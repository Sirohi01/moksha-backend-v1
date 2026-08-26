import { z } from "zod";
import { ACCESS_GRANT_STATUSES } from "../../models/accessGrant.model";

// Same "" -> undefined preprocess as project.validation.ts — an <input type="date"> for
// expiresAt would otherwise submit "" and fail z.coerce.date() as an Invalid Date.
const optionalDate = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.coerce.date().optional()
);

export const createAccessGrantSchema = z.object({
  body: z.object({
    userId: z.string().trim().min(1, "userId is required"),
    // null = all organisations (Super Admin). Omit the field entirely, or pass null explicitly,
    // for that case — an empty string is rejected rather than silently treated as "all".
    organisationId: z.string().trim().min(1).nullable().optional(),
    programCode: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, "Program code may only contain letters, numbers, - and _")
      .nullable()
      .optional(),
    roleId: z.string().trim().min(1, "roleId is required"),
    expiresAt: optionalDate,
  }),
});

// Only status and expiresAt are ever editable — userId/organisationId/programCode/roleId define
// WHAT was granted; changing any of those is a new grant (with its own audit trail), not an edit
// of the old one. Revoking is PUT .../revoke, not a raw status field, to keep the intent explicit
// in the API surface rather than accepting an arbitrary status string.
export const updateAccessGrantExpirySchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({ expiresAt: optionalDate }),
});

export const listAccessGrantsQuerySchema = z.object({
  query: z.object({
    userId: z.string().trim().optional(),
    organisationId: z.string().trim().optional(),
    status: z.enum(ACCESS_GRANT_STATUSES).optional(),
  }),
});
