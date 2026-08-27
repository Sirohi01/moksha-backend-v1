import { Router } from "express";
import multer from "multer";
import * as controller from "./namoLegacyWrite.controller";

const uploadProfileImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
}).single("profileImage");

const router = Router();

router.get("/jobs/list", controller.jobsList);
router.post("/members/create", uploadProfileImage, controller.membersCreate);

export default router;
