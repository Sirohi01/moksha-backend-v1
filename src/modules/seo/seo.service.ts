import { FilterQuery, Types } from "mongoose";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { SeoAlert } from "../../models/seoAlert.model";
import { SeoAnalyticsSnapshot } from "../../models/seoAnalyticsSnapshot.model";
import { SeoCrawl } from "../../models/seoCrawl.model";
import { SeoIssue } from "../../models/seoIssue.model";
import { SeoLink } from "../../models/seoLink.model";
import { SeoPage, ISeoPage } from "../../models/seoPage.model";
import { SeoPageSnapshot } from "../../models/seoPageSnapshot.model";
import { SeoPerformanceAudit } from "../../models/seoPerformanceAudit.model";
import { SeoRecommendation } from "../../models/seoRecommendation.model";
import { SeoRedirectChain } from "../../models/seoRedirectChain.model";
import { SeoSearchSnapshot } from "../../models/seoSearchSnapshot.model";
import { SeoSite, ISeoSite } from "../../models/seoSite.model";
import { SeoSiteSnapshot } from "../../models/seoSiteSnapshot.model";
import { normalizeUrl } from "./crawler/url.util";
import { computeSiteScore } from "./engine/score";
import type { DetectedIssue } from "./engine/rules";

export async function ensurePrimarySite(): Promise<ISeoSite> {
  const normalized = normalizeUrl(env.WEBSITE_URL);
  if (!normalized) throw ApiError.internal("WEBSITE_URL is not a valid URL");

  const existing = await SeoSite.findOne({ type: "primary" });
  if (existing) return existing;

  return SeoSite.create({
    url: normalized.href,
    origin: normalized.origin,
    label: "Moksha Sewa",
    type: "primary",
    searchConsoleSiteUrl: env.SEARCH_CONSOLE_SITE_URL ?? null,
    ga4PropertyId: env.GA4_PROPERTY_ID ?? null,
  });
}

export async function resolveSite(siteId?: string): Promise<ISeoSite> {
  if (siteId) {
    if (!Types.ObjectId.isValid(siteId)) throw ApiError.badRequest("Invalid site id");
    const site = await SeoSite.findById(siteId);
    if (!site) throw ApiError.notFound("SEO site not found");
    return site;
  }
  return ensurePrimarySite();
}

async function latestCompletedCrawlId(siteId: Types.ObjectId): Promise<Types.ObjectId | null> {
  const crawl = await SeoCrawl.findOne({ siteId, status: "completed" }).sort({ createdAt: -1 }).select("_id").lean();
  return crawl?._id ?? null;
}

export interface PageListFilters {
  search?: string;
  status?: "2xx" | "3xx" | "4xx" | "5xx" | "error";
  indexable?: boolean;
  severity?: "critical" | "warning" | "notice";
  issueCategory?: string;
  hasBrokenLinks?: boolean;
  minScore?: number;
  maxScore?: number;
  inSitemap?: boolean;
  orphan?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}

const SORTABLE_FIELDS: Record<string, string> = {
  url: "normalizedUrl",
  score: "score",
  clicks: "search.clicks",
  impressions: "search.impressions",
  ctr: "search.ctr",
  position: "search.position",
  depth: "depth",
  wordCount: "wordCount",
  issues: "issueCounts.total",
  critical: "issueCounts.critical",
  status: "httpStatus",
  inLinks: "inLinks",
  performance: "performance.performance",
  crawledAt: "crawledAt",
};

