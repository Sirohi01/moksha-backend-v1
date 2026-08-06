import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import * as donationService from "./donation.service";
import { parsePagination } from "../../utils/pagination";
import { env } from "../../config/env";
import { NewDonationStatus, SubscriptionStatus } from "../../utils/constants";

export const createDonation = asyncHandler(async (req: Request, res: Response) => {
  const { donation, order, subscriptionId } = await donationService.createDonation(req.body);
  sendSuccess(res, 201, "Donation initiated", {
    donationId: donation._id,
    order,
    subscriptionId,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
  });
});

export const verifyDonation = asyncHandler(async (req: Request, res: Response) => {
  const {
    donationId,
    razorpay_order_id: orderId,
    razorpay_subscription_id: subscriptionId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body;
  const donation = await donationService.verifyDonation({ donationId, orderId, subscriptionId, paymentId, signature });
  sendSuccess(res, 200, "Thank you for your generosity!", donation);
});

export const recordOfflineDonation = asyncHandler(async (req: Request, res: Response) => {
  const donation = await donationService.recordOfflineDonation(req.body, req.auth!.userId);
  sendSuccess(res, 201, "Offline donation recorded", donation);
});

export const listDonationsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: NewDonationStatus };
  const pagination = parsePagination(req);
  const { donations, meta } = await donationService.listDonationsForAdmin({ status }, pagination);
  sendSuccess(res, 200, "Donations fetched", donations, meta);
});

export const updateDonationStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const donation = await donationService.updateDonationStatus(req.params.id, req.body.status, req.auth!.userId);
  sendSuccess(res, 200, "Donation status updated", donation);
});

export const getDonationSummaryAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await donationService.getDonationSummary();
  sendSuccess(res, 200, "Donation summary fetched", summary);
});

export const listMyDonations = asyncHandler(async (req: Request, res: Response) => {
  const donations = await donationService.listMyDonations(req.auth!.userId);
  sendSuccess(res, 200, "Your donations", donations);
});

export const getMyReceipt = asyncHandler(async (req: Request, res: Response) => {
  const receipt = await donationService.getReceiptForDonor(req.params.donationId, req.auth!.userId);
  const html = await donationService.renderReceiptHtml(receipt);
  res.type("html").send(html);
});

export const getReceiptAdmin = asyncHandler(async (req: Request, res: Response) => {
  const receipt = await donationService.getReceiptForAdmin(req.params.receiptId);
  const html = await donationService.renderReceiptHtml(receipt);
  res.type("html").send(html);
});

export const listMyRecurringDonations = asyncHandler(async (req: Request, res: Response) => {
  const recurring = await donationService.listMyRecurringDonations(req.auth!.userId);
  sendSuccess(res, 200, "Your recurring donations", recurring);
});

export const pauseMyRecurringDonation = asyncHandler(async (req: Request, res: Response) => {
  const recurring = await donationService.pauseMyRecurringDonation(req.params.id, req.auth!.userId);
  sendSuccess(res, 200, "Recurring donation paused", recurring);
});

export const resumeMyRecurringDonation = asyncHandler(async (req: Request, res: Response) => {
  const recurring = await donationService.resumeMyRecurringDonation(req.params.id, req.auth!.userId);
  sendSuccess(res, 200, "Recurring donation resumed", recurring);
});

export const cancelMyRecurringDonation = asyncHandler(async (req: Request, res: Response) => {
  const recurring = await donationService.cancelMyRecurringDonation(req.params.id, req.auth!.userId);
  sendSuccess(res, 200, "Recurring donation cancelled", recurring);
});

export const listRecurringDonationsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as { status?: SubscriptionStatus };
  const recurring = await donationService.listRecurringDonationsForAdmin({ status });
  sendSuccess(res, 200, "Recurring donations fetched", recurring);
});

export const pauseRecurringDonationAdmin = asyncHandler(async (req: Request, res: Response) => {
  const recurring = await donationService.pauseRecurringDonationAdmin(req.params.id);
  sendSuccess(res, 200, "Recurring donation paused", recurring);
});

export const resumeRecurringDonationAdmin = asyncHandler(async (req: Request, res: Response) => {
  const recurring = await donationService.resumeRecurringDonationAdmin(req.params.id);
  sendSuccess(res, 200, "Recurring donation resumed", recurring);
});

export const cancelRecurringDonationAdmin = asyncHandler(async (req: Request, res: Response) => {
  const recurring = await donationService.cancelRecurringDonationAdmin(req.params.id);
  sendSuccess(res, 200, "Recurring donation cancelled", recurring);
});
