import { Schema, model, Document, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

/** PRD §11.4 "donors" — a donor's identity, separate from any single donation, so a returning
 * donor's giving history accumulates in one place. Donations are guest-checkout (no login
 * required), so this is deduplicated by email at creation time, not tied to a User account.
 * email/phone are the lookup keys used for that dedup and for the self-service "my donations"
 * match against a logged-in DONOR user's email — never encrypted, same documented constraint as
 * every other exact-match field in this codebase. pan is encrypted (sensitive tax ID).
 * totalDonated is integer paise (PRD §11.1) — converted to rupees at the API boundary. */
export interface IDonor extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  pan?: string;
  totalDonated: number;
  createdAt: Date;
  updatedAt: Date;
}

const donorSchema = new Schema<IDonor>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    phone: { type: String, trim: true },
    pan: { type: String },
    totalDonated: { type: Number, default: 0, validate: { validator: Number.isInteger, message: "totalDonated must be an integer (paise)" } },
  },
  { timestamps: true }
);

encryptFieldsOnSave(donorSchema, ["pan"]);

export const Donor = model<IDonor>("Donor", donorSchema);
