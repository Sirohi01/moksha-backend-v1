import { Request, Response } from "express";
import { Faq } from "../../models/faq.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";

export const listPublicFaqs = asyncHandler(async (_req: Request, res: Response) => {
  const faqs = await Faq.find({ isActive: true }).sort({ order: 1 });
  sendSuccess(res, 200, "FAQs fetched", faqs);
});
