import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export const NAMO_SUPPORT_GENDERS = ["Male", "Female", "Other"] as const;
export type NamoSupportGender = (typeof NAMO_SUPPORT_GENDERS)[number];

/** Namo Gange's real "General Support" form (POST /support/create) — see
 * Backend_Namo_Gange/src/models/support/SupportModel.js. `prefferedContribution` keeps the real
 * legacy field-name typo since it's the literal JSON key Support.tsx sends. */
export interface INamoSupportRequest extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  name: string;
  email: string;
  mobile: string;
  gender: NamoSupportGender;
  dob: Date;
  supportType: string;
  fullAddress: string;
  state: string;
  city: string;
  prefferedContribution: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoSupportRequest>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    gender: { type: String, enum: NAMO_SUPPORT_GENDERS, required: true },
    dob: { type: Date, required: true },
    supportType: { type: String, required: true, trim: true },
    fullAddress: { type: String, required: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    prefferedContribution: { type: String, required: true, trim: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

encryptFieldsOnSave(schema, ["email", "mobile", "fullAddress", "message"]);

export const NamoSupportRequest = model<INamoSupportRequest>("NamoSupportRequest", schema);
