import Razorpay from "razorpay";
import { env } from "../config/env";
import { resolveRazorpayConfig } from "./integrationConfig.service";

let client: Razorpay | null = null;

/** Lazily constructed so the app can boot even before Razorpay keys are configured. Moksha-only —
 * left untouched (still reads the unprefixed env vars directly) so the existing donation flow
 * can't be affected by anything below. */
export function getRazorpayClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }
  if (!client) {
    client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }
  return client;
}

const orgClients = new Map<string, Razorpay>();

/** Organisation-aware Razorpay client — resolves that organisation's own credentials via
 * integrationConfig.service.ts (fail-closed, no cross-org fallback). Cached per organisation code
 * so each org gets exactly one client instance, same lazy-construction reasoning as above. */
export function getOrgRazorpayClient(organisationCode: string): Razorpay {
  const cached = orgClients.get(organisationCode);
  if (cached) return cached;
  const config = resolveRazorpayConfig(organisationCode);
  const created = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  orgClients.set(organisationCode, created);
  return created;
}
