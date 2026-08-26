import { Document, model, Schema, Types } from "mongoose";

/** Same generic kind+payload pattern as NamoContent (see that model's comment) — 20+ old Arogya
 * models (backend-arogya/models/{hero,chairman,founder,faq,glimpse,globalVoices,partners,
 * speakers,seo,settings}/*.js, see migration-tools/arogya-cms-field-maps/) each turned out to be
 * the same shape (a handful of text/image/order fields), so one flexible schema per organisation
 * avoids building 20+ near-identical Mongoose schemas for content that's structurally the same
 * kind of thing every time. */
export const AROGYA_CONTENT_KINDS = [
  "HERO",
  "CHAIRMAN_MESSAGE",
  "FOUNDER_MESSAGE",
  "FAQ_ITEM",
  "FAQ_SETTINGS",
  "GLIMPSE_SETTINGS",
  "GLIMPSE_GALLERY",
  "GLIMPSE_VIDEO",
  "GLIMPSE_COUNTER",
  "GLIMPSE_YEAR",
  "GLIMPSE_CATEGORY",
  "GLOBAL_VOICES_SETTINGS",
  "GLOBAL_VOICES_CATEGORY",
  "GLOBAL_VOICES_COUNTER",
  "GLOBAL_VOICES_SPEAKER",
  "GLOBAL_VOICES_CAROUSEL_SPEAKER",
  "PARTNER_CATEGORY",
  "PARTNER_LOGO",
  "PARTNER_SETTINGS",
  "SPEAKER_EMINENT",
  "SPEAKER_EMINENT_HEADING",
  "SPEAKER_EXPERT",
  "SPEAKER_EXPERT_HEADING",
  "SPEAKER_MORE_CATEGORY",
  "SPEAKER_MORE_ITEM",
  "SPEAKER_ORGANISING_HEADING",
  "SPEAKER_ORGANISING_MEMBER",
  "SPEAKER_PREVIOUS",
  "SPEAKER_PREVIOUS_HEADING",
  "SPEAKER_HERO",
  "SPEAKER_COUNTER",
  "SEO",
  "SOCIAL_MEDIA",
  "SETTINGS",
  // Discovered only by connecting to the real legacy database directly (2026-08-26) — these
  // collections exist in production but were missed by the earlier document-based field-mapping
  // pass (no testimonials-field-map.md was ever produced). Confirms direct-DB verification is
  // necessary before considering a content-kind inventory complete.
  "TESTIMONIAL_ITEM",
  "TESTIMONIAL_SETTINGS",
  "TESTIMONIAL_COUNTER",
  "VIDEO_TESTIMONIAL_ITEM",
  "SPEAKER_ESTEEMED",
  "SPEAKER_ESTEEMED_SETTINGS",
  "RESOURCE_SETTINGS",
  "PDF_CARD",
] as const;
export type ArogyaContentKind = (typeof AROGYA_CONTENT_KINDS)[number];
export const AROGYA_CONTENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ArogyaContentStatus = (typeof AROGYA_CONTENT_STATUSES)[number];

export interface IArogyaContent extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  kind: ArogyaContentKind;
  slug?: string;
  title?: string;
  payload: Record<string, unknown>;
  status: ArogyaContentStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IArogyaContent>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  legacyId: { type: String, trim: true },
  kind: { type: String, enum: AROGYA_CONTENT_KINDS, required: true, index: true },
  slug: { type: String, trim: true, lowercase: true },
  title: { type: String, trim: true },
  payload: { type: Schema.Types.Mixed, required: true, default: {} },
  status: { type: String, enum: AROGYA_CONTENT_STATUSES, default: "ACTIVE", index: true },
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

export const ArogyaContent = model<IArogyaContent>("ArogyaContent", schema);
