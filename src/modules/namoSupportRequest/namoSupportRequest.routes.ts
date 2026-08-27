import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoSupportRequest.controller";
import { createNamoSupportRequestSchema } from "./namoSupportRequest.validation";

const router = Router();

router.post("/create", validate(createNamoSupportRequestSchema), controller.create);
router.get("/admin", requireAuth, authorizeScoped({ permission: "namoSupportRequests.read", organisation: "NAMOGANGE" }), controller.listAdmin);

export default router;
