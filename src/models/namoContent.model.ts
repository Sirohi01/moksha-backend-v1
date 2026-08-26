import { Document, model, Schema, Types } from "mongoose";

export const NAMO_CONTENT_KINDS = [
  "BLOG", "FAQ", "TESTIMONIAL", "BANNER", "GALLERY_IMAGE", "GALLERY_VIDEO",
  "ABOUT", "ACHIEVEMENT", "INITIATIVE", "OBJECTIVE", "RECENT_UPDATE", "TRUST_BODY",
  "SEO", "SOCIAL_MEDIA",
] as const;
export type NamoContentKind = (typeof NAMO_CONTENT_KINDS)[number];
export const NAMO_CONTENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type NamoContentStatus = (typeof NAMO_CONTENT_STATUSES)[number];

export interface INamoContent extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  kind: NamoContentKind;
  slug?: string;
  title?: string;
  payload: Record<string, unknown>;
  status: NamoContentStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<INamoContent>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  legacyId: { type: String, trim: true },
  kind: { type: String, enum: NAMO_CONTENT_KINDS, required: true, index: true },
  slug: { type: String, trim: true, lowercase: true },
  title: { type: String, trim: true },
  payload: { type: Schema.Types.Mixed, required: true, default: {} },
  status: { type: String, enum: NAMO_CONTENT_STATUSES, default: "ACTIVE", index: true },
  order: { type: Number, default: 0 },
}, { timestamps: true, minimize: false });

schema.index(
  { organisationId: 1, kind: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: "string" } } },
);
schema.index(
  { organisationId: 1, kind: 1, legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } },
);
schema.index({ organisationId: 1, kind: 1, status: 1, order: 1 });

export const NamoContent = model<INamoContent>("NamoContent", schema);
