import crypto from "crypto";
import { Request } from "express";
import { Types } from "mongoose";
import { env } from "../../config/env";
import { User } from "../../models/user.model";
import { Role } from "../../models/role.model";
import { SystemServiceAccessGrant } from "../../models/systemServiceAccessGrant.model";
import { SystemServiceOtpUse } from "../../models/systemServiceOtpUse.model";
import { verifyTotpCode } from "../../lib/totp.service";
import { ApiError } from "../../utils/ApiError";

export const GRANT_TTL_MS = 10 * 60 * 1000;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const otpDigest = (userId: string, code: string) =>
  crypto.createHmac("sha256", env.JWT_ACCESS_PRIVATE_KEY).update(`${userId}:${code}`).digest("hex");

export function requestBinding(req: Request) {
  return {
    ipHash: sha256(req.ip || req.socket.remoteAddress || "unknown"),
    userAgentHash: sha256(req.get("user-agent") || "unknown"),
  };
}

export function requiredApprovalRoles(roleSlug?: string): string[] {
  if (roleSlug === "super_admin") return ["self"];
  if (roleSlug === "admin") return ["self", "super_admin"];
  return ["self", "admin", "super_admin"];
}

export async function getRequirements(requesterId: string, roleSlug?: string) {
  const roles = requiredApprovalRoles(roleSlug);
  const approverRoles = roles.filter((role) => role !== "self");
  const roleDocs = await Role.find({ slug: { $in: approverRoles }, status: "ACTIVE" }).select("slug").lean();
  const roleById = new Map(roleDocs.map((role) => [String(role._id), role.slug]));
  const users = await User.find({
    roleId: { $in: roleDocs.map((role) => role._id) },
    status: "ACTIVE",
    "twoFactor.enabled": true,
    _id: { $ne: requesterId },
  }).select("name email roleId").lean();
  const requester = await User.findById(requesterId).select("name email twoFactor.enabled").lean();

  return {
    expiresInMinutes: GRANT_TTL_MS / 60000,
    requiredRoles: roles,
    requester: requester ? { id: String(requester._id), name: requester.name, email: requester.email, twoFactorEnabled: requester.twoFactor.enabled } : null,
    approvers: users.map((user) => ({ id: String(user._id), name: user.name, email: user.email, roleSlug: roleById.get(String(user.roleId)) })),
  };
}

type ApprovalInput = { userId: string; code: string };

export async function createGrant(req: Request, approvals: ApprovalInput[]) {
  if (!req.auth) throw ApiError.unauthorized();
  const required = requiredApprovalRoles(req.auth.roleSlug);
  const requesterId = req.auth.userId;
  if (!Array.isArray(approvals)) throw ApiError.badRequest("OTP approvals are required");
  if (new Set(approvals.map((item) => item.userId)).size !== approvals.length) {
    throw ApiError.badRequest("Each approval level must be completed by a different person");
  }

  const ids = approvals.map((item) => item.userId);
  if (!ids.includes(requesterId)) throw ApiError.badRequest("Your own Authenticator OTP is required");
  if (ids.some((id) => !Types.ObjectId.isValid(id))) throw ApiError.badRequest("Invalid approver");

  const users = await User.find({ _id: { $in: ids }, status: "ACTIVE" })
    .select("name roleId twoFactor.enabled +twoFactor.secret").lean();
  if (users.length !== approvals.length) throw ApiError.forbidden("An approver is unavailable or inactive");
  const roleDocs = await Role.find({ _id: { $in: users.map((user) => user.roleId).filter(Boolean) }, status: "ACTIVE" }).select("slug").lean();
  const roleById = new Map(roleDocs.map((role) => [String(role._id), role.slug]));
  const userById = new Map(users.map((user) => [String(user._id), user]));

  for (const role of required) {
    const match = role === "self"
      ? approvals.find((item) => item.userId === requesterId)
      : approvals.find((item) => roleById.get(String(userById.get(item.userId)?.roleId)) === role);
    if (!match) throw ApiError.badRequest(`${role === "self" ? "Your" : role.replace("_", " ")} Authenticator OTP is required`);
  }
  if (approvals.length !== required.length) throw ApiError.badRequest("Only the required approvals may be submitted");

  for (const approval of approvals) {
    const user = userById.get(approval.userId);
    const code = String(approval.code || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code) || !user?.twoFactor.enabled || !user.twoFactor.secret || !(await verifyTotpCode(user.twoFactor.secret, code))) {
      throw ApiError.unauthorized("One or more Authenticator codes are invalid or expired");
    }
    try {
      await SystemServiceOtpUse.create({ digest: otpDigest(approval.userId, code), expiresAt: new Date(Date.now() + 2 * 60 * 1000) });
    } catch (error: any) {
      if (error?.code === 11000) throw ApiError.unauthorized("An Authenticator code was already used. Wait for a new code");
      throw error;
    }
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + GRANT_TTL_MS);
  const { ipHash, userAgentHash } = requestBinding(req);
  const approvedBy = approvals.map((approval) => ({
    userId: new Types.ObjectId(approval.userId),
    roleSlug: approval.userId === requesterId ? "self" : roleById.get(String(userById.get(approval.userId)?.roleId)) || "unknown",
  }));
  await SystemServiceAccessGrant.create({ requesterUserId: requesterId, tokenHash: sha256(token), ipHash, userAgentHash, approvedBy, expiresAt });
  return { token, expiresAt, expiresInMinutes: GRANT_TTL_MS / 60000 };
}

export async function getValidGrant(req: Request) {
  if (!req.auth) return false;
  const token = req.get("x-system-services-grant");
  if (!token) return false;
  const binding = requestBinding(req);
  return SystemServiceAccessGrant.findOne({
    requesterUserId: req.auth.userId,
    tokenHash: sha256(token),
    expiresAt: { $gt: new Date() },
    ...binding,
  }).select("expiresAt").lean();
}

export async function isGrantValid(req: Request): Promise<boolean> {
  return Boolean(await getValidGrant(req));
}
