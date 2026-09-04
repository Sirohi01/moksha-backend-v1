import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { SeoCrawl } from "../../models/seoCrawl.model";
import { SeoIssue } from "../../models/seoIssue.model";
import { SeoPage } from "../../models/seoPage.model";
import { SeoRecommendation, ISeoRecommendation } from "../../models/seoRecommendation.model";
import { SeoSearchSnapshot } from "../../models/seoSearchSnapshot.model";
import { SeoAnalyticsSnapshot } from "../../models/seoAnalyticsSnapshot.model";
import { SeoSiteSnapshot } from "../../models/seoSiteSnapshot.model";
import type { ISeoSite } from "../../models/seoSite.model";
import { normalizeUrl } from "./crawler/url.util";
import {
  analyzeContentGap,
  generatePageRecommendations,
  generateSiteRecommendations,
  hashInput,
  interpretCannibalization,
  isGeminiConfigured,
  type ContentGapInput,
  type PageRecommendationInput,
  type SiteRecommendationInput,
} from "./integrations/gemini";
import { buildSearchInsights } from "./seo.insights";

export interface RecommendationResponse {
  status: "ok" | "cached" | "not_configured" | "error" | "no_data";
  message: string | null;
  recommendation: ReturnType<typeof serialize> | null;
}

function serialize(recommendation: ISeoRecommendation) {
  return {
    id: String(recommendation._id),
    scope: recommendation.scope,
    url: recommendation.url,
    provider: recommendation.provider,
    model: recommendation.aiModel,
    summary: recommendation.summary,
    items: recommendation.items,
    status: recommendation.status,
    error: recommendation.error,
    inputSummary: recommendation.inputSummary,
    generatedAt: recommendation.generatedAt,
  };
}

async function findCached(
  siteId: Types.ObjectId,
  scope: ISeoRecommendation["scope"],
  url: string | null,
  inputHash: string,
): Promise<ISeoRecommendation | null> {
  return SeoRecommendation.findOne({ siteId, scope, url, inputHash, status: "ok" })
    .sort({ generatedAt: -1 })
    .exec();
}

export async function generateForPage(
  site: ISeoSite,
  pageIdOrUrl: string,
  force = false,
): Promise<RecommendationResponse> {
  const page = Types.ObjectId.isValid(pageIdOrUrl)
    ? await SeoPage.findOne({ _id: pageIdOrUrl, siteId: site._id }).lean()
    : await SeoPage.findOne({ siteId: site._id, normalizedUrl: pageIdOrUrl }).lean();

  if (!page) throw ApiError.notFound("Page not found in the latest audit");

  const [issues, searchSnapshot, siblings] = await Promise.all([
    SeoIssue.find({ siteId: site._id, url: page.normalizedUrl, status: "open" })
      .select("ruleId severity title detail")
      .lean(),
    SeoSearchSnapshot.findOne({ siteId: site._id }).sort({ capturedAt: -1 }).lean(),
    SeoPage.find({ siteId: site._id, indexable: true, normalizedUrl: { $ne: page.normalizedUrl } })
      .select("normalizedUrl title")
      .limit(60)
      .lean(),
  ]);

  const topQueries = searchSnapshot
    ? searchSnapshot.queryPagePairs
        .filter((pair) => normalizeUrl(pair.page)?.normalized === page.normalizedUrl)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20)
        .map((pair) => ({
          query: pair.query,
          clicks: pair.clicks,
          impressions: pair.impressions,
          position: pair.position,
        }))
    : [];

  const input: PageRecommendationInput = {
    url: page.normalizedUrl,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1 ?? [],
    h2: (page.h2 ?? []).slice(0, 20),
    wordCount: page.wordCount,
    canonical: page.canonical,
    indexable: page.indexable,
    schemaTypes: page.schemaTypes ?? [],
    internalLinksIn: page.inLinks,
    internalLinksOut: page.outLinks,
    crawlDepth: page.depth,
    score: page.score,
    issues: issues.map((issue) => ({
      ruleId: issue.ruleId,
      severity: issue.severity,
      title: issue.title,
      detail: issue.detail,
    })),
    search: searchSnapshot
      ? {
          clicks: page.search?.clicks ?? 0,
          impressions: page.search?.impressions ?? 0,
          ctr: page.search?.ctr ?? 0,
          position: page.search?.position ?? 0,
          available: true,
        }
      : null,
    topQueries,
    performance: page.performance?.fetchedAt
      ? {
          performanceScore: page.performance.performance,
          labLcpMs: page.performance.labLcpMs,
          labCls: page.performance.labCls,
          fieldLcpMs: page.performance.fieldLcpMs,
          fieldCls: page.performance.fieldCls,
          fieldInpMs: page.performance.fieldInpMs,
        }
      : null,
    candidateInternalLinkTargets: siblings.map((sibling) => ({
      url: sibling.normalizedUrl,
      title: sibling.title ?? null,
    })),
  };

  if (!input.issues.length) {
    return {
      status: "no_data",
      message: "This page has no open issues, so there is nothing for the AI layer to explain.",
      recommendation: null,
    };
  }

  return runAndStore(site, "page", page.normalizedUrl, page._id, input, force, () => generatePageRecommendations(input));
}

