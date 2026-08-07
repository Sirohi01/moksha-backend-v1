import { Router } from "express";
import { requireAuth, requireUserType } from "../../middlewares/auth.middleware";
import * as adminNotificationController from "./adminNotification.controller";

const router = Router();
const guards = [requireAuth, requireUserType("INTERNAL")];

// No permission-key gate (unlike most /admin routes) — this feed spans donations, enquiries,
// cases, and volunteers, none of which any single existing permission key covers, and every
// internal role should see it regardless of what they're otherwise allowed to touch.
router.get("/admin", ...guards, adminNotificationController.listNotifications);
router.patch("/admin/:id/read", ...guards, adminNotificationController.markRead);
router.patch("/admin/read-all", ...guards, adminNotificationController.markAllRead);

export default router;
