import { Schema, model, Document } from "mongoose";

export interface IRedirect extends Document {
  source: string;
  destination: string;
  permanent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const redirectSchema = new Schema<IRedirect>(
  {
    source: { type: String, required: true, trim: true, unique: true },
    destination: { type: String, required: true, trim: true },
    permanent: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Redirect = model<IRedirect>("Redirect", redirectSchema);
