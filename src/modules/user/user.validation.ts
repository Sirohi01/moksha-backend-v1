import { z } from "zod";
import { NEW_USER_STATUSES } from "../../utils/constants";

const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const inviteStaffSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    email: z.string().trim().email(),
    phone: phoneSchema,
    roleId: z.string().trim().min(1, "roleId is required"),
    avatarUrl: z.string().trim().url().optional(),
  }),
});

export const updateStaffStatusSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    status: z.enum(NEW_USER_STATUSES),
  }),
});

export const updateStaffRoleSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    roleId: z.string().trim().min(1, "roleId is required"),
  }),
});

export const updateStaffDetailsSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    email: z.string().trim().email(),
    phone: phoneSchema,
    roleId: z.string().trim().min(1, "roleId is required"),
    avatarUrl: z.string().trim().url().optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).optional(),
    email: z.string().trim().email().optional(),
    addresses: z
      .array(
        z.object({
          line1: z.string().trim().min(3),
          city: z.string().trim().min(2),
          state: z.string().trim().min(2),
          pincode: z.string().trim().regex(/^\d{6}$/),
        })
      )
      .optional(),
  }),
});
