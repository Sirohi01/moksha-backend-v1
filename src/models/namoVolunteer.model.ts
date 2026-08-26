import crypto from "crypto";
import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export const NAMO_VOLUNTEER_STATUSES = ["PENDING_REVIEW", "ACTIVE", "INACTIVE", "REJECTED"] as const;
export type NamoVolunteerStatus = (typeof NAMO_VOLUNTEER_STATUSES)[number];
interface Reference { name?: string; mobile?: string; email?: string }

export interface INamoVolunteer extends Document {
  _id: Types.ObjectId; organisationId: Types.ObjectId; legacyId?: string;
  title: string; applicantName: string; surname: string; fatherName: string; gender: string;
  qualification?: string; occupation?: string; organisationType?: string; designation?: string; dob?: Date;
  mobile: string; mobileHash: string; alternateMobile?: string; email: string; emailHash: string; aadhaar?: string; aadhaarHash?: string;
  address?: string; country?: string; state?: string; city?: string; pincode?: string;
  emergencyRelation?: string; emergencyContact?: string; initiatives: string[];
  volunteeringFor?: string; networkingFor?: string; areaOfInterest?: string; monetarySupport?: string;
  reference1?: Reference; reference2?: Reference; areaOfRegion?: string; reportTo?: string; volunteerDesignation?: string;
  bankName?: string; accountNo?: string; ifscCode?: string; companyName?: string; businessAddress?: string;
  businessCountry?: string; businessState?: string; businessCity?: string; businessPincode?: string;
  businessDesignation?: string; businessContactNo?: string; profilePic?: string;
  status: NamoVolunteerStatus; reviewNotes?: string; createdAt: Date; updatedAt: Date;
}

const referenceSchema = new Schema<Reference>({ name: String, mobile: String, email: String }, { _id: false });
const schema = new Schema<INamoVolunteer>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true }, legacyId: String,
  title: { type: String, required: true, trim: true }, applicantName: { type: String, required: true, trim: true }, surname: { type: String, required: true, trim: true }, fatherName: { type: String, required: true, trim: true }, gender: { type: String, required: true, trim: true },
  qualification: String, occupation: String, organisationType: String, designation: String, dob: Date,
  mobile: { type: String, required: true }, mobileHash: { type: String, required: true, select: false }, alternateMobile: String,
  email: { type: String, required: true }, emailHash: { type: String, required: true, select: false }, aadhaar: { type: String, select: false }, aadhaarHash: { type: String, select: false },
  address: String, country: String, state: String, city: String, pincode: String, emergencyRelation: String, emergencyContact: String,
  initiatives: { type: [String], default: [] }, volunteeringFor: String, networkingFor: String, areaOfInterest: String, monetarySupport: String,
  reference1: referenceSchema, reference2: referenceSchema, areaOfRegion: String, reportTo: String, volunteerDesignation: String,
  bankName: String, accountNo: { type: String, select: false }, ifscCode: String, companyName: String, businessAddress: String,
  businessCountry: String, businessState: String, businessCity: String, businessPincode: String, businessDesignation: String, businessContactNo: String,
  profilePic: String, status: { type: String, enum: NAMO_VOLUNTEER_STATUSES, default: "PENDING_REVIEW", index: true }, reviewNotes: String,
}, { timestamps: true });

schema.index({ organisationId: 1, mobileHash: 1 }, { unique: true });
schema.index({ organisationId: 1, emailHash: 1 }, { unique: true });
schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });
const hash = (value: string) => crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
schema.pre("validate", function (next) {
  if (this.isModified("mobile")) this.mobileHash = hash(this.mobile.replace(/\D/g, ""));
  if (this.isModified("email")) this.emailHash = hash(this.email);
  if (this.isModified("aadhaar") && this.aadhaar) this.aadhaarHash = hash(this.aadhaar.replace(/\D/g, ""));
  next();
});
encryptFieldsOnSave(schema, ["mobile", "alternateMobile", "email", "aadhaar", "address", "emergencyContact", "reference1.mobile", "reference1.email", "reference2.mobile", "reference2.email", "accountNo", "businessAddress", "businessContactNo"]);
export const NamoVolunteer = model<INamoVolunteer>("NamoVolunteer", schema);
