import { z } from "zod";
import { zBoolean } from "../../utils/zodHelpers";

export const createExpenseCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    isActive: zBoolean(true),
    notes: z.string().trim().optional(),
  }),
});

export const updateExpenseCategorySchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createExpenseCategorySchema.shape.body.partial(),
});
