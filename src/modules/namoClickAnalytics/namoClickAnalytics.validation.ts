import { z } from "zod";

export const createNamoClickAnalyticsSchema = z.object({
  body: z.object({ iconName: z.string().trim().min(1).max(80) }),
});
