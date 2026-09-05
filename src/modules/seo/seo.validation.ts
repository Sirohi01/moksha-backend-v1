import { z } from "zod";
import { zBoolean } from "../../utils/zodHelpers";

const optionalBoolean = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean().optional(),
);

const siteQuery = z.object({ siteId: z.string().trim().optional() });

export const overviewSchema = z.object({ query: siteQuery });

export const listPagesSchema = z.object({
  query: siteQuery.extend({
    search: z.string().trim().max(300).optional(),
    status: z.enum(["2xx", "3xx", "4xx", "5xx", "error"]).optional(),
    indexable: optionalBoolean,
    severity: z.enum(["critical", "warning", "notice"]).optional(),
    issueCategory: z
      .enum([
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
      ])
      .optional(),
    hasBrokenLinks: optionalBoolean,
    inSitemap: optionalBoolean,
    orphan: optionalBoolean,
    minScore: z.coerce.number().min(0).max(100).optional(),
    maxScore: z.coerce.number().min(0).max(100).optional(),
    sortBy: z.string().trim().optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
});

export const pageDetailSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query: siteQuery,
});

export const listIssuesSchema = z.object({
  query: siteQuery.extend({
    severity: z.enum(["critical", "warning", "notice"]).optional(),
    category: z.string().trim().optional(),
    ruleId: z.string().trim().optional(),
    status: z.enum(["open", "resolved"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
});

export const listBrokenLinksSchema = z.object({
  query: siteQuery.extend({
    internalOnly: optionalBoolean,
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
});

export const listAlertsSchema = z.object({
  query: siteQuery.extend({ status: z.enum(["open", "acknowledged"]).optional() }),
});

export const acknowledgeAlertSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query: siteQuery,
});

export const startAuditSchema = z.object({
  query: siteQuery,
  body: z
    .object({
      skipPerformance: zBoolean(false),
      skipGoogleData: zBoolean(false),
    })
    .default({}),
});

export const crawlDetailSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
});

export const updateSiteSchema = z.object({
  query: siteQuery,
  body: z.object({
    label: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
    crawlSettings: z
      .object({
        maxPages: z.number().int().min(1).max(5000).optional(),
        maxDepth: z.number().int().min(0).max(20).optional(),
        concurrency: z.number().int().min(1).max(12).optional(),
        requestTimeoutMs: z.number().int().min(2000).max(60000).optional(),
        politenessDelayMs: z.number().int().min(0).max(10000).optional(),
        respectRobots: z.boolean().optional(),
        followSitemap: z.boolean().optional(),
        renderJs: z.boolean().optional(),
        checkExternalLinks: z.boolean().optional(),
        excludePatterns: z.array(z.string().trim().max(300)).max(50).optional(),
        extraSeedUrls: z.array(z.string().trim().url()).max(200).optional(),
        performanceUrls: z.array(z.string().trim().url()).max(50).optional(),
        performanceStrategy: z.enum(["mobile", "desktop"]).optional(),
        maxPerformanceUrls: z.number().int().min(0).max(50).optional(),
        keywordTargets: z.array(z.object({
          url: z.string().trim().url(),
          primary: z.string().trim().min(1).max(120),
          secondary: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
        })).max(500).optional(),
      })
      .optional(),
    schedule: z
      .object({
        enabled: z.boolean().optional(),
        frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
        hourUtc: z.number().int().min(0).max(23).optional(),
        dayOfWeek: z.number().int().min(0).max(6).optional(),
      })
      .optional(),
  }),
});

export const recommendationSchema = z.object({
  query: siteQuery.extend({ force: optionalBoolean }),
});

export const pageRecommendationSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  query: siteQuery.extend({ force: optionalBoolean }),
});

export const createCompetitorSchema = z.object({
  body: z.object({
    url: z.string().trim().url(),
    label: z.string().trim().min(1).max(120),
  }),
});

export const competitorIdSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
});
