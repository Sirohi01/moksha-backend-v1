import { Schema, model, Document, Types } from "mongoose";

export const NAMO_OTP_CHANNELS = ["email", "mobile"] as const;
export type NamoOtpChannel = (typeof NAMO_OTP_CHANNELS)[number];
export interface INamoOtp extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  channel: NamoOtpChannel;
  destination: string;
  otpHash: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
}

const schema = new Schema<INamoOtp>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    channel: { type: String, enum: NAMO_OTP_CHANNELS, required: true },
    destination: { type: String, required: true, trim: true, lowercase: true, index: true },
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NamoOtp = model<INamoOtp>("NamoOtp", schema);
