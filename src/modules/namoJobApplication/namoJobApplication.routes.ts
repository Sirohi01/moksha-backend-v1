import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoJobApplication.controller";
import { createNamoJobApplicationSchema, updateNamoJobApplicationSchema } from "./namoJobApplication.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];
router.post("/apply", validate(createNamoJobApplicationSchema), controller.create);
router.post("/create", validate(createNamoJobApplicationSchema), controller.create);

router.get("/admin", ...scoped("namoJobApplications.read"), controller.listAdmin);
router.get("/admin/:id", ...scoped("namoJobApplications.read"), controller.getAdmin);
router.put("/admin/:id/status", ...scoped("namoJobApplications.update"), validate(updateNamoJobApplicationSchema), controller.updateStatus);

export default router;
