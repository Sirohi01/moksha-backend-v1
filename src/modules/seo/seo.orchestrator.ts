import { Types } from "mongoose";
import { logger } from "../../config/logger";
import { SeoAlert } from "../../models/seoAlert.model";
import { SeoAnalyticsSnapshot } from "../../models/seoAnalyticsSnapshot.model";
import { SeoCrawl, ISeoCrawl } from "../../models/seoCrawl.model";
import { SeoIssue } from "../../models/seoIssue.model";
import { SeoLink } from "../../models/seoLink.model";
import { SeoPage } from "../../models/seoPage.model";
import { SeoPageSnapshot } from "../../models/seoPageSnapshot.model";
import { SeoPerformanceAudit } from "../../models/seoPerformanceAudit.model";
import { SeoRedirectChain } from "../../models/seoRedirectChain.model";
import { SeoSearchSnapshot } from "../../models/seoSearchSnapshot.model";
import { SeoSite, ISeoSite } from "../../models/seoSite.model";
import { SeoSiteSnapshot } from "../../models/seoSiteSnapshot.model";
import { runCrawl, CrawlResult } from "./crawler/crawler";
import { buildRedirectChain, checkLinks, LinkCheckResult, RedirectChainResult } from "./crawler/linkChecker";
import { closeRenderer } from "./crawler/renderer";
import { normalizeUrl } from "./crawler/url.util";
import { buildSiteGraph, SiteGraph } from "./engine/graph";
import { computeIndexability, DetectedIssue, PerformanceSummary, runRules } from "./engine/rules";
import { computePageScore, computeSiteScore } from "./engine/score";
import { fetchAnalyticsSnapshot, fetchSearchConsoleSnapshot, runPageSpeedAudit } from "./integrations/google";
import { evaluateAlerts } from "./seo.alerts";

const SEARCH_WINDOW_DAYS = 28;
const ANALYTICS_WINDOW_DAYS = 28;
const MAX_PERSISTED_LINKS = 20000;

export interface RunAuditOptions {
  trigger?: "manual" | "scheduled";
  skipPerformance?: boolean;
  skipGoogleData?: boolean;
}

export class AuditInProgressError extends Error {
  constructor(public readonly crawlId: string) {
    super("An audit is already running for this site");
  }
}

export async function runSeoAudit(siteId: Types.ObjectId | string, options: RunAuditOptions = {}): Promise<ISeoCrawl> {
  const site = await SeoSite.findById(siteId);
  if (!site) throw new Error("SEO site not found");

  const existing = await SeoCrawl.findOne({ siteId: site._id, status: { $in: ["queued", "running"] } });
  if (existing) throw new AuditInProgressError(String(existing._id));

  const crawl = await SeoCrawl.create({
    siteId: site._id,
    status: "running",
    trigger: options.trigger ?? "manual",
    startedAt: new Date(),
  });

  const log: Array<{ at: Date; level: "info" | "warn" | "error"; message: string }> = [];
  const addLog = (message: string, level: "info" | "warn" | "error" = "info") => {
    log.push({ at: new Date(), level, message });
    if (log.length > 200) log.shift();
  };

  try {
    const result = await executeAudit(site, crawl._id, addLog, options);
    crawl.status = "completed";
    crawl.completedAt = new Date();
    crawl.durationMs = crawl.completedAt.getTime() - (crawl.startedAt?.getTime() ?? Date.now());
    crawl.stats = result.stats;
    crawl.scores = result.scores;
    crawl.robotsFound = result.robotsFound;
    crawl.sitemapFound = result.sitemapFound;
    crawl.sitemapUrlCount = result.sitemapUrlCount;
    crawl.log = log;
    await crawl.save();

    site.lastCrawlAt = crawl.completedAt;
    site.lastCrawlId = crawl._id;
    site.lastScore = result.scores.overall;
    await site.save();

    return crawl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit failed";
    addLog(message, "error");
    crawl.status = "failed";
    crawl.completedAt = new Date();
    crawl.error = message.slice(0, 500);
    crawl.log = log;
    await crawl.save();

    await SeoAlert.create({
      siteId: site._id,
      crawlId: crawl._id,
      type: "crawl_failed",
      severity: "critical",
      title: "SEO audit failed",
      message: message.slice(0, 1000),
      data: {},
    });

    logger.error("seoAudit: run failed", { siteId: String(site._id), err: error });
    throw error;
  } finally {
    await closeRenderer().catch(() => undefined);
  }
}

interface AuditOutcome {
  stats: ISeoCrawl["stats"];
  scores: ISeoCrawl["scores"];
  robotsFound: boolean;
  sitemapFound: boolean;
  sitemapUrlCount: number;
}

