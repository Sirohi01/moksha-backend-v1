import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export const NAMO_DONATION_LEAD_GENDERS = ["Male", "Female", "Other", ""] as const;
export type NamoDonationLeadGender = (typeof NAMO_DONATION_LEAD_GENDERS)[number];

/** Namo Gange's real donation form (POST /donations, submitted from the /donate page) — see
 * Backend_Namo_Gange/src/models/donation/DonationModel.js. This is a pledge/lead record only —
 * the legacy model has no Razorpay/payment-gateway linkage of any kind, confirmed from source, so
 * this is intentionally not wired into Moksha's own donation-payment flow (which is a real,
 * separate, org-scoped Donation model with actual gateway integration). If Namo Gange ever wants
 * real online payment for donations, that is a materially bigger, separate task (see
 * UNIFIED_PLATFORM_STATE.md §F "NAMOGANGE_RAZORPAY_* — nothing to migrate, needed only if/when
 * Namo Gange gets real online payment"), not something to bolt onto this lead record. */
export interface INamoDonationLead extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  fullName: string;
  email: string;
  phone: string;
  gender?: NamoDonationLeadGender;
  country: string;
  state: string;
  city: string;
  address: string;
  sewaType: string;
  donationPackage: string;
  amount: number;
  pan?: string;
  message?: string;
  anonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoDonationLead>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    gender: { type: String, enum: NAMO_DONATION_LEAD_GENDERS, default: "" },
    country: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    sewaType: { type: String, required: true, trim: true },
    donationPackage: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    pan: String,
    message: String,
    anonymous: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

encryptFieldsOnSave(schema, ["email", "phone", "address", "pan"]);

export const NamoDonationLead = model<INamoDonationLead>("NamoDonationLead", schema);