export async function generateForSite(site: ISeoSite, force = false): Promise<RecommendationResponse> {
  const [crawl, snapshot, searchSnapshot, analyticsSnapshot, topIssues, history] = await Promise.all([
    SeoCrawl.findOne({ siteId: site._id, status: "completed" }).sort({ createdAt: -1 }).lean(),
    SeoSiteSnapshot.findOne({ siteId: site._id }).sort({ capturedAt: -1 }).lean(),
    SeoSearchSnapshot.findOne({ siteId: site._id }).sort({ capturedAt: -1 }).lean(),
    SeoAnalyticsSnapshot.findOne({ siteId: site._id }).sort({ capturedAt: -1 }).lean(),
    SeoIssue.aggregate([
      { $match: { siteId: site._id, status: "open" } },
      {
        $group: {
          _id: { ruleId: "$ruleId", severity: "$severity", title: "$title" },
          affectedPages: { $sum: 1 },
        },
      },
      { $sort: { affectedPages: -1 } },
      { $limit: 30 },
    ]),
    SeoSiteSnapshot.find({ siteId: site._id }).sort({ capturedAt: -1 }).limit(10).lean(),
  ]);

  if (!crawl || !snapshot) {
    return { status: "no_data", message: "Run an audit first — there is no crawl data to analyse.", recommendation: null };
  }

  const clicksChangePercent =
    searchSnapshot && searchSnapshot.previousTotals.clicks > 0
      ? ((searchSnapshot.totals.clicks - searchSnapshot.previousTotals.clicks) /
          searchSnapshot.previousTotals.clicks) *
        100
      : null;

  const input: SiteRecommendationInput = {
    siteUrl: site.url,
    scores: {
      overall: snapshot.scores.overall,
      technical: snapshot.scores.technical,
      onPage: snapshot.scores.onPage,
      content: snapshot.scores.content,
      performance: snapshot.scores.performance,
      visibility: snapshot.scores.visibility,
    },
    pagesCrawled: snapshot.counts.urlsCrawled,
    topIssues: topIssues.map((row: any) => ({
      ruleId: row._id.ruleId,
      severity: row._id.severity,
      title: row._id.title,
      affectedPages: row.affectedPages,
    })),
    brokenLinks: snapshot.counts.brokenInternalLinks + snapshot.counts.brokenExternalLinks,
    redirectIssues: snapshot.counts.redirectIssues,
    orphanPages: snapshot.counts.orphanPages,
    search: searchSnapshot
      ? {
          available: true,
          windowDays: searchSnapshot.windowDays,
          clicks: searchSnapshot.totals.clicks,
          impressions: searchSnapshot.totals.impressions,
          ctr: searchSnapshot.totals.ctr,
          position: searchSnapshot.totals.position,
          clicksChangePercent: clicksChangePercent == null ? null : Number(clicksChangePercent.toFixed(1)),
        }
      : null,
    analytics: analyticsSnapshot
      ? {
          available: true,
          sessions: analyticsSnapshot.totals.sessions,
          organicSessions: analyticsSnapshot.organicTotals.sessions,
          engagementRate: analyticsSnapshot.totals.engagementRate,
        }
      : null,
    scoreHistory: history
      .slice()
      .reverse()
      .map((item) => ({ capturedAt: item.capturedAt.toISOString(), overall: item.scores.overall })),
  };

  return runAndStore(site, "site", null, null, input, force, () => generateSiteRecommendations(input));
}

export async function generateForCannibalization(site: ISeoSite, force = false): Promise<RecommendationResponse> {
  const insights = await buildSearchInsights(site._id);
  if (!insights.available || !insights.cannibalization.length) {
    return {
      status: "no_data",
      message: insights.available
        ? "No queries currently have multiple competing pages."
        : "Search Console data has not been captured yet.",
      recommendation: null,
    };
  }

  const input = insights.cannibalization.slice(0, 15).map((group) => ({
    query: group.query,
    totals: { clicks: group.totalClicks, impressions: group.totalImpressions },
    pages: group.pages,
  }));

  return runAndStore(site, "cannibalization", null, null, input, force, () => interpretCannibalization(input));
}

