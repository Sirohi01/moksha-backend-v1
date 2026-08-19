import { Router } from "express";
import { Enquiry } from "../../models/enquiry.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { publicFormLimiter } from "../../middlewares/rateLimiters";
import { buildAdminCrudHandlers, mountAdminCrudRoutes } from "../../utils/crudFactory";
import * as enquiryController from "./enquiry.controller";
import { createEnquirySchema, updateEnquiryStatusSchema } from "./enquiry.validation";
import { createCsrEnquirySchema, createPartnershipEnquirySchema, createUnclaimedBodyEnquirySchema } from "./enquiry.validation";
import { uploadSingleFilePublic, verifyOptionalFileSignature } from "../upload/upload.middleware";

const router = Router();
const adminGuards = [requireAuth, authorize("enquiries.update")];
const handlers = buildAdminCrudHandlers(Enquiry, "Enquiry", ["phone", "email"]);

router.post("/", publicFormLimiter, validate(createEnquirySchema), enquiryController.createEnquiry);
router.post("/csr", publicFormLimiter, validate(createCsrEnquirySchema), enquiryController.createCsrEnquiry);
router.post("/partnership", publicFormLimiter, validate(createPartnershipEnquirySchema), enquiryController.createPartnershipEnquiry);
router.post(
  "/unclaimed-body",
  publicFormLimiter,
  uploadSingleFilePublic,
  verifyOptionalFileSignature,
  validate(createUnclaimedBodyEnquirySchema),
  enquiryController.createUnclaimedBodyEnquiry
);

mountAdminCrudRoutes(router, handlers, adminGuards);
router.put("/admin/:id/status", ...adminGuards, validate(updateEnquiryStatusSchema), enquiryController.updateEnquiryStatus);

export default router;
