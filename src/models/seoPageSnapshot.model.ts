import { Schema, model, Document, Types } from "mongoose";
export interface ISeoPageSnapshot extends Document {
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId;
  pageId: Types.ObjectId;
  normalizedUrl: string;
  capturedAt: Date;
  httpStatus: number | null;
  indexable: boolean;
  score: number | null;
  wordCount: number;
  issueCounts: { critical: number; warning: number; notice: number; total: number };
  titleHash: string | null;
  descriptionHash: string | null;
  contentHash: string | null;
  canonicalNormalized: string | null;
  metaRobots: string | null;
  inLinks: number;
  outLinks: number;
  depth: number | null;
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  clicks: number | null;
  impressions: number | null;
  position: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const seoPageSnapshotSchema = new Schema<ISeoPageSnapshot>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", required: true, index: true },
    pageId: { type: Schema.Types.ObjectId, ref: "SeoPage", required: true, index: true },
    normalizedUrl: { type: String, required: true, maxlength: 2000 },
    capturedAt: { type: Date, default: Date.now },
    httpStatus: { type: Number, default: null },
    indexable: { type: Boolean, default: true },
    score: { type: Number, default: null },
    wordCount: { type: Number, default: 0 },
    issueCounts: {
      type: new Schema(
        {
          critical: { type: Number, default: 0 },
          warning: { type: Number, default: 0 },
          notice: { type: Number, default: 0 },
          total: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    titleHash: { type: String, default: null },
    descriptionHash: { type: String, default: null },
    contentHash: { type: String, default: null },
    canonicalNormalized: { type: String, default: null },
    metaRobots: { type: String, default: null },
    inLinks: { type: Number, default: 0 },
    outLinks: { type: Number, default: 0 },
    depth: { type: Number, default: null },
    performanceScore: { type: Number, default: null },
    lcpMs: { type: Number, default: null },
    cls: { type: Number, default: null },
    clicks: { type: Number, default: null },
    impressions: { type: Number, default: null },
    position: { type: Number, default: null },
  },
  { timestamps: true },
);

seoPageSnapshotSchema.index({ pageId: 1, capturedAt: -1 });
seoPageSnapshotSchema.index({ siteId: 1, normalizedUrl: 1, capturedAt: -1 });

export const SeoPageSnapshot = model<ISeoPageSnapshot>("SeoPageSnapshot", seoPageSnapshotSchema);
