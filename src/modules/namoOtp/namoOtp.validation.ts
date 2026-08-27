import { z } from "zod";

export const sendMobileOtpSchema = z.object({
  body: z.object({ mobile: z.string().trim().min(6).max(20) }),
});

export const sendEmailOtpSchema = z.object({
  body: z.object({ email: z.string().trim().email() }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    mobile: z.string().trim().min(6).max(20).optional(),
    email: z.string().trim().email().optional(),
    otp: z.string().trim().length(6),
  }).refine((v) => !!(v.mobile || v.email), { message: "mobile or email is required" }),
});
