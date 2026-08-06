import { Schema, model, Document, Types } from "mongoose";
import { NotificationChannel, NOTIFICATION_CHANNELS, NotificationCategory, NOTIFICATION_CATEGORIES } from "../utils/constants";

/** PRD §11.4 "notificationTemplates" — the single source of copy for every message notify()
 * sends. `body` (and `subject`) support "{{variable}}" placeholders, filled in by notify.service.ts. */
export interface INotificationTemplate extends Document {
  _id: Types.ObjectId;
  key: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  subject?: string;
  body: string;
  isActive: boolean;
}

const notificationTemplateSchema = new Schema<INotificationTemplate>({
  key: { type: String, required: true, unique: true, index: true },
  channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
  category: { type: String, enum: NOTIFICATION_CATEGORIES, default: "TRANSACTIONAL" },
  subject: { type: String, trim: true },
  body: { type: String, required: true },
  isActive: { type: Boolean, default: true },
});

export const NotificationTemplate = model<INotificationTemplate>("NotificationTemplate", notificationTemplateSchema);
