import { Document, model, Schema, Types } from "mongoose";

/** Namo Gange's social-icon click tracker (POST /click-analytics/create) — see
 * Backend_Namo_Gange/src/models/click_analytics/ClickAnalyticsModel.js. `ipAddress` is captured
 * server-side from the request, never client-supplied. The legacy controller also tried to set a
 * `created_by` field that doesn't exist on its own schema (silently dropped by Mongoose) — not
 * reproduced here, since it never actually did anything in production either. */
export interface INamoClickAnalytics extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  iconName: string;
  ipAddress: string;
  clickedAt: Date;
}

const schema = new Schema<INamoClickAnalytics>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  iconName: { type: String, required: true, trim: true, index: true },
  ipAddress: { type: String, required: true },
  clickedAt: { type: Date, default: Date.now },
});

export const NamoClickAnalytics = model<INamoClickAnalytics>("NamoClickAnalytics", schema);
