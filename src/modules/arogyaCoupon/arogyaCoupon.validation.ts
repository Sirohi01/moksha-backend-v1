import { z } from "zod";
import { AROGYA_COUPON_APPLICABLE_TO, AROGYA_COUPON_STATUSES } from "../../models/arogyaCoupon.model";

const body = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Coupon code may only contain letters, numbers, - and _"),
  discountPercent: z.coerce.number().int().min(1).max(100),
  applicableTo: z.enum(AROGYA_COUPON_APPLICABLE_TO).default("both"),
  usageLimit: z.coerce.number().int().min(1).default(1),
  status: z.enum(AROGYA_COUPON_STATUSES).default("available"),
});

export const createArogyaCouponSchema = z.object({ body });
export const updateArogyaCouponSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: body.omit({ code: true }).partial(),
});
export const listArogyaCouponsSchema = z.object({ query: z.object({ status: z.enum(AROGYA_COUPON_STATUSES).optional() }) });
export const validateArogyaCouponSchema = z.object({
  body: z.object({
    code: z.string().trim().min(1).max(30),
    registrationType: z.enum(["single", "group"]).optional(),
  }),
});
