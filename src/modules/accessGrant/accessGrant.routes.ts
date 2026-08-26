import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as accessGrantController from "./accessGrant.controller";
import {
  createAccessGrantSchema,
  listAccessGrantsQuerySchema,
  updateAccessGrantExpirySchema,
} from "./accessGrant.validation";

const router = Router();
const readGuards = [requireAuth, authorize("accessGrants.read")];
const writeGuards = [requireAuth, authorize("accessGrants.create")];
const revokeGuards = [requireAuth, authorize("accessGrants.delete")];

router.get("/admin", ...readGuards, validate(listAccessGrantsQuerySchema), accessGrantController.listAccessGrants);
router.get("/admin/:id", ...readGuards, accessGrantController.getAccessGrant);
router.post(
  "/admin",
  ...writeGuards,
  validate(createAccessGrantSchema),
  accessGrantController.createAccessGrant
);
router.put(
  "/admin/:id",
  ...writeGuards,
  validate(updateAccessGrantExpirySchema),
  accessGrantController.updateAccessGrantExpiry
);
router.put("/admin/:id/revoke", ...revokeGuards, accessGrantController.revokeAccessGrant);

export default router;
