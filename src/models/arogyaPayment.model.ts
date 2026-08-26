import { Schema, model, Document, Types } from "mongoose";

export const AROGYA_PAYMENT_STATUSES = ["CREATED", "PAID", "FAILED"] as const;
export type ArogyaPaymentStatus = (typeof AROGYA_PAYMENT_STATUSES)[number];
export const AROGYA_PAYMENT_MODES = ["CASH", "CHEQUE", "PAYTM", "NEFT_RTGS", "OTHER"] as const;
export type ArogyaPaymentMode = (typeof AROGYA_PAYMENT_MODES)[number];

export interface IArogyaPayment extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  gateway: "RAZORPAY" | "OFFLINE";
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  amountPaise: number;
  currency: string;
  status: ArogyaPaymentStatus;
  passId: Types.ObjectId;
  selectedDays: number[];
  registrationType: "single" | "group";
  groupSize: number;
  couponId?: Types.ObjectId;
  couponCode?: string;
  delegateRegistrationId?: Types.ObjectId;
  paymentMode?: ArogyaPaymentMode;
  note?: string;
  recordedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IArogyaPayment>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    gateway: { type: String, enum: ["RAZORPAY", "OFFLINE"], default: "RAZORPAY" },
    gatewayOrderId: { type: String, required: true, unique: true, index: true },
    gatewayPaymentId: { type: String, index: true },
    gatewaySignature: String,
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: AROGYA_PAYMENT_STATUSES, default: "CREATED", index: true },
    passId: { type: Schema.Types.ObjectId, ref: "ArogyaPass", required: true },
    selectedDays: { type: [Number], default: [] },
    registrationType: { type: String, enum: ["single", "group"], required: true },
    groupSize: { type: Number, default: 1, min: 1 },
    couponId: { type: Schema.Types.ObjectId, ref: "ArogyaCoupon" },
    couponCode: String,
    delegateRegistrationId: { type: Schema.Types.ObjectId, ref: "ArogyaDelegateRegistration", default: null, index: true },
    paymentMode: { type: String, enum: AROGYA_PAYMENT_MODES },
    note: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const ArogyaPayment = model<IArogyaPayment>("ArogyaPayment", schema);
