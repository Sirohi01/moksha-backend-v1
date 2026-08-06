import { z } from "zod";
import { zOptionalBoolean } from "../../utils/zodHelpers";

export const submitTestimonialSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    photo: z.string().trim().optional(),
    message: z.string().trim().min(10),
    rating: z.coerce.number().int().min(1).max(5),
  }),
});

export const updateTestimonialSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    photo: z.string().trim().optional(),
    message: z.string().trim().min(10).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    isApproved: zOptionalBoolean(),
  }),
});