export async function listPages(site: ISeoSite, filters: PageListFilters) {
  const crawlId = await latestCompletedCrawlId(site._id);
  if (!crawlId) {
    return {
      pages: [],
      meta: { page: 1, limit: filters.limit ?? 25, total: 0, totalPages: 0 },
      crawlId: null,
      message: "No completed audit yet. Run an audit to populate this table.",
    };
  }

  const query: FilterQuery<ISeoPage> = { siteId: site._id, crawlId };

  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { normalizedUrl: { $regex: escaped, $options: "i" } },
      { title: { $regex: escaped, $options: "i" } },
    ];
  }

  if (filters.status) {
    if (filters.status === "error") query.httpStatus = null;
    else {
      const base = Number(filters.status[0]) * 100;
      query.httpStatus = { $gte: base, $lt: base + 100 };
    }
  }

  if (filters.indexable !== undefined) query.indexable = filters.indexable;
  if (filters.inSitemap !== undefined) query.inSitemap = filters.inSitemap;
  if (filters.orphan !== undefined) query.isOrphan = filters.orphan;
  if (filters.issueCategory) query.issueCategories = filters.issueCategory;
  if (filters.hasBrokenLinks) query.brokenLinkCount = { $gt: 0 };
  if (filters.severity) query[`issueCounts.${filters.severity}`] = { $gt: 0 };

  if (filters.minScore != null || filters.maxScore != null) {
    query.score = {};
    if (filters.minScore != null) (query.score as Record<string, number>).$gte = filters.minScore;
    if (filters.maxScore != null) (query.score as Record<string, number>).$lte = filters.maxScore;
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 25));
  const sortField = SORTABLE_FIELDS[filters.sortBy ?? "score"] ?? "score";
  const sortDir = filters.sortDir === "asc" ? 1 : -1;

  const [rows, total] = await Promise.all([
    SeoPage.find(query)
      .select(
        "normalizedUrl url path title titleLength metaDescription metaDescriptionLength httpStatus indexable indexabilityReason canonical canonicalIsSelf canonicalNormalized score issueCounts issueCategories h1 wordCount inLinks outLinks brokenLinkCount depth isOrphan inSitemap schemaTypes schemaValid hasBreadcrumbSchema breadcrumbValid hierarchyStatus headingCounts imageCount imagesMissingAlt performance search analytics crawledAt responseTimeMs",
      )
      .sort({ [sortField]: sortDir, normalizedUrl: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SeoPage.countDocuments(query),
  ]);

  return {
    pages: rows.map(serializePageRow),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    crawlId: String(crawlId),
    message: null,
  };
}

function serializePageRow(page: Record<string, any>) {
  return {
    id: String(page._id),
    url: page.normalizedUrl,
    path: page.path,
    title: page.title,
    titleLength: page.titleLength,
    titleStatus: titleStatus(page.title, page.titleLength),
    metaDescription: page.metaDescription,
    metaDescriptionLength: page.metaDescriptionLength,
    descriptionStatus: descriptionStatus(page.metaDescription, page.metaDescriptionLength),
    httpStatus: page.httpStatus,
    indexable: page.indexable,
    indexabilityReason: page.indexabilityReason,
    canonical: page.canonical,
    canonicalStatus: canonicalStatus(page),
    score: page.score,
    issueCounts: page.issueCounts,
    issueCategories: page.issueCategories ?? [],
    h1: page.h1 ?? [],
    h1Status: h1Status(page.h1 ?? [], page.hierarchyStatus),
    hierarchyStatus: page.hierarchyStatus,
    headingCounts: page.headingCounts ?? {},
    wordCount: page.wordCount,
    inLinks: page.inLinks,
    outLinks: page.outLinks,
    brokenLinks: page.brokenLinkCount,
    depth: page.depth,
    isOrphan: page.isOrphan,
    inSitemap: page.inSitemap,
    schemaTypes: page.schemaTypes ?? [],
    schemaStatus: schemaStatus(page),
    imageCount: page.imageCount,
    imagesMissingAlt: page.imagesMissingAlt,
    responseTimeMs: page.responseTimeMs,
    performance: {
      score: page.performance?.performance ?? null,
      lcpMs: page.performance?.fieldLcpMs ?? page.performance?.labLcpMs ?? null,
      cls: page.performance?.fieldCls ?? page.performance?.labCls ?? null,
      isFieldData: page.performance?.fieldLcpMs != null,
      fetchedAt: page.performance?.fetchedAt ?? null,
    },
    search: page.search ?? null,
    analytics: page.analytics ?? null,
    lastCrawledAt: page.crawledAt,
  };
}

function titleStatus(title: string | null, length: number): string {
  if (!title) return "missing";
  if (length < 30) return "too_short";
  if (length > 60) return "too_long";
  return "ok";
}

function descriptionStatus(description: string | null, length: number): string {
  if (!description) return "missing";
  if (length < 70) return "too_short";
  if (length > 160) return "too_long";
  return "ok";
}

function h1Status(h1: string[], hierarchyStatus: string): string {
  if (h1.length === 0) return "missing";
  if (h1.length > 1) return "multiple";
  if (hierarchyStatus === "error") return "hierarchy_error";
  if (hierarchyStatus === "warning") return "hierarchy_warning";
  return "ok";
}

function canonicalStatus(page: Record<string, any>): string {
  if (!page.canonical) return "missing";
  if (page.canonicalIsSelf === true) return "self";
  if (page.canonicalIsSelf === false) return "points_elsewhere";
  return "unknown";
}

function schemaStatus(page: Record<string, any>): string {
  if (!page.schemaTypes?.length) return "none";
  if (page.schemaValid === false) return "invalid";
  return page.hasBreadcrumbSchema ? "valid_with_breadcrumb" : "valid";
}

export async function getPageDetail(site: ISeoSite, pageId: string) {
  const page = Types.ObjectId.isValid(pageId)
    ? await SeoPage.findOne({ _id: pageId, siteId: site._id }).lean()
    : await SeoPage.findOne({ siteId: site._id, normalizedUrl: pageId }).lean();

  if (!page) throw ApiError.notFound("Page not found in the latest audit");

  const [issues, inboundLinks, outboundLinks, redirect, performanceAudits, history, recommendation, searchSnapshot] =
    await Promise.all([
      SeoIssue.find({ siteId: site._id, url: page.normalizedUrl, status: "open" })
        .sort({ severity: 1, ruleId: 1 })
        .lean(),
      SeoLink.find({ siteId: site._id, normalizedTarget: page.normalizedUrl })
        .select("sourceUrl anchorText isNofollow httpStatus statusClass")
        .limit(200)
        .lean(),
      SeoLink.find({ siteId: site._id, sourceUrl: page.normalizedUrl })
        .select("targetUrl normalizedTarget anchorText rel isInternal isNofollow httpStatus statusClass isBroken redirectsTo redirectHops")
        .limit(500)
        .lean(),
      SeoRedirectChain.findOne({ siteId: site._id, sourceUrl: page.normalizedUrl }).lean(),
      SeoPerformanceAudit.find({ siteId: site._id, normalizedUrl: page.normalizedUrl })
        .sort({ fetchedAt: -1 })
        .limit(5)
        .lean(),
      SeoPageSnapshot.find({ siteId: site._id, normalizedUrl: page.normalizedUrl })
        .sort({ capturedAt: -1 })
        .limit(30)
        .lean(),
      SeoRecommendation.findOne({ siteId: site._id, scope: "page", url: page.normalizedUrl })
        .sort({ generatedAt: -1 })
        .lean(),
      SeoSearchSnapshot.findOne({ siteId: site._id }).sort({ capturedAt: -1 }).lean(),
    ]);

  const topQueries = searchSnapshot
    ? searchSnapshot.queryPagePairs
        .filter((pair) => normalizeUrl(pair.page)?.normalized === page.normalizedUrl)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 25)
    : [];

  const severityOrder = { critical: 0, warning: 1, notice: 2 } as const;

  return {
    page: {
      ...serializePageRow(page),
      metaRobots: page.metaRobots,
      canonicalNormalized: page.canonicalNormalized,
      canonicalCount: page.canonicalCount,
      ogTitle: page.ogTitle,
      ogDescription: page.ogDescription,
      ogImage: page.ogImage,
      twitterCard: page.twitterCard,
      lang: page.lang,
      viewport: page.viewport,
      hreflang: page.hreflang,
      headingSequence: page.headingSequence,
      headingIssues: page.headingIssues,
      h2: page.h2,
      h3: page.h3,
      images: page.images,
      imagesEmptyAlt: page.imagesEmptyAlt,
      imagesLazyLoaded: page.imagesLazyLoaded,
      imagesWithoutDimensions: page.imagesWithoutDimensions,
      schemas: page.schemas,
      breadcrumbIssues: page.breadcrumbIssues,
      scoreBreakdown: page.scoreBreakdown,
      contentType: page.contentType,
      finalUrl: page.finalUrl,
      redirected: page.redirected,
      fetchError: page.fetchError,
      renderedWithJs: page.renderedWithJs,
      internalLinkCount: page.internalLinkCount,
      externalLinkCount: page.externalLinkCount,
      nofollowLinkCount: page.nofollowLinkCount,
      mixedContentLinkCount: page.mixedContentLinkCount,
    },
    issues: issues
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .map((issue) => ({
        id: String(issue._id),
        ruleId: issue.ruleId,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        detail: issue.detail,
        evidence: issue.evidence,
        firstSeenAt: issue.firstSeenAt,
        lastSeenAt: issue.lastSeenAt,
      })),
    links: {
      incoming: inboundLinks.map((link) => ({
        source: link.sourceUrl,
        anchorText: link.anchorText,
        isNofollow: link.isNofollow,
      })),
      outgoing: outboundLinks.map((link) => ({
        target: link.targetUrl,
        normalizedTarget: link.normalizedTarget,
        anchorText: link.anchorText,
        rel: link.rel,
        isInternal: link.isInternal,
        isNofollow: link.isNofollow,
        httpStatus: link.httpStatus,
        statusClass: link.statusClass,
        isBroken: link.isBroken,
        redirectsTo: link.redirectsTo,
        redirectHops: link.redirectHops,
      })),
      brokenOutgoing: outboundLinks.filter((link) => link.isBroken).length,
      redirectingOutgoing: outboundLinks.filter((link) => (link.redirectHops ?? 0) > 0).length,
    },
    redirectChain: redirect ?? null,
    performance: {
      audits: performanceAudits.map((audit) => ({
        id: String(audit._id),
        strategy: audit.strategy,
        status: audit.status,
        error: audit.error,
        lighthouseVersion: audit.lighthouseVersion,
        lab: audit.lab,
        field: audit.field,
        opportunities: audit.opportunities,
        fetchedAt: audit.fetchedAt,
      })),
      labNote: "Lab data comes from a Lighthouse run in Google's test environment.",
      fieldNote: "Field data comes from the Chrome UX Report and only exists when Google has enough real-user samples.",
    },
    search: {
      available: Boolean(searchSnapshot),
      rangeStart: searchSnapshot?.rangeStart ?? null,
      rangeEnd: searchSnapshot?.rangeEnd ?? null,
      metric: "Google Search Console average position (not a live SERP rank)",
      totals: page.search,
      topQueries,
    },
    history: history.reverse().map((snapshot) => ({
      capturedAt: snapshot.capturedAt,
      score: snapshot.score,
      issueCounts: snapshot.issueCounts,
      wordCount: snapshot.wordCount,
      httpStatus: snapshot.httpStatus,
      performanceScore: snapshot.performanceScore,
      lcpMs: snapshot.lcpMs,
      cls: snapshot.cls,
      clicks: snapshot.clicks,
      impressions: snapshot.impressions,
      position: snapshot.position,
    })),
    recommendation: recommendation
      ? {
          id: String(recommendation._id),
          provider: recommendation.provider,
          model: recommendation.aiModel,
          summary: recommendation.summary,
          items: recommendation.items,
          status: recommendation.status,
          error: recommendation.error,
          generatedAt: recommendation.generatedAt,
        }
      : null,
  };
}

