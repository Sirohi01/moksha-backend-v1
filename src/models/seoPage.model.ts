import { Schema, model, Document, Types } from "mongoose";

export interface ISeoHeading {
  level: number;
  text: string;
}

export interface ISeoImageRecord {
  src: string;
  alt: string | null;
  hasAlt: boolean;
  isDecorative: boolean;
  loading: string | null;
  width: number | null;
  height: number | null;
}

export interface ISeoSchemaRecord {
  types: string[];
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ISeoPagePerformance {
  auditId: Types.ObjectId | null;
  strategy: string | null;
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  labLcpMs: number | null;
  labCls: number | null;
  fieldLcpMs: number | null;
  fieldCls: number | null;
  fieldInpMs: number | null;
  labFcpMs: number | null;
  labTbtMs: number | null;
  labSpeedIndexMs: number | null;
  labServerResponseMs: number | null;
  fieldFcpMs: number | null;
  fieldTtfbMs: number | null;
  transferredBytes: number | null;
  resourceCount: number | null;
  renderBlockingResources: Array<{ url: string | null; type: string; savingsMs: number | null; source: string }>;
  fetchedAt: Date | null;
}

export interface ISeoPageSearch {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rangeStart: string | null;
  rangeEnd: string | null;
  updatedAt: Date | null;
}

export interface ISeoPageAnalytics {
  views: number;
  users: number;
  engagementRate: number | null;
  updatedAt: Date | null;
}

export interface ISeoPage extends Document {
  _id: Types.ObjectId;
  siteId: Types.ObjectId;
  crawlId: Types.ObjectId;
  url: string;
  normalizedUrl: string;
  path: string;

  httpStatus: number | null;
  contentType: string | null;
  responseTimeMs: number | null;
  contentLength: number | null;
  finalUrl: string | null;
  redirected: boolean;
  fetchError: string | null;
  crawledAt: Date;
  renderedWithJs: boolean;

  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  metaRobots: string | null;
  metaKeywords: string | null;
  metaKeywordCount: number;
  canonical: string | null;
  canonicalNormalized: string | null;
  canonicalCount: number;
  canonicalIsSelf: boolean | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogType: string | null;
  ogUrl: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  socialStatus: { openGraph: string; twitter: string };
  keywordAnalysis: Record<string, unknown>;
  browserHealth: Record<string, unknown>;
  cdn: Record<string, unknown>;
  lang: string | null;
  viewport: string | null;
  hreflang: Array<{ hreflang: string; href: string }>;

  h1: string[];
  h2: string[];
  h3: string[];
  headingCounts: Record<string, number>;
  headingSequence: ISeoHeading[];
  hierarchyStatus: "ok" | "warning" | "error" | "unknown";
  headingIssues: string[];

  wordCount: number;
  textHash: string | null;
  contentSimhash: string | null;
  titleHash: string | null;
  descriptionHash: string | null;

  images: ISeoImageRecord[];
  imageCount: number;
  imagesMissingAlt: number;
  imagesEmptyAlt: number;
  imagesLazyLoaded: number;
  imagesWithoutDimensions: number;

  internalLinkCount: number;
  externalLinkCount: number;
  uniqueInternalLinks: number;
  nofollowLinkCount: number;
  brokenLinkCount: number;
  mixedContentLinkCount: number;

  schemas: ISeoSchemaRecord[];
  schemaTypes: string[];
  schemaValid: boolean | null;
  hasBreadcrumbSchema: boolean;
  breadcrumbValid: boolean | null;
  breadcrumbIssues: string[];

  indexable: boolean;
  indexabilityReason: string | null;
  blockedByRobots: boolean;
  inSitemap: boolean;

  depth: number | null;
  inLinks: number;
  outLinks: number;
  isOrphan: boolean;
  isDeadEnd: boolean;

  issueCounts: { critical: number; warning: number; notice: number; total: number };
  issueCategories: string[];
  issueRuleIds: string[];
  score: number | null;
  scoreBreakdown: Array<{ category: string; score: number; weight: number }>;

