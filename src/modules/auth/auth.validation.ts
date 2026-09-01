import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const sendOtpSchema = z.object({
  body: z.object({
    phone: phoneSchema,
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    otp: z.string().length(6, "OTP must be 6 digits"),
    name: z.string().trim().min(2).optional(),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    phone: phoneSchema,
    email: z.string().trim().email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1, "Email, mobile number or employee ID is required").optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(1, "Password is required"),
    totpCode: z.string().trim().optional(),
  }).refine((body) => Boolean(body.identifier || body.email), {
    message: "Email, mobile number or employee ID is required",
    path: ["identifier"],
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
});

export const confirmTwoFactorSchema = z.object({
  body: z.object({
    code: z.string().trim().min(6, "Enter the 6-digit code from your authenticator app"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().min(32, "Invalid or missing reset token"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
});
