import { Request, Response } from "express";
import { NewsletterSubscriber } from "../../models/newsletterSubscriber.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { notify } from "../../lib/notify.service";
import { sendAdminFormSubmissionEmail } from "../adminEmail/adminEmail.service";

/** Idempotent — re-submitting the same email is a success, not a 409, since the visitor has no
 * way to know whether they already subscribed and shouldn't be shown an error either way. */
export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const email = req.body.email.trim().toLowerCase();
  const result = await NewsletterSubscriber.updateOne(
    { email },
    { $setOnInsert: { email, source: req.body.source } },
    { upsert: true }
  );
  // Only on the actual first subscription — a re-submit shouldn't re-send the confirmation.
  if (result.upsertedCount > 0) {
    await notify("newsletter.subscribed", { email }, {});
    sendAdminFormSubmissionEmail({
      formName: "Newsletter / Request Support",
      userName: email,
      details: {
        email,
        source: req.body.source,
      },
    });
  }
  sendSuccess(res, 201, "Thank you — our team will be in touch.", null);
});

export const listSubscribers = asyncHandler(async (_req: Request, res: Response) => {
  const subscribers = await NewsletterSubscriber.find().sort({ createdAt: -1 });
  sendSuccess(res, 200, "Subscribers fetched", subscribers);
});
