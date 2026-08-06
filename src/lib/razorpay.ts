import Razorpay from "razorpay";
import { env } from "../config/env";

let client: Razorpay | null = null;

/** Lazily constructed so the app can boot even before Razorpay keys are configured. */
export function getRazorpayClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }
  if (!client) {
    client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return client;
}
