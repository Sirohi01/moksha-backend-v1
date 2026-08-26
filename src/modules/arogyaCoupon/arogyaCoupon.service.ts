import { Types } from "mongoose";
import { ArogyaCoupon } from "../../models/arogyaCoupon.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";

interface CouponInput { code: string; discountPercent: number; applicableTo?: string; usageLimit?: number; status?: string }

export async function list(organisationId: string, status?: string) {
  return ArogyaCoupon.find({ organisationId, ...compactFilter({ status }) }).sort({ createdAt: -1 });
}
export async function create(organisationId: string, input: CouponInput) {
  const existing = await ArogyaCoupon.findOne({ organisationId, code: input.code.toUpperCase().trim() });
  if (existing) throw ApiError.conflict("A coupon with this code already exists");
  return ArogyaCoupon.create({ ...input, organisationId });
}
export async function update(organisationId: string, id: string, input: Partial<CouponInput>) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Coupon not found");
  const coupon = await ArogyaCoupon.findOneAndUpdate({ _id: id, organisationId }, input, { new: true, runValidators: true });
  if (!coupon) throw ApiError.notFound("Coupon not found");
  return coupon;
}
export async function remove(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Coupon not found");
  const coupon = await ArogyaCoupon.findOneAndDelete({ _id: id, organisationId });
  if (!coupon) throw ApiError.notFound("Coupon not found");
  return coupon;
}

/** Display-only: tells the client what discount a code WOULD give, so the UI can show it before
 * payment. Never used as the source of truth for the actual charge — see applyServerSideDiscount
 * below, which arogyaPayment.service.ts calls again, independently, at order-creation time. This
 * two-step design (validate-for-display, then re-check-and-apply-for-real) is the fix for the
 * legacy system's actual bug: it validated a coupon for display only and then trusted whatever
 * final amount the client sent to order creation, with nothing tying the two together. */
export async function validateForDisplay(organisationId: string, code: string, registrationType?: "single" | "group") {
  const coupon = await ArogyaCoupon.findOne({ organisationId, code: code.toUpperCase().trim() });
  if (!coupon) throw ApiError.notFound("Invalid coupon code");
  assertUsable(coupon, registrationType);
  return { code: coupon.code, discountPercent: coupon.discountPercent };
}

function assertUsable(coupon: { status: string; usedCount: number; usageLimit: number; applicableTo: string }, registrationType?: string) {
  if (coupon.status !== "available") throw ApiError.badRequest("This coupon is no longer active");
  if (coupon.usedCount >= coupon.usageLimit) throw ApiError.badRequest("This coupon has reached its usage limit");
  if (registrationType && coupon.applicableTo !== "both" && coupon.applicableTo !== registrationType) {
    throw ApiError.badRequest(`This coupon does not apply to ${registrationType} registrations`);
  }
}

/** The real, trusted discount computation — called once, server-side, when an order is actually
 * being created (never from a route the client controls the outcome of). Returns the percent to
 * apply; does NOT mark the coupon used yet (that happens only after payment is verified, in
 * markCouponUsed, so a coupon isn't consumed by an abandoned/failed payment attempt). */
export async function applyServerSideDiscount(
  organisationId: string,
  code: string | undefined,
  registrationType: "single" | "group"
): Promise<{ couponId: string; discountPercent: number } | null> {
  if (!code) return null;
  const coupon = await ArogyaCoupon.findOne({ organisationId, code: code.toUpperCase().trim() });
  if (!coupon) throw ApiError.badRequest("Invalid coupon code");
  assertUsable(coupon, registrationType);
  return { couponId: coupon._id.toString(), discountPercent: coupon.discountPercent };
}

export async function markCouponUsed(couponId: string, usedByEmail: string) {
  const coupon = await ArogyaCoupon.findById(couponId);
  if (!coupon) return; // best-effort — the payment itself already succeeded, don't fail the caller over this
  coupon.usedCount += 1;
  coupon.usedBy.push(usedByEmail);
  if (coupon.usedCount >= coupon.usageLimit) coupon.status = "used";
  await coupon.save();
}