async function executeAudit(
  site: ISeoSite,
  crawlId: Types.ObjectId,
  addLog: (message: string, level?: "info" | "warn" | "error") => void,
  options: RunAuditOptions,
): Promise<AuditOutcome> {
  const settings = site.crawlSettings;

  // Search Console is fetched before the crawl so the URLs Google already knows about can seed
  // discovery. That matters for pages the static HTML never links to (client-rendered listings).
  const searchResult = options.skipGoogleData
    ? { status: "not_connected" as const, data: null, message: "Skipped" }
    : await fetchSearchConsoleSnapshot(site.searchConsoleSiteUrl, SEARCH_WINDOW_DAYS);

  const searchSeedUrls = searchResult.data
    ? [...new Set(searchResult.data.byPage.map((row) => row.key))].slice(0, 200)
    : [];
  if (searchSeedUrls.length) {
    addLog(`Seeding crawl with ${searchSeedUrls.length} URL(s) known to Search Console`);
  }

  addLog(`Starting crawl of ${site.url}`);
  const crawlResult = await runCrawl(
    {
      siteUrl: site.url,
      maxPages: settings.maxPages,
      maxDepth: settings.maxDepth,
      concurrency: settings.concurrency,
      requestTimeoutMs: settings.requestTimeoutMs,
      politenessDelayMs: settings.politenessDelayMs,
      respectRobots: settings.respectRobots,
      followSitemap: settings.followSitemap,
      renderJs: settings.renderJs,
      includeSubdomains: false,
      excludePatterns: settings.excludePatterns,
      extraSeedUrls: [...settings.extraSeedUrls, ...searchSeedUrls],
    },
    (message) => addLog(message),
  );

  addLog(`Crawled ${crawlResult.pages.length} URL(s), found ${crawlResult.edges.length} link(s)`);

  const rootNormalized = normalizeUrl(site.url)?.normalized ?? site.url;
  const graph = buildSiteGraph(crawlResult.pages, crawlResult.edges, rootNormalized);

  const known = new Map<string, LinkCheckResult>();
  for (const page of crawlResult.pages) {
    if (page.status == null) continue;
    known.set(page.normalizedUrl, {
      normalized: page.normalizedUrl,
      url: page.url,
      status: page.status,
      statusClass:
        page.status >= 500 ? "server_error" : page.status >= 400 ? "broken" : page.status >= 300 ? "redirect" : "ok",
      redirectsTo: page.redirected ? page.finalUrl : null,
      hops: page.hops,
      hopCount: Math.max(0, page.hops.length - 1),
      isBroken: page.status >= 400,
      isLoop: false,
      error: page.fetchError,
      checkedAt: new Date(),
    });
  }

  const linkTargets = new Map<string, { url: string; normalized: string; isInternal: boolean }>();
  for (const edge of crawlResult.edges) {
    if (linkTargets.has(edge.target)) continue;
    linkTargets.set(edge.target, { url: edge.targetHref, normalized: edge.target, isInternal: edge.isInternal });
  }

  addLog(`Checking ${linkTargets.size} unique link target(s)`);
  const linkResults = await checkLinks([...linkTargets.values()], {
    concurrency: settings.concurrency,
    timeoutMs: settings.requestTimeoutMs,
    checkExternal: settings.checkExternalLinks,
    known,
  });

  const redirectChains: RedirectChainResult[] = [];
  for (const [normalized, checked] of linkResults) {
    const chain = buildRedirectChain(normalized, checked, crawlResult.hostname);
    if (chain) redirectChains.push(chain);
  }
  for (const page of crawlResult.pages) {
    if (!page.redirected || page.hops.length < 2) continue;
    if (redirectChains.some((chain) => chain.sourceUrl === page.normalizedUrl)) continue;
    const chain = buildRedirectChain(
      page.normalizedUrl,
      {
        normalized: page.normalizedUrl,
        url: page.url,
        status: page.status,
        statusClass: "redirect",
        redirectsTo: page.finalUrl,
        hops: page.hops,
        hopCount: page.hops.length - 1,
        isBroken: false,
        isLoop: false,
        error: null,
        checkedAt: new Date(),
      },
      crawlResult.hostname,
    );
    if (chain) redirectChains.push(chain);
  }
  addLog(`Detected ${redirectChains.length} redirect chain(s)`);

  const performancePageFields = new Map<string, Record<string, unknown>>();
  const performance = options.skipPerformance
    ? new Map<string, PerformanceSummary>()
    : await runPerformanceAudits(site, crawlId, crawlResult, graph, addLog, performancePageFields);

  const analyticsResult = options.skipGoogleData
    ? { status: "not_connected" as const, data: null, message: "Skipped" }
    : await fetchAnalyticsSnapshot(site.ga4PropertyId, ANALYTICS_WINDOW_DAYS);

  addLog(`Search Console: ${searchResult.status}${searchResult.message ? ` (${searchResult.message})` : ""}`);
  addLog(`Analytics: ${analyticsResult.status}${analyticsResult.message ? ` (${analyticsResult.message})` : ""}`);

  const searchByPage = new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();
  if (searchResult.data) {
    for (const row of searchResult.data.byPage) {
      const normalized = normalizeUrl(row.key)?.normalized;
      if (!normalized) continue;
      searchByPage.set(normalized, {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      });
    }
  }

  const analyticsByPath = new Map<string, { views: number; users: number; engagementRate: number }>();
  if (analyticsResult.data) {
    for (const row of analyticsResult.data.pagePaths) {
      analyticsByPath.set(row.path.split("?")[0], {
        views: row.views,
        users: row.users,
        engagementRate: row.engagementRate,
      });
    }
  }

  const sitemapUrls = new Set(crawlResult.sitemapUrls);
  const issues = runRules({
    origin: crawlResult.origin,
    hostname: crawlResult.hostname,
    pages: crawlResult.pages,
    edges: crawlResult.edges,
    graph,
    linkResults,
    redirectChains,
    sitemapUrls,
    sitemapFound: crawlResult.sitemapFound,
    robots: crawlResult.robots,
    performance,
  });
  addLog(`Rules engine produced ${issues.length} issue(s)`);

  const issuesByUrl = new Map<string, DetectedIssue[]>();
  for (const detected of issues) {
    if (!detected.url) continue;
    if (!issuesByUrl.has(detected.url)) issuesByUrl.set(detected.url, []);
    issuesByUrl.get(detected.url)!.push(detected);
  }

  const pageIds = await persistPages(
    site,
    crawlId,
    crawlResult,
    graph,
    issuesByUrl,
    performance,
    performancePageFields,
    searchByPage,
    analyticsByPath,
    searchResult.data ? { start: searchResult.data.rangeStart, end: searchResult.data.rangeEnd } : null,
  );

  await persistIssues(site, crawlId, issues, pageIds);
  await persistLinks(site, crawlId, crawlResult, linkResults);
  await persistRedirectChains(site, crawlId, redirectChains);

  if (searchResult.data) {
    await SeoSearchSnapshot.create({
      siteId: site._id,
      crawlId,
      siteUrl: searchResult.data.siteUrl,
      windowDays: searchResult.data.windowDays,
      rangeStart: searchResult.data.rangeStart,
      rangeEnd: searchResult.data.rangeEnd,
      previousRangeStart: searchResult.data.previousRangeStart,
      previousRangeEnd: searchResult.data.previousRangeEnd,
      totals: searchResult.data.totals,
      previousTotals: searchResult.data.previousTotals,
      byQuery: searchResult.data.byQuery.slice(0, 250),
      previousByQuery: searchResult.data.previousByQuery.slice(0, 250),
      byPage: searchResult.data.byPage.slice(0, 500),
      previousByPage: searchResult.data.previousByPage.slice(0, 500),
      byDevice: searchResult.data.byDevice,
      byCountry: searchResult.data.byCountry,
      byDate: searchResult.data.byDate,
      queryPagePairs: searchResult.data.queryPagePairs.slice(0, 1000),
    });
  }

  if (analyticsResult.data) {
    await SeoAnalyticsSnapshot.create({
      siteId: site._id,
      crawlId,
      propertyId: analyticsResult.data.propertyId,
      windowDays: analyticsResult.data.windowDays,
      rangeStart: analyticsResult.data.rangeStart,
      rangeEnd: analyticsResult.data.rangeEnd,
      totals: analyticsResult.data.totals,
      previousTotals: analyticsResult.data.previousTotals,
      organicTotals: analyticsResult.data.organicTotals,
      landingPages: analyticsResult.data.landingPages.slice(0, 100),
      organicLandingPages: analyticsResult.data.organicLandingPages.slice(0, 100),
      channels: analyticsResult.data.channels,
      events: analyticsResult.data.events,
      daily: analyticsResult.data.daily,
    });
  }

  const htmlPages = crawlResult.pages.filter((page) => page.isHtml && page.parsed && page.status === 200);
  const indexablePages = htmlPages.filter(
    (page) => computeIndexability(page, crawlResult.robots, settings.respectRobots).indexable,
  );

  const pagesWithImpressions = indexablePages.filter(
    (page) => (searchByPage.get(page.normalizedUrl)?.impressions ?? 0) > 0,
  ).length;
  const pagesWithClicks = indexablePages.filter((page) => (searchByPage.get(page.normalizedUrl)?.clicks ?? 0) > 0).length;

  const scores = computeSiteScore(
    issues,
    Math.max(1, htmlPages.length),
    {
      available: searchResult.status === "connected",
      indexablePages: indexablePages.length,
      pagesWithImpressions,
      pagesWithClicks,
    },
    performance.size,
  );

  const counts = buildCounts(crawlResult, issues, graph, indexablePages.length, linkResults, redirectChains);
  const performanceAverages = averagePerformance(performance);

  await SeoSiteSnapshot.create({
    siteId: site._id,
    crawlId,
    scores: {
      overall: scores.overall,
      technical: scores.technical,
      onPage: scores.onPage,
      content: scores.content,
      performance: scores.performance,
      visibility: scores.visibility,
    },
    counts,
    performance: performanceAverages,
    search: {
      available: searchResult.status === "connected",
      windowDays: searchResult.data?.windowDays ?? null,
      clicks: searchResult.data?.totals.clicks ?? null,
      impressions: searchResult.data?.totals.impressions ?? null,
      ctr: searchResult.data?.totals.ctr ?? null,
      position: searchResult.data?.totals.position ?? null,
    },
    analytics: {
      available: analyticsResult.status === "connected",
      windowDays: analyticsResult.data?.windowDays ?? null,
      users: analyticsResult.data?.totals.users ?? null,
      sessions: analyticsResult.data?.totals.sessions ?? null,
      organicSessions: analyticsResult.data?.organicTotals.sessions ?? null,
    },
  });

  await evaluateAlerts(site, crawlId);

  const severityCount = (severity: string) => issues.filter((detected) => detected.severity === severity).length;

  return {
    stats: {
      urlsDiscovered: crawlResult.pages.length + crawlResult.skipped.length,
      pagesCrawled: crawlResult.pages.length,
      pagesFailed: crawlResult.pages.filter((page) => page.status == null && !page.blockedByRobots).length,
      htmlPages: htmlPages.length,
      linksFound: crawlResult.edges.length,
      linksChecked: linkResults.size,
      brokenLinks: [...linkResults.values()].filter((link) => link.isBroken).length,
      redirectChains: redirectChains.length,
      issuesFound: issues.length,
      criticalIssues: severityCount("critical"),
      warnings: severityCount("warning"),
      notices: severityCount("notice"),
      performanceAudits: performance.size,
    },
    scores: {
      overall: scores.overall,
      technical: scores.technical,
      onPage: scores.onPage,
      content: scores.content,
      performance: scores.performance,
      visibility: scores.visibility,
    },
    robotsFound: crawlResult.robots.found,
    sitemapFound: crawlResult.sitemapFound,
    sitemapUrlCount: crawlResult.sitemapUrls.length,
  };
}

