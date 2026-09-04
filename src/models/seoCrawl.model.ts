import { Schema, model, Document, Types } from "mongoose";

export interface ISeoCrawlStats {
  urlsDiscovered: number;
  pagesCrawled: number;
  pagesFailed: number;
  htmlPages: number;
  linksFound: number;
  linksChecked: number;
  brokenLinks: number;
  redirectChains: number;
  issuesFound: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  performanceAudits: number;
}

export interface ISeoScores {
  overall: number | null;
  technical: number | null;
  onPage: number | null;
  content: number | null;
  performance: number | null;
  visibility: number | null;
}

export interface ISeoCrawlLogEntry {
  at: Date;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ISeoCrawl extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  trigger: "manual" | "scheduled";
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  stats: ISeoCrawlStats;
  scores: ISeoScores;
  robotsFound: boolean;
  sitemapFound: boolean;
  sitemapUrlCount: number;
  error: string | null;
  log: ISeoCrawlLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const statsSchema = new Schema<ISeoCrawlStats>(
  {
    urlsDiscovered: { type: Number, default: 0 },
    pagesCrawled: { type: Number, default: 0 },
    pagesFailed: { type: Number, default: 0 },
    htmlPages: { type: Number, default: 0 },
    linksFound: { type: Number, default: 0 },
    linksChecked: { type: Number, default: 0 },
    brokenLinks: { type: Number, default: 0 },
    redirectChains: { type: Number, default: 0 },
    issuesFound: { type: Number, default: 0 },
    criticalIssues: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    notices: { type: Number, default: 0 },
    performanceAudits: { type: Number, default: 0 },
  },
  { _id: false },
);

const scoresSchema = new Schema<ISeoScores>(
  {
    overall: { type: Number, default: null },
    technical: { type: Number, default: null },
    onPage: { type: Number, default: null },
    content: { type: Number, default: null },
    performance: { type: Number, default: null },
    visibility: { type: Number, default: null },
  },
  { _id: false },
);

const logSchema = new Schema<ISeoCrawlLogEntry>(
  {
    at: { type: Date, default: Date.now },
    level: { type: String, enum: ["info", "warn", "error"], default: "info" },
    message: { type: String, required: true, maxlength: 500 },
  },
  { _id: false },
);

const seoCrawlSchema = new Schema<ISeoCrawl>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    trigger: { type: String, enum: ["manual", "scheduled"], default: "manual" },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    stats: { type: statsSchema, default: () => ({}) },
    scores: { type: scoresSchema, default: () => ({}) },
    robotsFound: { type: Boolean, default: false },
    sitemapFound: { type: Boolean, default: false },
    sitemapUrlCount: { type: Number, default: 0 },
    error: { type: String, default: null },
    log: { type: [logSchema], default: [] },
  },
  { timestamps: true },
);

seoCrawlSchema.index({ siteId: 1, createdAt: -1 });

export const SeoCrawl = model<ISeoCrawl>("SeoCrawl", seoCrawlSchema);
