import crypto from "crypto";
import { NamoOtpChannel, NamoOtp } from "../../models/namoOtp.model";
import { sendNamoOtpEmail, sendNamoWhatsappOtp } from "../../lib/namoNotify.service";
import { ApiError } from "../../utils/ApiError";

const OTP_TTL_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 5;

const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");
const generateOtp = () => crypto.randomInt(100000, 999999).toString();

export async function sendOtp(organisationId: string, channel: NamoOtpChannel, destination: string): Promise<void> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await NamoOtp.create({
    organisationId, channel, destination: destination.trim().toLowerCase(),
    otpHash: hashOtp(otp), expiresAt, verified: false, attempts: 0,
  });

  if (channel === "email") {
    await sendNamoOtpEmail(destination, otp);
  } else {
    await sendNamoWhatsappOtp(destination, otp);
  }
}

export async function verifyOtp(organisationId: string, channel: NamoOtpChannel, destination: string, otp: string): Promise<void> {
  const record = await NamoOtp.findOne({
    organisationId, channel, destination: destination.trim().toLowerCase(), verified: false,
  }).sort({ createdAt: -1 }).select("+otpHash");

  if (!record) throw ApiError.badRequest("No pending verification found — request a new code");
  if (record.expiresAt.getTime() < Date.now()) throw ApiError.badRequest("This code has expired — request a new one");
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) throw ApiError.badRequest("Too many incorrect attempts — request a new code");

  if (record.otpHash !== hashOtp(otp)) {
    record.attempts += 1;
    await record.save();
    throw ApiError.badRequest("Incorrect code");
  }

  record.verified = true;
  await record.save();
}
