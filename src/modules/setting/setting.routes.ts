import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as settingController from "./setting.controller";
import { updateSettingSchema } from "./setting.validation";

const router = Router();
const adminGuards = [requireAuth, authorize("settings.update")];

router.get("/", settingController.getSettings);
router.put("/admin", ...adminGuards, validate(updateSettingSchema), settingController.updateSettings);

export default router;
