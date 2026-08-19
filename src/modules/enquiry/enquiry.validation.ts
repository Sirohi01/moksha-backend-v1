import { z } from "zod";
import { ENQUIRY_STATUSES } from "../../utils/constants";

export const createEnquirySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/),
    email: z.string().trim().email().optional(),
    message: z.string().trim().min(5),
  }),
});

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number");
const optionalText = z.string().trim().max(200).optional().or(z.literal(""));

export const createCsrEnquirySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    phone,
    email: z.string().trim().email(),
    organization: z.string().trim().min(2).max(180),
    designation: optionalText,
    interest: optionalText,
    message: z.string().trim().min(10).max(3000),
    consent: z.literal(true),
  }),
});

export const createPartnershipEnquirySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    phone,
    email: z.string().trim().email(),
    organization: z.string().trim().min(2).max(180),
    interest: z.string().trim().min(2).max(180),
    city: optionalText,
    message: z.string().trim().min(10).max(3000),
    consent: z.literal(true),
  }),
});

export const createUnclaimedBodyEnquirySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(120),
    phone,
    email: z.string().trim().email(),
    city: z.string().trim().min(2).max(180),
    organization: optionalText,
    authority: optionalText,
    reference: optionalText,
    message: z.string().trim().min(10).max(3000),
    consent: z.union([z.literal(true), z.literal("true")]),
  }),
});

export const updateEnquiryStatusSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    status: z.enum(ENQUIRY_STATUSES),
  }),
});
