import { Router } from "express";
import { authorize, requireAuth, requireUserType } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { uploadSingleFile, verifyFileSignature } from "../upload/upload.middleware";
import * as volunteerController from "./volunteer.controller";
import {
  assignmentDetailParamsSchema,
  listVolunteersQuerySchema,
  registerVolunteerSchema,
  respondToAssignmentSchema,
  updateAvailabilitySchema,
  updateMyVolunteerProfileSchema,
  updateVolunteerStatusSchema,
  uploadAssignmentDocumentSchema,
} from "./volunteer.validation";

const router = Router();

// Public — volunteer sign-up
router.post("/register", validate(registerVolunteerSchema), volunteerController.registerVolunteer);

// Self-service (the volunteer themselves)
router.get("/me", requireAuth, requireUserType("VOLUNTEER"), volunteerController.getMyProfile);
router.patch(
  "/me",
  requireAuth,
  requireUserType("VOLUNTEER"),
  validate(updateMyVolunteerProfileSchema),
  volunteerController.updateMyProfile
);
router.patch(
  "/me/availability",
  requireAuth,
  requireUserType("VOLUNTEER"),
  validate(updateAvailabilitySchema),
  volunteerController.updateMyAvailability
);
router.get("/me/assignments", requireAuth, requireUserType("VOLUNTEER"), volunteerController.listMyAssignments);
router.get(
  "/me/assignments/:assignmentId",
  requireAuth,
  requireUserType("VOLUNTEER"),
  validate(assignmentDetailParamsSchema),
  volunteerController.getMyAssignmentDetail
);
router.post(
  "/me/assignments/:assignmentId/documents",
  requireAuth,
  requireUserType("VOLUNTEER"),
  uploadSingleFile,
  verifyFileSignature,
  validate(uploadAssignmentDocumentSchema),
  volunteerController.uploadAssignmentDocument
);
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
