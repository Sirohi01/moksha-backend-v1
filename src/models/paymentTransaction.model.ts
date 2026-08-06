import { Schema, model, Document, Types } from "mongoose";
import { PaymentGatewayStatus, PAYMENT_GATEWAY_STATUSES } from "../utils/constants";

/** PRD §11.4 "paymentTransactions" — the gateway-facing record, kept separate from Donation so a
 * failed attempt can be retried without mutating the donation's own identity/history (a donation
 * can have more than one transaction attempt behind it). amount is integer paise (PRD §11.1),
 * which also happens to be Razorpay's own native unit — no conversion needed when talking to
 * Razorpay, only at this app's own API boundary. */
export interface IPaymentTransaction extends Document {
  _id: Types.ObjectId;
  donationId: Types.ObjectId;
  gateway: "RAZORPAY";
  orderId?: string;
  subscriptionId?: string;
  paymentId?: string;
  signature?: string;
  amount: number;
  currency: string;
  status: PaymentGatewayStatus;
  createdAt: Date;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    donationId: { type: Schema.Types.ObjectId, ref: "Donation", required: true, index: true },
    gateway: { type: String, enum: ["RAZORPAY"], default: "RAZORPAY" },
    orderId: { type: String, index: true },
    subscriptionId: { type: String, index: true },
    paymentId: { type: String },
    signature: { type: String },
    amount: { type: Number, required: true, validate: { validator: Number.isInteger, message: "amount must be an integer (paise)" } },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: PAYMENT_GATEWAY_STATUSES, default: "created" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PaymentTransaction = model<IPaymentTransaction>("PaymentTransaction", paymentTransactionSchema);
