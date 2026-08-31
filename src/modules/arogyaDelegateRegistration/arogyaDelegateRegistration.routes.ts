import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authorizeScoped } from "../../middlewares/access.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./arogyaDelegateRegistration.controller";
import {
  adminOfflineGroupSchema,
  adminOfflineSingleSchema,
  completeGroupSchema,
  completeSingleSchema,
  initiateSchema,
  updateDelegateSchema,
  verifyOtpSchema,
} from "./arogyaDelegateRegistration.validation";

const router = Router();
const scoped = (permission: string) => [requireAuth, authorizeScoped({ permission, organisation: "AROGYA" })];

router.post("/initiate", validate(initiateSchema), controller.initiate);
router.post("/verify-otp", validate(verifyOtpSchema), controller.verifyOtp);
router.post("/verify", validate(completeSingleSchema), controller.verifySingle);
router.post("/verify-group", validate(completeGroupSchema), controller.verifyGroup);

router.get("/admin/export/delegates.csv", ...scoped("arogyaDelegates.read"), controller.exportDelegatesCsv);
router.get("/admin", ...scoped("arogyaDelegates.read"), controller.listAdmin);
router.get("/admin/:id", ...scoped("arogyaDelegates.read"), controller.getAdminOne);
router.put("/admin/:id", ...scoped("arogyaDelegates.create"), validate(updateDelegateSchema), controller.updateAdmin);
router.post("/admin/offline/single", ...scoped("arogyaDelegates.create"), validate(adminOfflineSingleSchema), controller.adminCreateOfflineSingle);
router.post("/admin/offline/group", ...scoped("arogyaDelegates.create"), validate(adminOfflineGroupSchema), controller.adminCreateOfflineGroup);

export default router;
