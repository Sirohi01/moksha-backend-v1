import { Schema, model, Document, Types } from "mongoose";

export const AROGYA_CATEGORY_TYPES = ["single", "group", "both"] as const;
export type ArogyaCategoryType = (typeof AROGYA_CATEGORY_TYPES)[number];

/** Industry/interest category options offered on the Arogya delegate registration form
 * (backend-arogya/models/delegate/Category.js — `type` distinguishes which registration flow the
 * option applies to, not a taxonomy of the category's own subject matter). */
export interface IArogyaCategory extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  name: string;
  type: ArogyaCategoryType;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IArogyaCategory>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: AROGYA_CATEGORY_TYPES, required: true, lowercase: true },
  },
  { timestamps: true }
);
schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

export const ArogyaCategory = model<IArogyaCategory>("ArogyaCategory", schema);
