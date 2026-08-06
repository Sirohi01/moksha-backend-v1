import { Router } from "express";
import { ServiceProvider } from "../../models/serviceProvider.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers } from "../../utils/crudFactory";
import { createServiceProviderSchema, updateServiceProviderSchema } from "./serviceProvider.validation";

const router = Router();
// Same split as vehicle.routes.ts — masters.read for lookup, masters.update for management.
const readGuards = [requireAuth, authorize("masters.read")];
const writeGuards = [requireAuth, authorize("masters.update")];
const handlers = buildAdminCrudHandlers(ServiceProvider, "Service provider");

router.get("/admin", ...readGuards, handlers.list);
router.get("/admin/:id", ...readGuards, handlers.getById);
router.post("/admin", ...writeGuards, validate(createServiceProviderSchema), handlers.create);
router.put("/admin/:id", ...writeGuards, validate(updateServiceProviderSchema), handlers.update);
router.delete("/admin/:id", ...writeGuards, handlers.remove);

export default router;
