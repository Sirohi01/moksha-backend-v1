import { z } from "zod";
import { NAMO_CONTENT_KINDS, NAMO_CONTENT_STATUSES } from "../../models/namoContent.model";

const body = z.object({
  kind: z.enum(NAMO_CONTENT_KINDS),
  slug: z.string().trim().min(1).max(240).regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  payload: z.record(z.unknown()),
  status: z.enum(NAMO_CONTENT_STATUSES).default("ACTIVE"),
  order: z.coerce.number().int().min(-100000).max(100000).default(0),
});

export const listNamoContentSchema = z.object({ query: z.object({ kind: z.enum(NAMO_CONTENT_KINDS).optional(), status: z.enum(NAMO_CONTENT_STATUSES).optional() }) });
export const publicNamoContentSchema = z.object({ params: z.object({ kind: z.enum(NAMO_CONTENT_KINDS) }) });
export const publicNamoContentBySlugSchema = z.object({ params: z.object({ kind: z.enum(NAMO_CONTENT_KINDS), slug: z.string().trim().min(1) }) });
export const createNamoContentSchema = z.object({ body });
export const updateNamoContentSchema = z.object({ params: z.object({ id: z.string().trim().min(1) }), body: body.partial() });
