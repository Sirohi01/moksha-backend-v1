import { z } from "zod";
import { zBoolean } from "../../utils/zodHelpers";

export const createFaqSchema = z.object({
  body: z.object({
    question: z.string().trim().min(5),
    answer: z.string().trim().min(5),
    category: z.string().trim().optional(),
    order: z.coerce.number().default(0),
    isActive: zBoolean(true),
  }),
});

export const updateFaqSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createFaqSchema.shape.body.partial(),
});
