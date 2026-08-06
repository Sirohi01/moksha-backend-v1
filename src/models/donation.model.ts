import { Schema, model, Document, Types } from "mongoose";
import { DonationCause, DONATION_CAUSES, NewDonationType, NEW_DONATION_TYPES, NewDonationStatus, NEW_DONATION_STATUSES } from "../utils/constants";

/** PRD §11.4 "donations" — one contribution. Donor identity (name/email/phone/pan) now lives on
 * Donor, referenced here rather than duplicated per-donation; the gateway interaction itself
 * lives on PaymentTransaction (a donation can have more than one attempt behind it). amount is
 * integer paise (PRD §11.1) — converted to/from rupees at the service layer's API boundary. */
export interface IDonation extends Document {
  _id: Types.ObjectId;
  donorId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  cause: DonationCause;
  type: NewDonationType;
  amount: number;
  currency: string;
  status: NewDonationStatus;
  isAnonymous: boolean;
  dedication?: string;
  recurringDonationId?: Types.ObjectId;
  receiptId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const donationSchema = new Schema<IDonation>(
  {
    donorId: { type: Schema.Types.ObjectId, ref: "Donor", required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", index: true },
    cause: { type: String, enum: DONATION_CAUSES, default: "general" },
    type: { type: String, enum: NEW_DONATION_TYPES, default: "ONE_TIME" },
    amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "amount must be an integer (paise)" } },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: NEW_DONATION_STATUSES, default: "PENDING", index: true },
    isAnonymous: { type: Boolean, default: false },
    dedication: { type: String, trim: true },
    recurringDonationId: { type: Schema.Types.ObjectId, ref: "RecurringDonation" },
    receiptId: { type: Schema.Types.ObjectId, ref: "Receipt" },
  },
  { timestamps: true }
);

export const Donation = model<IDonation>("Donation", donationSchema);
