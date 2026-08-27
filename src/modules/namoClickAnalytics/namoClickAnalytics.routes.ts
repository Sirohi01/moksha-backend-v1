import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoClickAnalytics.controller";
import { createNamoClickAnalyticsSchema } from "./namoClickAnalytics.validation";

const router = Router();

router.post("/create", validate(createNamoClickAnalyticsSchema), controller.create);
router.get("/admin", requireAuth, authorizeScoped({ permission: "namoClickAnalytics.read", organisation: "NAMOGANGE" }), controller.listAdmin);

export default router;
