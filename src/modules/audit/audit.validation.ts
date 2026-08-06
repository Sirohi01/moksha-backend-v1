import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  query: z.object({
    entityType: z.string().trim().optional(),
    action: z.string().trim().optional(),
    userId: z.string().trim().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    page: z.coerce.number().int().min(1).optional(),
  }),
});
