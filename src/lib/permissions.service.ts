import { IUser } from "../models/user.model";
import { Role } from "../models/role.model";
import { Permission } from "../models/permission.model";

interface ResolvedPermissions {
  roleSlug?: string;
  permissions: string[];
}

/** PRD SEC-02 / FR-USR-05 — roles that must complete TOTP enrollment before their session is
 * fully trusted. Centralised here (not duplicated in auth.service.ts and auth.middleware.ts)
 * since both need the same answer to "does this role require 2FA". */
export const TWO_FACTOR_MANDATORY_ROLE_SLUGS = ["super_admin", "admin"];

export function isTwoFactorMandatoryForRole(roleSlug?: string): boolean {
  return !!roleSlug && TWO_FACTOR_MANDATORY_ROLE_SLUGS.includes(roleSlug);
}

/** Single source of truth for "what can this user currently do" — used by requireAuth (fresh on
 * every request, PRD §3.2 "fail closed") and, separately, to enrich login/profile responses so the
 * frontend can render permission-aware UI. The login-time snapshot this produces is never used for
 * an authorization decision itself; every actual request re-resolves via requireAuth. */
export async function resolveRoleAndPermissions(user: Pick<IUser, "roleId">): Promise<ResolvedPermissions> {
  if (!user.roleId) return { permissions: [] };

  const role = await Role.findById(user.roleId);
  if (!role || role.status !== "ACTIVE") return { permissions: [] };
  if (role.permissionIds.length === 0) return { roleSlug: role.slug, permissions: [] };

  const perms = await Permission.find({ _id: { $in: role.permissionIds } }).select("key");
  return { roleSlug: role.slug, permissions: perms.map((p) => p.key) };
}
