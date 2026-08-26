import { Schema, model, Document, Types } from "mongoose";
import { OrganisationStatus, ORGANISATION_STATUSES } from "../utils/constants";
export interface IOrganisation extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  slug: string;
  status: OrganisationStatus;
  logo?: {
    publicId?: string;
    secureUrl?: string;
  };
  legalDetails?: {
    registeredName?: string;
    panNumber?: string;
    registrationNumber?: string;
    registeredAddress?: string;
  };
  contactDetails?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const organisationSchema = new Schema<IOrganisation>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, immutable: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    status: { type: String, enum: ORGANISATION_STATUSES, default: "ACTIVE", index: true },
    logo: {
      publicId: { type: String, trim: true },
      secureUrl: { type: String, trim: true },
    },
    legalDetails: {
      registeredName: { type: String, trim: true },
      panNumber: { type: String, trim: true },
      registrationNumber: { type: String, trim: true },
      registeredAddress: { type: String, trim: true },
    },
    contactDetails: {
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Organisation = model<IOrganisation>("Organisation", organisationSchema);