function selectPerformanceUrls(site: ISeoSite, crawlResult: CrawlResult, graph: SiteGraph): string[] {
  const settings = site.crawlSettings;
  if (settings.maxPerformanceUrls <= 0) return [];

  if (settings.performanceUrls.length) {
    return settings.performanceUrls
      .map((url) => normalizeUrl(url)?.normalized)
      .filter((url): url is string => Boolean(url))
      .slice(0, settings.maxPerformanceUrls);
  }

  const candidates = crawlResult.pages
    .filter((page) => page.isHtml && page.status === 200)
    .map((page) => ({
      normalized: page.normalizedUrl,
      depth: graph.nodes.get(page.normalizedUrl)?.depth ?? 99,
      inLinks: graph.nodes.get(page.normalizedUrl)?.uniqueInLinks ?? 0,
    }))
    .sort((a, b) => a.depth - b.depth || b.inLinks - a.inLinks || a.normalized.localeCompare(b.normalized));

  return candidates.slice(0, settings.maxPerformanceUrls).map((candidate) => candidate.normalized);
}

async function runPerformanceAudits(
  site: ISeoSite,
  crawlId: Types.ObjectId,
  crawlResult: CrawlResult,
  graph: SiteGraph,
  addLog: (message: string, level?: "info" | "warn" | "error") => void,
  pageFields: Map<string, Record<string, unknown>>,
): Promise<Map<string, PerformanceSummary>> {
  const targets = selectPerformanceUrls(site, crawlResult, graph);
  const summaries = new Map<string, PerformanceSummary>();
  if (!targets.length) return summaries;

  addLog(`Running PageSpeed Insights on ${targets.length} URL(s)`);
  const pageByNormalized = new Map(crawlResult.pages.map((page) => [page.normalizedUrl, page]));

  for (const normalized of targets) {
    const page = pageByNormalized.get(normalized);
    const targetUrl = page?.finalUrl ?? page?.url ?? normalized;
    const outcome = await runPageSpeedAudit(targetUrl, site.crawlSettings.performanceStrategy);

    if (outcome.status !== "connected" || !outcome.data) {
      addLog(`PageSpeed failed for ${normalized}: ${outcome.message ?? "unknown error"}`, "warn");
      await SeoPerformanceAudit.create({
        siteId: site._id,
        crawlId,
        url: targetUrl,
        normalizedUrl: normalized,
        strategy: site.crawlSettings.performanceStrategy,
        status: "error",
        error: (outcome.message ?? "PageSpeed request failed").slice(0, 500),
      });
      continue;
    }

    const audit = await SeoPerformanceAudit.create({
      siteId: site._id,
      crawlId,
      url: outcome.data.url,
      normalizedUrl: normalized,
      strategy: outcome.data.strategy,
      lighthouseVersion: outcome.data.lighthouseVersion,
      lab: outcome.data.lab,
      field: outcome.data.field,
      opportunities: outcome.data.opportunities,
      status: "ok",
    });

    summaries.set(normalized, {
      normalizedUrl: normalized,
      performance: outcome.data.lab.performance,
      lcpMs: outcome.data.field.available ? outcome.data.field.lcpMs : outcome.data.lab.lcpMs,
      clsScore: outcome.data.field.available ? outcome.data.field.clsScore : outcome.data.lab.clsScore,
      inpMs: outcome.data.field.inpMs,
      fieldAvailable: outcome.data.field.available,
    });

    // Written by persistPages rather than here: on a site's first crawl the SeoPage documents
    // do not exist yet, so an update at this point would silently match nothing.
    pageFields.set(normalized, {
      auditId: audit._id,
      strategy: outcome.data.strategy,
      performance: outcome.data.lab.performance,
      accessibility: outcome.data.lab.accessibility,
      bestPractices: outcome.data.lab.bestPractices,
      seo: outcome.data.lab.seo,
      labLcpMs: outcome.data.lab.lcpMs,
      labCls: outcome.data.lab.clsScore,
      fieldLcpMs: outcome.data.field.lcpMs,
      fieldCls: outcome.data.field.clsScore,
      fieldInpMs: outcome.data.field.inpMs,
      fetchedAt: audit.fetchedAt,
    });
  }

  return summaries;
}

