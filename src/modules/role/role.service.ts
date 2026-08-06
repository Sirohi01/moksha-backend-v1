import { Role, IRole } from "../../models/role.model";
import { Permission } from "../../models/permission.model";
import { User } from "../../models/user.model";
import { ApiError } from "../../utils/ApiError";
import { RoleScope } from "../../utils/constants";

interface CreateRoleInput {
  name: string;
  slug: string;
  description?: string;
  scope: RoleScope;
  permissionIds: string[];
}

interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
  status?: "ACTIVE" | "INACTIVE";
}

async function validatePermissionIds(permissionIds: string[]): Promise<void> {
  if (permissionIds.length === 0) return;
  const count = await Permission.countDocuments({ _id: { $in: permissionIds } });
  if (count !== permissionIds.length) {
    throw ApiError.badRequest("One or more permission ids are invalid");
  }
}

/** Attaches each permission's resolved key/label — the role-editor UI works with keys, not raw
 * ObjectIds, and the admin summary views want the same. */
async function withPermissionDetails(role: IRole) {
  const permissions = await Permission.find({ _id: { $in: role.permissionIds } }).select("key label module action");
  return { ...role.toObject(), permissions };
}

export async function listRoles() {
  const roles = await Role.find().sort({ isSystem: -1, name: 1 });
  return Promise.all(roles.map(withPermissionDetails));
}

export async function getRoleById(id: string) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound("Role not found");
  return withPermissionDetails(role);
}

export async function createRole(input: CreateRoleInput) {
  const existing = await Role.findOne({ slug: input.slug });
  if (existing) throw ApiError.conflict("A role with this slug already exists");

  await validatePermissionIds(input.permissionIds);

  const role = await Role.create({ ...input, isSystem: false });
  return withPermissionDetails(role);
}

/** System roles' name/slug are referenced by code (e.g. isTwoFactorMandatoryForRole checks
 * "super_admin"/"admin" by slug) — slug is therefore immutable for every role, not just system
 * ones, to keep "the slug I saved is the slug still in use" a permanent invariant. Everything
 * else, including a system role's permission set, is editable — that's the whole point of
 * roles being admin-owned data (PRD's own stated design) rather than fixed by code. */
export async function updateRole(id: string, updates: UpdateRoleInput) {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound("Role not found");

  if (updates.permissionIds) await validatePermissionIds(updates.permissionIds);

  Object.assign(role, updates);
  await role.save();
  return withPermissionDetails(role);
}

export async function deleteRole(id: string): Promise<void> {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound("Role not found");
  if (role.isSystem) throw ApiError.forbidden("System roles cannot be deleted");

  const inUse = await User.exists({ roleId: role._id });
  if (inUse) throw ApiError.conflict("This role is still assigned to one or more users");

  await role.deleteOne();
}

export async function listPermissions() {
  return Permission.find().sort({ module: 1, action: 1 });
}
