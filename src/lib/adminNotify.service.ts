import { AdminNotification } from "../models/adminNotification.model";
import { AdminNotificationType } from "../utils/constants";
import { logger } from "../config/logger";

/**
 * The single call site for every in-app admin notification (Topbar bell) — same "one place, not
 * scattered ad-hoc calls" reasoning as notify.service.ts's own notify(). Unlike notify(), this is
 * a local DB insert (no SMTP round-trip), so it's safe to await directly rather than needing the
 * fire-and-forget treatment — but it still must never throw and break the operation that
 * triggered it (a failed notification write is not a reason to fail someone's donation).
 */
export async function notifyAdmins(
  type: AdminNotificationType,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    await AdminNotification.create({ type, title, message, link });
  } catch (err) {
    logger.error(`notifyAdmins(): failed to record "${type}" notification`, { err });
  }
}
