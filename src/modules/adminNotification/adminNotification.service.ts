import { AdminNotification } from "../../models/adminNotification.model";
const LIST_LIMIT = 30;

export async function listNotificationsForAdmin() {
  const notifications = await AdminNotification.find({ isRead: false }).sort({ createdAt: -1 }).limit(LIST_LIMIT);
  return { notifications, unreadCount: notifications.length };
}

export async function markNotificationRead(id: string) {
  await AdminNotification.findByIdAndUpdate(id, { isRead: true });
}

export async function markAllNotificationsRead() {
  await AdminNotification.updateMany({ isRead: false }, { isRead: true });
}
