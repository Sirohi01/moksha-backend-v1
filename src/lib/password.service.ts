import argon2 from "argon2";
import crypto from "crypto";

export async function hashPassword(password: string): Promise<string> {
  // PRD SEC-04: Argon2id, memory 64 MB, time cost 3, parallelism 4.
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB, in KiB
    timeCost: 3,
    parallelism: 4,
  });
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  // Legacy bcrypt hashes ($2a$/$2b$/$2y$) from before the Argon2id migration verify via bcrypt;
  // callers should re-hash with hashPassword() on a successful legacy login so accounts migrate
  // transparently on next use instead of needing a bulk migration script.
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    const bcrypt = await import("bcryptjs");
    return bcrypt.compare(password, hash);
  }
  return argon2.verify(hash, password);
}

export function isLegacyHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
}

/** A one-time temporary password for admin-created staff accounts — random, not memorable by
 * design (the account holder is expected to change it on first login). Mixed alphanumeric,
 * avoiding characters that are easy to misread (0/O, 1/l/I) since this is meant to be read off a
 * screen or typed from an email. */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(14);
  let password = "";
  for (const byte of bytes) password += alphabet[byte % alphabet.length];
  return password;
}
