import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as campaignController from "./campaign.controller";
import { createCampaignSchema, listCampaignsQuerySchema, updateCampaignSchema } from "./campaign.validation";

const router = Router();

// Public — active campaigns only, for the donation page's cause picker
router.get("/", campaignController.listPublicCampaigns);

// Admin
router.get(
  "/admin",
  requireAuth,
  authorize("campaigns.read"),
  validate(listCampaignsQuerySchema),
  campaignController.listCampaignsAdmin
);
router.get("/admin/:id", requireAuth, authorize("campaigns.read"), campaignController.getCampaignAdmin);
router.post(
  "/admin",
  requireAuth,
  authorize("campaigns.create"),
  validate(createCampaignSchema),
  campaignController.createCampaign
);
router.put(
  "/admin/:id",
  requireAuth,
  authorize("campaigns.update"),
  validate(updateCampaignSchema),
  campaignController.updateCampaign
);

export default router;
