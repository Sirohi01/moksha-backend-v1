import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../../config/env";
import { getOtpProvider } from "./otp.factory";

const otpProvider = getOtpProvider();

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function compareOtp(otp: string, otpHash: string): Promise<boolean> {
  return bcrypt.compare(otp, otpHash);
}

export function getOtpExpiry(): Date {
  return new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
}

export async function dispatchOtp(phone: string, otp: string): Promise<void> {
  await otpProvider.sendOtp(phone, otp);
}
