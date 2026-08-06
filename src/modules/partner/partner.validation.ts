import { z } from "zod";
import { PARTNER_TYPES, PARTNER_STATUSES } from "../../utils/constants";

export const createPartnerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    type: z.enum(PARTNER_TYPES),
    status: z.enum(PARTNER_STATUSES).default("LEAD"),
    contactPerson: z.string().trim().optional(),
    contactPhone: z.string().trim().optional(),
    contactEmail: z.string().trim().email().optional(),
    address: z.string().trim().optional(),
    agreementDetails: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const updatePartnerSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createPartnerSchema.shape.body.partial(),
});

export const listPartnersQuerySchema = z.object({
  query: z.object({
    type: z.enum(PARTNER_TYPES).optional(),
    status: z.enum(PARTNER_STATUSES).optional(),
  }),
});
