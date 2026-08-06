import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as roleController from "./role.controller";
import { createRoleSchema, updateRoleSchema } from "./role.validation";

const router = Router();
const readGuards = [requireAuth, authorize("roles.read")];
const writeGuards = [requireAuth, authorize("roles.create")];

router.get("/admin", ...readGuards, roleController.listRoles);
router.get("/admin/permissions", ...readGuards, roleController.listPermissions);
router.get("/admin/:id", ...readGuards, roleController.getRole);
router.post("/admin", ...writeGuards, validate(createRoleSchema), roleController.createRole);
router.put("/admin/:id", ...writeGuards, validate(updateRoleSchema), roleController.updateRole);
router.delete("/admin/:id", ...writeGuards, roleController.deleteRole);

export default router;
