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

export const updateEnquiryStatusSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    status: z.enum(ENQUIRY_STATUSES),
  }),
});
