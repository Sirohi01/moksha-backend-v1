import { Schema, model, Document, Types } from "mongoose";
import { PartnerType, PARTNER_TYPES, PartnerStatus, PARTNER_STATUSES } from "../utils/constants";

/** PRD §11.4 "partners" — an institutional relationship (NGO, hospital, municipal body, corporate
 * CSR sponsor, cremation ground, etc.), tracked through a LEAD → ACTIVE → EXPIRED/INACTIVE
 * pipeline. Distinct from the logistics masters (vehicle/serviceProvider): those are day-to-day
 * operational lookups a Case Manager picks from, this is relationship/CSR bookkeeping an admin
 * manages — no hard delete, since a lapsed partnership is still part of the org's history. */
export interface IPartner extends Document {
  _id: Types.ObjectId;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  agreementDetails?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: PARTNER_TYPES, required: true },
    status: { type: String, enum: PARTNER_STATUSES, default: "LEAD", index: true },
    contactPerson: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    address: { type: String, trim: true },
    agreementDetails: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Partner = model<IPartner>("Partner", partnerSchema);
