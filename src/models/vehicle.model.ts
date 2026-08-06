import { Schema, model, Document, Types } from "mongoose";
import { VehicleType, VEHICLE_TYPES } from "../utils/constants";

/** PRD §11.4 — logistics master data: a vehicle (hearse/ambulance/van) available for case
 * transport, assigned ad hoc per case rather than through a formal assignment collection since
 * a case only ever needs one at a time. */
export interface IVehicle extends Document {
  _id: Types.ObjectId;
  type: VehicleType;
  registrationNumber: string;
  capacity?: number;
  driverName?: string;
  driverPhone?: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    type: { type: String, enum: VEHICLE_TYPES, required: true },
    registrationNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
    capacity: { type: Number, min: 1 },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Vehicle = model<IVehicle>("Vehicle", vehicleSchema);
