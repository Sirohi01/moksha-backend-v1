import { Schema, model, Document, Types } from "mongoose";
import type { ISeoScores } from "./seoCrawl.model";

export interface ISeoSiteSnapshotCounts {
  urlsCrawled: number;
  htmlPages: number;
  indexablePages: number;
  healthyPages: number;
  criticalIssues: number;
  warnings: number;
  notices: number;
  brokenInternalLinks: number;
  brokenExternalLinks: number;
  redirectIssues: number;
  pagesMissingTitle: number;
  pagesMissingDescription: number;
  pagesMissingH1: number;
  canonicalIssues: number;
  schemaIssues: number;
  orphanPages: number;
  thinContentPages: number;
  duplicateTitlePages: number;
}

export interface ISeoSiteSnapshot extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId;
  capturedAt: Date;
  scores: ISeoScores;
  counts: ISeoSiteSnapshotCounts;
  performance: {
    score: number | null;
    lcpMs: number | null;
    clsScore: number | null;
    inpMs: number | null;
    fieldDataAvailable: boolean;
  };
  search: {
    available: boolean;
    windowDays: number | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
    position: number | null;
  };
  analytics: {
    available: boolean;
    windowDays: number | null;
    users: number | null;
    sessions: number | null;
    organicSessions: number | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const countsSchema = new Schema<ISeoSiteSnapshotCounts>(
  {
    urlsCrawled: { type: Number, default: 0 },
    htmlPages: { type: Number, default: 0 },
    indexablePages: { type: Number, default: 0 },
    healthyPages: { type: Number, default: 0 },
    criticalIssues: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    notices: { type: Number, default: 0 },
    brokenInternalLinks: { type: Number, default: 0 },
    brokenExternalLinks: { type: Number, default: 0 },
    redirectIssues: { type: Number, default: 0 },
    pagesMissingTitle: { type: Number, default: 0 },
    pagesMissingDescription: { type: Number, default: 0 },
    pagesMissingH1: { type: Number, default: 0 },
    canonicalIssues: { type: Number, default: 0 },
    schemaIssues: { type: Number, default: 0 },
    orphanPages: { type: Number, default: 0 },
    thinContentPages: { type: Number, default: 0 },
    duplicateTitlePages: { type: Number, default: 0 },
  },
  { _id: false },
);

const scoresSchema = new Schema(
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

const seoSiteSnapshotSchema = new Schema<ISeoSiteSnapshot>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", required: true, unique: true },
    capturedAt: { type: Date, default: Date.now, index: true },
    scores: { type: scoresSchema, default: () => ({}) },
    counts: { type: countsSchema, default: () => ({}) },
    performance: {
      type: new Schema(
        {
          score: { type: Number, default: null },
          lcpMs: { type: Number, default: null },
          clsScore: { type: Number, default: null },
          inpMs: { type: Number, default: null },
          fieldDataAvailable: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    search: {
      type: new Schema(
        {
          available: { type: Boolean, default: false },
          windowDays: { type: Number, default: null },
          clicks: { type: Number, default: null },
          impressions: { type: Number, default: null },
          ctr: { type: Number, default: null },
          position: { type: Number, default: null },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    analytics: {
      type: new Schema(
        {
          available: { type: Boolean, default: false },
          windowDays: { type: Number, default: null },
          users: { type: Number, default: null },
          sessions: { type: Number, default: null },
          organicSessions: { type: Number, default: null },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
);

seoSiteSnapshotSchema.index({ siteId: 1, capturedAt: -1 });

export const SeoSiteSnapshot = model<ISeoSiteSnapshot>("SeoSiteSnapshot", seoSiteSnapshotSchema);
