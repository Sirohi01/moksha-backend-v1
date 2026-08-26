import { z } from "zod";
import { ORGANISATION_STATUSES } from "../../utils/constants";

export const createOrganisationSchema = z.object({
  body: z.object({
    code: z
      .string()
      .trim()
      .min(2, "Code is required")
      .max(20)
      .regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, - and _"),
    name: z.string().trim().min(2, "Name is required"),
    slug: z
      .string()
      .trim()
      .min(2, "Slug is required")
      .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and -"),
    status: z.enum(ORGANISATION_STATUSES).default("ACTIVE"),
    legalDetails: z
      .object({
        registeredName: z.string().trim().optional(),
        panNumber: z.string().trim().optional(),
        registrationNumber: z.string().trim().optional(),
        registeredAddress: z.string().trim().optional(),
      })
      .optional(),
    contactDetails: z
      .object({
        email: z.string().trim().email().optional(),
        phone: z.string().trim().optional(),
        address: z.string().trim().optional(),
      })
      .optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const updateOrganisationSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createOrganisationSchema.shape.body.omit({ code: true }).partial(),
});

export const listOrganisationsQuerySchema = z.object({
  query: z.object({
    status: z.enum(ORGANISATION_STATUSES).optional(),
  }),
});
