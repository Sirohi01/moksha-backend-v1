import { Request, Response } from "express";
import { Types } from "mongoose";
import { logger } from "../../config/logger";
import { ApiError } from "../../utils/ApiError";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { SeoCrawl } from "../../models/seoCrawl.model";
import { RULE_THRESHOLDS } from "./engine/rules";
import { CATEGORY_WEIGHTS, SEVERITY_PENALTY, SITE_SENSITIVITY } from "./engine/score";
import { AuditInProgressError, runSeoAudit } from "./seo.orchestrator";
import { compareCompetitors, createCompetitor, deleteCompetitor, listCompetitors } from "./seo.competitors";
import { buildSearchInsights, INSIGHT_THRESHOLDS } from "./seo.insights";
import {
  generateForCannibalization,
  generateForContentGap,
  generateForPage,
  generateForSite,
  listRecommendations,
} from "./seo.recommendations";
import { computeNextRun } from "./seo.scheduler";
import {
  acknowledgeAlert,
  getHistory,
  getOverview,
  getPageDetail,
  getScoreExplanation,
  listAlerts,
  listBrokenLinks,
  listCrawls,
  listIssues,
  listPages,
  listRedirects,
  resolveSite,
} from "./seo.service";
import { SeoSite } from "../../models/seoSite.model";

const siteIdOf = (req: Request) => (req.query.siteId as string | undefined) ?? undefined;
const isTrue = (value: unknown) => value === true || value === "true";

export const getSite = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "SEO site fetched", {
    id: String(site._id),
    url: site.url,
    label: site.label,
    type: site.type,
    isActive: site.isActive,
    crawlSettings: site.crawlSettings,
    schedule: site.schedule,
    lastCrawlAt: site.lastCrawlAt,
    lastScore: site.lastScore,
    searchConsoleConnected: Boolean(site.searchConsoleSiteUrl),
    analyticsConnected: Boolean(site.ga4PropertyId),
    thresholds: RULE_THRESHOLDS,
    scoring: { severityPenalty: SEVERITY_PENALTY, sensitivity: SITE_SENSITIVITY, weights: CATEGORY_WEIGHTS },
    insightThresholds: INSIGHT_THRESHOLDS,
  });
});

export const updateSite = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  const { label, isActive, crawlSettings, schedule } = req.body as Record<string, any>;

  if (label !== undefined) site.label = label;
  if (isActive !== undefined) site.isActive = isActive;
  if (crawlSettings) Object.assign(site.crawlSettings, crawlSettings);
  if (schedule) {
    Object.assign(site.schedule, schedule);
    site.schedule.nextRunAt = site.schedule.enabled ? computeNextRun(site.schedule) : null;
  }

  await site.save();
  sendSuccess(res, 200, "SEO site updated", {
    id: String(site._id),
    crawlSettings: site.crawlSettings,
    schedule: site.schedule,
  });
});

export const getSeoOverview = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "SEO overview fetched", await getOverview(site));
});

export const startAudit = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  const running = await SeoCrawl.findOne({ siteId: site._id, status: { $in: ["queued", "running"] } }).lean();
  if (running) throw ApiError.conflict("An audit is already running for this site");

  const options = {
    skipPerformance: isTrue(req.body?.skipPerformance),
    skipGoogleData: isTrue(req.body?.skipGoogleData),
    renderJs: true,
    trigger: "manual" as const,
  };

  runSeoAudit(site._id, options).catch((error) => {
    if (error instanceof AuditInProgressError) return;
    logger.error("seoAudit: background run failed", { siteId: String(site._id), err: error });
  });

  let crawl = null;
  for (let attempt = 0; attempt < 10 && !crawl; attempt += 1) {
    crawl = await SeoCrawl.findOne({ siteId: site._id }).sort({ createdAt: -1 }).lean();
    if (!crawl) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  sendSuccess(res, 202, "SEO audit started", {
    crawlId: crawl ? String(crawl._id) : null,
    status: crawl?.status ?? "running",
  });
});

export const getCrawls = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "SEO audits fetched", await listCrawls(site));
});

export const getCrawl = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest("Invalid audit id");
  const crawl = await SeoCrawl.findById(id).lean();
  if (!crawl) throw ApiError.notFound("Audit not found");

  sendSuccess(res, 200, "SEO audit fetched", {
    id: String(crawl._id),
    siteId: String(crawl.siteId),
    status: crawl.status,
    trigger: crawl.trigger,
    startedAt: crawl.startedAt,
    completedAt: crawl.completedAt,
    durationMs: crawl.durationMs,
    stats: crawl.stats,
    scores: crawl.scores,
    robotsFound: crawl.robotsFound,
    sitemapFound: crawl.sitemapFound,
    sitemapUrlCount: crawl.sitemapUrlCount,
    error: crawl.error,
    log: crawl.log ?? [],
  });
});

