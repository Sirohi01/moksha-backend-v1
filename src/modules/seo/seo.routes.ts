import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  acknowledgeSeoAlert,
  addCompetitor,
  createCannibalizationRecommendation,
  createContentGapRecommendation,
  createPageRecommendation,
  createSiteRecommendation,
  getAlerts,
  getBrokenLinks,
  getCompetitorComparison,
  getCompetitors,
  getCrawl,
  getCrawls,
  getInsights,
  getIssues,
  getPage,
  getPages,
  getRecommendations,
  getRedirectChains,
  getScore,
  getSeoHistory,
  getSeoOverview,
  getSite,
  removeCompetitor,
  startAudit,
  startCompetitorAudit,
  updateSite,
} from "./seo.controller";
import {
  acknowledgeAlertSchema,
  competitorIdSchema,
  crawlDetailSchema,
  createCompetitorSchema,
  listAlertsSchema,
  listBrokenLinksSchema,
  listIssuesSchema,
  listPagesSchema,
  overviewSchema,
  pageDetailSchema,
  pageRecommendationSchema,
  recommendationSchema,
  startAuditSchema,
  updateSiteSchema,
} from "./seo.validation";

const router = Router();

const readGuards = [requireAuth, authorize("reports.read")];
const writeGuards = [requireAuth, authorize("settings.update")];

router.get("/site", ...readGuards, validate(overviewSchema), getSite);
router.patch("/site", ...writeGuards, validate(updateSiteSchema), updateSite);

router.get("/overview", ...readGuards, validate(overviewSchema), getSeoOverview);
router.get("/score", ...readGuards, validate(overviewSchema), getScore);
router.get("/history", ...readGuards, validate(overviewSchema), getSeoHistory);
router.get("/insights", ...readGuards, validate(overviewSchema), getInsights);

router.post("/audits", ...writeGuards, validate(startAuditSchema), startAudit);
router.get("/audits", ...readGuards, validate(overviewSchema), getCrawls);
router.get("/audits/:id", ...readGuards, validate(crawlDetailSchema), getCrawl);

router.get("/pages", ...readGuards, validate(listPagesSchema), getPages);
router.get("/pages/:id", ...readGuards, validate(pageDetailSchema), getPage);

router.get("/issues", ...readGuards, validate(listIssuesSchema), getIssues);
router.get("/broken-links", ...readGuards, validate(listBrokenLinksSchema), getBrokenLinks);
router.get("/redirect-chains", ...readGuards, validate(overviewSchema), getRedirectChains);

router.get("/alerts", ...readGuards, validate(listAlertsSchema), getAlerts);
router.post("/alerts/:id/acknowledge", ...writeGuards, validate(acknowledgeAlertSchema), acknowledgeSeoAlert);

router.get("/recommendations", ...readGuards, getRecommendations);
router.post("/recommendations/site", ...writeGuards, validate(recommendationSchema), createSiteRecommendation);
router.post("/recommendations/pages/:id", ...writeGuards, validate(pageRecommendationSchema), createPageRecommendation);
router.post("/recommendations/cannibalization", ...writeGuards, validate(recommendationSchema), createCannibalizationRecommendation);
router.post("/recommendations/content-gap", ...writeGuards, validate(recommendationSchema), createContentGapRecommendation);

router.get("/competitors", ...readGuards, getCompetitors);
router.post("/competitors", ...writeGuards, validate(createCompetitorSchema), addCompetitor);
router.delete("/competitors/:id", ...writeGuards, validate(competitorIdSchema), removeCompetitor);
router.post("/competitors/:id/audit", ...writeGuards, validate(competitorIdSchema), startCompetitorAudit);
router.get("/competitors/comparison", ...readGuards, validate(overviewSchema), getCompetitorComparison);

export default router;
