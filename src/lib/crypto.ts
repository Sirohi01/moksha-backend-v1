import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended nonce length for GCM

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a base64 string that decodes to exactly 32 bytes (AES-256). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  cachedKey = key;
  return key;
}

/** Encrypts a plaintext string with AES-256-GCM. Output format: "iv:authTag:ciphertext" (all base64). */
export function encryptField(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Reverses encryptField. Throws if the value isn't a well-formed "iv:authTag:ciphertext" triple. */
export function decryptField(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value — expected 'iv:authTag:ciphertext'");
  }
  const [ivB64, authTagB64, dataB64] = parts;

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * Gated read helper for admin-facing responses: decrypts only when EXPOSE_DECRYPTED_DATA is on
 * (a developer/ops toggle in .env), otherwise passes the ciphertext through untouched. Use
 * decryptField() directly instead when the viewer is the data's own owner (e.g. a customer
 * reading their own booking) — that case should never be gated behind this toggle.
 */
export function maybeDecrypt(cipherText: string): string {
  if (!env.EXPOSE_DECRYPTED_DATA) return cipherText;
  try {
    return decryptField(cipherText);
  } catch {
    return cipherText;
  }
}
