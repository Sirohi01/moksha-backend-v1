import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NamoAgsDelegate } from "../../../models/namoAgsDelegate.model";
import { NamoAgsPayment } from "../../../models/namoAgsPayment.model";
import { createDelegate } from "../../namoAgsDelegate/namoAgsDelegate.service";
import { cancelPayment, createPayment, getPayment, listPayments, updatePayment } from "../namoAgsPayment.service";

describe("scoped Namo Gange AGS payments", () => {
  let server: MongoMemoryServer;
  const namoId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    await NamoAgsDelegate.syncIndexes();
    await NamoAgsPayment.syncIndexes();
  });

  afterEach(async () => {
    await NamoAgsDelegate.deleteMany({});
    await NamoAgsPayment.deleteMany({});
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
  });

  async function makeDelegate(orgId: string) {
    const delegate = await createDelegate(orgId, { firstName: "Ramesh", mobile: "9876543210" }, userId);
    return delegate._id as unknown as string;
  }

  it("rejects a delegate that does not belong to the resolved organisation", async () => {
    const delegateId = await makeDelegate(otherId);
    await expect(
      createPayment(namoId, { agsDelegateId: delegateId, amount: 1500, paymentMode: "CASH" }, userId)
    ).rejects.toThrow("agsDelegateId does not match a delegate in this organisation");
  });

  it("generates a unique, atomically-sequenced registration number per payment", async () => {
    const delegateId = await makeDelegate(namoId);
    const p1 = await createPayment(namoId, { agsDelegateId: delegateId, amount: 1500, paymentMode: "CASH" }, userId);
    const p2 = await createPayment(namoId, { agsDelegateId: delegateId, amount: 2000, paymentMode: "PAYTM" }, userId);

    expect(p1.registrationNo).toMatch(/^AGS\/\d{4}\/\d{6}$/);
    expect(p2.registrationNo).not.toBe(p1.registrationNo);
  });

  it("cancel is idempotent and preserves the record instead of deleting it", async () => {
    const delegateId = await makeDelegate(namoId);
    const payment = await createPayment(namoId, { agsDelegateId: delegateId, amount: 1500, paymentMode: "CASH" }, userId);

    const cancelled = await cancelPayment(namoId, payment._id as unknown as string, userId);
    expect(cancelled.status).toBe("CANCELLED");
    await expect(cancelPayment(namoId, payment._id as unknown as string, userId)).resolves.toMatchObject({ status: "CANCELLED" });
    expect(await getPayment(namoId, payment._id as unknown as string)).toMatchObject({ status: "CANCELLED" });
  });

  it("refuses to edit a cancelled payment", async () => {
    const delegateId = await makeDelegate(namoId);
    const payment = await createPayment(namoId, { agsDelegateId: delegateId, amount: 1500, paymentMode: "CASH" }, userId);
    await cancelPayment(namoId, payment._id as unknown as string, userId);

    await expect(updatePayment(namoId, payment._id as unknown as string, { amount: 2000 }, userId))
      .rejects.toThrow("A cancelled payment cannot be edited");
  });

  it("isolates payments by server-resolved organisation id", async () => {
    const delegateId = await makeDelegate(namoId);
    await createPayment(namoId, { agsDelegateId: delegateId, amount: 1500, paymentMode: "CASH" }, userId);

    expect(await listPayments(namoId, {})).toHaveLength(1);
    expect(await listPayments(otherId, {})).toHaveLength(0);
  });

  it("masks the Aadhaar/PAN field instead of ever returning it in plaintext", async () => {
    const delegateId = await makeDelegate(namoId);
    const payment = await createPayment(
      namoId,
      { agsDelegateId: delegateId, amount: 1500, paymentMode: "CASH", aadharOrPanNo: "123456789012" },
      userId
    );
    const fetched = await getPayment(namoId, payment._id as unknown as string);
    expect(fetched.aadharOrPanNo).toBeUndefined();
    expect(fetched.aadharOrPanMasked).toBe("********9012");
  });
});
