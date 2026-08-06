import { Schema, model, Document, Types } from "mongoose";
import { ExpenseStatus, EXPENSE_STATUSES, PaymentMode, PAYMENT_MODES } from "../utils/constants";

/** PRD §11.4 "caseExpenses" / §7.7 — money spent on a case, with an approval workflow. BR:
 * submittedBy and approvedBy must differ, enforced in case.service.ts, not just trusted from the
 * client. An approved entry is immutable — corrections happen via a reversal record. amount is
 * integer paise (PRD §11.1) — converted to/from rupees at the service layer's API boundary. */
export interface ICaseExpense extends Document {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  categoryId: Types.ObjectId;
  category: string;
  amount: number;
  expenseDate: Date;
  paymentMode: PaymentMode;
  payeeName?: string;
  referenceNo?: string;
  status: ExpenseStatus;
  submittedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvalRemark?: string;
  approvedAt?: Date;
  reversalOf?: Types.ObjectId;
  createdAt: Date;
}

const caseExpenseSchema = new Schema<ICaseExpense>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    // Snapshot of the category's name at submission time — reporting/CSV exports read this
    // directly rather than joining ExpenseCategory, so a category rename later doesn't rewrite
    // history (same pattern as Receipt.panUsed).
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "amount must be an integer (paise)" } },
    expenseDate: { type: Date, required: true },
    paymentMode: { type: String, enum: PAYMENT_MODES, required: true },
    payeeName: { type: String, trim: true },
    referenceNo: { type: String, trim: true },
    status: { type: String, enum: EXPENSE_STATUSES, default: "SUBMITTED", index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvalRemark: { type: String, trim: true },
    approvedAt: { type: Date },
    reversalOf: { type: Schema.Types.ObjectId, ref: "CaseExpense" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CaseExpense = model<ICaseExpense>("CaseExpense", caseExpenseSchema);
