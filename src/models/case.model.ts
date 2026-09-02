import { Schema, model, Document, Types } from "mongoose";
import { CaseStatus, CASE_STATUSES, CasePriority, CASE_PRIORITIES, VerificationStatus, VERIFICATION_STATUSES } from "../utils/constants";

/** PRD §11.4 "cases" — the operational record from verification to closure. §8.3 defines the
 * legal state transitions (CASE_STATUS_TRANSITIONS in constants.ts); this schema only stores the
 * current status, it never validates a transition itself — that's case.service.ts's job so the
 * rule is enforced in exactly one place regardless of which caller triggers it. totalExpense is
 * integer paise (PRD §11.1) — converted to rupees at the service layer's API boundary. */
export interface ICase extends Document {
  _id: Types.ObjectId;
  caseId: string;
  requestId: Types.ObjectId;
  status: CaseStatus;
  priority: CasePriority;
  caseManagerId?: Types.ObjectId;
  verification?: {
    outcome: VerificationStatus;
    method: "CALL" | "FIELD_VISIT" | "DOCUMENT" | "VERBAL_PENDING_DOCS";
    note: string;
    byUserId: Types.ObjectId;
    at: Date;
  };
  scheduledAt?: Date;
  completedAt?: Date;
  closedAt?: Date;
  closureNote?: string;
  cancellation?: {
    reason: string;
    byUserId: Types.ObjectId;
    at: Date;
  };
  totalExpense: number;
  documentCount: number;
  city: string;
  createdAt: Date;
  updatedAt: Date;
}

const caseSchema = new Schema<ICase>(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    requestId: { type: Schema.Types.ObjectId, ref: "AssistanceRequest", required: true, unique: true },
    status: { type: String, enum: CASE_STATUSES, default: "NEW", index: true },
    priority: { type: String, enum: CASE_PRIORITIES, default: "NORMAL" },
    caseManagerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    verification: {
      outcome: { type: String, enum: VERIFICATION_STATUSES },
      method: { type: String, enum: ["CALL", "FIELD_VISIT", "DOCUMENT", "VERBAL_PENDING_DOCS"] },
      note: { type: String },
      byUserId: { type: Schema.Types.ObjectId, ref: "User" },
      at: { type: Date },
    },
    scheduledAt: { type: Date },
    completedAt: { type: Date },
    closedAt: { type: Date },
    closureNote: { type: String, trim: true },
    cancellation: {
      reason: { type: String },
      byUserId: { type: Schema.Types.ObjectId, ref: "User" },
      at: { type: Date },
    },
    totalExpense: { type: Number, default: 0, validate: { validator: Number.isInteger, message: "totalExpense must be an integer (paise)" } },
    documentCount: { type: Number, default: 0 },
    // Denormalised from the request's location at case-creation time for fast queue filtering,
    // same trade-off the PRD itself documents for cases.cityId.
    city: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

caseSchema.index({ status: 1, priority: -1, createdAt: 1 });
caseSchema.index({ status: 1, updatedAt: 1 });

export const Case = model<ICase>("Case", caseSchema);
