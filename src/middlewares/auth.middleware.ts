import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { AccessTokenPayload, verifyAccessToken } from "../lib/token.service";
import { User } from "../models/user.model";
import { UserType } from "../utils/constants";
import { asyncHandler } from "../utils/asyncHandler";
import { resolveRoleAndPermissions, isTwoFactorMandatoryForRole } from "../lib/permissions.service";

export interface AuthContext {
  userId: string;
  userType: UserType;
  roleSlug?: string;
  permissions: Set<string>;
  /** True when this role requires 2FA (PRD SEC-02) and the user hasn't finished enrolling yet.
   * authorize() below refuses every permission-gated route while this is true — requireAuth alone
   * (used by the 2FA setup/confirm endpoints) does not check it, so the user can still complete
   * enrollment without being locked out entirely. */
  twoFactorPending: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

/**
 * Verifies the access token, then resolves the user's CURRENT role → permissions from the
 * database and attaches it as req.auth. Permissions are deliberately never read from the JWT
 * itself (PRD §3.2 "fail closed"): a role change, permission edit, or account lock takes effect
 * on the very next request instead of waiting for the token to expire or be refreshed.
 */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized("Authentication token missing"));

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized("Invalid or expired token"));
  }

  const user = await User.findById(payload.id);
  if (!user) return next(ApiError.unauthorized("Account no longer exists"));
  if (user.status !== "ACTIVE") return next(ApiError.unauthorized("Account is not active"));

  const { roleSlug, permissions: permKeys } = await resolveRoleAndPermissions(user);
  const twoFactorPending = isTwoFactorMandatoryForRole(roleSlug) && !user.twoFactor.enabled;

  req.auth = {
    userId: user._id.toString(),
    userType: user.userType,
    roleSlug,
    permissions: new Set(permKeys),
    twoFactorPending,
  };
  next();
});

/** Restricts a route to specific account surfaces (INTERNAL staff / VOLUNTEER / DONOR). */
export function requireUserType(...types: UserType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !types.includes(req.auth.userType)) {
      return next(ApiError.forbidden("Access denied"));
    }
    next();
  };
}

/**
 * Permission-key based RBAC (PRD §6, §15.3) — replaces the old requireAdminRole(...roles) name
 * check. The API never checks a role name directly, only whether the resolved permission set
 * (req.auth.permissions, built in requireAuth above) contains the declared key.
 */
export function authorize(permissionKey: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(ApiError.forbidden("You do not have permission to perform this action"));
    if (req.auth.twoFactorPending) {
      return next(ApiError.forbidden("Two-factor authentication setup is required before you can continue"));
    }
    if (!req.auth.permissions.has(permissionKey)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}
