import { Document, model, Schema, Types } from "mongoose";

export const NAMO_LOOKUP_TYPES = [
  "CATEGORY", "OCCUPATION", "DESIGNATION", "DEPARTMENT", "PROFESSION", "UNIVERSITY",
  "DATA", "OBJ_NAME", "ORGANIZATION", "SOURCE", "CALL_TARGET", "COORDINATOR_STATUS",
  "BANK", "STATUS_OPTION", "IP",
] as const;
export type NamoLookupType = (typeof NAMO_LOOKUP_TYPES)[number];

/** Generic kind+payload model for Namo Gange's ~15 small internal admin dropdown/master tables
 * (Backend_Namo_Gange/src/models/add_by_admin/*.js) — Category, Occupation, Designation,
 * Department, Profession, University, Data, ObjName, Organization, Source, CallTarget,
 * CoordinatorStatus, Bank, StatusOption, IP. Every one of them is a `name`(-ish) + status +
 * a couple of optional extra fields — none read by the real public site (confirmed via the
 * New_Namo_Gange frontend audit), purely internal admin-panel convenience. One flexible schema
 * avoids building 15 near-identical Mongoose models, same reasoning as NamoContent/ArogyaContent. */
export interface INamoLookup extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  type: NamoLookupType;
  name: string;
  payload: Record<string, unknown>;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoLookup>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  legacyId: { type: String, trim: true },
  type: { type: String, enum: NAMO_LOOKUP_TYPES, required: true, index: true },
  name: { type: String, required: true, trim: true },
  payload: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
}, { timestamps: true, minimize: false });

schema.index({ organisationId: 1, type: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });
schema.index({ organisationId: 1, type: 1, status: 1 });

export const NamoLookup = model<INamoLookup>("NamoLookup", schema);
