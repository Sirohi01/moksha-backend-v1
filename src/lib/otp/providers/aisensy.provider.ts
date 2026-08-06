import { env } from "../../../config/env";
import { ApiError } from "../../../utils/ApiError";
import { logger } from "../../../config/logger";
import { OtpProvider } from "../otp.provider";

/**
 * AiSensy delivers OTPs over WhatsApp via a pre-approved message template ("campaign").
 * Requires an active AiSensy account with an approved OTP template — AISENSY_CAMPAIGN_OTP must
 * match that template's campaign name exactly, and the template must be Meta-approved (new
 * templates can sit in "pending" for a while — sends silently go nowhere until approved).
 */
export class AisensyOtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    if (!env.AISENSY_API_KEY || !env.AISENSY_CAMPAIGN_OTP) {
      throw ApiError.internal("AiSensy credentials are not configured");
    }

    // AiSensy expects the destination with country code, no leading '+'. Our phone numbers are
    // validated as 10-digit Indian mobile numbers, so India's country code is prefixed here.
    const destination = phone.startsWith("91") ? phone : `91${phone}`;

    const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: env.AISENSY_API_KEY,
        campaignName: env.AISENSY_CAMPAIGN_OTP,
        destination,
        userName: "Moksha Sewa",
        templateParams: [otp],
      }),
    });

    // AiSensy (like several WhatsApp API providers) can return HTTP 200 with a JSON body that
    // still reports failure (bad campaign name, unapproved template, etc.) — trusting response.ok
    // alone would swallow that and report "sent" when nothing went out. Parse and check the body.
    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; status?: string }
      | null;
    const failed = !response.ok || body?.success === false || body?.status === "error";

    if (failed) {
      logger.error("AiSensy OTP send failed", { status: response.status, body, destination });
      throw ApiError.internal("Failed to send OTP via AiSensy");
    }
  }
}
