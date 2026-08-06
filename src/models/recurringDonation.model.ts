import { Schema, model, Document, Types } from "mongoose";
import { SubscriptionStatus, SUBSCRIPTION_STATUSES, DonationCause, DONATION_CAUSES } from "../utils/constants";

/** PRD §11.4 "recurringDonations" — one Razorpay Subscription. Donation amounts here are
 * donor-chosen (not fixed like a typical SaaS plan), so a dedicated Razorpay Plan is created
 * per subscription at signup time rather than reusing a shared catalog of plans. amount is
 * integer paise (PRD §11.1) — converted to/from rupees at the service layer's API boundary. */
export interface IRecurringDonation extends Document {
  _id: Types.ObjectId;
  donorId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  cause: DonationCause;
  amount: number;
  razorpayPlanId: string;
  razorpaySubscriptionId: string;
  status: SubscriptionStatus;
  startedAt: Date;
  lastChargedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
}

const recurringDonationSchema = new Schema<IRecurringDonation>(
  {
    donorId: { type: Schema.Types.ObjectId, ref: "Donor", required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign" },
    cause: { type: String, enum: DONATION_CAUSES, default: "general" },
    amount: {
      type: Number,
      required: true,
      min: 5000, // ₹50 minimum, in paise
      validate: { validator: Number.isInteger, message: "amount must be an integer (paise)" },
    },
    razorpayPlanId: { type: String, required: true },
    razorpaySubscriptionId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "ACTIVE", index: true },
    startedAt: { type: Date, default: Date.now },
    lastChargedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const RecurringDonation = model<IRecurringDonation>("RecurringDonation", recurringDonationSchema);
