import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

/** The legacy system had no payment gateway of any kind for AGS (confirmed by full-code audit —
 * no Razorpay, no order/webhook, nothing) — every "payment" here is a manual ledger entry a staff
 * member records after receiving cash/cheque/UPI/bank transfer, not an online transaction. This
 * model preserves that real behaviour rather than inventing a gateway integration that never
 * existed; if AGS gains real online payment later, it belongs in the shared finance_ledger design
 * (architecture audit §Finance), not bolted onto this record. */
export const AGS_PAYMENT_MODES = ["CASH", "CHEQUE", "PAYTM", "NEFT_RTGS", "PAYMENT_GATEWAY"] as const;
export type AgsPaymentMode = (typeof AGS_PAYMENT_MODES)[number];

export const AGS_PAYMENT_STATUSES = ["ACTIVE", "CANCELLED"] as const;
export type AgsPaymentStatus = (typeof AGS_PAYMENT_STATUSES)[number];

export interface INamoAgsPayment extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  agsDelegateId: Types.ObjectId;
  registrationNo: string;
  paymentFor?: string;
  seminarDay?: string;
  aadharOrPanNo?: string;
  amount: number;
  paymentMode: AgsPaymentMode;
  bankName?: string;
  chequeNo?: string;
  dateOfIssue?: Date;
  branch?: string;
  paytmNo?: string;
  upiId?: string;
  transactionId?: string;
  bankReferenceNo?: string;
  orderNo?: string;
  status: AgsPaymentStatus;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoAgsPayment>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    // Replaces the legacy `client_id` field, which referenced a Mongoose model named "Client"
    // that did not exist anywhere in that codebase — a dangling ref that silently failed to
    // populate. This points at the real delegate record.
    agsDelegateId: { type: Schema.Types.ObjectId, ref: "NamoAgsDelegate", required: true, index: true },
    registrationNo: { type: String, required: true, unique: true, index: true },
    paymentFor: { type: String, trim: true },
    seminarDay: { type: String, trim: true },
    aadharOrPanNo: { type: String, select: false },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: AGS_PAYMENT_MODES, required: true },
    bankName: { type: String, trim: true },
    chequeNo: { type: String, trim: true },
    dateOfIssue: Date,
    branch: { type: String, trim: true },
    paytmNo: { type: String, trim: true },
    upiId: { type: String, trim: true },
    transactionId: { type: String, trim: true },
    bankReferenceNo: { type: String, trim: true },
    orderNo: { type: String, trim: true },
    status: { type: String, enum: AGS_PAYMENT_STATUSES, default: "ACTIVE", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

encryptFieldsOnSave(schema, ["aadharOrPanNo"]);

export const NamoAgsPayment = model<INamoAgsPayment>("NamoAgsPayment", schema);
