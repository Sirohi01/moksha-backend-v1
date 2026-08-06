import { Schema, model, Document, Types } from "mongoose";

/** PRD §11.3 "auditLogs" / BR-08 — immutable record of every sensitive action. Write-only from
 * the application; no route ever updates or deletes an entry. */
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  at: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: Schema.Types.ObjectId, index: true },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  at: { type: Date, default: Date.now, index: true },
});

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
