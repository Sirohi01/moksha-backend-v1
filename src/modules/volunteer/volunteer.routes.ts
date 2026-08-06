import { Router } from "express";
import { authorize, requireAuth, requireUserType } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as volunteerController from "./volunteer.controller";
import {
  listVolunteersQuerySchema,
  registerVolunteerSchema,
  respondToAssignmentSchema,
  updateAvailabilitySchema,
  updateVolunteerStatusSchema,
} from "./volunteer.validation";

const router = Router();

// Public — volunteer sign-up
router.post("/register", validate(registerVolunteerSchema), volunteerController.registerVolunteer);

// Self-service (the volunteer themselves)
router.patch(
  "/me/availability",
  requireAuth,
  requireUserType("VOLUNTEER"),
  validate(updateAvailabilitySchema),
  volunteerController.updateMyAvailability
);
router.get("/me/assignments", requireAuth, requireUserType("VOLUNTEER"), volunteerController.listMyAssignments);
router.patch(
  "/me/assignments/:assignmentId/respond",
  requireAuth,
  requireUserType("VOLUNTEER"),
  validate(respondToAssignmentSchema),
  volunteerController.respondToAssignment
);

// Admin
router.get(
  "/admin",
  requireAuth,
  authorize("volunteers.read"),
  validate(listVolunteersQuerySchema),
  volunteerController.listVolunteersAdmin
);
router.get("/admin/:id", requireAuth, authorize("volunteers.read"), volunteerController.getVolunteerAdmin);
router.patch(
  "/admin/:id/status",
  requireAuth,
  authorize("volunteers.update"),
  validate(updateVolunteerStatusSchema),
  volunteerController.updateVolunteerStatusAdmin
);

export default router;
