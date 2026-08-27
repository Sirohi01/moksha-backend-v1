import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export const NAMO_JOB_APPLICATION_STATUSES = ["Pending", "Reviewed", "Rejected"] as const;
export type NamoJobApplicationStatus = (typeof NAMO_JOB_APPLICATION_STATUSES)[number];
export interface INamoJobApplication extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  currentLocation?: string;
  role?: string;
  message?: string;
  status: NamoJobApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoJobApplication>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    email: String,
    phone: String,
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    currentLocation: { type: String, trim: true },
    role: { type: String, trim: true },
    message: String,
    status: { type: String, enum: NAMO_JOB_APPLICATION_STATUSES, default: "Pending", index: true },
  },
  { timestamps: true }
);

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

encryptFieldsOnSave(schema, ["email", "phone", "message"]);

export const NamoJobApplication = model<INamoJobApplication>("NamoJobApplication", schema);
