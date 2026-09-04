import { Schema, model, Document, Types } from "mongoose";

export interface ISeoLabMetrics {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  clsScore: number | null;
  tbtMs: number | null;
  fcpMs: number | null;
  speedIndexMs: number | null;
  ttiMs: number | null;
  serverResponseMs: number | null;
}

export interface ISeoFieldMetrics {
  available: boolean;
  source: "url" | "origin" | null;
  lcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  overallCategory: string | null;
}

export interface ISeoPerformanceAudit extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId | null;
  url: string;
  normalizedUrl: string;
  strategy: "mobile" | "desktop";
  provider: "pagespeed_insights";
  lighthouseVersion: string | null;
  lab: ISeoLabMetrics;
  field: ISeoFieldMetrics;
  opportunities: Array<{ id: string; title: string; savingsMs: number | null }>;
  status: "ok" | "error";
  error: string | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const labSchema = new Schema<ISeoLabMetrics>(
  {
    performance: { type: Number, default: null },
    accessibility: { type: Number, default: null },
    bestPractices: { type: Number, default: null },
    seo: { type: Number, default: null },
    lcpMs: { type: Number, default: null },
    clsScore: { type: Number, default: null },
    tbtMs: { type: Number, default: null },
    fcpMs: { type: Number, default: null },
    speedIndexMs: { type: Number, default: null },
    ttiMs: { type: Number, default: null },
    serverResponseMs: { type: Number, default: null },
  },
  { _id: false },
);

const fieldSchema = new Schema<ISeoFieldMetrics>(
  {
    available: { type: Boolean, default: false },
    source: { type: String, enum: ["url", "origin", null], default: null },
    lcpMs: { type: Number, default: null },
    clsScore: { type: Number, default: null },
    inpMs: { type: Number, default: null },
    fcpMs: { type: Number, default: null },
    ttfbMs: { type: Number, default: null },
    overallCategory: { type: String, default: null },
  },
  { _id: false },
);

const seoPerformanceAuditSchema = new Schema<ISeoPerformanceAudit>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", default: null, index: true },
    url: { type: String, required: true, maxlength: 2000 },
    normalizedUrl: { type: String, required: true, maxlength: 2000, index: true },
    strategy: { type: String, enum: ["mobile", "desktop"], required: true },
    provider: { type: String, default: "pagespeed_insights" },
    lighthouseVersion: { type: String, default: null },
    lab: { type: labSchema, default: () => ({}) },
    field: { type: fieldSchema, default: () => ({}) },
    opportunities: {
      type: [new Schema({ id: String, title: String, savingsMs: Number }, { _id: false })],
      default: [],
    },
    status: { type: String, enum: ["ok", "error"], default: "ok" },
    error: { type: String, default: null, maxlength: 500 },
    fetchedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

seoPerformanceAuditSchema.index({ siteId: 1, normalizedUrl: 1, strategy: 1, fetchedAt: -1 });

export const SeoPerformanceAudit = model<ISeoPerformanceAudit>(
  "SeoPerformanceAudit",
  seoPerformanceAuditSchema,
);
