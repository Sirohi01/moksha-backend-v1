import crypto from "crypto";
import { Schema, model, Document, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export const AROGYA_REGISTRATION_TYPES = ["single", "group"] as const;
export type ArogyaRegistrationType = (typeof AROGYA_REGISTRATION_TYPES)[number];

/** Preserves every legacy field (see migration-tools/arogya-delegates-field-map.md) but fixes the
 * two confirmed-from-code trust gaps: `price` is a Number resolved server-side from the linked
 * pass/payment, never a client-supplied string; and this record can only be created once a linked
 * `ArogyaPayment` already has status PAID (see arogyaDelegateRegistration.service.ts) — there is
 * no path to a registration existing without a verified payment behind it, unlike the legacy
 * system where the two were unlinked. */
export interface IArogyaDelegateRegistration extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  delegateCode: string;
  groupId?: string;
  isGroupPrimary: boolean;
  title?: string;
  fullName: string;
  email: string;
  emailHash: string;
  mobile: string;
  mobileHash: string;
  whatsappNumber?: string;
  designation?: string;
  organization?: string;
  country?: string;
  state?: string;
  city?: string;
  industryType?: string;
  areasOfInterest?: string;
  source?: string;
  registrationType: ArogyaRegistrationType;
  passId: Types.ObjectId;
  passName: string;
  amountPaise: number;
  selectedDays: number[];
  couponId?: Types.ObjectId;
  couponCode?: string;
  paymentId: Types.ObjectId;
  isSpeaker: boolean;
  dietary?: string;
  assistance?: string;
  documentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const hash = (value: string) => crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

const schema = new Schema<IArogyaDelegateRegistration>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    delegateCode: { type: String, required: true, unique: true, index: true },
    groupId: { type: String, index: true },
    isGroupPrimary: { type: Boolean, default: true },
    title: String,
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true },
    emailHash: { type: String, required: true, select: false },
    mobile: { type: String, required: true },
    mobileHash: { type: String, required: true, select: false },
    whatsappNumber: String,
    designation: String,
    organization: String,
    country: String,
    state: String,
    city: String,
    industryType: String,
    areasOfInterest: String,
    source: String,
    registrationType: { type: String, enum: AROGYA_REGISTRATION_TYPES, required: true },
    passId: { type: Schema.Types.ObjectId, ref: "ArogyaPass", required: true },
    passName: { type: String, required: true },
    amountPaise: { type: Number, required: true, min: 0 },
    selectedDays: { type: [Number], default: [] },
    couponId: { type: Schema.Types.ObjectId, ref: "ArogyaCoupon" },
    couponCode: String,
    paymentId: { type: Schema.Types.ObjectId, ref: "ArogyaPayment", required: true, index: true },
    isSpeaker: { type: Boolean, default: false },
    dietary: String,
    assistance: String,
    documentUrl: String,
  },
  { timestamps: true }
);

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

schema.pre("validate", function (next) {
  if (this.isModified("email")) this.emailHash = hash(this.email);
  if (this.isModified("mobile")) this.mobileHash = hash(this.mobile.replace(/\D/g, ""));
  next();
});

encryptFieldsOnSave(schema, ["email", "mobile", "whatsappNumber", "documentUrl"]);

export const ArogyaDelegateRegistration = model<IArogyaDelegateRegistration>("ArogyaDelegateRegistration", schema);
