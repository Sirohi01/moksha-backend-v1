import { Router } from "express";
import { authorize, requireAuth, requireUserType } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { donationLimiter } from "../../middlewares/rateLimiters";
import * as donationController from "./donation.controller";
import {
  createDonationSchema,
  listDonationsQuerySchema,
  listRecurringQuerySchema,
  recordOfflineDonationSchema,
  recurringIdParamSchema,
  updateDonationStatusSchema,
  verifyDonationSchema,
} from "./donation.validation";

const router = Router();

// Public — donation is a guest checkout, no login required
router.post("/", donationLimiter, validate(createDonationSchema), donationController.createDonation);
router.post("/verify", donationLimiter, validate(verifyDonationSchema), donationController.verifyDonation);

// Donor self-service
router.get("/me", requireAuth, requireUserType("DONOR"), donationController.listMyDonations);
router.get(
  "/me/receipts/:donationId",
  requireAuth,
  requireUserType("DONOR"),
  donationController.getMyReceipt
);
router.get("/me/recurring", requireAuth, requireUserType("DONOR"), donationController.listMyRecurringDonations);
router.patch(
  "/me/recurring/:id/pause",
  requireAuth,
  requireUserType("DONOR"),
  validate(recurringIdParamSchema),
  donationController.pauseMyRecurringDonation
);
router.patch(
  "/me/recurring/:id/resume",
  requireAuth,
  requireUserType("DONOR"),
  validate(recurringIdParamSchema),
  donationController.resumeMyRecurringDonation
);
router.patch(
  "/me/recurring/:id/cancel",
  requireAuth,
  requireUserType("DONOR"),
  validate(recurringIdParamSchema),
  donationController.cancelMyRecurringDonation
);

// Admin
router.get("/admin", requireAuth, authorize("donations.read"), validate(listDonationsQuerySchema), donationController.listDonationsAdmin);
router.get(
  "/admin/summary",
  requireAuth,
  authorize("donations.read"),
  donationController.getDonationSummaryAdmin
);
router.post(
  "/admin/offline",
  requireAuth,
  authorize("donations.create"),
  validate(recordOfflineDonationSchema),
  donationController.recordOfflineDonation
);
router.put(
  "/admin/:id/status",
  requireAuth,
  authorize("donations.update"),
  validate(updateDonationStatusSchema),
  donationController.updateDonationStatusAdmin
);
router.get(
  "/admin/receipts/:receiptId",
  requireAuth,
  authorize("donations.read"),
  donationController.getReceiptAdmin
);

router.get(
  "/admin/recurring",
  requireAuth,
  authorize("donations.read"),
  validate(listRecurringQuerySchema),
  donationController.listRecurringDonationsAdmin
);
router.patch(
  "/admin/recurring/:id/pause",
  requireAuth,
  authorize("donations.update"),
  validate(recurringIdParamSchema),
  donationController.pauseRecurringDonationAdmin
);
router.patch(
  "/admin/recurring/:id/resume",
  requireAuth,
  authorize("donations.update"),
  validate(recurringIdParamSchema),
  donationController.resumeRecurringDonationAdmin
);
router.patch(
  "/admin/recurring/:id/cancel",
  requireAuth,
  authorize("donations.update"),
  validate(recurringIdParamSchema),
  donationController.cancelRecurringDonationAdmin
);

export default router;
