import { z } from "zod";

export const createNamoEnquirySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email(),
    mobile: z.string().trim().min(6).max(20),
    message: z.string().trim().min(1).max(2000),
  }),
});
