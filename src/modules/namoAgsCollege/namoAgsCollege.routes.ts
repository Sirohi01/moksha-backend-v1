import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoAgsCollege.controller";
import { createNamoAgsCollegeSchema, updateNamoAgsCollegeSchema } from "./namoAgsCollege.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];

router.get("/admin", ...scoped("namoAgsColleges.read"), controller.list);
router.post("/admin", ...scoped("namoAgsColleges.update"), validate(createNamoAgsCollegeSchema), controller.create);
router.put("/admin/:id", ...scoped("namoAgsColleges.update"), validate(updateNamoAgsCollegeSchema), controller.update);
router.delete("/admin/:id", ...scoped("namoAgsColleges.update"), controller.remove);

export default router;
