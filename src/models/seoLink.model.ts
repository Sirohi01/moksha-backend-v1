import { Schema, model, Document, Types } from "mongoose";

export type SeoLinkStatusClass = "ok" | "redirect" | "broken" | "server_error" | "timeout" | "unchecked";

export interface ISeoLink extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId;
  sourceUrl: string;
  targetUrl: string;
  normalizedTarget: string;
  anchorText: string;
  rel: string | null;
  isInternal: boolean;
  isNofollow: boolean;
  httpStatus: number | null;
  statusClass: SeoLinkStatusClass;
  redirectsTo: string | null;
  redirectHops: number;
  isBroken: boolean;
  error: string | null;
  checkedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const seoLinkSchema = new Schema<ISeoLink>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", required: true, index: true },
    sourceUrl: { type: String, required: true, maxlength: 2000, index: true },
    targetUrl: { type: String, required: true, maxlength: 2000 },
    normalizedTarget: { type: String, required: true, maxlength: 2000, index: true },
    anchorText: { type: String, default: "", maxlength: 500 },
    rel: { type: String, default: null, maxlength: 200 },
    isInternal: { type: Boolean, default: true, index: true },
    isNofollow: { type: Boolean, default: false },
    httpStatus: { type: Number, default: null },
    statusClass: {
      type: String,
      enum: ["ok", "redirect", "broken", "server_error", "timeout", "unchecked"],
      default: "unchecked",
      index: true,
    },
    redirectsTo: { type: String, default: null, maxlength: 2000 },
    redirectHops: { type: Number, default: 0 },
    isBroken: { type: Boolean, default: false, index: true },
    error: { type: String, default: null, maxlength: 300 },
    checkedAt: { type: Date, default: null },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

seoLinkSchema.index({ siteId: 1, sourceUrl: 1, normalizedTarget: 1 }, { unique: true });
seoLinkSchema.index({ siteId: 1, isBroken: 1, isInternal: 1 });

export const SeoLink = model<ISeoLink>("SeoLink", seoLinkSchema);
