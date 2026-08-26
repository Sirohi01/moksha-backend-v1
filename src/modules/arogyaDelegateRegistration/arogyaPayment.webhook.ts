import crypto from "crypto";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../config/logger";
import { resolveRazorpayConfig } from "../../lib/integrationConfig.service";
import { ArogyaPayment } from "../../models/arogyaPayment.model";

interface RazorpayPaymentEntity { id: string; order_id?: string }
interface RazorpayWebhookPayload { event: string; payload: { payment?: { entity: RazorpayPaymentEntity } } }

function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Reconciliation backstop for Arogya payments — same reasoning as Moksha's own donation webhook
 * (donation.webhook.ts): the authoritative confirmation must not depend solely on the delegate's
 * browser staying open long enough to call /payment/verify. Mounted with its own raw-body parser
 * (see app.ts) before express.json(), for the same byte-exactness reason.
 *
 * URL is organisation-specific (/webhooks/razorpay/arogya) rather than a shared path, per
 * UNIFIED_PLATFORM_STATE.md's integration-resolver design — the correct AROGYA_RAZORPAY_
 * WEBHOOK_SECRET must be selected before signature verification is even attempted, and a shared
 * generic path can't do that safely once more than one organisation has its own Razorpay account.
 *
 * Registering this URL in the Razorpay dashboard (Settings > Webhooks) is a one-time manual step
 * the account owner does once a public HTTPS URL exists — not something this code can do itself.
 */
export const handleArogyaRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { webhookSecret } = resolveRazorpayConfig("AROGYA"); // throws (fails closed) if not configured

  const rawBody = req.body as Buffer;
  const signature = req.headers["x-razorpay-signature"] as string | undefined;

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    throw ApiError.unauthorized("Invalid webhook signature");
  }

  const event: RazorpayWebhookPayload = JSON.parse(rawBody.toString("utf8"));
  logger.info(`Arogya Razorpay webhook received: ${event.event}`);

  if (event.event === "payment.captured" || event.event === "payment.authorized") {
    const entity = event.payload.payment?.entity;
    if (entity?.order_id) {
      const payment = await ArogyaPayment.findOne({ gatewayOrderId: entity.order_id });
      // Idempotent: a payment already marked PAID (by the client-invoked /verify call racing
      // ahead of this webhook, the normal case) is left untouched — this handler's job is only to
      // catch the case where that call never happened.
      if (payment && payment.status !== "PAID") {
        payment.status = "PAID";
        payment.gatewayPaymentId = entity.id;
        await payment.save();
        logger.info(`Arogya payment ${payment._id.toString()} confirmed via webhook (order ${entity.order_id})`);
      }
    }
  }

  // Razorpay retries on any non-2xx — acknowledge every event, including ones this handler
  // doesn't act on, so an event type added later doesn't cause a retry storm.
  res.status(200).json({ received: true });
});
