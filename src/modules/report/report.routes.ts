import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import * as reportController from "./report.controller";

const router = Router();

// Public — no login, deliberately narrow (aggregate counts only). See report.service.ts's
// getPublicImpact() doc comment for what "narrow" means here.
router.get("/impact", reportController.getPublicImpact);

router.get("/admin/overview", requireAuth, authorize("reports.read"), reportController.getOverview);
router.get("/admin/snapshots", requireAuth, authorize("reports.read"), reportController.getSnapshots);
router.get("/admin/export/cases.csv", requireAuth, authorize("reports.export"), reportController.exportCasesCsv);
router.get("/admin/export/donations.csv", requireAuth, authorize("reports.export"), reportController.exportDonationsCsv);

export default router;
