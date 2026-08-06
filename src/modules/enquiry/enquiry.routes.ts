import { Router } from "express";
import { Enquiry } from "../../models/enquiry.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers, mountAdminCrudRoutes } from "../../utils/crudFactory";
import * as enquiryController from "./enquiry.controller";
import { createEnquirySchema, updateEnquiryStatusSchema } from "./enquiry.validation";

const router = Router();
const adminGuards = [requireAuth, authorize("enquiries.update")];
const handlers = buildAdminCrudHandlers(Enquiry, "Enquiry", ["phone", "email"]);

router.post("/", validate(createEnquirySchema), enquiryController.createEnquiry);

mountAdminCrudRoutes(router, handlers, adminGuards);
router.put("/admin/:id/status", ...adminGuards, validate(updateEnquiryStatusSchema), enquiryController.updateEnquiryStatus);

export default router;
