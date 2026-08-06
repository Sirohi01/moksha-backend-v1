import { Schema, model, Document, Types } from "mongoose";
import { ServiceProviderCategory, SERVICE_PROVIDER_CATEGORIES } from "../utils/constants";

/** PRD §11.4 — logistics master data: an external vendor (priest, caterer, ambulance service,
 * florist) a Case Manager can call on for a case, kept as a simple lookup list rather than a
 * relationship-managed Partner (see partner.model.ts) since these are day-to-day service calls,
 * not institutional partnerships. */
export interface IServiceProvider extends Document {
  _id: Types.ObjectId;
  name: string;
  category: ServiceProviderCategory;
  contactPerson?: string;
  contactPhone: string;
  address?: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const serviceProviderSchema = new Schema<IServiceProvider>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: SERVICE_PROVIDER_CATEGORIES, required: true },
    contactPerson: { type: String, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const ServiceProvider = model<IServiceProvider>("ServiceProvider", serviceProviderSchema);
