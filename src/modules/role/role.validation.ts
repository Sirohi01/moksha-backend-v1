import { z } from "zod";
import { ROLE_SCOPES } from "../../utils/constants";

const slugRegex = /^[a-z0-9_]+$/;

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    slug: z.string().trim().toLowerCase().regex(slugRegex, "Slug can only contain lowercase letters, numbers and underscores"),
    description: z.string().trim().optional(),
    scope: z.enum(ROLE_SCOPES).default("GLOBAL"),
    permissionIds: z.array(z.string().trim().min(1)).default([]),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().optional(),
    permissionIds: z.array(z.string().trim().min(1)).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
});
