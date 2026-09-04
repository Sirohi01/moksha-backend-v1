import { Schema, model, Document, Types } from "mongoose";

export interface ISeoRedirectHop {
  url: string;
  status: number | null;
  location: string | null;
}

export interface ISeoRedirectChain extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId;
  sourceUrl: string;
  hops: ISeoRedirectHop[];
  hopCount: number;
  finalUrl: string | null;
  finalStatus: number | null;
  isLoop: boolean;
  endsInError: boolean;
  issues: string[];
  severity: "critical" | "warning" | "notice" | "none";
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const hopSchema = new Schema<ISeoRedirectHop>(
  {
    url: { type: String, required: true, maxlength: 2000 },
    status: { type: Number, default: null },
    location: { type: String, default: null, maxlength: 2000 },
  },
  { _id: false },
);

const seoRedirectChainSchema = new Schema<ISeoRedirectChain>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", required: true, index: true },
    sourceUrl: { type: String, required: true, maxlength: 2000 },
    hops: { type: [hopSchema], default: [] },
    hopCount: { type: Number, default: 0 },
    finalUrl: { type: String, default: null, maxlength: 2000 },
    finalStatus: { type: Number, default: null },
    isLoop: { type: Boolean, default: false },
    endsInError: { type: Boolean, default: false },
    issues: { type: [String], default: [] },
    severity: {
      type: String,
      enum: ["critical", "warning", "notice", "none"],
      default: "none",
      index: true,
    },
    checkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

seoRedirectChainSchema.index({ siteId: 1, sourceUrl: 1 }, { unique: true });

export const SeoRedirectChain = model<ISeoRedirectChain>("SeoRedirectChain", seoRedirectChainSchema);
