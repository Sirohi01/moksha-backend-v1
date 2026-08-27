import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

/** Namo Gange's real "Contact Us" submission (POST /enquire-list/create) — see
 * Backend_Namo_Gange/src/models/enquiry_list/EnquiryListModel.js. Distinct from the small
 * admin-managed "Enquiry" lookup/category table in that same repo (models/add_by_admin/
 * enquiryModel.js), which is a dropdown-options list, not visitor submissions — not migrated here
 * since nothing on the real frontend reads from it. */
export interface INamoEnquiry extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  name: string;
  email: string;
  mobile: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoEnquiry>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

encryptFieldsOnSave(schema, ["email", "mobile", "message"]);

export const NamoEnquiry = model<INamoEnquiry>("NamoEnquiry", schema);
