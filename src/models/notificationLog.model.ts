import { Schema, model, Document, Types } from "mongoose";
import { NotificationChannel, NOTIFICATION_CHANNELS, NotificationCategory, NOTIFICATION_CATEGORIES, NotificationStatus, NOTIFICATION_STATUSES } from "../utils/constants";

/** PRD §11.4 "notificationLogs" — a delivery record for every notify() call, success or failure.
 * Never blocks the caller (same fire-and-forget discipline as AuditLog). The identity of a send
 * (who/what/when it was first triggered) never changes once written — but unlike AuditLog, a
 * single row's delivery *status* legitimately mutates while notificationQueue.service.ts retries
 * it (QUEUED/FAILED -> SENT, attempts incrementing), the same way any job-queue row would. */
export interface INotificationLog extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  phone?: string;
  email?: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  templateKey: string;
  variables?: Record<string, string>;
  status: NotificationStatus;
  error?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    phone: { type: String },
    email: { type: String },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    templateKey: { type: String, required: true, index: true },
    // Kept so a later retry (potentially minutes/hours after the original request context is
    // long gone) can re-render the template from scratch rather than resending stale content.
    variables: { type: Schema.Types.Mixed },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "QUEUED" },
    error: { type: String },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextRetryAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// The queue processor's core query: "what's due for (re)send right now".
notificationLogSchema.index({ status: 1, nextRetryAt: 1 });

export const NotificationLog = model<INotificationLog>("NotificationLog", notificationLogSchema);
