import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ArogyaPass } from "../../../models/arogyaPass.model";
import { ArogyaCoupon } from "../../../models/arogyaCoupon.model";
import { ArogyaPayment } from "../../../models/arogyaPayment.model";
import { ArogyaDelegateRegistration } from "../../../models/arogyaDelegateRegistration.model";
import { adminCreateOfflineGroup, adminCreateOfflineSingle } from "../arogyaDelegateRegistration.service";

describe("Arogya admin offline registration — cash/cheque delegates recorded without Razorpay", () => {
  let server: MongoMemoryServer;
  const orgId = new Types.ObjectId().toString();
  const adminUserId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
  });
  afterEach(async () => {
    await ArogyaPass.deleteMany({});
    await ArogyaCoupon.deleteMany({});
    await ArogyaPayment.deleteMany({});
    await ArogyaDelegateRegistration.deleteMany({});
  });
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  it("records a single offline registration with a server-computed amount, no OTP required", async () => {
    const pass = await ArogyaPass.create({ organisationId: orgId, name: "Delegate Pass", price: 1500, applicableTo: "both" });
    const registration = await adminCreateOfflineSingle(orgId, adminUserId, {
      passId: pass._id.toString(), selectedDays: [1, 2], paymentMode: "CASH", note: "collected at venue",
      form: { fullName: "Test Delegate", email: "test.delegate@example.com", mobile: "9999999999" },
    });
    expect(registration.amountPaise).toBe(1500 * 2 * 100);
    expect(registration.registrationType).toBe("single");

    const payment = await ArogyaPayment.findOne({ delegateRegistrationId: registration._id });
    expect(payment).not.toBeNull();
    expect(payment!.gateway).toBe("OFFLINE");
    expect(payment!.status).toBe("PAID");
    expect(payment!.paymentMode).toBe("CASH");
    expect(payment!.recordedBy!.toString()).toBe(adminUserId);
  });

  it("records a group offline registration, splitting amount onto the primary only, and consumes the coupon", async () => {
    const pass = await ArogyaPass.create({ organisationId: orgId, name: "Group Pass", price: 1000, applicableTo: "group" });
    await ArogyaCoupon.create({ organisationId: orgId, code: "GROUP10", discountPercent: 10, applicableTo: "group", usageLimit: 5 });

    const registrations = await adminCreateOfflineGroup(orgId, adminUserId, {
      passId: pass._id.toString(), selectedDays: [1], couponCode: "GROUP10", paymentMode: "NEFT_RTGS",
      groupSize: 3,
      primary: { fullName: "Primary Delegate", email: "primary@example.com", mobile: "8888888888" },
      members: [
        { fullName: "Member One", email: "member1@example.com", mobile: "7777777777" },
        { fullName: "Member Two", email: "member2@example.com", mobile: "6666666666" },
      ],
    });

    expect(registrations).toHaveLength(3);
    const [primary, ...members] = registrations;
    // 1000 * 1 day * 3 people = 3000, minus 10% = 2700
    expect(primary.amountPaise).toBe(2700 * 100);
    for (const member of members) expect(member.amountPaise).toBe(0);

    const coupon = await ArogyaCoupon.findOne({ code: "GROUP10" });
    expect(coupon!.usedCount).toBe(1);
  });

  it("rejects offline registration for a pass that doesn't exist", async () => {
    await expect(
      adminCreateOfflineSingle(orgId, adminUserId, {
        passId: new Types.ObjectId().toString(), selectedDays: [1], paymentMode: "CASH",
        form: { fullName: "X", email: "x@example.com", mobile: "1234567890" },
      })
    ).rejects.toThrow("Selected pass is not available");
  });
});
