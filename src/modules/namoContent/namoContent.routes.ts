import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./namoContent.controller";
import { createNamoContentSchema, listNamoContentSchema, publicNamoContentBySlugSchema, publicNamoContentSchema, updateNamoContentSchema } from "./namoContent.validation";
import { uploadSingleFile, verifyFileSignature } from "../upload/upload.middleware";
import { uploadFile } from "../upload/upload.controller";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "NAMOGANGE" })];
router.get("/admin", ...scoped("cms.read"), validate(listNamoContentSchema), controller.listAdmin);
router.post("/admin/upload", ...scoped("media.create"), uploadSingleFile, verifyFileSignature, uploadFile);
router.post("/admin", ...scoped("cms.create"), validate(createNamoContentSchema), controller.create);
router.put("/admin/:id", ...scoped("cms.update"), validate(updateNamoContentSchema), controller.update);
router.delete("/admin/:id", ...scoped("cms.update"), controller.remove);
router.get("/:kind", validate(publicNamoContentSchema), controller.listPublic);
router.get("/:kind/:slug", validate(publicNamoContentBySlugSchema), controller.getPublic);
export default router;
