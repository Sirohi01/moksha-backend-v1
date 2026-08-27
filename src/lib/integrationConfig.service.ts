import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

export type SupportedOrganisationCode = "MOKSHA" | "NAMOGANGE" | "AROGYA";

export interface CloudinaryIntegrationConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface RazorpayIntegrationConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export interface SmtpIntegrationConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export interface OtpIntegrationConfig {
  msg91?: { authKey: string; templateId: string; senderId?: string };
  aisensy?: { apiKey: string; campaignOtp: string };
  opus?: { apiKey: string };
}

type IntegrationEnv = typeof env;

function normaliseOrganisationCode(code: string): SupportedOrganisationCode {
  const normalised = code.trim().toUpperCase();
  if (normalised === "MOKSHA" || normalised === "NAMOGANGE" || normalised === "AROGYA") {
    return normalised;
  }
  throw ApiError.internal(`Integration configuration is not defined for organisation ${normalised || "(empty)"}`);
}

function requireValues<T extends Record<string, string | undefined>>(
  organisationCode: SupportedOrganisationCode,
  integration: string,
  values: T
): { [K in keyof T]: string } {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw ApiError.internal(
      `${integration} is not configured for ${organisationCode}; missing ${missing.join(", ")}`
    );
  }
  return values as { [K in keyof T]: string };
}
export function resolveCloudinaryConfig(
  organisationCode: string,
  source: IntegrationEnv = env
): CloudinaryIntegrationConfig {
  const code = normaliseOrganisationCode(organisationCode);
  if (code === "MOKSHA") {
    return requireValues(code, "Cloudinary", {
      cloudName: source.CLOUDINARY_CLOUD_NAME,
      apiKey: source.CLOUDINARY_API_KEY,
      apiSecret: source.CLOUDINARY_API_SECRET,
    });
  }

  const prefix = code === "NAMOGANGE" ? "NAMOGANGE" : "AROGYA";
  return requireValues(code, "Cloudinary", {
    cloudName: source[`${prefix}_CLOUDINARY_CLOUD_NAME`],
    apiKey: source[`${prefix}_CLOUDINARY_API_KEY`],
    apiSecret: source[`${prefix}_CLOUDINARY_API_SECRET`],
  });
}

export function resolveRazorpayConfig(
  organisationCode: string,
  source: IntegrationEnv = env
): RazorpayIntegrationConfig {
  const code = normaliseOrganisationCode(organisationCode);
  if (code === "MOKSHA") {
    return requireValues(code, "Razorpay", {
      keyId: source.RAZORPAY_KEY_ID,
      keySecret: source.RAZORPAY_KEY_SECRET,
      webhookSecret: source.RAZORPAY_WEBHOOK_SECRET,
    });
  }

  const prefix = code === "NAMOGANGE" ? "NAMOGANGE" : "AROGYA";
  return requireValues(code, "Razorpay", {
    keyId: source[`${prefix}_RAZORPAY_KEY_ID`],
    keySecret: source[`${prefix}_RAZORPAY_KEY_SECRET`],
    webhookSecret: source[`${prefix}_RAZORPAY_WEBHOOK_SECRET`],
  });
}

export function resolveSmtpConfig(
  organisationCode: string,
  source: IntegrationEnv = env
): SmtpIntegrationConfig {
  const code = normaliseOrganisationCode(organisationCode);
  if (code === "MOKSHA") {
    const required = requireValues(code, "SMTP", {
      host: source.SMTP_HOST,
      user: source.SMTP_USER,
      pass: source.SMTP_PASS,
      fromName: source.SMTP_FROM_NAME,
      fromEmail: source.SMTP_FROM_EMAIL,
    });
    return { ...required, port: source.SMTP_PORT, secure: source.SMTP_SECURE };
  }

  const prefix = code === "NAMOGANGE" ? "NAMOGANGE" : "AROGYA";
  const required = requireValues(code, "SMTP", {
    host: source[`${prefix}_SMTP_HOST`],
    user: source[`${prefix}_SMTP_USER`],
    pass: source[`${prefix}_SMTP_PASS`],
    fromName: source[`${prefix}_SMTP_FROM_NAME`],
    fromEmail: source[`${prefix}_SMTP_FROM_EMAIL`],
  });
  const port = source[`${prefix}_SMTP_PORT`];
  if (!port) throw ApiError.internal(`SMTP is not configured for ${code}; missing port`);
  return { ...required, port, secure: source[`${prefix}_SMTP_SECURE`] };
}

export function resolveOtpConfig(
  organisationCode: string,
  source: IntegrationEnv = env
): OtpIntegrationConfig {
  const code = normaliseOrganisationCode(organisationCode);
  const prefix = code === "MOKSHA" ? "" : `${code}_`;
  const msg91AuthKey = source[`${prefix}MSG91_AUTH_KEY` as keyof IntegrationEnv] as string | undefined;
  const msg91TemplateId = source[`${prefix}MSG91_TEMPLATE_ID` as keyof IntegrationEnv] as string | undefined;
  const msg91SenderId = source[`${prefix}MSG91_SENDER_ID` as keyof IntegrationEnv] as string | undefined;
  const aisensyApiKey = source[`${prefix}AISENSY_API_KEY` as keyof IntegrationEnv] as string | undefined;
  const aisensyCampaignOtp = source[`${prefix}AISENSY_CAMPAIGN_OTP` as keyof IntegrationEnv] as string | undefined;
  const opusApiKey = code === "NAMOGANGE" ? source.NAMOGANGE_OPUS_API_KEY : undefined;

  if ((msg91AuthKey && !msg91TemplateId) || (!msg91AuthKey && msg91TemplateId)) {
    throw ApiError.internal(`MSG91 is not configured for ${code}; authKey and templateId are both required`);
  }
  if ((aisensyApiKey && !aisensyCampaignOtp) || (!aisensyApiKey && aisensyCampaignOtp)) {
    throw ApiError.internal(`AiSensy is not configured for ${code}; apiKey and campaignOtp are both required`);
  }
  if (!msg91AuthKey && !aisensyApiKey && !opusApiKey) {
    throw ApiError.internal(`OTP delivery is not configured for ${code}`);
  }
  return {
    msg91: msg91AuthKey && msg91TemplateId
      ? { authKey: msg91AuthKey, templateId: msg91TemplateId, senderId: msg91SenderId }
      : undefined,
    aisensy: aisensyApiKey && aisensyCampaignOtp
      ? { apiKey: aisensyApiKey, campaignOtp: aisensyCampaignOtp }
      : undefined,
    opus: opusApiKey ? { apiKey: opusApiKey } : undefined,
  };
}
