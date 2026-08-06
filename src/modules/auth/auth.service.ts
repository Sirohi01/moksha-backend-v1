import crypto from "crypto";
import { User, IUser } from "../../models/user.model";
import { Role } from "../../models/role.model";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import { comparePassword, hashPassword, isLegacyHash } from "../../lib/password.service";
import { compareOtp, dispatchOtp, generateOtp, getOtpExpiry, hashOtp } from "../../lib/otp/otp.service";
import { notify } from "../../lib/notify.service";
import { issueTokenPair, rotateRefreshToken, revokeRefreshToken, revokeAllSessions, DeviceInfo } from "../../lib/session.service";
import { isTwoFactorMandatoryForRole } from "../../lib/permissions.service";
import {
  verifyTotpCode,
  hashBackupCode,
  generateTotpSecret,
  getTotpProvisioningUri,
  generateBackupCodes,
} from "../../lib/totp.service";

const FAILED_LOGIN_LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes, PRD §15.4

async function twoFactorMandatoryFor(user: IUser): Promise<boolean> {
  if (user.userType !== "INTERNAL" || !user.roleId) return false;
  const role = await Role.findById(user.roleId).select("slug");
  return isTwoFactorMandatoryForRole(role?.slug);
}

export async function requestOtp(phone: string): Promise<void> {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const otpExpiresAt = getOtpExpiry();

  const donorRole = await Role.findOne({ slug: "donor" }).select("_id");

  await User.findOneAndUpdate(
    { phone },
    {
      $setOnInsert: {
        name: "Guest User",
        phone,
        userType: "DONOR",
        ...(donorRole ? { roleId: donorRole._id } : {}),
      },
      otpHash,
      otpExpiresAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await dispatchOtp(phone, otp);
}

export async function verifyOtp(phone: string, otp: string, name?: string, deviceInfo?: DeviceInfo) {
  const user = await User.findOne({ phone }).select("+otpHash +otpExpiresAt");
  if (!user || !user.otpHash || !user.otpExpiresAt) {
    throw ApiError.badRequest("OTP not requested for this number");
  }
  if (user.otpExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("OTP has expired, please request a new one");
  }

  const isValid = await compareOtp(otp, user.otpHash);
  if (!isValid) throw ApiError.badRequest("Invalid OTP");
  if (user.status !== "ACTIVE") throw ApiError.forbidden("This account is not active");

  user.isPhoneVerified = true;
  user.otpHash = undefined;
  user.otpExpiresAt = undefined;
  if (name && user.name === "Guest User") user.name = name;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokenPair(user._id.toString(), env.JWT_REFRESH_EXPIRY, deviceInfo);
  return { user, ...tokens };
}

export async function registerWithEmail(
  name: string,
  phone: string,
  email: string,
  password: string,
  deviceInfo?: DeviceInfo
) {
  const existing = await User.findOne({ $or: [{ phone }, { email }] });
  if (existing) throw ApiError.conflict("An account with this phone or email already exists");

  const donorRole = await Role.findOne({ slug: "donor" }).select("_id");
  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    phone,
    email,
    passwordHash,
    userType: "DONOR",
    roleId: donorRole?._id,
    lastLoginAt: new Date(),
  });

  // notify() never throws — a misconfigured/unreachable SMTP provider must never block account
  // creation, and this is now the one call site for outbound notifications (PRD §17.1).
  await notify("user.welcome", { userId: user._id.toString(), email }, { name });

  const tokens = await issueTokenPair(user._id.toString(), env.JWT_REFRESH_EXPIRY, deviceInfo);
  return { user, ...tokens };
}

interface LoginResult {
  user: IUser;
  accessToken: string;
  refreshToken: string;
  twoFactorSetupRequired: boolean;
}

export async function loginWithEmail(
  email: string,
  password: string,
  totpCode?: string,
  deviceInfo?: DeviceInfo
): Promise<LoginResult> {
  const user = await User.findOne({ email }).select("+passwordHash +twoFactor.secret +twoFactor.backupCodeHashes");
  if (!user || !user.passwordHash) throw ApiError.unauthorized("Invalid email or password");

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw ApiError.forbidden("Account temporarily locked due to failed login attempts. Try again later.");
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= FAILED_LOGIN_LOCKOUT_THRESHOLD) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await user.save();
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Checked only after a correct password — status is account-sensitive information that
  // shouldn't be revealed to someone who doesn't already know the password (the same reasoning
  // requireAuth documents for permissions being resolved fresh, not trusted from the token).
  if (user.status !== "ACTIVE") throw ApiError.forbidden("This account is not active");

  // Transparent Argon2id migration — see password.service.ts's comparePassword note.
  if (isLegacyHash(user.passwordHash)) {
    user.passwordHash = await hashPassword(password);
  }

  if (user.twoFactor.enabled) {
    if (!totpCode) throw ApiError.unauthorized("Two-factor code required");

    const validTotp = user.twoFactor.secret ? await verifyTotpCode(user.twoFactor.secret, totpCode) : false;
    const backupHash = hashBackupCode(totpCode);
    const backupIndex = user.twoFactor.backupCodeHashes?.indexOf(backupHash) ?? -1;

    if (!validTotp && backupIndex === -1) {
      throw ApiError.unauthorized("Invalid two-factor code");
    }
    if (!validTotp && backupIndex !== -1) {
      // Backup codes are single-use — consume it.
      user.twoFactor.backupCodeHashes?.splice(backupIndex, 1);
    }
  }

  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokenPair(user._id.toString(), env.JWT_REFRESH_EXPIRY, deviceInfo);
  const twoFactorSetupRequired = !user.twoFactor.enabled && (await twoFactorMandatoryFor(user));

  return { user, ...tokens, twoFactorSetupRequired };
}

