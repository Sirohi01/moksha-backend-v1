import { Schema, model, Document, Types } from "mongoose";
import { ENQUIRY_STATUSES, EnquiryStatus } from "../utils/constants";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export interface IEnquiry extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  message: string;
  status: EnquiryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    name: { type: String, required: true, trim: true },
    // phone/email are encrypted at rest (see encryptFieldsOnSave below) — normalize casing in
    // the controller before save rather than via schema setters, which would mangle ciphertext.
    phone: { type: String, required: true },
    email: { type: String },
    message: { type: String, required: true },
    status: { type: String, enum: ENQUIRY_STATUSES, default: "new" },
  },
  { timestamps: true }
);

encryptFieldsOnSave(enquirySchema, ["phone", "email"]);

export const Enquiry = model<IEnquiry>("Enquiry", enquirySchema);
