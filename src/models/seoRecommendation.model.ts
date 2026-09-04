import { Schema, model, Document, Types } from "mongoose";

export interface ISeoRecommendationItem {
  ruleId: string | null;
  title: string;
  whyItMatters: string;
  priority: "high" | "medium" | "low";
  recommendedFix: string;
  implementation: string;
  suggestedTitle: string | null;
  suggestedDescription: string | null;
  headingSuggestions: string[];
  internalLinkSuggestions: Array<{ fromOrTo: string; anchorText: string; reason: string }>;
  contentSuggestions: string[];
  schemaSuggestion: string | null;
}

export interface ISeoRecommendation extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId | null;
  scope: "site" | "page" | "cannibalization" | "content_gap" | "competitor";
  url: string | null;
  pageId: Types.ObjectId | null;
  provider: string;
  aiModel: string;
  inputHash: string;
  inputSummary: Record<string, unknown>;
  items: ISeoRecommendationItem[];
  summary: string | null;
  status: "ok" | "error";
  error: string | null;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ISeoRecommendationItem>(
  {
    ruleId: { type: String, default: null },
    title: { type: String, required: true, maxlength: 300 },
    whyItMatters: { type: String, default: "", maxlength: 2000 },
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    recommendedFix: { type: String, default: "", maxlength: 3000 },
    implementation: { type: String, default: "", maxlength: 4000 },
    suggestedTitle: { type: String, default: null, maxlength: 300 },
    suggestedDescription: { type: String, default: null, maxlength: 500 },
    headingSuggestions: { type: [String], default: [] },
    internalLinkSuggestions: {
      type: [
        new Schema(
          { fromOrTo: String, anchorText: String, reason: String },
          { _id: false },
        ),
      ],
      default: [],
    },
    contentSuggestions: { type: [String], default: [] },
    schemaSuggestion: { type: String, default: null, maxlength: 4000 },
  },
  { _id: false },
);

const seoRecommendationSchema = new Schema<ISeoRecommendation>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", default: null },
    scope: {
      type: String,
      enum: ["site", "page", "cannibalization", "content_gap", "competitor"],
      default: "page",
      index: true,
    },
    url: { type: String, default: null, maxlength: 2000, index: true },
    pageId: { type: Schema.Types.ObjectId, ref: "SeoPage", default: null, index: true },
    provider: { type: String, default: "gemini" },
    aiModel: { type: String, default: "" },
    inputHash: { type: String, required: true, index: true },
    inputSummary: { type: Schema.Types.Mixed, default: {} },
    items: { type: [itemSchema], default: [] },
    summary: { type: String, default: null, maxlength: 4000 },
    status: { type: String, enum: ["ok", "error"], default: "ok" },
    error: { type: String, default: null, maxlength: 1000 },
    generatedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

seoRecommendationSchema.index({ siteId: 1, scope: 1, url: 1, generatedAt: -1 });

export const SeoRecommendation = model<ISeoRecommendation>(
  "SeoRecommendation",
  seoRecommendationSchema,
);
