import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { getDashboardOverview } from "./dashboard.controller";

const router = Router();

router.get("/admin/overview", requireAuth, authorize("reports.read"), getDashboardOverview);

export default router;
