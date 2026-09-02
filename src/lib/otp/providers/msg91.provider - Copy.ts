import { env } from "../../../config/env";
import { ApiError } from "../../../utils/ApiError";
import { OtpProvider } from "../otp.provider";

/**
 * MSG91 is one common SMS agency for Indian OTP delivery — included as a working example.
 * If you pick a different agency, add a sibling file implementing OtpProvider and register it
 * in otp.factory.ts; nothing else in the codebase needs to change.
 */
export class Msg91OtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
      throw ApiError.internal("MSG91 credentials are not configured");
    }

    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: env.MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        template_id: env.MSG91_TEMPLATE_ID,
        mobile: phone,
        otp,
        sender: env.MSG91_SENDER_ID,
      }),
    });

    if (!response.ok) {
      throw ApiError.internal("Failed to send OTP via MSG91");
    }
  }
}
