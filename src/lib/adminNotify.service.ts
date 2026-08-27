import { AdminNotification } from "../models/adminNotification.model";
import { AdminNotificationType } from "../utils/constants";
import { logger } from "../config/logger";
export async function notifyAdmins(
  organisationCode: string,
  type: AdminNotificationType,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    await AdminNotification.create({ organisationCode, type, title, message, link });
  } catch (err) {
    logger.error(`notifyAdmins(): failed to record "${type}" notification`, { err });
  }
}
