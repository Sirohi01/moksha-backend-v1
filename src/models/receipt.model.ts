import { Schema, model, Document, Types } from "mongoose";
import { ReceiptStatus, RECEIPT_STATUSES } from "../utils/constants";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

/** PRD §11.4 "receipts" — every successful donation gets one unconditionally (FR-DON-06); it is
 * NOT gated on the organisation's 80G registration. is80GEligible is a snapshot of whether
 * Setting.organisation.exemptionRef was configured at issuance time (FR-DON-08) — a separate flag
 * on an otherwise-always-issued receipt, not a precondition for issuing it at all. panUsed is
 * likewise a snapshot of whichever PAN was on file at issuance time, not a live reference.
 * amount is integer paise (PRD §11.1) — converted to rupees when the receipt is rendered. */
export interface IReceipt extends Document {
  _id: Types.ObjectId;
  receiptNo: string;
  donationId: Types.ObjectId;
  donorId: Types.ObjectId;
  amount: number;
  panUsed?: string;
  is80GEligible: boolean;
  status: ReceiptStatus;
  issuedAt: Date;
}

const receiptSchema = new Schema<IReceipt>({
  receiptNo: { type: String, required: true, unique: true, index: true },
  donationId: { type: Schema.Types.ObjectId, ref: "Donation", required: true, unique: true },
  donorId: { type: Schema.Types.ObjectId, ref: "Donor", required: true, index: true },
  amount: { type: Number, required: true, validate: { validator: Number.isInteger, message: "amount must be an integer (paise)" } },
  panUsed: { type: String },
  is80GEligible: { type: Boolean, default: false },
  status: { type: String, enum: RECEIPT_STATUSES, default: "ISSUED" },
  issuedAt: { type: Date, default: Date.now },
});

encryptFieldsOnSave(receiptSchema, ["panUsed"]);

export const Receipt = model<IReceipt>("Receipt", receiptSchema);