export const getPages = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  const query = req.query as Record<string, any>;
  const result = await listPages(site, {
    search: query.search,
    status: query.status,
    indexable: query.indexable,
    severity: query.severity,
    issueCategory: query.issueCategory,
    hasBrokenLinks: query.hasBrokenLinks,
    inSitemap: query.inSitemap,
    orphan: query.orphan,
    minScore: query.minScore,
    maxScore: query.maxScore,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    page: query.page,
    limit: query.limit,
  });

  sendSuccess(
    res,
    200,
    "SEO pages fetched",
    { pages: result.pages, crawlId: result.crawlId, message: result.message, meta: result.meta },
    result.meta,
  );
});

export const getPage = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "SEO page fetched", await getPageDetail(site, req.params.id));
});

export const getIssues = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  const query = req.query as Record<string, any>;
  const result = await listIssues(site, {
    severity: query.severity,
    category: query.category,
    ruleId: query.ruleId,
    status: query.status,
    page: query.page,
    limit: query.limit,
  });
  sendSuccess(res, 200, "SEO issues fetched", { issues: result.issues, meta: result.meta }, result.meta);
});

export const getBrokenLinks = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  const query = req.query as Record<string, any>;
  const result = await listBrokenLinks(site, {
    internalOnly: query.internalOnly,
    page: query.page,
    limit: query.limit,
  });
  sendSuccess(res, 200, "Broken links fetched", { links: result.links, meta: result.meta }, result.meta);
});

export const getRedirectChains = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "Redirect chains fetched", await listRedirects(site));
});

export const getSeoHistory = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "SEO history fetched", await getHistory(site));
});

export const getScore = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "SEO score explanation fetched", await getScoreExplanation(site));
});

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "Search insights fetched", await buildSearchInsights(site._id));
});

export const getAlerts = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "SEO alerts fetched", await listAlerts(site, req.query.status as string | undefined));
});

export const acknowledgeSeoAlert = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  const userId = req.auth?.userId ? new Types.ObjectId(req.auth.userId) : undefined;
  sendSuccess(res, 200, "Alert acknowledged", await acknowledgeAlert(site, req.params.id, userId));
});

export const getRecommendations = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "AI recommendations fetched", await listRecommendations(site, req.query.scope as string | undefined));
});

export const createSiteRecommendation = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "Site recommendations generated", await generateForSite(site, isTrue(req.query.force)));
});

export const createPageRecommendation = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "Page recommendations generated", await generateForPage(site, req.params.id, isTrue(req.query.force)));
});

export const createCannibalizationRecommendation = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "Cannibalization analysis generated", await generateForCannibalization(site, isTrue(req.query.force)));
});

export const createContentGapRecommendation = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "Content gap analysis generated", await generateForContentGap(site, isTrue(req.query.force)));
});

export const getCompetitors = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Competitors fetched", await listCompetitors());
});

export const addCompetitor = asyncHandler(async (req: Request, res: Response) => {
  const site = await createCompetitor(req.body.url, req.body.label);
  sendSuccess(res, 201, "Competitor added", { id: String(site._id), url: site.url, label: site.label });
});

export const removeCompetitor = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, 200, "Competitor removed", await deleteCompetitor(req.params.id));
});

export const startCompetitorAudit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest("Invalid competitor id");
  const site = await SeoSite.findOne({ _id: id, type: "competitor" });
  if (!site) throw ApiError.notFound("Competitor not found");

  const running = await SeoCrawl.findOne({ siteId: site._id, status: { $in: ["queued", "running"] } }).lean();
  if (running) throw ApiError.conflict("A crawl is already running for this competitor");

  runSeoAudit(site._id, { trigger: "manual", skipGoogleData: true }).catch((error) => {
    logger.error("seoAudit: competitor crawl failed", { siteId: String(site._id), err: error });
  });

  sendSuccess(res, 202, "Competitor crawl started", { siteId: String(site._id) });
});

export const getCompetitorComparison = asyncHandler(async (req: Request, res: Response) => {
  const site = await resolveSite(siteIdOf(req));
  sendSuccess(res, 200, "Competitor comparison fetched", await compareCompetitors(site));
});
