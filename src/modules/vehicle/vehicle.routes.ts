import { Router } from "express";
import { Vehicle } from "../../models/vehicle.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers } from "../../utils/crudFactory";
import { createVehicleSchema, updateVehicleSchema } from "./vehicle.validation";

const router = Router();
// Split on purpose (not the usual single-guard mountAdminCrudRoutes helper): a Case Manager can
// look up vehicles while scheduling a case (masters.read) without being able to edit the master
// list itself (masters.update, admin-only).
const readGuards = [requireAuth, authorize("masters.read")];
const writeGuards = [requireAuth, authorize("masters.update")];
const handlers = buildAdminCrudHandlers(Vehicle, "Vehicle");

router.get("/admin", ...readGuards, handlers.list);
router.get("/admin/:id", ...readGuards, handlers.getById);
router.post("/admin", ...writeGuards, validate(createVehicleSchema), handlers.create);
router.put("/admin/:id", ...writeGuards, validate(updateVehicleSchema), handlers.update);
router.delete("/admin/:id", ...writeGuards, handlers.remove);

export default router;
