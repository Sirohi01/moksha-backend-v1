import { User, IUser } from "../../models/user.model";
import { Role } from "../../models/role.model";
import { ApiError } from "../../utils/ApiError";
import { hashPassword, generateTempPassword } from "../../lib/password.service";
import { notify } from "../../lib/notify.service";
import { writeAuditLog } from "../../lib/audit.service";
import { maybeDecrypt } from "../../lib/crypto";
import { NewUserStatus } from "../../utils/constants";

interface InviteStaffInput {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  roleId: string;
  avatarUrl?: string;
}

function serializeStaff(user: IUser, roleName?: string) {
  const obj = user.toObject();
  obj.addresses = obj.addresses.map((a: IUser["addresses"][number]) => ({ ...a, line1: maybeDecrypt(a.line1) }));
  return { ...obj, roleName };
}

/**
 * PRD FR-USR — creates an internal staff account with a one-time temporary password. The
 * password is returned to the inviting admin exactly once (same pattern as 2FA backup codes) and
 * best-effort emailed to the new staff member — "best-effort" because notify() never throws, and
 * this admin flow must not fail just because SMTP is unreachable; the admin still has the
 * password on screen either way.
 */
export async function inviteStaff(input: InviteStaffInput, actorUserId: string) {
  const employeeId = input.employeeId.trim().toUpperCase();
  const existing = await User.findOne({ $or: [{ phone: input.phone }, { email: input.email }, { employeeId }] });
  if (existing) throw ApiError.conflict("An account with this phone, email or employee ID already exists");

  const role = await Role.findById(input.roleId);
  if (!role) throw ApiError.badRequest("Select a valid role");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    employeeId,
    avatarUrl: input.avatarUrl,
    passwordHash,
    userType: "INTERNAL",
    roleId: role._id,
    status: "ACTIVE",
    isEmailVerified: false,
    isPhoneVerified: false,
  });

  await notify(
    "staff.invited",
    { userId: user._id.toString(), email: input.email },
    { name: input.name, roleName: role.name, email: input.email, tempPassword }
  );

  await writeAuditLog({
    userId: actorUserId,
    action: "staff.invited",
    entityType: "User",
    entityId: user._id.toString(),
    after: { name: input.name, email: input.email, roleId: input.roleId },
  });

  return { user: serializeStaff(user, role.name), temporaryPassword: tempPassword };
}

export async function listStaff() {
  const users = await User.find({ userType: "INTERNAL" }).sort({ createdAt: -1 });
  const roles = await Role.find({ _id: { $in: users.map((u) => u.roleId).filter(Boolean) } }).select("name");
  const roleNameById = new Map(roles.map((r) => [r._id.toString(), r.name]));
  return users.map((u) => serializeStaff(u, u.roleId ? roleNameById.get(u.roleId.toString()) : undefined));
}

export async function updateStaffStatus(userId: string, status: NewUserStatus, actorUserId: string) {
  if (userId === actorUserId) throw ApiError.badRequest("You cannot change your own account status");

  const user = await User.findOneAndUpdate({ _id: userId, userType: "INTERNAL" }, { status }, { new: true });
  if (!user) throw ApiError.notFound("Staff account not found");

  await writeAuditLog({
    userId: actorUserId,
    action: "staff.status_changed",
    entityType: "User",
    entityId: userId,
    after: { status },
  });

  if (user.email) {
    await notify("staff.status_changed", { userId: user._id.toString(), email: user.email }, { name: user.name, status });
  }

  return serializeStaff(user);
}

interface UpdateStaffDetailsInput {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  roleId: string;
  avatarUrl?: string;
}

/** Full-detail edit (name/email/phone/role together) — the granular /status and /role endpoints
 * above stay as-is for quick single-field toggles already wired elsewhere; this is what the admin
 * "Edit" action on the staff table uses. */
export async function updateStaffDetails(userId: string, input: UpdateStaffDetailsInput, actorUserId: string) {
  const user = await User.findOne({ _id: userId, userType: "INTERNAL" });
  if (!user) throw ApiError.notFound("Staff account not found");

  const duplicate = await User.findOne({
    _id: { $ne: userId },
    $or: [{ phone: input.phone }, { email: input.email }, { employeeId: input.employeeId.trim().toUpperCase() }],
  });
  if (duplicate) throw ApiError.conflict("Another account already uses this phone, email or employee ID");

  const role = await Role.findById(input.roleId);
  if (!role) throw ApiError.badRequest("Select a valid role");

  user.name = input.name;
  user.email = input.email;
  user.phone = input.phone;
  user.employeeId = input.employeeId.trim().toUpperCase();
  user.roleId = role._id;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
  await user.save();

  await writeAuditLog({
    userId: actorUserId,
    action: "staff.updated",
    entityType: "User",
    entityId: userId,
    after: { name: input.name, email: input.email, phone: input.phone, roleId: input.roleId },
  });

  return serializeStaff(user, role.name);
}

export async function updateStaffRole(userId: string, roleId: string, actorUserId: string) {
  const role = await Role.findById(roleId);
  if (!role) throw ApiError.badRequest("Select a valid role");

  const user = await User.findOneAndUpdate({ _id: userId, userType: "INTERNAL" }, { roleId }, { new: true });
  if (!user) throw ApiError.notFound("Staff account not found");

  await writeAuditLog({
    userId: actorUserId,
    action: "staff.role_changed",
    entityType: "User",
    entityId: userId,
    after: { roleId },
  });

  return serializeStaff(user, role.name);
}
