import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as projectController from "./project.controller";
import { createProjectSchema, listProjectsQuerySchema, updateProjectSchema } from "./project.validation";

const router = Router();
const readGuards = [requireAuth, authorize("projects.read")];
const writeGuards = [requireAuth, authorize("projects.create")];

router.get("/admin", ...readGuards, validate(listProjectsQuerySchema), projectController.listProjects);
router.get("/admin/:id", ...readGuards, projectController.getProject);
router.post("/admin", ...writeGuards, validate(createProjectSchema), projectController.createProject);
router.put("/admin/:id", ...writeGuards, validate(updateProjectSchema), projectController.updateProject);

export default router;
