import { z } from "zod";
import { AROGYA_CONTENT_KINDS, AROGYA_CONTENT_STATUSES } from "../../models/arogyaContent.model";

const body = z.object({
  kind: z.enum(AROGYA_CONTENT_KINDS),
  slug: z.string().trim().min(1).max(240).regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  payload: z.record(z.unknown()),
  status: z.enum(AROGYA_CONTENT_STATUSES).default("ACTIVE"),
  order: z.coerce.number().int().min(-100000).max(100000).default(0),
});

export const listArogyaContentSchema = z.object({ query: z.object({ kind: z.enum(AROGYA_CONTENT_KINDS).optional(), status: z.enum(AROGYA_CONTENT_STATUSES).optional() }) });
export const publicArogyaContentSchema = z.object({ params: z.object({ kind: z.enum(AROGYA_CONTENT_KINDS) }) });
export const publicArogyaContentBySlugSchema = z.object({ params: z.object({ kind: z.enum(AROGYA_CONTENT_KINDS), slug: z.string().trim().min(1) }) });
export const createArogyaContentSchema = z.object({ body });
export const updateArogyaContentSchema = z.object({ params: z.object({ id: z.string().trim().min(1) }), body: body.partial() });
