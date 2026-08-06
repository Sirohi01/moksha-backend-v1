import { env } from "../../config/env";
import { OtpProvider } from "./otp.provider";
import { ConsoleOtpProvider } from "./providers/console.provider";
import { Msg91OtpProvider } from "./providers/msg91.provider";
import { AisensyOtpProvider } from "./providers/aisensy.provider";

export function getOtpProvider(): OtpProvider {
  switch (env.OTP_PROVIDER) {
    case "msg91":
      return new Msg91OtpProvider();
    case "aisensy":
      return new AisensyOtpProvider();
    case "console":
    default:
      return new ConsoleOtpProvider();
  }
}
