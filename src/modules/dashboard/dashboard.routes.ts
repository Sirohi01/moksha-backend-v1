import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { getDashboardOverview, getIndexCoverageStatus, getPageSpeedStatus, getSiteStatus } from "./dashboard.controller";

const router = Router();

router.get("/admin/overview", requireAuth, authorize("reports.read"), getDashboardOverview);
router.get("/admin/page-speed", requireAuth, authorize("reports.read"), getPageSpeedStatus);
router.get("/admin/index-coverage", requireAuth, authorize("reports.read"), getIndexCoverageStatus);
router.get("/admin/site-status", requireAuth, authorize("reports.read"), getSiteStatus);

export default router;
