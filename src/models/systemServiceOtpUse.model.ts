import { Schema, model, Document } from "mongoose";

interface ISystemServiceOtpUse extends Document {
  digest: string;
  expiresAt: Date;
}

const schema = new Schema<ISystemServiceOtpUse>({
  digest: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const SystemServiceOtpUse = model<ISystemServiceOtpUse>("SystemServiceOtpUse", schema);
