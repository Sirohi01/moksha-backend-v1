import { Schema, model, Document, Types } from "mongoose";

export interface ISeoCrawlSettings {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  requestTimeoutMs: number;
  politenessDelayMs: number;
  respectRobots: boolean;
  followSitemap: boolean;
  renderJs: boolean;
  checkExternalLinks: boolean;
  excludePatterns: string[];
  extraSeedUrls: string[];
  performanceUrls: string[];
  performanceStrategy: "mobile" | "desktop";
  maxPerformanceUrls: number;
}

export interface ISeoSchedule {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  hourUtc: number;
  dayOfWeek: number;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

export interface ISeoSite extends Document {
  _id: Types.ObjectId;
  url: string;
  origin: string;
  label: string;
  type: "primary" | "competitor";
  isActive: boolean;
  searchConsoleSiteUrl: string | null;
  ga4PropertyId: string | null;
  crawlSettings: ISeoCrawlSettings;
  schedule: ISeoSchedule;
  lastCrawlAt: Date | null;
  lastCrawlId: Types.ObjectId | null;
  lastScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const crawlSettingsSchema = new Schema<ISeoCrawlSettings>(
  {
    maxPages: { type: Number, default: 300, min: 1, max: 5000 },
    maxDepth: { type: Number, default: 5, min: 0, max: 20 },
    concurrency: { type: Number, default: 4, min: 1, max: 12 },
    requestTimeoutMs: { type: Number, default: 20000, min: 2000, max: 60000 },
    politenessDelayMs: { type: Number, default: 200, min: 0, max: 10000 },
    respectRobots: { type: Boolean, default: true },
    followSitemap: { type: Boolean, default: true },
    renderJs: { type: Boolean, default: false },
    checkExternalLinks: { type: Boolean, default: true },
    excludePatterns: { type: [String], default: [] },
    extraSeedUrls: { type: [String], default: [] },
    performanceUrls: { type: [String], default: [] },
    performanceStrategy: { type: String, enum: ["mobile", "desktop"], default: "mobile" },
    maxPerformanceUrls: { type: Number, default: 5, min: 0, max: 50 },
  },
  { _id: false },
);

const scheduleSchema = new Schema<ISeoSchedule>(
  {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    hourUtc: { type: Number, default: 2, min: 0, max: 23 },
    dayOfWeek: { type: Number, default: 1, min: 0, max: 6 },
    lastRunAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },
  },
  { _id: false },
);

const seoSiteSchema = new Schema<ISeoSite>(
  {
    url: { type: String, required: true, trim: true },
    origin: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: ["primary", "competitor"], default: "primary", index: true },
    isActive: { type: Boolean, default: true },
    searchConsoleSiteUrl: { type: String, default: null, trim: true },
    ga4PropertyId: { type: String, default: null, trim: true },
    crawlSettings: { type: crawlSettingsSchema, default: () => ({}) },
    schedule: { type: scheduleSchema, default: () => ({}) },
    lastCrawlAt: { type: Date, default: null },
    lastCrawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", default: null },
    lastScore: { type: Number, default: null },
  },
  { timestamps: true },
);

export const SeoSite = model<ISeoSite>("SeoSite", seoSiteSchema);
