import { Schema, model, Document, Types } from "mongoose";
import { AdminNotificationType, ADMIN_NOTIFICATION_TYPES } from "../utils/constants";

/**
 * The Topbar bell's in-app feed for internal staff — a shared inbox (one read-state for the whole
 * team, not per-admin) rather than a per-user notification system. For an org this size that's a
 * deliberate simplification: nobody needs their own separate unread count, and per-user tracking
 * would need a join table for no real benefit yet.
 */
export interface IAdminNotification extends Document {
  _id: Types.ObjectId;
  type: AdminNotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    type: { type: String, enum: ADMIN_NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AdminNotification = model<IAdminNotification>("AdminNotification", adminNotificationSchema);
