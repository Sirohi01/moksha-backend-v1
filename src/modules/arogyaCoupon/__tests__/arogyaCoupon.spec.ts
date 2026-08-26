import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ArogyaCoupon } from "../../../models/arogyaCoupon.model";
import { applyServerSideDiscount, create, markCouponUsed, validateForDisplay } from "../arogyaCoupon.service";

describe("Arogya coupon — server-side trust boundary", () => {
  let server: MongoMemoryServer;
  const orgId = new Types.ObjectId().toString();

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
  });
  afterEach(async () => ArogyaCoupon.deleteMany({}));
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); });

  it("rejects an unknown code", async () => {
    await expect(validateForDisplay(orgId, "NOPE", "single")).rejects.toThrow("Invalid coupon code");
  });

  it("rejects a code once its usage limit is reached (markCouponUsed flips status to 'used')", async () => {
    await create(orgId, { code: "ONEUSE", discountPercent: 10, usageLimit: 1 });
    const coupon = await ArogyaCoupon.findOne({ organisationId: orgId, code: "ONEUSE" });
    await markCouponUsed(coupon!._id.toString(), "someone@example.test");
    // markCouponUsed already flipped status to "used", so that guard fires first — the separate
    // usageLimit check in assertUsable is defensive for the case status and usedCount ever
    // disagree (e.g. an admin manually resets status without resetting usedCount).
    await expect(validateForDisplay(orgId, "ONEUSE", "single")).rejects.toThrow("no longer active");
  });

  it("the usageLimit guard fires independently of status, if the two ever disagree", async () => {
    const coupon = await create(orgId, { code: "DESYNCED", discountPercent: 10, usageLimit: 1 });
    await ArogyaCoupon.updateOne({ _id: coupon._id }, { usedCount: 1, status: "available" });
    await expect(validateForDisplay(orgId, "DESYNCED", "single")).rejects.toThrow("reached its usage limit");
  });

  it("rejects a coupon not applicable to the requested registration type", async () => {
    await create(orgId, { code: "GROUPONLY", discountPercent: 15, applicableTo: "group" });
    await expect(validateForDisplay(orgId, "GROUPONLY", "single")).rejects.toThrow("does not apply to single");
    await expect(validateForDisplay(orgId, "GROUPONLY", "group")).resolves.toMatchObject({ discountPercent: 15 });
  });

  it("applyServerSideDiscount returns null for no code, and never trusts a discount value from the caller", async () => {
    await expect(applyServerSideDiscount(orgId, undefined, "single")).resolves.toBeNull();

    await create(orgId, { code: "REAL10", discountPercent: 10 });
    const result = await applyServerSideDiscount(orgId, "real10", "single"); // case-insensitive, matches legacy behaviour
    expect(result?.discountPercent).toBe(10);
  });

  it("markCouponUsed flips status to used once the usage limit is hit, not before", async () => {
    await create(orgId, { code: "TWOUSE", discountPercent: 5, usageLimit: 2 });
    const coupon = await ArogyaCoupon.findOne({ organisationId: orgId, code: "TWOUSE" });
    await markCouponUsed(coupon!._id.toString(), "a@example.test");
    expect((await ArogyaCoupon.findById(coupon!._id))!.status).toBe("available");
    await markCouponUsed(coupon!._id.toString(), "b@example.test");
    expect((await ArogyaCoupon.findById(coupon!._id))!.status).toBe("used");
  });
});
