import { Document, model, Schema, Types } from "mongoose";

/** AGS delegate status-change history (Backend_Namo_Gange/src/models/clientStatus/
 * clientStatus.model.js, collection "clientstatuses") — the legacy schema's `client_id` field
 * declares `ref: "Client"`, but no "Client" model exists anywhere in that repo (a real, confirmed
 * dangling reference, not something this migration invented). Context (this collection sits
 * alongside AGSDelegateModel, which itself carries `clientStatus`/`updatedStatusBy` fields) makes
 * NamoAgsDelegate the most plausible real target, so `agsDelegateId` points there — best-effort,
 * not schema-enforced, since the source data itself was never reliably linked. Migrated as a
 * read-only historical log; no admin UI was built for it (9 records, informational only). */
export interface INamoAgsClientStatusLog extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  agsDelegateId?: Types.ObjectId;
  legacyClientId?: string;
  selectedStatus: string;
  selectedEvent?: string;
  previousStatus?: string;
  description?: string;
  reminderAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoAgsClientStatusLog>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  legacyId: { type: String, trim: true },
  agsDelegateId: { type: Schema.Types.ObjectId, ref: "NamoAgsDelegate" },
  legacyClientId: { type: String, trim: true },
  selectedStatus: { type: String, required: true, trim: true },
  selectedEvent: String,
  previousStatus: String,
  description: String,
  reminderAt: Date,
}, { timestamps: true });

schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

export const NamoAgsClientStatusLog = model<INamoAgsClientStatusLog>("NamoAgsClientStatusLog", schema);
