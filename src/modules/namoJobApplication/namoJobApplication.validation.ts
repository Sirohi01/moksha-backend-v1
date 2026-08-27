import { z } from "zod";
import { NAMO_JOB_APPLICATION_STATUSES } from "../../models/namoJobApplication.model";

export const createNamoJobApplicationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(20).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    currentLocation: z.string().trim().max(160).optional(),
    role: z.string().trim().max(160).optional(),
    message: z.string().trim().max(2000).optional(),
  }),
});

export const updateNamoJobApplicationSchema = z.object({
  body: z.object({ status: z.enum(NAMO_JOB_APPLICATION_STATUSES) }),
});
