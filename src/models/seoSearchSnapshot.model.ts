import { Schema, model, Document, Types } from "mongoose";

export interface ISeoSearchTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ISeoSearchRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ISeoSearchSnapshot extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId | null;
  siteUrl: string;
  windowDays: number;
  rangeStart: string;
  rangeEnd: string;
  previousRangeStart: string;
  previousRangeEnd: string;
  totals: ISeoSearchTotals;
  previousTotals: ISeoSearchTotals;
  byQuery: ISeoSearchRow[];
  previousByQuery: ISeoSearchRow[];
  byPage: ISeoSearchRow[];
  previousByPage: ISeoSearchRow[];
  byDevice: ISeoSearchRow[];
  byCountry: ISeoSearchRow[];
  byDate: ISeoSearchRow[];
  queryPagePairs: Array<{ query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }>;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const totalsSchema = new Schema<ISeoSearchTotals>(
  {
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
  },
  { _id: false },
);

const rowSchema = new Schema<ISeoSearchRow>(
  {
    key: { type: String, required: true, maxlength: 2000 },
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
  },
  { _id: false },
);

const pairSchema = new Schema(
  {
    query: { type: String, required: true, maxlength: 500 },
    page: { type: String, required: true, maxlength: 2000 },
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
  },
  { _id: false },
);

const seoSearchSnapshotSchema = new Schema<ISeoSearchSnapshot>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", default: null },
    siteUrl: { type: String, required: true },
    windowDays: { type: Number, required: true, index: true },
    rangeStart: { type: String, required: true },
    rangeEnd: { type: String, required: true },
    previousRangeStart: { type: String, required: true },
    previousRangeEnd: { type: String, required: true },
    totals: { type: totalsSchema, default: () => ({}) },
    previousTotals: { type: totalsSchema, default: () => ({}) },
    byQuery: { type: [rowSchema], default: [] },
    previousByQuery: { type: [rowSchema], default: [] },
    byPage: { type: [rowSchema], default: [] },
    previousByPage: { type: [rowSchema], default: [] },
    byDevice: { type: [rowSchema], default: [] },
    byCountry: { type: [rowSchema], default: [] },
    byDate: { type: [rowSchema], default: [] },
    queryPagePairs: { type: [pairSchema], default: [] },
    capturedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

seoSearchSnapshotSchema.index({ siteId: 1, windowDays: 1, capturedAt: -1 });

export const SeoSearchSnapshot = model<ISeoSearchSnapshot>(
  "SeoSearchSnapshot",
  seoSearchSnapshotSchema,
);
