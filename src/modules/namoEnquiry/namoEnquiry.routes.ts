import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoEnquiry.controller";
import { createNamoEnquirySchema } from "./namoEnquiry.validation";

const router = Router();

router.post("/create", validate(createNamoEnquirySchema), controller.create);
router.get("/admin", requireAuth, authorizeScoped({ permission: "namoEnquiries.read", organisation: "NAMOGANGE" }), controller.listAdmin);

export default router;
