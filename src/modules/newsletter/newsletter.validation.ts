import { z } from "zod";

export const subscribeSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    source: z.string().trim().optional(),
  }),
});
