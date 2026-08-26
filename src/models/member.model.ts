import crypto from "crypto";
import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export const MEMBER_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "REJECTED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export interface IMember extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  title?: string;
  applicantName: string;
  surname?: string;
  fatherMotherSpouseName?: string;
  gender?: string;
  qualification?: string;
  occupation?: string;
  organisationType?: string;
  designation?: string;
  dob?: Date;
  mobile: string;
  mobileHash: string;
  alternateNo?: string;
  email: string;
  emailHash: string;
  aadharNo?: string;
  aadharHash?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  pinCode?: string;
  bloodGroup?: string;
  relation?: string;
  emergencyContact?: string;
  initiatives: string[];
  volunteeringFor: string[];
  networkingFor: string[];
  areaOfInterest: string[];
  monetarySupport?: string;
  reference1?: Record<string, unknown>;
  reference2?: Record<string, unknown>;
  profilePic?: string;
  status: MemberStatus;
  createdAt: Date;
  updatedAt: Date;
}

const hash = (value: string) => crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

const memberSchema = new Schema<IMember>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  legacyId: { type: String, trim: true },
  title: { type: String, trim: true },
  applicantName: { type: String, required: true, trim: true },
  surname: { type: String, trim: true },
  fatherMotherSpouseName: { type: String, trim: true },
  gender: { type: String, trim: true },
  qualification: { type: String, trim: true },
  occupation: { type: String, trim: true },
  organisationType: { type: String, trim: true },
  designation: { type: String, trim: true },
  dob: Date,
  mobile: { type: String, required: true },
  mobileHash: { type: String, required: true, select: false },
  alternateNo: String,
  email: { type: String, required: true },
  emailHash: { type: String, required: true, select: false },
  aadharNo: { type: String, select: false },
  aadharHash: { type: String, select: false },
  address: String,
  country: { type: String, trim: true },
  state: { type: String, trim: true },
  city: { type: String, trim: true },
  pinCode: { type: String, trim: true },
  bloodGroup: { type: String, trim: true },
  relation: { type: String, trim: true },
  emergencyContact: String,
  initiatives: { type: [String], default: [] },
  volunteeringFor: { type: [String], default: [] },
  networkingFor: { type: [String], default: [] },
  areaOfInterest: { type: [String], default: [] },
  monetarySupport: { type: String, trim: true },
  reference1: Schema.Types.Mixed,
  reference2: Schema.Types.Mixed,
  profilePic: { type: String, trim: true },
  status: { type: String, enum: MEMBER_STATUSES, default: "PENDING", index: true },
}, { timestamps: true });

memberSchema.index({ organisationId: 1, mobileHash: 1 }, { unique: true });
memberSchema.index({ organisationId: 1, emailHash: 1 }, { unique: true });
memberSchema.index({ organisationId: 1, legacyId: 1 }, { unique: true, sparse: true });

memberSchema.pre("validate", function (next) {
  if (this.isModified("mobile")) this.mobileHash = hash(this.mobile.replace(/\D/g, ""));
  if (this.isModified("email")) this.emailHash = hash(this.email);
  if (this.isModified("aadharNo") && this.aadharNo) this.aadharHash = hash(this.aadharNo.replace(/\D/g, ""));
  next();
});

encryptFieldsOnSave(memberSchema, ["mobile", "alternateNo", "email", "aadharNo", "address", "emergencyContact"]);

export const Member = model<IMember>("Member", memberSchema);
