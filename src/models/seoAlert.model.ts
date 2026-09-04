import { Schema, model, Document, Types } from "mongoose";

export type SeoAlertType =
  | "score_drop"
  | "new_broken_links"
  | "new_404_pages"
  | "page_became_noindex"
  | "page_blocked_by_robots"
  | "canonical_changed"
  | "sitemap_problem"
  | "performance_degraded"
  | "search_clicks_drop"
  | "search_position_drop"
  | "new_critical_issue"
  | "crawl_failed";

export interface ISeoAlert extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId | null;
  type: SeoAlertType;
  severity: "critical" | "warning" | "notice";
  title: string;
  message: string;
  data: Record<string, unknown>;
  status: "open" | "acknowledged";
  acknowledgedAt: Date | null;
  acknowledgedBy: Types.ObjectId | null;
  emailedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const seoAlertSchema = new Schema<ISeoAlert>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", default: null },
    type: {
      type: String,
      required: true,
      enum: [
        "score_drop",
        "new_broken_links",
        "new_404_pages",
        "page_became_noindex",
        "page_blocked_by_robots",
        "canonical_changed",
        "sitemap_problem",
        "performance_degraded",
        "search_clicks_drop",
        "search_position_drop",
        "new_critical_issue",
        "crawl_failed",
      ],
      index: true,
    },
    severity: { type: String, enum: ["critical", "warning", "notice"], default: "warning", index: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    data: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["open", "acknowledged"], default: "open", index: true },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    emailedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

seoAlertSchema.index({ siteId: 1, createdAt: -1 });

export const SeoAlert = model<ISeoAlert>("SeoAlert", seoAlertSchema);
