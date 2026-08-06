import crypto from "crypto";
import { RefreshToken, IRefreshToken } from "../models/refreshToken.model";
import { signAccessToken } from "./token.service";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";

const REFRESH_TOKEN_BYTES = 48;

function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration string: "${duration}" (expected e.g. "30d")`);
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
  return value * unitMs;
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export interface DeviceInfo {
  userAgent?: string;
  ip?: string;
  platform?: string;
}

/** PRD §15.1 — the refresh token handed to the client is an opaque random string; only its hash
 * is ever stored. Issuing a new pair always creates a fresh RefreshToken document, so every
 * session is independently listable and revocable. */
export async function issueTokenPair(userId: string, refreshExpiry: string, deviceInfo?: DeviceInfo) {
  const accessToken = signAccessToken({ id: userId });

  const rawRefreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + parseDurationMs(refreshExpiry));

  const doc = await RefreshToken.create({
    userId,
    tokenHash: hashToken(rawRefreshToken),
    deviceInfo,
    expiresAt,
  });

  return { accessToken, refreshToken: rawRefreshToken, refreshTokenId: doc._id };
}

/** PRD §15.2 step 6 — presenting a refresh token that's already been rotated (or explicitly
 * revoked) is treated as theft: every session for that user is revoked immediately. A stolen
 * token being replayed after the legitimate client already rotated it is exactly this case. */
export async function revokeAllSessions(userId: string, reason: string): Promise<void> {
  await RefreshToken.updateMany({ userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
  logger.warn(`All sessions revoked for user ${userId}`, { reason });
}

export async function rotateRefreshToken(rawToken: string, refreshExpiry: string, deviceInfo?: DeviceInfo) {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing) throw ApiError.unauthorized("Invalid or expired refresh token");

  if (existing.revokedAt || existing.expiresAt.getTime() < Date.now()) {
    // Already used (rotated) or expired. A revoked-but-not-expired token being presented again is
    // the theft signature described above.
    if (existing.revokedAt && existing.expiresAt.getTime() >= Date.now()) {
      await revokeAllSessions(existing.userId.toString(), "refresh token reuse after rotation");
    }
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const userId = existing.userId.toString();
  const { accessToken, refreshToken, refreshTokenId } = await issueTokenPair(userId, refreshExpiry, deviceInfo);

  existing.revokedAt = new Date();
  existing.replacedBy = refreshTokenId;
  await existing.save();

  return { userId, accessToken, refreshToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshToken.updateOne({ tokenHash: hashToken(rawToken), revokedAt: { $exists: false } }, { revokedAt: new Date() });
}

export async function listSessions(userId: string): Promise<IRefreshToken[]> {
  return RefreshToken.find({ userId, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({
    createdAt: -1,
  });
}

export async function revokeSessionById(userId: string, sessionId: string): Promise<void> {
  const session = await RefreshToken.findOne({ _id: sessionId, userId });
  if (!session) throw ApiError.notFound("Session not found");
  session.revokedAt = new Date();
  await session.save();
}
