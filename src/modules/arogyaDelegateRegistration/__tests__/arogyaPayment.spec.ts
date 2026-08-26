import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ArogyaPass } from "../../../models/arogyaPass.model";
import { ArogyaCoupon } from "../../../models/arogyaCoupon.model";
import { ArogyaPayment } from "../../../models/arogyaPayment.model";
import { computeAmountPaise, getPaidUnlinkedPayment, verifyPayment } from "../arogyaPayment.service";
import * as integrationConfig from "../../../lib/integrationConfig.service";

describe("Arogya payment — server-side amount and signature trust boundary", () => {
  let server: MongoMemoryServer;
  const orgId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
  });
  afterEach(async () => {
    await ArogyaPass.deleteMany({});
    await ArogyaCoupon.deleteMany({});
    await ArogyaPayment.deleteMany({});
    jest.restoreAllMocks();
  });
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  it("computes the amount from the pass price and day count — never from client input", async () => {
    const pass = await ArogyaPass.create({ organisationId: orgId, name: "Delegate Pass", price: 1500, applicableTo: "both" });
    const result = await computeAmountPaise(orgId, {
      passId: pass._id.toString(), selectedDays: [1, 2], registrationType: "single",
    });
    expect(result.amountPaise).toBe(1500 * 2 * 100); // 2 days, single -> no group multiplier
  });

  it("applies the group multiplier and the coupon's real stored discount, not a client-supplied one", async () => {
    const pass = await ArogyaPass.create({ organisationId: orgId, name: "Group Pass", price: 1000, applicableTo: "group" });
    await ArogyaCoupon.create({ organisationId: orgId, code: "SAVE20", discountPercent: 20, applicableTo: "group" });

    const result = await computeAmountPaise(orgId, {
      passId: pass._id.toString(), selectedDays: [1], registrationType: "group", groupSize: 3, couponCode: "save20",
    });
    // 1000 * 1 day * 3 people = 3000, minus 20% = 2400
    expect(result.amountPaise).toBe(2400 * 100);
  });

  it("rejects an inactive or unknown pass rather than silently pricing at 0", async () => {
    await expect(
      computeAmountPaise(orgId, { passId: new Types.ObjectId().toString(), selectedDays: [1], registrationType: "single" })
    ).rejects.toThrow("Selected pass is not available");
  });

  it("verifyPayment rejects a forged signature and marks the payment FAILED", async () => {
    jest.spyOn(integrationConfig, "resolveRazorpayConfig").mockReturnValue({
      keyId: "test_key", keySecret: "test_secret", webhookSecret: "test_webhook",
    });
    const pass = await ArogyaPass.create({ organisationId: orgId, name: "Pass", price: 500 });
    const payment = await ArogyaPayment.create({
      organisationId: orgId, gatewayOrderId: "order_fake_1", amountPaise: 50000, status: "CREATED",
      passId: pass._id, registrationType: "single",
    });

    await expect(
      verifyPayment("AROGYA", { orderId: "order_fake_1", paymentId: "pay_fake", signature: "not-the-real-signature" })
    ).rejects.toThrow("Payment verification failed");

    expect((await ArogyaPayment.findById(payment._id))!.status).toBe("FAILED");
  });

  it("verifyPayment accepts a correctly-signed payload and is idempotent on replay", async () => {
    jest.spyOn(integrationConfig, "resolveRazorpayConfig").mockReturnValue({
      keyId: "test_key", keySecret: "test_secret", webhookSecret: "test_webhook",
    });
    const pass = await ArogyaPass.create({ organisationId: orgId, name: "Pass", price: 500 });
    await ArogyaPayment.create({
      organisationId: orgId, gatewayOrderId: "order_fake_2", amountPaise: 50000, status: "CREATED",
      passId: pass._id, registrationType: "single",
    });
    const validSignature = crypto.createHmac("sha256", "test_secret").update("order_fake_2|pay_real").digest("hex");

    const first = await verifyPayment("AROGYA", { orderId: "order_fake_2", paymentId: "pay_real", signature: validSignature });
    const second = await verifyPayment("AROGYA", { orderId: "order_fake_2", paymentId: "pay_real", signature: validSignature });
    expect(first.paymentRecordId).toBe(second.paymentRecordId);
  });

  it("getPaidUnlinkedPayment refuses a payment that isn't PAID yet, and one already used by another registration", async () => {
    const pass = await ArogyaPass.create({ organisationId: orgId, name: "Pass", price: 500 });
    const unpaid = await ArogyaPayment.create({
      organisationId: orgId, gatewayOrderId: "order_unpaid", amountPaise: 50000, status: "CREATED",
      passId: pass._id, registrationType: "single",
    });
    await expect(getPaidUnlinkedPayment(orgId, unpaid._id.toString())).rejects.toThrow("has not been completed");

    const alreadyLinked = await ArogyaPayment.create({
      organisationId: orgId, gatewayOrderId: "order_used", amountPaise: 50000, status: "PAID",
      passId: pass._id, registrationType: "single", delegateRegistrationId: new Types.ObjectId(),
    });
    await expect(getPaidUnlinkedPayment(orgId, alreadyLinked._id.toString())).rejects.toThrow("already been used");
  });
});
