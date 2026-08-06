import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import * as authService from "./auth.service";
import { resolveRoleAndPermissions } from "../../lib/permissions.service";
import { listSessions, revokeSessionById, DeviceInfo } from "../../lib/session.service";
import { IUser } from "../../models/user.model";

/** Enriches the auth response with the role/permission snapshot at login time — purely for the
 * frontend to render permission-aware UI. Every subsequent request still re-resolves permissions
 * fresh via requireAuth, so a stale snapshot here can never grant access the server wouldn't. */
async function toSafeUser(user: IUser) {
  const { roleSlug, permissions } = await resolveRoleAndPermissions(user);
  return {
    id: user._id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    userType: user.userType,
    roleSlug,
    permissions,
  };
}

function extractDeviceInfo(req: Request): DeviceInfo {
  return {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
    platform: typeof req.body?.platform === "string" ? req.body.platform : undefined,
  };
}

export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestOtp(req.body.phone);
  sendSuccess(res, 200, "OTP sent successfully");
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp, name } = req.body;
  const result = await authService.verifyOtp(phone, otp, name, extractDeviceInfo(req));
  sendSuccess(res, 200, "OTP verified", {
    user: await toSafeUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, phone, email, password } = req.body;
  const result = await authService.registerWithEmail(name, phone, email, password, extractDeviceInfo(req));
  sendSuccess(res, 201, "Account created successfully", {
    user: await toSafeUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, totpCode } = req.body;
  const result = await authService.loginWithEmail(email, password, totpCode, extractDeviceInfo(req));
  sendSuccess(res, 200, "Logged in successfully", {
    user: await toSafeUser(result.user),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    twoFactorSetupRequired: result.twoFactorSetupRequired,
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await authService.refreshUserToken(req.body.refreshToken, extractDeviceInfo(req));
  sendSuccess(res, 200, "Token refreshed", tokens);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logoutUser(req.body.refreshToken);
  sendSuccess(res, 200, "Logged out");
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  await authService.changeMyPassword(req.auth.userId, req.body.currentPassword, req.body.newPassword);
  sendSuccess(res, 200, "Password changed — all other sessions have been signed out");
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  sendSuccess(res, 200, "Current session", {
    userId: req.auth.userId,
    userType: req.auth.userType,
    roleSlug: req.auth.roleSlug,
    permissions: Array.from(req.auth.permissions),
    twoFactorPending: req.auth.twoFactorPending,
  });
});

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  const sessions = await listSessions(req.auth.userId);
  sendSuccess(
    res,
    200,
    "Active sessions",
    sessions.map((s) => ({ id: s._id, deviceInfo: s.deviceInfo, createdAt: s.createdAt, expiresAt: s.expiresAt }))
  );
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  await revokeSessionById(req.auth.userId, req.params.id);
  sendSuccess(res, 200, "Session revoked");
});

export const startTwoFactorSetup = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  const result = await authService.startTwoFactorSetup(req.auth.userId);
  sendSuccess(res, 200, "Scan this in your authenticator app", result);
});

export const confirmTwoFactorSetup = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw ApiError.unauthorized();
  const backupCodes = await authService.confirmTwoFactorSetup(req.auth.userId, req.body.code);
  sendSuccess(res, 200, "Two-factor authentication enabled — save these backup codes", { backupCodes });
});
