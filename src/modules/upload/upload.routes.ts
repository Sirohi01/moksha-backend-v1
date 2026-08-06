import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { uploadSingleFile, verifyFileSignature } from "./upload.middleware";
import { uploadFile } from "./upload.controller";

const router = Router();

router.post("/", requireAuth, authorize("media.create"), uploadSingleFile, verifyFileSignature, uploadFile);

export default router;
