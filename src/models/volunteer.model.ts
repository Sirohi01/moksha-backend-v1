import { Schema, model, Document, Types } from "mongoose";
import {
  VolunteerStatus,
  VOLUNTEER_STATUSES,
  VolunteerAvailability,
  VOLUNTEER_AVAILABILITY,
  VolunteerGender,
  VOLUNTEER_GENDERS,
  VolunteerBloodGroup,
  VOLUNTEER_BLOOD_GROUPS,
  VolunteerSchedulePreference,
  VOLUNTEER_SCHEDULE_PREFERENCES,
  VolunteerPreferredRole,
  VOLUNTEER_PREFERRED_ROLES,
} from "../utils/constants";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

/** PRD §11.4 "volunteers" — a profile extension on top of the unified `users` collection (the
 * user's own name/phone/email/auth live there; this holds only what's volunteer-specific). One
 * Volunteer document per User with userType "VOLUNTEER", enforced by the unique index below.
 * dateOfBirth/gender/bloodGroup/address/state/pincode/motivation/experience/schedulePreference/
 * preferredRole are captured once at registration (the volunteer intake form) — address is PII
 * and encrypted at rest like every other street-address field in this codebase; state/pincode
 * stay plain alongside the existing `city` for filtering. */
export interface IVolunteer extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  city: string;
  skills: string[];
  status: VolunteerStatus;
  availability: VolunteerAvailability;
  totalAssignments: number;
  dateOfBirth?: Date;
  gender?: VolunteerGender;
  bloodGroup?: VolunteerBloodGroup;
  address?: string;
  state?: string;
  pincode?: string;
  motivation?: string;
  experience?: string;
  schedulePreference?: VolunteerSchedulePreference;
  preferredRole?: VolunteerPreferredRole;
  // Best-effort, filled in asynchronously by geocoding.ts after registration/profile updates —
  // plain (not encrypted), same "operationally necessary" carve-out as city/state/pincode: needed
  // directly for nearest-volunteer distance ranking.
  lat?: number;
  lng?: number;
  createdAt: Date;
  updatedAt: Date;
}

const volunteerSchema = new Schema<IVolunteer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    city: { type: String, required: true, trim: true, index: true },
    skills: { type: [String], default: [] },
    status: { type: String, enum: VOLUNTEER_STATUSES, default: "ACTIVE", index: true },
    availability: { type: String, enum: VOLUNTEER_AVAILABILITY, default: "AVAILABLE", index: true },
    totalAssignments: { type: Number, default: 0 },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: VOLUNTEER_GENDERS },
    bloodGroup: { type: String, enum: VOLUNTEER_BLOOD_GROUPS },
    address: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    motivation: { type: String, trim: true },
    experience: { type: String, trim: true },
    schedulePreference: { type: String, enum: VOLUNTEER_SCHEDULE_PREFERENCES },
    preferredRole: { type: String, enum: VOLUNTEER_PREFERRED_ROLES },
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true }
);

encryptFieldsOnSave(volunteerSchema, ["address"]);

export const Volunteer = model<IVolunteer>("Volunteer", volunteerSchema);
