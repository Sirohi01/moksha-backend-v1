import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { resolveMyAccess } from "../../lib/accessResolution.service";
import * as adminNotificationService from "./adminNotification.service";

/** Resolves which organisation's notifications this request should see — the client sends
 * whichever organisation is currently selected in the admin's own org switcher, but that value is
 * always re-validated against the user's real access grants server-side (never trusted blindly),
 * same reasoning as every other org-scoped route in this platform. Falls back to the user's first
 * accessible organisation if none was requested or the requested one isn't actually granted. */
async function resolveRequestedOrgCode(req: Request): Promise<string> {
  const requested = (req.query.organisationCode as string | undefined)?.trim().toUpperCase();
  if (!req.auth) throw ApiError.unauthorized();
  const access = await resolveMyAccess(req.auth.userId);
  if (access.isSuperAdmin) {
    if (requested) return requested;
    return access.organisations[0]?.code ?? "MOKSHA";
  }
  const allowedCodes = access.organisations.map((org) => org.code);
  if (requested && allowedCodes.includes(requested)) return requested;
  return allowedCodes[0] ?? "MOKSHA";
}

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const organisationCode = await resolveRequestedOrgCode(req);
  const { notifications, unreadCount } = await adminNotificationService.listNotificationsForAdmin(organisationCode);
  sendSuccess(res, 200, "Notifications fetched", { notifications, unreadCount });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await adminNotificationService.markNotificationRead(req.params.id);
  sendSuccess(res, 200, "Notification marked read");
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const organisationCode = await resolveRequestedOrgCode(req);
  await adminNotificationService.markAllNotificationsRead(organisationCode);
  sendSuccess(res, 200, "All notifications marked read");
});
