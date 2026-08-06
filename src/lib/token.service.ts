import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Access tokens deliberately carry only the user id (PRD §15.1 + §3.2 "fail closed" principle —
 * role/permissions are always resolved fresh from the DB in requireAuth, never trusted from an
 * old token claim, so a role change or account lock takes effect on the very next request instead
 * of waiting for the token to expire).
 */
export interface AccessTokenPayload {
  id: string;
}

const privateKey = Buffer.from(env.JWT_ACCESS_PRIVATE_KEY, "base64").toString("utf8");
const publicKey = Buffer.from(env.JWT_ACCESS_PUBLIC_KEY, "base64").toString("utf8");

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as AccessTokenPayload;
}
