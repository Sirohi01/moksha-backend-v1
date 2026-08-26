import { Schema, model, Document, Types } from "mongoose";

export const AROGYA_OTP_CHANNELS = ["email", "whatsapp"] as const;
export type ArogyaOtpChannel = (typeof AROGYA_OTP_CHANNELS)[number];

/** Short-lived verification record for the Arogya delegate registration form — deliberately not
 * tied to a User account (a delegate registering is not a platform login). Separate from Moksha's
 * own auth OTP system (src/lib/otp/), which is for staff/donor login. */
export interface IArogyaRegistrationOtp extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  channel: ArogyaOtpChannel;
  destination: string;
  otpHash: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
}

const schema = new Schema<IArogyaRegistrationOtp>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    channel: { type: String, enum: AROGYA_OTP_CHANNELS, required: true },
    destination: { type: String, required: true, trim: true, lowercase: true, index: true },
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Mongo TTL index — expired, unverified OTP attempts are reaped automatically rather than
// accumulating forever.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ArogyaRegistrationOtp = model<IArogyaRegistrationOtp>("ArogyaRegistrationOtp", schema);
