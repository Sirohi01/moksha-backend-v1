import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { Organisation } from "../../models/organisation.model";
import * as service from "./namoOtp.service";

async function orgId(): Promise<string> {
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Namo Gange organisation is not configured");
  return organisation._id.toString();
}

export const sendMobileOtp = asyncHandler(async (req: Request, res: Response) => {
  const { mobile } = req.body as { mobile: string };
  await service.sendOtp(await orgId(), "mobile", mobile);
  res.json({ success: true, message: "OTP sent to your WhatsApp" });
});

export const sendEmailOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await service.sendOtp(await orgId(), "email", email);
  res.json({ success: true, message: "OTP sent to your email" });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { mobile, email, otp } = req.body as { mobile?: string; email?: string; otp: string };
  const channel = mobile ? "mobile" : "email";
  await service.verifyOtp(await orgId(), channel, (mobile ?? email)!, otp);
  res.json({ success: true, message: "OTP verified successfully" });
});
