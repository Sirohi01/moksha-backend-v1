import { env } from "../../config/env";
import { resolveCloudinaryConfig, resolveOtpConfig, resolveRazorpayConfig, resolveSmtpConfig } from "../integrationConfig.service";

function integrationEnv(overrides: Partial<typeof env>): typeof env {
  return { ...env, ...overrides };
}

describe("organisation integration configuration", () => {
  it("maps legacy unprefixed Cloudinary variables only to Moksha", () => {
    const source = integrationEnv({
      CLOUDINARY_CLOUD_NAME: "moksha-cloud",
      CLOUDINARY_API_KEY: "moksha-key",
      CLOUDINARY_API_SECRET: "moksha-secret",
      NAMOGANGE_CLOUDINARY_CLOUD_NAME: undefined,
      NAMOGANGE_CLOUDINARY_API_KEY: undefined,
      NAMOGANGE_CLOUDINARY_API_SECRET: undefined,
    });

    expect(resolveCloudinaryConfig("moksha", source)).toEqual({
      cloudName: "moksha-cloud",
      apiKey: "moksha-key",
      apiSecret: "moksha-secret",
    });
    expect(() => resolveCloudinaryConfig("NAMOGANGE", source)).toThrow(/not configured for NAMOGANGE/);
  });

  it("resolves Arogya Cloudinary credentials without falling back to Moksha", () => {
    const source = integrationEnv({
      CLOUDINARY_CLOUD_NAME: "moksha-cloud",
      CLOUDINARY_API_KEY: "moksha-key",
      CLOUDINARY_API_SECRET: "moksha-secret",
      AROGYA_CLOUDINARY_CLOUD_NAME: "arogya-cloud",
      AROGYA_CLOUDINARY_API_KEY: "arogya-key",
      AROGYA_CLOUDINARY_API_SECRET: "arogya-secret",
    });
    expect(resolveCloudinaryConfig("AROGYA", source).cloudName).toBe("arogya-cloud");
  });

  it("fails explicitly when an organisation's Razorpay configuration is incomplete", () => {
    const source = integrationEnv({
      NAMOGANGE_RAZORPAY_KEY_ID: "namo-key",
      NAMOGANGE_RAZORPAY_KEY_SECRET: undefined,
      NAMOGANGE_RAZORPAY_WEBHOOK_SECRET: undefined,
    });
    expect(() => resolveRazorpayConfig("NAMOGANGE", source)).toThrow(/keySecret, webhookSecret/);
  });

  it("rejects unknown organisation codes", () => {
    expect(() => resolveCloudinaryConfig("UNKNOWN", env)).toThrow(/not defined/);
  });

  it("does not fall back to Moksha SMTP credentials for Namo Gange", () => {
    const source = integrationEnv({
      SMTP_HOST: "smtp.moksha.test",
      SMTP_USER: "moksha",
      SMTP_PASS: "secret",
      NAMOGANGE_SMTP_HOST: undefined,
      NAMOGANGE_SMTP_USER: undefined,
    });
    expect(() => resolveSmtpConfig("NAMOGANGE", source)).toThrow(/SMTP is not configured for NAMOGANGE/);
  });

  it("resolves complete organisation-specific OTP providers", () => {
    const source = integrationEnv({
      AROGYA_MSG91_AUTH_KEY: "arogya-auth",
      AROGYA_MSG91_TEMPLATE_ID: "arogya-template",
    });
    expect(resolveOtpConfig("AROGYA", source).msg91).toEqual({
      authKey: "arogya-auth",
      templateId: "arogya-template",
      senderId: undefined,
    });
  });
});
