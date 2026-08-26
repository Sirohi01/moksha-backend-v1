import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./arogyaCategory.controller";
import { createArogyaCategorySchema, listArogyaCategoriesSchema, updateArogyaCategorySchema } from "./arogyaCategory.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "AROGYA" })];

router.get("/", validate(listArogyaCategoriesSchema), controller.listPublic);
router.get("/admin", ...scoped("cms.read"), validate(listArogyaCategoriesSchema), controller.listAdmin);
router.post("/admin", ...scoped("cms.create"), validate(createArogyaCategorySchema), controller.create);
router.put("/admin/:id", ...scoped("cms.update"), validate(updateArogyaCategorySchema), controller.update);
router.delete("/admin/:id", ...scoped("cms.update"), controller.remove);

export default router;
