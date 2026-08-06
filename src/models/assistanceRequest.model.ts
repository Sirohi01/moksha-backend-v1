import { Schema, model, Document, Types } from "mongoose";
import {
  RequestType,
  REQUEST_TYPES,
  RequestSource,
  REQUEST_SOURCES,
  AssistanceRequestStatus,
  ASSISTANCE_REQUEST_STATUSES,
} from "../utils/constants";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

/** PRD §11.4 "assistanceRequests" — the raw intake record, before a Case Manager verifies it and
 * converts it into an operational Case. Deliberately minimal-field per PRD §7.1's business rule:
 * only six fields are mandatory so the form stays usable by someone who has just lost a family
 * member, on a low-end phone, on a bad connection. */
export interface IAssistanceRequest extends Document {
  _id: Types.ObjectId;
  requestNo: string;
  type: RequestType;
  source: RequestSource;
  requester: {
    name: string;
    phone: string;
    altPhone?: string;
    email?: string;
    relation: string;
  };
  deceased: {
    name: string;
    age?: number;
    gender?: string;
    dateOfDeath?: Date;
  };
  location: {
    address: string;
    area?: string;
    city: string;
    state: string;
    pincode: string;
  };
  cremationPreference?: "WOOD" | "ELECTRIC" | "AS_AVAILABLE";
  notes?: string;
  consent: {
    dataProcessing: boolean;
    publishStory: boolean;
  };
  status: AssistanceRequestStatus;
  // PRD BR — non-blocking duplicate flag (48hr window on requester.phone, see
  // request.service.ts's checkForDuplicate). Never blocks submission — a grieving family
  // resubmitting is far more likely than a malicious duplicate — just surfaces for admin review.
  duplicateOfRequestId?: Types.ObjectId;
  duplicateNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const assistanceRequestSchema = new Schema<IAssistanceRequest>(
  {
    requestNo: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: REQUEST_TYPES, default: "NORMAL", index: true },
    source: { type: String, enum: REQUEST_SOURCES, default: "WEBSITE" },
    requester: {
      name: { type: String, required: true, trim: true },
      // phone is the public tracking lookup key (Case ID + phone) — never encrypted, same
      // documented constraint as every other exact-match field in this codebase.
      phone: { type: String, required: true, trim: true, index: true },
      altPhone: { type: String, trim: true },
      email: { type: String, trim: true },
      relation: { type: String, required: true, trim: true },
    },
    deceased: {
      name: { type: String, required: true, trim: true },
      age: { type: Number },
      gender: { type: String, trim: true },
      dateOfDeath: { type: Date },
    },
    location: {
      address: { type: String, required: true, trim: true },
      area: { type: String, trim: true },
      city: { type: String, required: true, trim: true, index: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    cremationPreference: { type: String, enum: ["WOOD", "ELECTRIC", "AS_AVAILABLE"] },
    notes: { type: String, trim: true },
    consent: {
      dataProcessing: { type: Boolean, required: true },
      publishStory: { type: Boolean, default: false },
    },
    status: { type: String, enum: ASSISTANCE_REQUEST_STATUSES, default: "SUBMITTED", index: true },
    duplicateOfRequestId: { type: Schema.Types.ObjectId, ref: "AssistanceRequest" },
    duplicateNote: { type: String, trim: true },
  },
  { timestamps: true }
);

// Requester email and the deceased's name/street-address are PII that isn't a lookup key —
// encrypted at rest like everything else in this codebase. requester.phone, location.city/
// state/pincode stay plain (phone is the tracking lookup key; the rest is needed for filtering).
encryptFieldsOnSave(assistanceRequestSchema, ["requester.email", "deceased.name", "location.address"]);

export const AssistanceRequest = model<IAssistanceRequest>("AssistanceRequest", assistanceRequestSchema);
