import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoLookup.controller";
import { createNamoLookupSchema, updateNamoLookupSchema } from "./namoLookup.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];

router.get("/admin", ...scoped("namoLookups.read"), controller.list);
router.post("/admin", ...scoped("namoLookups.update"), validate(createNamoLookupSchema), controller.create);
router.put("/admin/:id", ...scoped("namoLookups.update"), validate(updateNamoLookupSchema), controller.update);
router.delete("/admin/:id", ...scoped("namoLookups.update"), controller.remove);

export default router;
