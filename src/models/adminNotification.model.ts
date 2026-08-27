import { Schema, model, Document, Types } from "mongoose";
import { AdminNotificationType, ADMIN_NOTIFICATION_TYPES } from "../utils/constants";
export interface IAdminNotification extends Document {
  _id: Types.ObjectId;
  organisationCode: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

const adminNotificationSchema = new Schema<IAdminNotification>(
  {
    organisationCode: { type: String, required: true, index: true, uppercase: true, trim: true },
    type: { type: String, enum: ADMIN_NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, trim: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
adminNotificationSchema.index({ organisationCode: 1, isRead: 1, createdAt: -1 });

export const AdminNotification = model<IAdminNotification>("AdminNotification", adminNotificationSchema);
