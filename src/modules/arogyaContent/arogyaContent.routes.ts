import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./arogyaContent.controller";
import {
  createArogyaContentSchema,
  listArogyaContentSchema,
  publicArogyaContentBySlugSchema,
  publicArogyaContentSchema,
  updateArogyaContentSchema,
} from "./arogyaContent.validation";
import { uploadSingleFile, verifyFileSignature } from "../upload/upload.middleware";
import { uploadFile } from "../upload/upload.controller";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "AROGYA" })];

router.get("/admin", ...scoped("cms.read"), validate(listArogyaContentSchema), controller.listAdmin);
router.post("/admin/upload", ...scoped("media.create"), uploadSingleFile, verifyFileSignature, uploadFile);
router.post("/admin", ...scoped("cms.create"), validate(createArogyaContentSchema), controller.create);
router.put("/admin/:id", ...scoped("cms.update"), validate(updateArogyaContentSchema), controller.update);
router.delete("/admin/:id", ...scoped("cms.update"), controller.remove);
router.get("/:kind", validate(publicArogyaContentSchema), controller.listPublic);
router.get("/:kind/:slug", validate(publicArogyaContentBySlugSchema), controller.getPublic);

export default router;
