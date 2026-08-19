import { Request } from "express";
import rateLimit from "express-rate-limit";

/** Combines the caller's IP with a request-body field (phone/email) so an attacker can't dodge
 * the limit just by rotating IPs while keeping the target fixed, or vice versa. Falls back to IP
 * alone when the field is missing/not a string — validate() always runs before these limiters, so
 * malformed bodies are already rejected by the time this reads req.body. */
function keyByIpAnd(field: string) {
  return (req: Request): string => {
    const value = req.body?.[field];
    return typeof value === "string" && value ? `${req.ip}:${value.toLowerCase()}` : `${req.ip}`;
  };
}

/** A legitimate user requests an OTP once, maybe retries once or twice. This blocks SMS-bombing a
 * phone number and distributed OTP brute-forcing without affecting normal use. */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAnd("phone"),
  message: { success: false, message: "Too many OTP requests for this number. Please try again later." },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAnd("phone"),
  message: { success: false, message: "Too many attempts. Please request a new OTP and try again later." },
});

/** Covers forgot-password and account registration — both are prone to enumeration/spam abuse
 * from a single source, but a genuine user rarely needs more than a couple of tries. */
export const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAnd("email"),
  message: { success: false, message: "Too many requests. Please try again later." },
});

/** Generic guard for public, unauthenticated write endpoints (contact/enquiry, CSR, partnership,
 * unclaimed-body, assistance requests, newsletter signup). A real visitor submits a given form
 * once; this only bites automated flooding. */
export const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions from this connection. Please try again later." },
});

/** Guest checkout donations legitimately retry more (payment failures, changed amount), so this
 * stays looser than publicFormLimiter while still capping runaway automated order creation. */
export const donationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

/** Public case-status lookup (case ID + phone, no login) — loose enough for a family checking
 * repeatedly, tight enough to blunt case-ID enumeration attempts. */
export const caseTrackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many lookups from this connection. Please try again later." },
});
