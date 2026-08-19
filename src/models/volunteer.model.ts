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
export interface IVolunteer extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  code?: string;
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
  // Office-use fields, admin-managed (PRD-adjacent addition — printed on the registration form's
  // "For Office Use Only" section instead of being blank lines for hand-filling after printing).
  verified: boolean;
  assignedRole?: string;
  assignedArea?: string;
  approvedByUserId?: Types.ObjectId;
  approvedAt?: Date;
  // Defaults to the registration date (createdAt) unless an admin explicitly overrides it —
  // resolved at read time in volunteer.service.ts, not stored redundantly here.
  joiningDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const volunteerSchema = new Schema<IVolunteer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    // sparse: true — volunteers registered before this field existed have no code, and a plain
    // unique index would treat every one of those "missing" values as the same null and collide.
    code: { type: String, unique: true, sparse: true },
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
    verified: { type: Boolean, default: false },
    assignedRole: { type: String, trim: true },
    assignedArea: { type: String, trim: true },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    joiningDate: { type: Date },
  },
  { timestamps: true }
);

encryptFieldsOnSave(volunteerSchema, ["address"]);

export const Volunteer = model<IVolunteer>("Volunteer", volunteerSchema);
