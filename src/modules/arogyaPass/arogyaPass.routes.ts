import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./arogyaPass.controller";
import { createArogyaPassSchema, listArogyaPassesSchema, updateArogyaPassSchema } from "./arogyaPass.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "AROGYA" })];

router.get("/", validate(listArogyaPassesSchema), controller.listPublic);
router.get("/admin", ...scoped("cms.read"), validate(listArogyaPassesSchema), controller.listAdmin);
router.post("/admin", ...scoped("cms.create"), validate(createArogyaPassSchema), controller.create);
router.put("/admin/:id", ...scoped("cms.update"), validate(updateArogyaPassSchema), controller.update);
router.delete("/admin/:id", ...scoped("cms.update"), controller.remove);

export default router;
