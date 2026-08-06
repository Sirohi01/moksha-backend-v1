import { Schema, model, Document, Types } from "mongoose";

/** PRD §11.4 "caseTimeline" — append-only event log. Never updated or deleted; the current case
 * status must always be reproducible by replaying this collection. `visibility: FAMILY` entries
 * are what the public tracking page is allowed to show; INTERNAL entries never leave the admin
 * panel. */
export interface ICaseTimeline extends Document {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  event: string;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  byUserId?: Types.ObjectId;
  visibility: "INTERNAL" | "FAMILY";
  at: Date;
}

const caseTimelineSchema = new Schema<ICaseTimeline>({
  caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  event: { type: String, required: true },
  fromStatus: { type: String },
  toStatus: { type: String },
  note: { type: String, trim: true },
  byUserId: { type: Schema.Types.ObjectId, ref: "User" },
  visibility: { type: String, enum: ["INTERNAL", "FAMILY"], default: "INTERNAL" },
  at: { type: Date, default: Date.now, index: true },
});

export const CaseTimeline = model<ICaseTimeline>("CaseTimeline", caseTimelineSchema);
