import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as organisationController from "./organisation.controller";
import {
  createOrganisationSchema,
  listOrganisationsQuerySchema,
  updateOrganisationSchema,
} from "./organisation.validation";

const router = Router();
const readGuards = [requireAuth, authorize("organisations.read")];
const writeGuards = [requireAuth, authorize("organisations.create")];

router.get("/admin", ...readGuards, validate(listOrganisationsQuerySchema), organisationController.listOrganisations);
router.get("/admin/:id", ...readGuards, organisationController.getOrganisation);
router.post(
  "/admin",
  ...writeGuards,
  validate(createOrganisationSchema),
  organisationController.createOrganisation
);
router.put(
  "/admin/:id",
  ...writeGuards,
  validate(updateOrganisationSchema),
  organisationController.updateOrganisation
);

export default router;
