import { Request, Response } from "express";
import { Enquiry, IEnquiry } from "../../models/enquiry.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import { notify } from "../../lib/notify.service";
import { notifyAdmins } from "../../lib/adminNotify.service";

function serializeEnquiry(enquiry: IEnquiry, reveal: (v: string) => string) {
  const obj = enquiry.toObject();
  obj.phone = reveal(obj.phone);
  if (obj.email) obj.email = reveal(obj.email);
  return obj;
}

export const createEnquiry = asyncHandler(async (req: Request, res: Response) => {
  const email: string | undefined = req.body.email?.trim().toLowerCase();
  const enquiry = await Enquiry.create({ ...req.body, email });

  // Best-effort — email is optional on this form, and notify() never throws anyway.
  if (email) {
    await notify("enquiry.received", { email }, { name: req.body.name, message: req.body.message });
  }
  await notifyAdmins("ENQUIRY", `New enquiry from ${req.body.name}`, req.body.message, "/enquiries");

  // The submitter is viewing their own just-sent enquiry — always decrypt, never gated.
  sendSuccess(res, 201, "Thank you for reaching out, we'll contact you shortly", serializeEnquiry(enquiry, decryptField));
});

export const updateEnquiryStatus = asyncHandler(async (req: Request, res: Response) => {
  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!enquiry) throw ApiError.notFound("Enquiry not found");
  // Admin viewing someone else's PII — gated by the EXPOSE_DECRYPTED_DATA toggle.
  sendSuccess(res, 200, "Enquiry status updated", serializeEnquiry(enquiry, maybeDecrypt));
});
