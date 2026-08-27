import "dotenv/config";
import { z } from "zod";
import { zBoolean } from "../utils/zodHelpers";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default("/api/v1"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  ADMIN_CLIENT_URL: z.string().default("http://localhost:3001"),
  // Namo Gange and Arogya each have their own real public site, on their own origin — see
  // UNIFIED_PLATFORM_STATE.md §D. Both must be explicitly allow-listed for CORS (app.ts); there
  // is no wildcard, and adding an organisation's site here is the only code change its browser
  // traffic needs once the legacy-compat routes exist.
  NAMOGANGE_CLIENT_URL: z.string().default("http://localhost:3002"),
  // Arogya-frontend's own vite.config.js pins its dev server to 8080 (not Vite's 5173 default).
  AROGYA_CLIENT_URL: z.string().default("http://localhost:8080"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_ACCESS_PRIVATE_KEY: z.string().min(1, "JWT_ACCESS_PRIVATE_KEY is required"),
  JWT_ACCESS_PUBLIC_KEY: z.string().min(1, "JWT_ACCESS_PUBLIC_KEY is required"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().regex(/^\d+[smhd]$/, 'Must look like "30d", "15m", etc.').default("30d"),

  OTP_PROVIDER: z.enum(["console", "msg91", "aisensy"]).default("console"),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  AISENSY_API_KEY: z.string().optional(),
  AISENSY_CAMPAIGN_OTP: z.string().optional(),
  ADMIN_WHATSAPP_NUMBER: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: zBoolean(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Moksha Sewa"),
  SMTP_FROM_EMAIL: z.string().default("no-reply@mokshasewa.com"),
  ADMIN_NOTIFICATION_EMAIL: z.string().trim().email().default("chudharyaman1920@gmail.com"),
  NAMOGANGE_SMTP_HOST: z.string().optional(),
  NAMOGANGE_SMTP_PORT: z.coerce.number().optional(),
  NAMOGANGE_SMTP_SECURE: zBoolean(false),
  NAMOGANGE_SMTP_USER: z.string().optional(),
  NAMOGANGE_SMTP_PASS: z.string().optional(),
  NAMOGANGE_SMTP_FROM_NAME: z.string().optional(),
  NAMOGANGE_SMTP_FROM_EMAIL: z.string().optional(),
  AROGYA_SMTP_HOST: z.string().optional(),
  AROGYA_SMTP_PORT: z.coerce.number().optional(),
  AROGYA_SMTP_SECURE: zBoolean(false),
  AROGYA_SMTP_USER: z.string().optional(),
  AROGYA_SMTP_PASS: z.string().optional(),
  AROGYA_SMTP_FROM_NAME: z.string().optional(),
  AROGYA_SMTP_FROM_EMAIL: z.string().optional(),

  NAMOGANGE_MSG91_AUTH_KEY: z.string().optional(),
  NAMOGANGE_MSG91_TEMPLATE_ID: z.string().optional(),
  NAMOGANGE_MSG91_SENDER_ID: z.string().optional(),
  NAMOGANGE_AISENSY_API_KEY: z.string().optional(),
  NAMOGANGE_AISENSY_CAMPAIGN_OTP: z.string().optional(),
  NAMOGANGE_OPUS_API_KEY: z.string().optional(),
  AROGYA_MSG91_AUTH_KEY: z.string().optional(),
  AROGYA_MSG91_TEMPLATE_ID: z.string().optional(),
  AROGYA_MSG91_SENDER_ID: z.string().optional(),
  AROGYA_AISENSY_API_KEY: z.string().optional(),
  AROGYA_AISENSY_CAMPAIGN_OTP: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  NAMOGANGE_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  NAMOGANGE_CLOUDINARY_API_KEY: z.string().optional(),
  NAMOGANGE_CLOUDINARY_API_SECRET: z.string().optional(),
  AROGYA_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  AROGYA_CLOUDINARY_API_KEY: z.string().optional(),
  AROGYA_CLOUDINARY_API_SECRET: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  NAMOGANGE_RAZORPAY_KEY_ID: z.string().optional(),
  NAMOGANGE_RAZORPAY_KEY_SECRET: z.string().optional(),
  NAMOGANGE_RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  AROGYA_RAZORPAY_KEY_ID: z.string().optional(),
  AROGYA_RAZORPAY_KEY_SECRET: z.string().optional(),
  AROGYA_RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z
    .string()
    .min(1, "ENCRYPTION_KEY is required")
    .refine((val) => Buffer.from(val, "base64").length === 32, {
      message: "ENCRYPTION_KEY must be a base64 string that decodes to exactly 32 bytes",
    }),
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
