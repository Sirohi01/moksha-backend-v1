import "dotenv/config";
import { z } from "zod";
import { zBoolean } from "../utils/zodHelpers";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default("/api/v1"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  ADMIN_CLIENT_URL: z.string().default("http://localhost:3001"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // PRD §15.1: access tokens are RS256 (asymmetric) so a future service could verify them without
  // holding the signing key. Base64-encoded PEM, generate with:
  //   node -e "const{privateKey,publicKey}=require('crypto').generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});console.log('PRIVATE',Buffer.from(privateKey).toString('base64'));console.log('PUBLIC',Buffer.from(publicKey).toString('base64'))"
  JWT_ACCESS_PRIVATE_KEY: z.string().min(1, "JWT_ACCESS_PRIVATE_KEY is required"),
  JWT_ACCESS_PUBLIC_KEY: z.string().min(1, "JWT_ACCESS_PUBLIC_KEY is required"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  // Refresh tokens are opaque random strings (session.service.ts), not signed JWTs — only their
  // hash is stored server-side, so there's no refresh-token secret to configure. This just sets
  // how long an issued session stays valid before requiring a fresh login.
  JWT_REFRESH_EXPIRY: z.string().regex(/^\d+[smhd]$/, 'Must look like "30d", "15m", etc.').default("30d"),

  OTP_PROVIDER: z.enum(["console", "msg91", "aisensy"]).default("console"),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  AISENSY_API_KEY: z.string().optional(),
  AISENSY_CAMPAIGN_OTP: z.string().optional(),

  // WhatsApp number (with country code, no '+') that receives admin-facing notifications.
  ADMIN_WHATSAPP_NUMBER: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: zBoolean(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Moksha Sewa"),
  SMTP_FROM_EMAIL: z.string().default("no-reply@mokshasewa.com"),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  // Separate secret configured in the Razorpay dashboard's webhook settings (never the same value
  // as RAZORPAY_KEY_SECRET) — signs the webhook payload so /donations/webhook/razorpay can trust
  // it as the authoritative payment confirmation (PRD §16.1), independent of whether the donor's
  // browser ever calls back to /donations/verify.
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // AES-256-GCM key for encrypting sensitive PII fields at rest (donor/contact phone, email, PAN, address).
  // Must be a base64 string decoding to exactly 32 bytes. Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ENCRYPTION_KEY: z
    .string()
    .min(1, "ENCRYPTION_KEY is required")
    .refine((val) => Buffer.from(val, "base64").length === 32, {
      message: "ENCRYPTION_KEY must be a base64 string that decodes to exactly 32 bytes",
    }),
  // Developer/ops toggle: when false (default), admin-facing API responses return encrypted
  // ciphertext for sensitive fields. When true, they're transparently decrypted. Never gates a
  // user's view of their own data — only third-party (admin) visibility into others' PII.
  EXPOSE_DECRYPTED_DATA: zBoolean(false),

  SEED_ADMIN_NAME: z.string().default("Super Admin"),
  SEED_ADMIN_EMAIL: z.string().default("admin@mokshasewa.com"),
  SEED_ADMIN_PHONE: z.string().default("9999999999"),
  SEED_ADMIN_PASSWORD: z.string().default("change_this_password"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
