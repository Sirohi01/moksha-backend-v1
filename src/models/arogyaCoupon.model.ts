import { Schema, model, Document, Types } from "mongoose";

export const AROGYA_COUPON_APPLICABLE_TO = ["single", "group", "both"] as const;
export type ArogyaCouponApplicableTo = (typeof AROGYA_COUPON_APPLICABLE_TO)[number];
export const AROGYA_COUPON_STATUSES = ["available", "used", "inactive"] as const;
export type ArogyaCouponStatus = (typeof AROGYA_COUPON_STATUSES)[number];

/** The legacy Coupon (backend-arogya/models/coupon/Coupon.js) is preserved field-for-field, but
 * the CRITICAL difference is in how it's used: the legacy checkout flow validated a coupon for
 * *display* purposes only and then trusted whatever final `amount` the client sent to order
 * creation — nothing tied the two together server-side (confirmed by full-code audit). Here,
 * `discountPercent` is read fresh from this record and the discount is recomputed server-side at
 * order-creation time (arogyaPayment.service.ts), never taken from the client's own math. */
export interface IArogyaCoupon extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  code: string;
  discountPercent: number;
  applicableTo: ArogyaCouponApplicableTo;
  status: ArogyaCouponStatus;
  usageLimit: number;
  usedCount: number;
  usedBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IArogyaCoupon>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    applicableTo: { type: String, enum: AROGYA_COUPON_APPLICABLE_TO, default: "both" },
    status: { type: String, enum: AROGYA_COUPON_STATUSES, default: "available", index: true },
    usageLimit: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    usedBy: { type: [String], default: [] },
  },
  { timestamps: true }
);
schema.index({ organisationId: 1, code: 1 }, { unique: true });
schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

export const ArogyaCoupon = model<IArogyaCoupon>("ArogyaCoupon", schema);
