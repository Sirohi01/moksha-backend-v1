import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as userController from "./user.controller";
import {
  inviteStaffSchema,
  updateProfileSchema,
  updateStaffDetailsSchema,
  updateStaffRoleSchema,
  updateStaffStatusSchema,
} from "./user.validation";

const router = Router();

// Any authenticated account (internal staff, volunteer or donor) manages its own profile here —
// there's no separate "customer" actor type anymore, just a person and their own record.
router.get("/me", requireAuth, userController.getMyProfile);
router.put("/me", requireAuth, validate(updateProfileSchema), userController.updateMyProfile);

router.get("/admin", requireAuth, authorize("users.read"), userController.listCustomersAdmin);

// Internal staff management — super_admin only (users.* isn't granted to any other seeded role,
// same restricted-to-the-top scope as roles.*).
router.get("/admin/staff", requireAuth, authorize("users.read"), userController.listStaff);
router.post("/admin/staff", requireAuth, authorize("users.create"), validate(inviteStaffSchema), userController.inviteStaff);
router.patch(
  "/admin/staff/:id",
  requireAuth,
  authorize("users.update"),
  validate(updateStaffDetailsSchema),
  userController.updateStaffDetails
);
router.patch(
  "/admin/staff/:id/status",
  requireAuth,
  authorize("users.update"),
  validate(updateStaffStatusSchema),
  userController.updateStaffStatus
);
router.patch(
  "/admin/staff/:id/role",
  requireAuth,
  authorize("users.update"),
  validate(updateStaffRoleSchema),
  userController.updateStaffRole
);

export default router;
