import { z } from "zod";
import { DONATION_CAUSES, DONATION_FREQUENCIES, NEW_DONATION_STATUSES, PAYMENT_MODES, SUBSCRIPTION_STATUSES } from "../../utils/constants";
import { zBoolean, paginationQueryShape } from "../../utils/zodHelpers";

export const createDonationSchema = z.object({
  body: z.object({
    donorName: z.string().trim().min(2, "Name is required"),
    donorEmail: z.string().trim().email(),
    donorPhone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    pan: z.string().trim().optional(),
    dedication: z.string().trim().optional(),
    isAnonymous: zBoolean(false),
    cause: z.enum(DONATION_CAUSES).default("general"),
    campaignId: z.string().trim().optional(),
    amount: z.coerce.number().min(50, "Minimum donation amount is ₹50"),
    frequency: z.enum(DONATION_FREQUENCIES).default("once"),
  }),
});

export const verifyDonationSchema = z.object({
  body: z.object({
    donationId: z.string().trim().min(1),
    razorpay_order_id: z.string().trim().optional(),
    razorpay_subscription_id: z.string().trim().optional(),
    razorpay_payment_id: z.string().trim().min(1),
    razorpay_signature: z.string().trim().min(1),
  }),
});

export const recordOfflineDonationSchema = z.object({
  body: z.object({
    donorName: z.string().trim().min(2, "Name is required"),
    donorEmail: z.string().trim().email(),
    donorPhone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
    pan: z.string().trim().optional(),
    dedication: z.string().trim().optional(),
    cause: z.enum(DONATION_CAUSES).default("general"),
    campaignId: z.string().trim().optional(),
    amount: z.coerce.number().min(1, "Amount must be greater than zero"),
    paymentMode: z.enum(PAYMENT_MODES),
    referenceNo: z.string().trim().optional(),
  }),
});

export const updateDonationStatusSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    status: z.enum(NEW_DONATION_STATUSES),
  }),
});

export const listDonationsQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(NEW_DONATION_STATUSES).optional(),
    })
    .merge(paginationQueryShape),
});

export const recurringIdParamSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
});

export const listRecurringQuerySchema = z.object({
  query: z.object({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  }),
});