async function persistPages(
  site: ISeoSite,
  crawlId: Types.ObjectId,
  crawlResult: CrawlResult,
  graph: SiteGraph,
  issuesByUrl: Map<string, DetectedIssue[]>,
  performance: Map<string, PerformanceSummary>,
  performancePageFields: Map<string, Record<string, unknown>>,
  searchByPage: Map<string, { clicks: number; impressions: number; ctr: number; position: number }>,
  analyticsByPath: Map<string, { views: number; users: number; engagementRate: number }>,
  searchRange: { start: string; end: string } | null,
): Promise<Map<string, Types.ObjectId>> {
  const pageIds = new Map<string, Types.ObjectId>();
  const snapshots: Array<Record<string, unknown>> = [];

  for (const page of crawlResult.pages) {
    const pageIssues = issuesByUrl.get(page.normalizedUrl) ?? [];
    const scoreResult = computePageScore(pageIssues);
    const node = graph.nodes.get(page.normalizedUrl);
    const parsed = page.parsed;
    const indexability = computeIndexability(page, crawlResult.robots, site.crawlSettings.respectRobots);
    const canonicalRaw = parsed?.canonicals[0] ?? null;
    const canonicalResolved = canonicalRaw ? normalizeUrl(canonicalRaw, page.finalUrl ?? page.url) : null;
    const searchStats = searchByPage.get(page.normalizedUrl);
    const analyticsStats = analyticsByPath.get(page.path);
    const perf = performance.get(page.normalizedUrl);

    const issueCounts = {
      critical: pageIssues.filter((issue) => issue.severity === "critical").length,
      warning: pageIssues.filter((issue) => issue.severity === "warning").length,
      notice: pageIssues.filter((issue) => issue.severity === "notice").length,
      total: pageIssues.length,
    };

    const brokenLinkCount = pageIssues
      .filter((issue) => issue.ruleId === "BROKEN_INTERNAL_LINK" || issue.ruleId === "BROKEN_EXTERNAL_LINK")
      .reduce((sum, issue) => sum + Number(issue.evidence.count ?? 0), 0);

    const update: Record<string, unknown> = {
      siteId: site._id,
      crawlId,
      url: page.url,
      normalizedUrl: page.normalizedUrl,
      path: page.path,
      httpStatus: page.status,
      contentType: page.contentType,
      responseTimeMs: page.responseTimeMs,
      contentLength: page.contentLength,
      finalUrl: page.finalUrl,
      redirected: page.redirected,
      fetchError: page.fetchError,
      crawledAt: new Date(),
      renderedWithJs: page.renderedWithJs,

      title: parsed?.title ?? null,
      titleLength: parsed?.titleLength ?? 0,
      metaDescription: parsed?.metaDescription ?? null,
      metaDescriptionLength: parsed?.metaDescriptionLength ?? 0,
      metaRobots: parsed?.metaRobots ?? null,
      canonical: canonicalRaw,
      canonicalNormalized: canonicalResolved?.normalized ?? null,
      canonicalCount: parsed?.canonicals.length ?? 0,
      canonicalIsSelf: canonicalResolved ? canonicalResolved.normalized === page.normalizedUrl : null,
      ogTitle: parsed?.ogTitle ?? null,
      ogDescription: parsed?.ogDescription ?? null,
      ogImage: parsed?.ogImage ?? null,
      ogType: parsed?.ogType ?? null,
      twitterCard: parsed?.twitterCard ?? null,
      twitterTitle: parsed?.twitterTitle ?? null,
      twitterDescription: parsed?.twitterDescription ?? null,
      twitterImage: parsed?.twitterImage ?? null,
      lang: parsed?.lang ?? null,
      viewport: parsed?.viewport ?? null,
      hreflang: parsed?.hreflang ?? [],

      h1: parsed?.headings.h1 ?? [],
      h2: parsed?.headings.h2 ?? [],
      h3: parsed?.headings.h3 ?? [],
      headingCounts: parsed?.headings.counts ?? {},
      headingSequence: parsed?.headings.sequence ?? [],
      hierarchyStatus: parsed ? parsed.headings.status : "unknown",
      headingIssues: parsed?.headings.issues ?? [],

      wordCount: parsed?.wordCount ?? 0,
      textHash: parsed?.textHash ?? null,
      contentSimhash: parsed?.simhash ?? null,
      titleHash: parsed?.titleHash ?? null,
      descriptionHash: parsed?.descriptionHash ?? null,

      images: parsed?.images.slice(0, 100) ?? [],
      imageCount: parsed?.images.length ?? 0,
      imagesMissingAlt: parsed?.images.filter((image) => !image.hasAlt && !image.isDecorative).length ?? 0,
      imagesEmptyAlt: parsed?.images.filter((image) => image.isDecorative).length ?? 0,
      imagesLazyLoaded: parsed?.images.filter((image) => image.loading === "lazy").length ?? 0,
      imagesWithoutDimensions: parsed?.images.filter((image) => image.width == null || image.height == null).length ?? 0,

      internalLinkCount: parsed?.links.filter((link) => link.isInternal).length ?? 0,
      externalLinkCount: parsed?.links.filter((link) => !link.isInternal).length ?? 0,
      uniqueInternalLinks: node?.uniqueOutLinks ?? 0,
      nofollowLinkCount: parsed?.links.filter((link) => link.isNofollow).length ?? 0,
      brokenLinkCount,
      mixedContentLinkCount: parsed?.links.filter((link) => link.isMixedContent).length ?? 0,

      schemas: page.schema?.blocks ?? [],
      schemaTypes: page.schema?.types ?? [],
      schemaValid: page.schema?.allValid ?? null,
      hasBreadcrumbSchema: page.schema?.hasBreadcrumb ?? false,
      breadcrumbValid: page.schema?.breadcrumbValid ?? null,
      breadcrumbIssues: page.schema?.breadcrumbIssues ?? [],

      indexable: indexability.indexable,
      indexabilityReason: indexability.reason,
      blockedByRobots: page.blockedByRobots,
      inSitemap: page.inSitemap,

      depth: node?.depth ?? null,
      inLinks: node?.uniqueInLinks ?? 0,
      outLinks: node?.uniqueOutLinks ?? 0,
      isOrphan: node?.isOrphan ?? false,
      isDeadEnd: node?.isDeadEnd ?? false,

      issueCounts,
      issueCategories: [...new Set(pageIssues.map((issue) => issue.category))],
      issueRuleIds: [...new Set(pageIssues.map((issue) => issue.ruleId))],
      score: scoreResult.score,
      scoreBreakdown: scoreResult.breakdown,

      search: {
        clicks: searchStats?.clicks ?? 0,
        impressions: searchStats?.impressions ?? 0,
        ctr: searchStats?.ctr ?? 0,
        position: searchStats?.position ?? 0,
        rangeStart: searchRange?.start ?? null,
        rangeEnd: searchRange?.end ?? null,
        updatedAt: searchStats ? new Date() : null,
      },
      analytics: {
        views: analyticsStats?.views ?? 0,
        users: analyticsStats?.users ?? 0,
        engagementRate: analyticsStats?.engagementRate ?? null,
        updatedAt: analyticsStats ? new Date() : null,
      },
    };

    const performanceFields = performancePageFields.get(page.normalizedUrl);
    if (performanceFields) update.performance = performanceFields;

    const saved = await SeoPage.findOneAndUpdate(
      { siteId: site._id, normalizedUrl: page.normalizedUrl },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    pageIds.set(page.normalizedUrl, saved._id);

    snapshots.push({
      siteId: site._id,
      crawlId,
      pageId: saved._id,
      normalizedUrl: page.normalizedUrl,
      httpStatus: page.status,
      indexable: indexability.indexable,
      score: scoreResult.score,
      wordCount: parsed?.wordCount ?? 0,
      issueCounts,
      titleHash: parsed?.titleHash ?? null,
      descriptionHash: parsed?.descriptionHash ?? null,
      contentHash: parsed?.textHash ?? null,
      canonicalNormalized: canonicalResolved?.normalized ?? null,
      metaRobots: parsed?.metaRobots ?? null,
      inLinks: node?.uniqueInLinks ?? 0,
      outLinks: node?.uniqueOutLinks ?? 0,
      depth: node?.depth ?? null,
      performanceScore: perf?.performance ?? null,
      lcpMs: perf?.lcpMs ?? null,
      cls: perf?.clsScore ?? null,
      clicks: searchStats?.clicks ?? null,
      impressions: searchStats?.impressions ?? null,
      position: searchStats?.position ?? null,
    });
  }

  if (snapshots.length) await SeoPageSnapshot.insertMany(snapshots, { ordered: false });
  return pageIds;
}

async function persistIssues(
  site: ISeoSite,
  crawlId: Types.ObjectId,
  issues: DetectedIssue[],
  pageIds: Map<string, Types.ObjectId>,
): Promise<void> {
  const now = new Date();
  const operations = issues.map((detected) => ({
    updateOne: {
      filter: { siteId: site._id, ruleId: detected.ruleId, url: detected.url },
      update: {
        $set: {
          crawlId,
          pageId: detected.url ? pageIds.get(detected.url) ?? null : null,
          category: detected.category,
          severity: detected.severity,
          title: detected.title.slice(0, 200),
          detail: detected.detail.slice(0, 1000),
          evidence: detected.evidence,
          scope: detected.scope,
          status: "open" as const,
          lastSeenAt: now,
          resolvedAt: null,
        },
        $setOnInsert: { firstSeenAt: now },
      },
      upsert: true,
    },
  }));

  for (let index = 0; index < operations.length; index += 500) {
    await SeoIssue.bulkWrite(operations.slice(index, index + 500), { ordered: false });
  }

  await SeoIssue.updateMany(
    { siteId: site._id, status: "open", crawlId: { $ne: crawlId } },
    { $set: { status: "resolved", resolvedAt: now } },
  );
}

async function persistLinks(
  site: ISeoSite,
  crawlId: Types.ObjectId,
  crawlResult: CrawlResult,
  linkResults: Map<string, LinkCheckResult>,
): Promise<void> {
  const now = new Date();
  const seen = new Set<string>();
  const operations: Array<Record<string, unknown>> = [];

  for (const edge of crawlResult.edges) {
    const key = `${edge.source}|${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (operations.length >= MAX_PERSISTED_LINKS) break;

    const checked = linkResults.get(edge.target);
    operations.push({
      updateOne: {
        filter: { siteId: site._id, sourceUrl: edge.source, normalizedTarget: edge.target },
        update: {
          $set: {
            crawlId,
            targetUrl: edge.targetHref,
            anchorText: edge.anchorText.slice(0, 500),
            rel: edge.rel,
            isInternal: edge.isInternal,
            isNofollow: edge.isNofollow,
            httpStatus: checked?.status ?? null,
            statusClass: checked?.statusClass ?? "unchecked",
            redirectsTo: checked?.redirectsTo ?? null,
            redirectHops: checked?.hopCount ?? 0,
            isBroken: checked?.isBroken ?? false,
            error: checked?.error ?? null,
            checkedAt: checked?.checkedAt ?? null,
            lastSeenAt: now,
          },
          $setOnInsert: { firstSeenAt: now },
        },
        upsert: true,
      },
    });
  }

  for (let index = 0; index < operations.length; index += 500) {
    await SeoLink.bulkWrite(operations.slice(index, index + 500) as never, { ordered: false });
  }

  await SeoLink.deleteMany({ siteId: site._id, crawlId: { $ne: crawlId } });
}

async function persistRedirectChains(
  site: ISeoSite,
  crawlId: Types.ObjectId,
  chains: RedirectChainResult[],
): Promise<void> {
  const operations = chains.map((chain) => ({
    updateOne: {
      filter: { siteId: site._id, sourceUrl: chain.sourceUrl },
      update: {
        $set: {
          crawlId,
          hops: chain.hops.map((hop) => ({ url: hop.url, status: hop.status, location: hop.location })),
          hopCount: chain.hopCount,
          finalUrl: chain.finalUrl,
          finalStatus: chain.finalStatus,
          isLoop: chain.isLoop,
          endsInError: chain.endsInError,
          issues: chain.issues,
          severity: chain.severity,
          checkedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  for (let index = 0; index < operations.length; index += 500) {
    await SeoRedirectChain.bulkWrite(operations.slice(index, index + 500), { ordered: false });
  }

  await SeoRedirectChain.deleteMany({ siteId: site._id, crawlId: { $ne: crawlId } });
}

function buildCounts(
  crawlResult: CrawlResult,
  issues: DetectedIssue[],
  graph: SiteGraph,
  indexablePages: number,
  linkResults: Map<string, LinkCheckResult>,
  redirectChains: RedirectChainResult[],
) {
  const htmlPages = crawlResult.pages.filter((page) => page.isHtml && page.parsed && page.status === 200);
  const countRule = (ruleId: string) => issues.filter((issue) => issue.ruleId === ruleId).length;
  const pagesWithCritical = new Set(
    issues.filter((issue) => issue.severity === "critical" && issue.url).map((issue) => issue.url!),
  );

  const internalTargets = new Set(crawlResult.edges.filter((edge) => edge.isInternal).map((edge) => edge.target));
  const externalTargets = new Set(crawlResult.edges.filter((edge) => !edge.isInternal).map((edge) => edge.target));

  return {
    urlsCrawled: crawlResult.pages.length,
    htmlPages: htmlPages.length,
    indexablePages,
    healthyPages: htmlPages.filter((page) => !pagesWithCritical.has(page.normalizedUrl)).length,
    criticalIssues: issues.filter((issue) => issue.severity === "critical").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    notices: issues.filter((issue) => issue.severity === "notice").length,
    brokenInternalLinks: [...internalTargets].filter((target) => linkResults.get(target)?.isBroken).length,
    brokenExternalLinks: [...externalTargets].filter((target) => linkResults.get(target)?.isBroken).length,
    redirectIssues: redirectChains.filter((chain) => chain.severity !== "none").length,
    pagesMissingTitle: countRule("TITLE_MISSING"),
    pagesMissingDescription: countRule("DESCRIPTION_MISSING"),
    pagesMissingH1: countRule("H1_MISSING"),
    canonicalIssues: issues.filter((issue) => issue.category === "canonical").length,
    schemaIssues: issues.filter((issue) => issue.category === "structured_data").length,
    orphanPages: [...graph.nodes.values()].filter((node) => node.isOrphan).length,
    thinContentPages: countRule("THIN_CONTENT"),
    duplicateTitlePages: countRule("TITLE_DUPLICATE"),
  };
}

function averagePerformance(performance: Map<string, PerformanceSummary>) {
  const values = [...performance.values()];
  if (!values.length) {
    return { score: null, lcpMs: null, clsScore: null, inpMs: null, fieldDataAvailable: false };
  }
  const average = (selector: (item: PerformanceSummary) => number | null) => {
    const numbers = values.map(selector).filter((value): value is number => value != null);
    if (!numbers.length) return null;
    return Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2));
  };
  return {
    score: average((item) => item.performance),
    lcpMs: average((item) => item.lcpMs),
    clsScore: average((item) => item.clsScore),
    inpMs: average((item) => item.inpMs),
    fieldDataAvailable: values.some((item) => item.fieldAvailable),
  };
}
