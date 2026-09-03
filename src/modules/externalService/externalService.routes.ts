import { Router } from "express";
import { ExternalService } from "../../models/externalService.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers } from "../../utils/crudFactory";
import * as externalServiceController from "./externalService.controller";
import { createExternalServiceSchema, updateExternalServiceSchema } from "./externalService.validation";
import { requireSystemServiceAccess } from "./systemServiceAccess.middleware";
import { systemServiceAccessLimiter } from "../../middlewares/rateLimiters";

const router = Router();
const readGuards = [requireAuth, authorize("systemServices.read")];
const writeGuards = [requireAuth, authorize("systemServices.update")];
const { remove } = buildAdminCrudHandlers(ExternalService, "External Service");

router.get("/summary", ...readGuards, externalServiceController.summary);
router.get("/access/requirements", ...readGuards, externalServiceController.accessRequirements);
router.post("/access/verify", ...readGuards, systemServiceAccessLimiter, externalServiceController.verifyAccess);
router.get("/access/status", ...readGuards, externalServiceController.accessStatus);

router.get("/admin", ...readGuards, requireSystemServiceAccess, externalServiceController.list);
router.get("/admin/:id", ...readGuards, requireSystemServiceAccess, externalServiceController.getById);
router.post("/admin", ...writeGuards, requireSystemServiceAccess, validate(createExternalServiceSchema), externalServiceController.create);
router.put("/admin/:id", ...writeGuards, requireSystemServiceAccess, validate(updateExternalServiceSchema), externalServiceController.update);
router.delete("/admin/:id", ...writeGuards, requireSystemServiceAccess, remove);

export default router;
