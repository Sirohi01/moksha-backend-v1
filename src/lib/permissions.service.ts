import { Types } from "mongoose";
import { IUser } from "../models/user.model";
import { Role } from "../models/role.model";
import { Permission } from "../models/permission.model";

interface ResolvedPermissions {
  roleSlug?: string;
  permissions: string[];
}
export function isTwoFactorMandatoryForRole(roleSlug?: string): boolean {
  return !!roleSlug;
}
export async function resolveRoleAndPermissions(user: Pick<IUser, "roleId">): Promise<ResolvedPermissions> {
  if (!user.roleId) return { permissions: [] };
  return resolvePermissionsForRoleId(user.roleId);
}
export async function resolvePermissionsForRoleId(
  roleId: Types.ObjectId | string
): Promise<ResolvedPermissions> {
  const role = await Role.findById(roleId);
  if (!role || role.status !== "ACTIVE") return { permissions: [] };
  if (role.permissionIds.length === 0) return { roleSlug: role.slug, permissions: [] };

  const perms = await Permission.find({ _id: { $in: role.permissionIds } }).select("key");
  return { roleSlug: role.slug, permissions: perms.map((p) => p.key) };
}
