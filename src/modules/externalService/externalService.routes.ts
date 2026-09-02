import { Router } from "express";
import { ExternalService } from "../../models/externalService.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers } from "../../utils/crudFactory";
import * as externalServiceController from "./externalService.controller";
import { createExternalServiceSchema, updateExternalServiceSchema } from "./externalService.validation";

const router = Router();
const readGuards = [requireAuth, authorize("systemServices.read")];
const writeGuards = [requireAuth, authorize("systemServices.update")];
const { remove } = buildAdminCrudHandlers(ExternalService, "External Service");

router.get("/admin", ...readGuards, externalServiceController.list);
router.get("/admin/:id", ...readGuards, externalServiceController.getById);
router.post("/admin", ...writeGuards, validate(createExternalServiceSchema), externalServiceController.create);
router.put("/admin/:id", ...writeGuards, validate(updateExternalServiceSchema), externalServiceController.update);
router.delete("/admin/:id", ...writeGuards, remove);

export default router;