export async function getOverview(site: ISeoSite) {
  const crawl = await SeoCrawl.findOne({ siteId: site._id, status: "completed" }).sort({ createdAt: -1 }).lean();
  const running = await SeoCrawl.findOne({ siteId: site._id, status: { $in: ["queued", "running"] } })
    .sort({ createdAt: -1 })
    .lean();

  if (!crawl) {
    return {
      site: serializeSite(site),
      hasData: false,
      runningCrawl: running ? { id: String(running._id), status: running.status, startedAt: running.startedAt } : null,
      message: "No completed audit yet. Run an audit to populate the dashboard.",
    };
  }

  const [snapshot, previousSnapshot, searchSnapshot, analyticsSnapshot, alerts, topIssues, history] = await Promise.all([
    SeoSiteSnapshot.findOne({ siteId: site._id, crawlId: crawl._id }).lean(),
    SeoSiteSnapshot.find({ siteId: site._id }).sort({ capturedAt: -1 }).skip(1).limit(1).lean(),
    SeoSearchSnapshot.findOne({ siteId: site._id }).sort({ capturedAt: -1 }).lean(),
    SeoAnalyticsSnapshot.findOne({ siteId: site._id }).sort({ capturedAt: -1 }).lean(),
    SeoAlert.find({ siteId: site._id, status: "open" }).sort({ createdAt: -1 }).limit(20).lean(),
    SeoIssue.aggregate([
      { $match: { siteId: site._id, status: "open" } },
      {
        $group: {
          _id: { ruleId: "$ruleId", severity: "$severity", category: "$category", title: "$title" },
          affectedPages: { $sum: 1 },
        },
      },
      { $sort: { affectedPages: -1 } },
      { $limit: 25 },
    ]),
    SeoSiteSnapshot.find({ siteId: site._id }).sort({ capturedAt: -1 }).limit(30).lean(),
  ]);

  const previous = previousSnapshot[0] ?? null;

  return {
    site: serializeSite(site),
    hasData: true,
    runningCrawl: running ? { id: String(running._id), status: running.status, startedAt: running.startedAt } : null,
    crawl: {
      id: String(crawl._id),
      status: crawl.status,
      trigger: crawl.trigger,
      startedAt: crawl.startedAt,
      completedAt: crawl.completedAt,
      durationMs: crawl.durationMs,
      stats: crawl.stats,
      robotsFound: crawl.robotsFound,
      sitemapFound: crawl.sitemapFound,
      sitemapUrlCount: crawl.sitemapUrlCount,
    },
    scores: snapshot?.scores ?? crawl.scores,
    previousScores: previous?.scores ?? null,
    counts: snapshot?.counts ?? null,
    performance: snapshot?.performance ?? null,
    search: searchSnapshot
      ? {
          available: true,
          metricNote: "Google Search Console average position, averaged over the selected window — not a live SERP rank.",
          windowDays: searchSnapshot.windowDays,
          rangeStart: searchSnapshot.rangeStart,
          rangeEnd: searchSnapshot.rangeEnd,
          totals: searchSnapshot.totals,
          previousTotals: searchSnapshot.previousTotals,
          topQueries: searchSnapshot.byQuery.slice(0, 15),
          topPages: searchSnapshot.byPage.slice(0, 15),
          byDevice: searchSnapshot.byDevice,
          byCountry: searchSnapshot.byCountry.slice(0, 10),
          daily: searchSnapshot.byDate,
        }
      : { available: false, message: "Search Console data is not available for this site yet." },
    analytics: analyticsSnapshot
      ? {
          available: true,
          windowDays: analyticsSnapshot.windowDays,
          rangeStart: analyticsSnapshot.rangeStart,
          rangeEnd: analyticsSnapshot.rangeEnd,
          totals: analyticsSnapshot.totals,
          previousTotals: analyticsSnapshot.previousTotals,
          organicTotals: analyticsSnapshot.organicTotals,
          landingPages: analyticsSnapshot.organicLandingPages.slice(0, 15),
          channels: analyticsSnapshot.channels.slice(0, 10),
          events: analyticsSnapshot.events.slice(0, 25),
          daily: analyticsSnapshot.daily,
        }
      : { available: false, message: "Google Analytics data is not available for this site yet." },
    alerts: alerts.map((alert) => ({
      id: String(alert._id),
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      data: alert.data,
      createdAt: alert.createdAt,
    })),
    topIssues: topIssues.map((row: any) => ({
      ruleId: row._id.ruleId,
      severity: row._id.severity,
      category: row._id.category,
      title: row._id.title,
      affectedPages: row.affectedPages,
    })),
    history: history
      .slice()
      .reverse()
      .map((item) => ({
        capturedAt: item.capturedAt,
        scores: item.scores,
        counts: item.counts,
        performance: item.performance,
        search: item.search,
      })),
  };
}

