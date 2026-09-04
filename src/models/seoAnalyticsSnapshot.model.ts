import { Schema, model, Document, Types } from "mongoose";

export interface ISeoAnalyticsTotals {
  users: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  screenPageViews: number;
  averageSessionSeconds: number;
  bounceRate: number;
  keyEvents: number;
}

export interface ISeoAnalyticsSnapshot extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId | null;
  propertyId: string;
  windowDays: number;
  rangeStart: string;
  rangeEnd: string;
  totals: ISeoAnalyticsTotals;
  previousTotals: ISeoAnalyticsTotals;
  organicTotals: ISeoAnalyticsTotals;
  landingPages: Array<{
    path: string;
    sessions: number;
    users: number;
    engagementRate: number;
    keyEvents: number;
  }>;
  organicLandingPages: Array<{
    path: string;
    sessions: number;
    users: number;
    engagementRate: number;
    keyEvents: number;
  }>;
  channels: Array<{ source: string; medium: string; sessions: number; users: number; keyEvents: number }>;
  events: Array<{ name: string; count: number; users: number }>;
  daily: Array<{ date: string; users: number; sessions: number; organicSessions: number }>;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const totalsSchema = new Schema<ISeoAnalyticsTotals>(
  {
    users: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    engagedSessions: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    screenPageViews: { type: Number, default: 0 },
    averageSessionSeconds: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    keyEvents: { type: Number, default: 0 },
  },
  { _id: false },
);

const landingPageSchema = new Schema(
  {
    path: { type: String, required: true, maxlength: 2000 },
    sessions: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    keyEvents: { type: Number, default: 0 },
  },
  { _id: false },
);

const seoAnalyticsSnapshotSchema = new Schema<ISeoAnalyticsSnapshot>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", default: null },
    propertyId: { type: String, required: true },
    windowDays: { type: Number, required: true, index: true },
    rangeStart: { type: String, required: true },
    rangeEnd: { type: String, required: true },
    totals: { type: totalsSchema, default: () => ({}) },
    previousTotals: { type: totalsSchema, default: () => ({}) },
    organicTotals: { type: totalsSchema, default: () => ({}) },
    landingPages: { type: [landingPageSchema], default: [] },
    organicLandingPages: { type: [landingPageSchema], default: [] },
    channels: {
      type: [
        new Schema(
          {
            source: String,
            medium: String,
            sessions: Number,
            users: Number,
            keyEvents: Number,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    events: {
      type: [new Schema({ name: String, count: Number, users: Number }, { _id: false })],
      default: [],
    },
    daily: {
      type: [
        new Schema(
          { date: String, users: Number, sessions: Number, organicSessions: Number },
          { _id: false },
        ),
      ],
      default: [],
    },
    capturedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

seoAnalyticsSnapshotSchema.index({ siteId: 1, windowDays: 1, capturedAt: -1 });

export const SeoAnalyticsSnapshot = model<ISeoAnalyticsSnapshot>(
  "SeoAnalyticsSnapshot",
  seoAnalyticsSnapshotSchema,
);
