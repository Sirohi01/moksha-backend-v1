import { z } from "zod";
import { CAMPAIGN_STATUSES, DONATION_CAUSES } from "../../utils/constants";

export const createCampaignSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, "Title is required"),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and hyphens"),
    description: z.string().trim().optional(),
    coverImage: z.string().trim().optional(),
    cause: z.enum(DONATION_CAUSES).default("general"),
    goalAmount: z.coerce.number().positive().optional(),
    status: z.enum(CAMPAIGN_STATUSES).default("DRAFT"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

export const updateCampaignSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createCampaignSchema.shape.body.partial(),
});

export const listCampaignsQuerySchema = z.object({
  query: z.object({
    status: z.enum(CAMPAIGN_STATUSES).optional(),
  }),
});
