import { Schema, model, Document, Types } from "mongoose";

export interface ISystemServiceAccessGrant extends Document {
  requesterUserId: Types.ObjectId;
  tokenHash: string;
  ipHash: string;
  userAgentHash: string;
  approvedBy: Array<{ userId: Types.ObjectId; roleSlug: string }>;
  expiresAt: Date;
  createdAt: Date;
}

const schema = new Schema<ISystemServiceAccessGrant>({
  requesterUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  ipHash: { type: String, required: true },
  userAgentHash: { type: String, required: true },
  approvedBy: [{
    _id: false,
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roleSlug: { type: String, required: true },
  }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  createdAt: { type: Date, default: Date.now },
});

export const SystemServiceAccessGrant = model<ISystemServiceAccessGrant>("SystemServiceAccessGrant", schema);
