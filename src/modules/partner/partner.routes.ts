import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as partnerController from "./partner.controller";
import { createPartnerSchema, listPartnersQuerySchema, updatePartnerSchema } from "./partner.validation";

const router = Router();
const adminGuards = [requireAuth, authorize("partners.read")];

router.get("/admin", ...adminGuards, validate(listPartnersQuerySchema), partnerController.listPartners);
router.get("/admin/:id", ...adminGuards, partnerController.getPartner);
router.post(
  "/admin",
  requireAuth,
  authorize("partners.create"),
  validate(createPartnerSchema),
  partnerController.createPartner
);
router.put(
  "/admin/:id",
  requireAuth,
  authorize("partners.update"),
  validate(updatePartnerSchema),
  partnerController.updatePartner
);

export default router;
