import { AdminNotification } from "../../models/adminNotification.model";

/** Most-recent-first, capped — this feeds a Topbar dropdown, not a full inbox view (there's no
 * "load more" UI for it yet, so an unbounded list would just grow forever in memory for no
 * benefit). */
const LIST_LIMIT = 30;

export async function listNotificationsForAdmin() {
  const [notifications, unreadCount] = await Promise.all([
    AdminNotification.find().sort({ createdAt: -1 }).limit(LIST_LIMIT),
    AdminNotification.countDocuments({ isRead: false }),
  ]);
  return { notifications, unreadCount };
}

export async function markNotificationRead(id: string) {
  await AdminNotification.findByIdAndUpdate(id, { isRead: true });
}

export async function markAllNotificationsRead() {
  await AdminNotification.updateMany({ isRead: false }, { isRead: true });
}
