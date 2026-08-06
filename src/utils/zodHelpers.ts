import { z } from "zod";

/**
 * Parses booleans from either a real JSON boolean or a "true"/"false" string.
 * z.coerce.boolean() looks like it does this but doesn't — it just runs JS's Boolean(value),
 * so the string "false" (e.g. from an env var or query param) coerces to `true`. This is the
 * safe replacement everywhere a boolean might arrive as a string.
 */
export const zBoolean = (defaultValue = false) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined) return defaultValue;
      if (typeof val === "boolean") return val;
      return val.toLowerCase() === "true";
    });

/** Same parsing as zBoolean, but leaves the field genuinely undefined when omitted — use this
 * for partial/PATCH-style schemas where "not provided" must mean "don't change", not "false". */
export const zOptionalBoolean = () =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (typeof val === "boolean") return val;
      return val.toLowerCase() === "true";
    });

/**
 * Merge into any list endpoint's query schema: `listXQuerySchema.merge(paginationQueryShape)`.
 * validate.middleware.ts replaces req.query with the *parsed* zod output, so page/limit — read
 * downstream by utils/pagination.ts's parsePagination() — must be declared here or they're
 * silently stripped before the controller ever sees them, even though pagination.ts itself
 * doesn't otherwise care what a route's own zod schema looks like.
 */
export const paginationQueryShape = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
