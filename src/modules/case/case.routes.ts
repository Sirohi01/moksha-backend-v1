import { Router } from "express";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { caseTrackLimiter } from "../../middlewares/rateLimiters";
import { uploadSingleFile, verifyFileSignature } from "../upload/upload.middleware";
import * as caseController from "./case.controller";
import {
  addDocumentSchema,
  addExpenseSchema,
  assignCaseManagerSchema,
  assignVolunteerSchema,
  cancelCaseSchema,
  decideExpenseSchema,
  listCasesQuerySchema,
  trackCaseSchema,
  transitionStatusSchema,
  verifyCaseSchema,
  withdrawAssignmentSchema,
} from "./case.validation";

const router = Router();

// Public — Case ID + phone, no login (PRD FR-REQ-05)
router.get("/track", caseTrackLimiter, validate(trackCaseSchema), caseController.trackCase);

// Admin
router.get(
  "/admin",
  requireAuth,
  authorize("cases.read"),
  validate(listCasesQuerySchema),
  caseController.listCasesAdmin
);
// Must come before /admin/:id — otherwise Express would swallow "sla-breaches"/"map-data" as the :id param.
router.get("/admin/sla-breaches", requireAuth, authorize("cases.read"), caseController.getSlaBreaches);
router.get("/admin/map-data", requireAuth, authorize("cases.read"), caseController.getCasesMapData);
router.get("/admin/:id", requireAuth, authorize("cases.read"), caseController.getCaseAdmin);
router.get("/admin/:id/summary", requireAuth, authorize("cases.read"), caseController.getCaseSummary);
router.get("/admin/:id/nearest-volunteers", requireAuth, authorize("cases.assign"), caseController.getNearestVolunteers);

router.patch(
  "/admin/:id/status",
  requireAuth,
  authorize("cases.update"),
  validate(transitionStatusSchema),
  caseController.transitionStatus
);
router.patch(
  "/admin/:id/verify",
  requireAuth,
  authorize("cases.approve"),
  validate(verifyCaseSchema),
  caseController.verifyCase
);
router.patch(
  "/admin/:id/assign",
  requireAuth,
  authorize("cases.assign"),
  validate(assignCaseManagerSchema),
  caseController.assignCaseManager
);
router.patch(
  "/admin/:id/cancel",
  requireAuth,
  authorize("cases.update"),
  validate(cancelCaseSchema),
  caseController.cancelCase
);

router.post(
  "/admin/:id/volunteers",
  requireAuth,
  authorize("cases.assign"),
  validate(assignVolunteerSchema),
  caseController.assignVolunteer
);
router.patch(
  "/admin/:id/volunteers/:assignmentId/withdraw",
  requireAuth,
  authorize("cases.assign"),
  validate(withdrawAssignmentSchema),
  caseController.withdrawVolunteerAssignment
);

router.post(
  "/admin/:id/documents",
  requireAuth,
  authorize("cases.update"),
  uploadSingleFile,
  verifyFileSignature,
  validate(addDocumentSchema),
  caseController.addDocument
);

router.post(
  "/admin/:id/expenses",
  requireAuth,
  authorize("expenses.create"),
  validate(addExpenseSchema),
  caseController.addExpense
);
router.patch(
  "/admin/:id/expenses/:expenseId",
  requireAuth,
  authorize("expenses.approve"),
  validate(decideExpenseSchema),
  caseController.decideExpense
);

export default router;