export async function generateForContentGap(site: ISeoSite, force = false): Promise<RecommendationResponse> {
  const insights = await buildSearchInsights(site._id);
  if (!insights.available || !insights.contentGaps.length) {
    return {
      status: "no_data",
      message: insights.available
        ? "No underserved queries were detected in the current Search Console window."
        : "Search Console data has not been captured yet.",
      recommendation: null,
    };
  }

  const pages = await SeoPage.find({ siteId: site._id, indexable: true })
    .select("normalizedUrl title h1 wordCount")
    .limit(80)
    .lean();

  const input: ContentGapInput = {
    underservedQueries: insights.contentGaps.slice(0, 25).map((gap) => ({
      query: gap.query,
      impressions: gap.impressions,
      clicks: gap.clicks,
      ctr: gap.ctr,
      position: gap.position,
      bestPage: gap.bestPage,
      bestPageTitle: gap.bestPageTitle,
      bestPageWordCount: gap.bestPageWordCount,
    })),
    existingPages: pages.map((page) => ({
      url: page.normalizedUrl,
      title: page.title,
      h1: page.h1 ?? [],
      wordCount: page.wordCount,
    })),
  };

  return runAndStore(site, "content_gap", null, null, input, force, () => analyzeContentGap(input));
}

async function runAndStore(
  site: ISeoSite,
  scope: ISeoRecommendation["scope"],
  url: string | null,
  pageId: Types.ObjectId | null,
  input: unknown,
  force: boolean,
  run: () => Promise<{ status: string; data: { summary: string; items: any[] } | null; message: string | null; model: string }>,
): Promise<RecommendationResponse> {
  const inputHash = hashInput(input);

  if (!force) {
    const cached = await findCached(site._id, scope, url, inputHash);
    if (cached) {
      return { status: "cached", message: "Returned the stored result for identical audit data.", recommendation: serialize(cached) };
    }
  }

  if (!isGeminiConfigured()) {
    return {
      status: "not_configured",
      message: "Set GEMINI_API_KEY in the backend environment to enable AI recommendations. All crawl, rules-engine and Google metrics work without it.",
      recommendation: null,
    };
  }

  const crawl = await SeoCrawl.findOne({ siteId: site._id, status: "completed" }).sort({ createdAt: -1 }).select("_id").lean();
  const outcome = await run();

  if (outcome.status !== "ok" || !outcome.data) {
    const stored = await SeoRecommendation.create({
      siteId: site._id,
      crawlId: crawl?._id ?? null,
      scope,
      url,
      pageId,
      aiModel: outcome.model,
      inputHash,
      inputSummary: summarizeInput(input),
      items: [],
      summary: null,
      status: "error",
      error: (outcome.message ?? "Gemini request failed").slice(0, 1000),
    });
    return {
      status: outcome.status === "not_configured" ? "not_configured" : "error",
      message: outcome.message,
      recommendation: serialize(stored),
    };
  }

  const stored = await SeoRecommendation.create({
    siteId: site._id,
    crawlId: crawl?._id ?? null,
    scope,
    url,
    pageId,
    aiModel: outcome.model,
    inputHash,
    inputSummary: summarizeInput(input),
    items: outcome.data.items,
    summary: outcome.data.summary,
    status: "ok",
  });

  return { status: "ok", message: null, recommendation: serialize(stored) };
}

function summarizeInput(input: unknown): Record<string, unknown> {
  if (Array.isArray(input)) return { entries: input.length };
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    return {
      url: record.url ?? null,
      issueCount: Array.isArray(record.issues) ? record.issues.length : undefined,
      queryCount: Array.isArray(record.underservedQueries) ? record.underservedQueries.length : undefined,
      topIssueCount: Array.isArray(record.topIssues) ? record.topIssues.length : undefined,
    };
  }
  return {};
}

export async function listRecommendations(site: ISeoSite, scope?: string) {
  const query: Record<string, unknown> = { siteId: site._id, status: "ok" };
  if (scope) query.scope = scope;
  const rows = await SeoRecommendation.find(query).sort({ generatedAt: -1 }).limit(50).lean();
  return rows.map((row) => ({
    id: String(row._id),
    scope: row.scope,
    url: row.url,
    model: row.aiModel,
    summary: row.summary,
    items: row.items,
    generatedAt: row.generatedAt,
  }));
}
