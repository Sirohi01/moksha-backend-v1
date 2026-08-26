import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./job.controller";
import { createJobSchema, updateJobSchema } from "./job.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];

router.get("/admin", ...scoped("jobs.read"), controller.listAdmin);
router.post("/admin", ...scoped("jobs.create"), validate(createJobSchema), controller.create);
router.put("/admin/:id", ...scoped("jobs.update"), validate(updateJobSchema), controller.update);
router.delete("/admin/:id", ...scoped("jobs.delete"), controller.remove);
router.get("/", controller.listPublic);
router.get("/:slug", controller.getPublic);

export default router;
