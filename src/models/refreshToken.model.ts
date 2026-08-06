import { Schema, model, Document, Types } from "mongoose";

/** PRD §11.3/§15.1 "refreshTokens" — server-side revocable sessions. The refresh token itself is
 * an opaque random string handed to the client; only its SHA-256 hash lives here, so a leaked
 * database can never be used to forge a session. Rotation is tracked via `replacedBy`: presenting
 * an already-rotated (or revoked) token again is treated as theft — see session.service.ts. */
export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  deviceInfo?: { userAgent?: string; ip?: string; platform?: string };
  expiresAt: Date;
  revokedAt?: Date;
  replacedBy?: Types.ObjectId;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    deviceInfo: {
      userAgent: { type: String },
      ip: { type: String },
      platform: { type: String },
    },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedBy: { type: Schema.Types.ObjectId, ref: "RefreshToken" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export const RefreshToken = model<IRefreshToken>("RefreshToken", refreshTokenSchema);
