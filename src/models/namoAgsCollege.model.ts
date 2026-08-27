import { Document, model, Schema, Types } from "mongoose";

interface CollegeContact {
  contactPerson?: string;
  designation?: string;
  email?: string;
  mobile?: string;
  alternate?: string;
  landline?: string;
}

/** AGS's institution outreach directory (Backend_Namo_Gange/src/models/college/College.js,
 * collection "colleges") — kept as its own model rather than folded into NamoLookup because of
 * the real `contacts` subdocument array, which the generic payload pattern handles less cleanly
 * than a proper schema. `affilated_to` keeps the real legacy field-name typo intentionally. */
export interface INamoAgsCollege extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  collegeName: string;
  category?: string;
  website?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  affilatedTo?: string;
  status: "Active" | "Inactive";
  contacts: CollegeContact[];
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<CollegeContact>(
  { contactPerson: String, designation: String, email: String, mobile: String, alternate: String, landline: String },
  { _id: false }
);

const schema = new Schema<INamoAgsCollege>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  legacyId: { type: String, trim: true },
  collegeName: { type: String, required: true, trim: true },
  category: String,
  website: String,
  address: String,
  country: String,
  state: String,
  city: String,
  pincode: String,
  affilatedTo: String,
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  contacts: { type: [contactSchema], default: [] },
}, { timestamps: true });

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

export const NamoAgsCollege = model<INamoAgsCollege>("NamoAgsCollege", schema);
