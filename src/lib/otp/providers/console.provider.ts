import { logger } from "../../../config/logger";
import { OtpProvider } from "../otp.provider";

/** Dev-only provider: logs the OTP instead of sending a real SMS. No agency cost while building locally. */
export class ConsoleOtpProvider implements OtpProvider {
  async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info(`[DEV OTP] ${otp} for ${phone} (set OTP_PROVIDER=msg91 to send real SMS)`);
  }
}