function serializeSite(site: ISeoSite) {
  return {
    id: String(site._id),
    url: site.url,
    origin: site.origin,
    label: site.label,
    type: site.type,
    crawlSettings: site.crawlSettings,
    schedule: site.schedule,
    lastCrawlAt: site.lastCrawlAt,
    lastScore: site.lastScore,
    searchConsoleConnected: Boolean(site.searchConsoleSiteUrl),
    analyticsConnected: Boolean(site.ga4PropertyId),
  };
}

export async function getScoreExplanation(site: ISeoSite) {
  const crawlId = await latestCompletedCrawlId(site._id);
  if (!crawlId) return { available: false, message: "No completed audit yet." };

  const [issues, snapshot, pageCount, performanceCount, searchSnapshot, indexablePages] = await Promise.all([
    SeoIssue.find({ siteId: site._id, status: "open" }).select("ruleId category severity url").lean(),
    SeoSiteSnapshot.findOne({ siteId: site._id, crawlId }).lean(),
    SeoPage.countDocuments({ siteId: site._id, crawlId, httpStatus: 200 }),
    SeoPerformanceAudit.countDocuments({ siteId: site._id, crawlId, status: "ok" }),
    SeoSearchSnapshot.findOne({ siteId: site._id, crawlId }).lean(),
    SeoPage.find({ siteId: site._id, crawlId, indexable: true }).select("normalizedUrl search").lean(),
  ]);

  const detected: DetectedIssue[] = issues.map((issue) => ({
    ruleId: issue.ruleId,
    category: issue.category,
    severity: issue.severity,
    title: "",
    detail: "",
    evidence: {},
    url: issue.url,
    scope: issue.url ? "page" : "site",
  }));

  const score = computeSiteScore(
    detected,
    Math.max(1, pageCount),
    {
      available: Boolean(searchSnapshot),
      indexablePages: indexablePages.length,
      pagesWithImpressions: indexablePages.filter((page) => (page.search?.impressions ?? 0) > 0).length,
      pagesWithClicks: indexablePages.filter((page) => (page.search?.clicks ?? 0) > 0).length,
    },
    performanceCount,
  );

  return {
    available: true,
    storedScores: snapshot?.scores ?? null,
    ...score,
  };
}

