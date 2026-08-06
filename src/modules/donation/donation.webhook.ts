import crypto from "crypto";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import * as donationService from "./donation.service";

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
}

interface RazorpaySubscriptionEntity {
  id: string;
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    subscription?: { entity: RazorpaySubscriptionEntity };
  };
}

function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // Both sides are fixed-length hex digests of the same algorithm — safe to timingSafeEqual.
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * PRD §16.1 — the authoritative donation confirmation, independent of the donor's browser ever
 * returning to call /donations/verify. Mounted with a raw-body parser (see app.ts) so the exact
 * bytes Razorpay signed are available for HMAC verification; req.body here is a Buffer, not JSON.
 *
 * Razorpay's webhook delivery is at-least-once, so every handler below is idempotent — see
 * confirmPaymentTransaction / recordRecurringCharge in donation.service.ts.
 */
export const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw ApiError.internal("Razorpay webhook secret is not configured");
  }

  const rawBody = req.body as Buffer;
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  if (!verifySignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET)) {
    throw ApiError.unauthorized("Invalid webhook signature");
  }

  const event: RazorpayWebhookPayload = JSON.parse(rawBody.toString("utf8"));
  logger.info(`Razorpay webhook received: ${event.event}`);

  switch (event.event) {
    case "payment.captured": {
      const payment = event.payload.payment?.entity;
      if (payment?.order_id) await donationService.confirmOneTimePaymentByOrderId(payment.order_id, payment.id);
      break;
    }
    case "payment.failed": {
      const payment = event.payload.payment?.entity;
      if (payment?.order_id) await donationService.failOneTimePaymentByOrderId(payment.order_id);
      break;
    }
    case "subscription.charged": {
      const payment = event.payload.payment?.entity;
      const subscription = event.payload.subscription?.entity;
      if (payment?.order_id && subscription?.id) {
        await donationService.recordRecurringCharge({
          subscriptionId: subscription.id,
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          // Razorpay's webhook payload is already paise-native, matching this app's own storage
          // unit (PRD §11.1) — no conversion needed.
          amount: payment.amount,
        });
      }
      break;
    }
    case "subscription.cancelled": {
      const subscription = event.payload.subscription?.entity;
      if (subscription?.id) await donationService.updateRecurringStatusBySubscriptionId(subscription.id, "CANCELLED");
      break;
    }
    case "subscription.completed": {
      const subscription = event.payload.subscription?.entity;
      if (subscription?.id) await donationService.updateRecurringStatusBySubscriptionId(subscription.id, "COMPLETED");
      break;
    }
    case "subscription.halted": {
      const subscription = event.payload.subscription?.entity;
      if (subscription?.id) await donationService.updateRecurringStatusBySubscriptionId(subscription.id, "HALTED");
      break;
    }
    default:
      // Unhandled event types are acknowledged, not errors — Razorpay retries on non-2xx.
      break;
  }

  res.status(200).json({ received: true });
});
