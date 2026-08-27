import { z } from "zod";
import { NAMO_SUPPORT_GENDERS } from "../../models/namoSupportRequest.model";

export const createNamoSupportRequestSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email(),
    mobile: z.string().trim().min(6).max(20),
    gender: z.enum(NAMO_SUPPORT_GENDERS),
    dob: z.coerce.date(),
    supportType: z.string().trim().min(1).max(160),
    fullAddress: z.string().trim().min(1).max(500),
    state: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    prefferedContribution: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
  }),
});
