import { z } from "zod";
import { AROGYA_PASS_APPLICABLE_TO, AROGYA_PASS_STATUSES } from "../../models/arogyaPass.model";

const body = z.object({
  name: z.string().trim().min(1).max(160),
  price: z.coerce.number().min(0),
  daysText: z.string().trim().max(60).default("1 Day"),
  applicableTo: z.enum(AROGYA_PASS_APPLICABLE_TO).default("both"),
  includes: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  isMostPopular: z.boolean().default(false),
  status: z.enum(AROGYA_PASS_STATUSES).default("active"),
  order: z.coerce.number().int().default(0),
});

export const createArogyaPassSchema = z.object({ body });
export const updateArogyaPassSchema = z.object({ params: z.object({ id: z.string().trim().min(1) }), body: body.partial() });
export const listArogyaPassesSchema = z.object({
  query: z.object({ all: z.coerce.boolean().optional(), type: z.enum(AROGYA_PASS_APPLICABLE_TO).optional() }),
});
