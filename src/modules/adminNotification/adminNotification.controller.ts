import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as adminNotificationService from "./adminNotification.service";

export const listNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const { notifications, unreadCount } = await adminNotificationService.listNotificationsForAdmin();
  sendSuccess(res, 200, "Notifications fetched", { notifications, unreadCount });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await adminNotificationService.markNotificationRead(req.params.id);
  sendSuccess(res, 200, "Notification marked read");
});

export const markAllRead = asyncHandler(async (_req: Request, res: Response) => {
  await adminNotificationService.markAllNotificationsRead();
  sendSuccess(res, 200, "All notifications marked read");
});
