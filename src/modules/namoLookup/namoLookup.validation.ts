import { z } from "zod";
import { NAMO_LOOKUP_TYPES } from "../../models/namoLookup.model";

export const createNamoLookupSchema = z.object({
  body: z.object({
    type: z.enum(NAMO_LOOKUP_TYPES),
    name: z.string().trim().min(1).max(200),
    payload: z.record(z.unknown()).default({}),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  }),
});

export const updateNamoLookupSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    payload: z.record(z.unknown()).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
});
