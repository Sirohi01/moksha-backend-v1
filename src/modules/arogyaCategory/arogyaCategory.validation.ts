import { z } from "zod";
import { AROGYA_CATEGORY_TYPES } from "../../models/arogyaCategory.model";

export const createArogyaCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(160),
    type: z.enum(AROGYA_CATEGORY_TYPES),
  }),
});
export const updateArogyaCategorySchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createArogyaCategorySchema.shape.body.partial(),
});
export const listArogyaCategoriesSchema = z.object({
  query: z.object({ type: z.enum(AROGYA_CATEGORY_TYPES).optional() }),
});
