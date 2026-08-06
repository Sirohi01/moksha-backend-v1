import { Schema, model, Document, Types } from "mongoose";

/** PRD §11.4 — the controlled vocabulary for CaseExpense.category, so expense reporting groups
 * consistently instead of accumulating free-text variants ("Transport" vs "transport" vs
 * "Travel"). CaseExpense still stores its own category name as a point-in-time snapshot (see
 * caseExpense.model.ts) — this collection is what a Case Manager picks from when submitting one,
 * not something every historical expense re-reads live. */
export interface IExpenseCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const ExpenseCategory = model<IExpenseCategory>("ExpenseCategory", expenseCategorySchema);
