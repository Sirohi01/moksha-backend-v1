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
  whatsappPhone?: string;
  occupation?: string;
  organisation?: string;
  volunteerAreas: string[];
  availabilityDays: string[];
  preferredTimes: string[];
  emergencyOnCall?: boolean;
  canParticipateFieldCases?: boolean;
  ownVehicle?: boolean;
  languagesKnown?: string;
  hoursPerWeek?: string;
  volunteeredBefore?: boolean;
  previousOrganisationRole?: string;
  emergencyContact?: { name?: string; relationship?: string; phone?: string };
  idProofType?: string;
  idProofNumber?: string;
  declarationAccepted?: boolean;
  photographUrl?: string;
  photographPublicId?: string;
  idProofUrl?: string;
  idProofPublicId?: string;
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
    whatsappPhone: { type: String, trim: true },
    occupation: { type: String, trim: true },
    organisation: { type: String, trim: true },
    volunteerAreas: { type: [String], default: [] },
    availabilityDays: { type: [String], default: [] },
    preferredTimes: { type: [String], default: [] },
    emergencyOnCall: { type: Boolean },
    canParticipateFieldCases: { type: Boolean },
    ownVehicle: { type: Boolean },
    languagesKnown: { type: String, trim: true },
    hoursPerWeek: { type: String, trim: true },
    volunteeredBefore: { type: Boolean },
    previousOrganisationRole: { type: String, trim: true },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    idProofType: { type: String, trim: true },
    idProofNumber: { type: String, trim: true },
    declarationAccepted: { type: Boolean, default: false },
    photographUrl: { type: String },
    photographPublicId: { type: String },
    idProofUrl: { type: String },
    idProofPublicId: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true }
);

encryptFieldsOnSave(volunteerSchema, ["address"]);

export const Volunteer = model<IVolunteer>("Volunteer", volunteerSchema);
