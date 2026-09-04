import { Schema, model, Document, Types } from "mongoose";

export type SeoIssueSeverity = "critical" | "warning" | "notice";

export type SeoIssueCategory =
  | "metadata"
  | "indexing"
  | "canonical"
  | "headings"
  | "links"
  | "images"
  | "content"
  | "structure"
  | "structured_data"
  | "performance"
  | "security";

export interface ISeoIssue extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId;
  pageId: Types.ObjectId | null;
  url: string | null;
  ruleId: string;
  category: SeoIssueCategory;
  severity: SeoIssueSeverity;
  title: string;
  detail: string;
  /** Raw facts the rule matched on — never AI generated. */
  evidence: Record<string, unknown>;
  scope: "page" | "site";
  status: "open" | "resolved";
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const seoIssueSchema = new Schema<ISeoIssue>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", required: true, index: true },
    pageId: { type: Schema.Types.ObjectId, ref: "SeoPage", default: null, index: true },
    url: { type: String, default: null, maxlength: 2000 },
    ruleId: { type: String, required: true, index: true },
    category: {
      type: String,
      required: true,
      enum: [
        "metadata",
        "indexing",
        "canonical",
        "headings",
        "links",
        "images",
        "content",
        "structure",
        "structured_data",
        "performance",
        "security",
      ],
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ["critical", "warning", "notice"],
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    detail: { type: String, default: "", maxlength: 1000 },
    evidence: { type: Schema.Types.Mixed, default: {} },
    scope: { type: String, enum: ["page", "site"], default: "page" },
    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

seoIssueSchema.index({ siteId: 1, ruleId: 1, url: 1 }, { unique: true });
seoIssueSchema.index({ siteId: 1, status: 1, severity: 1 });

export const SeoIssue = model<ISeoIssue>("SeoIssue", seoIssueSchema);