  performance: ISeoPagePerformance;
  search: ISeoPageSearch;
  analytics: ISeoPageAnalytics;

  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<ISeoImageRecord>(
  {
    src: { type: String, required: true, maxlength: 1000 },
    alt: { type: String, default: null, maxlength: 500 },
    hasAlt: { type: Boolean, default: false },
    isDecorative: { type: Boolean, default: false },
    loading: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false },
);

const schemaRecordSchema = new Schema<ISeoSchemaRecord>(
  {
    types: { type: [String], default: [] },
    valid: { type: Boolean, default: false },
    errors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
  },
  { _id: false },
);

const headingSchema = new Schema<ISeoHeading>(
  {
    level: { type: Number, required: true },
    text: { type: String, default: "", maxlength: 300 },
  },
  { _id: false },
);

const renderBlockingResourceSchema = new Schema(
  { url: { type: String, default: null }, type: { type: String, required: true }, savingsMs: { type: Number, default: null }, source: { type: String, required: true } },
  { _id: false },
);

const performanceSchema = new Schema<ISeoPagePerformance>(
  {
    auditId: { type: Schema.Types.ObjectId, ref: "SeoPerformanceAudit", default: null },
    strategy: { type: String, default: null },
    performance: { type: Number, default: null },
    accessibility: { type: Number, default: null },
    bestPractices: { type: Number, default: null },
    seo: { type: Number, default: null },
    labLcpMs: { type: Number, default: null },
    labCls: { type: Number, default: null },
    fieldLcpMs: { type: Number, default: null },
    fieldCls: { type: Number, default: null },
    fieldInpMs: { type: Number, default: null },
    labFcpMs: { type: Number, default: null },
    labTbtMs: { type: Number, default: null },
    labSpeedIndexMs: { type: Number, default: null },
    labServerResponseMs: { type: Number, default: null },
    fieldFcpMs: { type: Number, default: null },
    fieldTtfbMs: { type: Number, default: null },
    transferredBytes: { type: Number, default: null },
    resourceCount: { type: Number, default: null },
    renderBlockingResources: { type: [renderBlockingResourceSchema], default: [] },
    fetchedAt: { type: Date, default: null },
  },
  { _id: false },
);

const searchSchema = new Schema<ISeoPageSearch>(
  {
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
    rangeStart: { type: String, default: null },
    rangeEnd: { type: String, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const analyticsSchema = new Schema<ISeoPageAnalytics>(
  {
    views: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    engagementRate: { type: Number, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const seoPageSchema = new Schema<ISeoPage>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "SeoSite", required: true, index: true },
    crawlId: { type: Schema.Types.ObjectId, ref: "SeoCrawl", required: true, index: true },
    url: { type: String, required: true, maxlength: 2000 },
    normalizedUrl: { type: String, required: true, maxlength: 2000 },
    path: { type: String, default: "/", maxlength: 1000 },

    httpStatus: { type: Number, default: null, index: true },
    contentType: { type: String, default: null },
    responseTimeMs: { type: Number, default: null },
    contentLength: { type: Number, default: null },
    finalUrl: { type: String, default: null, maxlength: 2000 },
    redirected: { type: Boolean, default: false },
    fetchError: { type: String, default: null, maxlength: 500 },
    crawledAt: { type: Date, default: Date.now },
    renderedWithJs: { type: Boolean, default: false },

    title: { type: String, default: null, maxlength: 1000 },
    titleLength: { type: Number, default: 0 },
    metaDescription: { type: String, default: null, maxlength: 2000 },
    metaDescriptionLength: { type: Number, default: 0 },
    metaRobots: { type: String, default: null, maxlength: 300 },
    metaKeywords: { type: String, default: null, maxlength: 2000 },
    metaKeywordCount: { type: Number, default: 0 },
    canonical: { type: String, default: null, maxlength: 2000 },
    canonicalNormalized: { type: String, default: null, maxlength: 2000 },
    canonicalCount: { type: Number, default: 0 },
    canonicalIsSelf: { type: Boolean, default: null },
    ogTitle: { type: String, default: null, maxlength: 1000 },
    ogDescription: { type: String, default: null, maxlength: 2000 },
    ogImage: { type: String, default: null, maxlength: 2000 },
    ogType: { type: String, default: null, maxlength: 100 },
    ogUrl: { type: String, default: null, maxlength: 2000 },
    twitterCard: { type: String, default: null, maxlength: 100 },
    twitterTitle: { type: String, default: null, maxlength: 1000 },
    twitterDescription: { type: String, default: null, maxlength: 2000 },
    twitterImage: { type: String, default: null, maxlength: 2000 },
    socialStatus: { type: Schema.Types.Mixed, default: () => ({ openGraph: "not_available", twitter: "not_available" }) },
    keywordAnalysis: { type: Schema.Types.Mixed, default: () => ({ available: false, targets: [] }) },
    browserHealth: { type: Schema.Types.Mixed, default: () => ({ consoleErrors: [], consoleWarnings: [], jsExceptions: [], failedRequests: [] }) },
    cdn: { type: Schema.Types.Mixed, default: () => ({ status: "unable_to_determine", provider: null, evidence: [] }) },
    lang: { type: String, default: null, maxlength: 50 },
    viewport: { type: String, default: null, maxlength: 300 },
    hreflang: {
      type: [new Schema({ hreflang: String, href: String }, { _id: false })],
      default: [],
    },

    h1: { type: [String], default: [] },
    h2: { type: [String], default: [] },
    h3: { type: [String], default: [] },
    headingCounts: { type: Schema.Types.Mixed, default: {} },
    headingSequence: { type: [headingSchema], default: [] },
    hierarchyStatus: {
      type: String,
      enum: ["ok", "warning", "error", "unknown"],
      default: "unknown",
    },
    headingIssues: { type: [String], default: [] },

    wordCount: { type: Number, default: 0 },
    textHash: { type: String, default: null, index: true },
    contentSimhash: { type: String, default: null },
    titleHash: { type: String, default: null, index: true },
    descriptionHash: { type: String, default: null, index: true },

    images: { type: [imageSchema], default: [] },
    imageCount: { type: Number, default: 0 },
    imagesMissingAlt: { type: Number, default: 0 },
    imagesEmptyAlt: { type: Number, default: 0 },
    imagesLazyLoaded: { type: Number, default: 0 },
    imagesWithoutDimensions: { type: Number, default: 0 },

    internalLinkCount: { type: Number, default: 0 },
    externalLinkCount: { type: Number, default: 0 },
    uniqueInternalLinks: { type: Number, default: 0 },
    nofollowLinkCount: { type: Number, default: 0 },
    brokenLinkCount: { type: Number, default: 0 },
    mixedContentLinkCount: { type: Number, default: 0 },

    schemas: { type: [schemaRecordSchema], default: [] },
    schemaTypes: { type: [String], default: [] },
    schemaValid: { type: Boolean, default: null },
    hasBreadcrumbSchema: { type: Boolean, default: false },
    breadcrumbValid: { type: Boolean, default: null },
    breadcrumbIssues: { type: [String], default: [] },

    indexable: { type: Boolean, default: true, index: true },
    indexabilityReason: { type: String, default: null },
    blockedByRobots: { type: Boolean, default: false },
    inSitemap: { type: Boolean, default: false },

    depth: { type: Number, default: null },
    inLinks: { type: Number, default: 0 },
    outLinks: { type: Number, default: 0 },
    isOrphan: { type: Boolean, default: false },
    isDeadEnd: { type: Boolean, default: false },

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
    issueCategories: { type: [String], default: [], index: true },
    issueRuleIds: { type: [String], default: [] },
    score: { type: Number, default: null, index: true },
    scoreBreakdown: {
      type: [new Schema({ category: String, score: Number, weight: Number }, { _id: false })],
      default: [],
    },

    performance: { type: performanceSchema, default: () => ({}) },
    search: { type: searchSchema, default: () => ({}) },
    analytics: { type: analyticsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

seoPageSchema.index({ siteId: 1, normalizedUrl: 1 }, { unique: true });
seoPageSchema.index({ siteId: 1, score: -1 });
seoPageSchema.index({ siteId: 1, "search.clicks": -1 });

export const SeoPage = model<ISeoPage>("SeoPage", seoPageSchema);
