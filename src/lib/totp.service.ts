import { generateSecret, generateURI, verify } from "otplib";
import crypto from "crypto";

const ISSUER = "Moksha Sewa";

/** PRD SEC-02 / FR-USR-05: mandatory TOTP 2FA for Super Admin / Admin. */
export function generateTotpSecret(): string {
  return generateSecret();
}

export function getTotpProvisioningUri(secret: string, accountEmail: string): string {
  return generateURI({ strategy: "totp", issuer: ISSUER, label: accountEmail, secret });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: code });
    return result.valid;
  } catch {
    return false;
  }
}

/** One-time backup codes for account recovery if the authenticator device is lost. Returned to
 * the user exactly once at enrollment; only their SHA-256 hashes are stored. */
export function generateBackupCodes(count = 8): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex"));
  const hashes = plain.map((code) => crypto.createHash("sha256").update(code).digest("hex"));
  return { plain, hashes };
}

export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