/** Step 1 of 2FA enrollment — generates a secret (not yet active) and a scannable provisioning URI. */
export async function startTwoFactorSetup(userId: string): Promise<{ secret: string; provisioningUri: string }> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("Account not found");

  const secret = generateTotpSecret();
  user.twoFactor.secret = secret;
  await user.save();

  return { secret, provisioningUri: getTotpProvisioningUri(secret, user.email ?? user.phone) };
}

/** Step 2 — confirms the user's authenticator app is actually working before enabling 2FA, and
 * issues one-time backup codes for account recovery. */
export async function confirmTwoFactorSetup(userId: string, code: string): Promise<string[]> {
  const user = await User.findById(userId).select("+twoFactor.secret");
  if (!user) throw ApiError.notFound("Account not found");
  if (!user.twoFactor.secret) throw ApiError.badRequest("Start 2FA setup first");

  if (!(await verifyTotpCode(user.twoFactor.secret, code))) {
    throw ApiError.badRequest("Invalid code — check your authenticator app and try again");
  }

  const { plain, hashes } = generateBackupCodes();
  user.twoFactor.enabled = true;
  user.twoFactor.backupCodeHashes = hashes;
  await user.save();

  return plain;
}

export async function refreshUserToken(refreshToken: string, deviceInfo?: DeviceInfo) {
  const { userId, accessToken, refreshToken: newRefreshToken } = await rotateRefreshToken(
    refreshToken,
    env.JWT_REFRESH_EXPIRY,
    deviceInfo
  );

  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized("Account no longer exists");
  if (user.status !== "ACTIVE") throw ApiError.unauthorized("Account is not active");

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await revokeRefreshToken(refreshToken);
}

/** Self-service password change — covers both a voluntary rotation and the required first
 * change after an admin-issued temporary password (see user.service.ts's inviteStaff). Revokes
 * every OTHER session on success: a changed password is exactly the moment a stale, possibly
 * compromised session elsewhere should stop working, same reasoning as revokeAllSessions's use
 * during refresh-token theft detection. */
export async function changeMyPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !user.passwordHash) throw ApiError.badRequest("This account does not use a password");

  const isValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isValid) throw ApiError.unauthorized("Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();

  await revokeAllSessions(userId, "password changed");

  // A security-relevant notification, deliberately sent even though it can't be gated behind
  // the account's own consent — if this wasn't the account holder, they need to know.
  if (user.email) {
    await notify("auth.password_changed", { userId, email: user.email }, { name: user.name });
  }
}

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Step 1 of "forgot password" — the actual authentication step for this flow: possession of the
 * email inbox stands in for the password the user has forgotten. Deliberately resolves the same
 * way (silently) whether or not the email matches an account, so the response itself can't be used
 * to enumerate valid admin emails. Only the SHA-256 hash of the token is persisted — see
 * user.model.ts's passwordResetTokenHash — the raw token exists only in the emailed link. */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) return;

  const token = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  if (user.email) {
    const resetUrl = `${env.ADMIN_CLIENT_URL}/reset-password?token=${token}`;
    await notify("auth.password_reset_requested", { userId: user._id.toString(), email: user.email }, { name: user.name, resetUrl });
  }
}

/** Step 2 — the token itself already proved identity (it only ever reached the account's inbox),
 * so this doesn't ask for the old password. Revokes every session and re-uses the same
 * "auth.password_changed" alert as a voluntary change, since from the account holder's point of
 * view the security-relevant fact (password changed, other sessions killed) is identical. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpiresAt");
  if (!user) throw ApiError.badRequest("This reset link is invalid or has expired");

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  await user.save();

  await revokeAllSessions(user._id.toString(), "password reset");

  if (user.email) {
    await notify("auth.password_changed", { userId: user._id.toString(), email: user.email }, { name: user.name });
  }
}
