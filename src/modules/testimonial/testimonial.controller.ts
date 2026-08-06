import { Request, Response } from "express";
import { Testimonial } from "../../models/testimonial.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";

export const listApprovedTestimonials = asyncHandler(async (_req: Request, res: Response) => {
  const testimonials = await Testimonial.find({ isApproved: true }).sort({ createdAt: -1 });
  sendSuccess(res, 200, "Testimonials fetched", testimonials);
});

export const submitTestimonial = asyncHandler(async (req: Request, res: Response) => {
  const testimonial = await Testimonial.create({ ...req.body, isApproved: false });
  sendSuccess(res, 201, "Thank you! Your testimonial will appear after review", testimonial);
});