export async function listIssues(
  site: ISeoSite,
  filters: { severity?: string; category?: string; ruleId?: string; status?: string; page?: number; limit?: number },
) {
  const query: FilterQuery<any> = { siteId: site._id, status: filters.status ?? "open" };
  if (filters.severity) query.severity = filters.severity;
  if (filters.category) query.category = filters.category;
  if (filters.ruleId) query.ruleId = filters.ruleId;

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));

  const [rows, total] = await Promise.all([
    SeoIssue.find(query)
      .sort({ severity: 1, ruleId: 1, url: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SeoIssue.countDocuments(query),
  ]);

  return {
    issues: rows.map((issue) => ({
      id: String(issue._id),
      ruleId: issue.ruleId,
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      detail: issue.detail,
      evidence: issue.evidence,
      url: issue.url,
      scope: issue.scope,
      status: issue.status,
      firstSeenAt: issue.firstSeenAt,
      lastSeenAt: issue.lastSeenAt,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function listBrokenLinks(site: ISeoSite, filters: { page?: number; limit?: number; internalOnly?: boolean }) {
  const query: FilterQuery<any> = { siteId: site._id, isBroken: true };
  if (filters.internalOnly) query.isInternal = true;

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));

  const [grouped, total] = await Promise.all([
    SeoLink.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$normalizedTarget",
          targetUrl: { $first: "$targetUrl" },
          httpStatus: { $first: "$httpStatus" },
          statusClass: { $first: "$statusClass" },
          isInternal: { $first: "$isInternal" },
          error: { $first: "$error" },
          firstSeenAt: { $min: "$firstSeenAt" },
          lastCheckedAt: { $max: "$checkedAt" },
          sources: { $push: { sourceUrl: "$sourceUrl", anchorText: "$anchorText" } },
        },
      },
      { $sort: { isInternal: -1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]),
    SeoLink.distinct("normalizedTarget", query),
  ]);

  return {
    links: grouped.map((row: any) => ({
      target: row._id,
      targetUrl: row.targetUrl,
      httpStatus: row.httpStatus,
      statusClass: row.statusClass,
      isInternal: row.isInternal,
      error: row.error,
      firstSeenAt: row.firstSeenAt,
      lastCheckedAt: row.lastCheckedAt,
      affectedPages: row.sources.length,
      sources: row.sources.slice(0, 50),
    })),
    meta: { page, limit, total: total.length, totalPages: Math.ceil(total.length / limit) },
  };
}

export async function listRedirects(site: ISeoSite) {
  const chains = await SeoRedirectChain.find({ siteId: site._id }).sort({ severity: 1, hopCount: -1 }).limit(500).lean();
  return chains.map((chain) => ({
    id: String(chain._id),
    source: chain.sourceUrl,
    hops: chain.hops,
    hopCount: chain.hopCount,
    finalUrl: chain.finalUrl,
    finalStatus: chain.finalStatus,
    isLoop: chain.isLoop,
    endsInError: chain.endsInError,
    issues: chain.issues,
    severity: chain.severity,
    checkedAt: chain.checkedAt,
  }));
}

export async function getHistory(site: ISeoSite, limit = 60) {
  const snapshots = await SeoSiteSnapshot.find({ siteId: site._id }).sort({ capturedAt: -1 }).limit(limit).lean();
  return snapshots
    .reverse()
    .map((snapshot) => ({
      capturedAt: snapshot.capturedAt,
      crawlId: String(snapshot.crawlId),
      scores: snapshot.scores,
      counts: snapshot.counts,
      performance: snapshot.performance,
      search: snapshot.search,
      analytics: snapshot.analytics,
    }));
}

export async function listCrawls(site: ISeoSite, limit = 25) {
  const crawls = await SeoCrawl.find({ siteId: site._id }).sort({ createdAt: -1 }).limit(limit).lean();
  return crawls.map((crawl) => ({
    id: String(crawl._id),
    status: crawl.status,
    trigger: crawl.trigger,
    startedAt: crawl.startedAt,
    completedAt: crawl.completedAt,
    durationMs: crawl.durationMs,
    stats: crawl.stats,
    scores: crawl.scores,
    error: crawl.error,
    log: crawl.log?.slice(-40) ?? [],
  }));
}

export async function listAlerts(site: ISeoSite, status?: string) {
  const query: FilterQuery<any> = { siteId: site._id };
  if (status) query.status = status;
  const alerts = await SeoAlert.find(query).sort({ createdAt: -1 }).limit(100).lean();
  return alerts.map((alert) => ({
    id: String(alert._id),
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    data: alert.data,
    status: alert.status,
    createdAt: alert.createdAt,
    acknowledgedAt: alert.acknowledgedAt,
  }));
}

export async function acknowledgeAlert(site: ISeoSite, alertId: string, userId?: Types.ObjectId) {
  if (!Types.ObjectId.isValid(alertId)) throw ApiError.badRequest("Invalid alert id");
  const alert = await SeoAlert.findOneAndUpdate(
    { _id: alertId, siteId: site._id },
    { $set: { status: "acknowledged", acknowledgedAt: new Date(), acknowledgedBy: userId ?? null } },
    { new: true },
  );
  if (!alert) throw ApiError.notFound("Alert not found");
  return { id: String(alert._id), status: alert.status, acknowledgedAt: alert.acknowledgedAt };
}
