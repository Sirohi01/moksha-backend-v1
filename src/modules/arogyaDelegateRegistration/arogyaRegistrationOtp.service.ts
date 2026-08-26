import crypto from "crypto";
import { ArogyaOtpChannel, ArogyaRegistrationOtp } from "../../models/arogyaRegistrationOtp.model";
import { sendArogyaOtpEmail, sendArogyaWhatsappOtp } from "../../lib/arogyaNotify.service";
import { ApiError } from "../../utils/ApiError";

const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;

const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");
const generateOtp = () => crypto.randomInt(100000, 999999).toString();

export async function sendOtp(organisationId: string, channel: ArogyaOtpChannel, destination: string, fullName: string): Promise<void> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await ArogyaRegistrationOtp.create({
    organisationId, channel, destination: destination.trim().toLowerCase(),
    otpHash: hashOtp(otp), expiresAt, verified: false, attempts: 0,
  });

  if (channel === "email") {
    await sendArogyaOtpEmail(destination, fullName, otp);
  } else {
    await sendArogyaWhatsappOtp(destination, fullName, otp);
  }
}

/** Marks the most recent unverified OTP for this destination as verified — does NOT delete it,
 * because the registration-completion step (arogyaDelegateRegistration.service.ts) needs to
 * confirm it's still verified+unexpired a second time before actually creating a record. It is
 * only ever consumed (deleted) there, once a registration is successfully created from it. */
export async function verifyOtp(organisationId: string, channel: ArogyaOtpChannel, destination: string, otp: string): Promise<void> {
  const record = await ArogyaRegistrationOtp.findOne({
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

/** Called only from within registration completion — confirms a verified, unexpired, unconsumed
 * OTP exists for this destination, then deletes it so it can never be reused for a second
 * registration. Throws if the check fails (registration is not created). */
export async function consumeVerifiedOtp(organisationId: string, channel: ArogyaOtpChannel, destination: string): Promise<void> {
  const record = await ArogyaRegistrationOtp.findOne({
    organisationId, channel, destination: destination.trim().toLowerCase(), verified: true,
  }).sort({ createdAt: -1 });

  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("Verification has expired — please verify your email or WhatsApp again");
  }
  await record.deleteOne();
}
