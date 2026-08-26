import { Schema, model, Document, Types } from "mongoose";

export const AROGYA_PASS_APPLICABLE_TO = ["both", "single", "group"] as const;
export type ArogyaPassApplicableTo = (typeof AROGYA_PASS_APPLICABLE_TO)[number];
export const AROGYA_PASS_STATUSES = ["active", "inactive"] as const;
export type ArogyaPassStatus = (typeof AROGYA_PASS_STATUSES)[number];

export interface IArogyaPass extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  name: string;
  price: number;
  daysText: string;
  applicableTo: ArogyaPassApplicableTo;
  includes: string[];
  isMostPopular: boolean;
  status: ArogyaPassStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IArogyaPass>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    daysText: { type: String, default: "1 Day", trim: true },
    applicableTo: { type: String, enum: AROGYA_PASS_APPLICABLE_TO, default: "both" },
    includes: { type: [String], default: [] },
    isMostPopular: { type: Boolean, default: false },
    status: { type: String, enum: AROGYA_PASS_STATUSES, default: "active", index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

export const ArogyaPass = model<IArogyaPass>("ArogyaPass", schema);
