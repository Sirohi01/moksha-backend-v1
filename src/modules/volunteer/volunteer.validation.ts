import { z } from "zod";
import {
  VOLUNTEER_STATUSES,
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_GENDERS,
  VOLUNTEER_BLOOD_GROUPS,
  VOLUNTEER_SCHEDULE_PREFERENCES,
  VOLUNTEER_PREFERRED_ROLES,
} from "../../utils/constants";
import { paginationQueryShape } from "../../utils/zodHelpers";

const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const registerVolunteerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    phone: phoneSchema,
    email: z.string().trim().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    city: z.string().trim().min(2, "City is required"),
    skills: z.array(z.string().trim()).default([]),

    // Intake form fields — required in the form's own UI, but kept optional server-side so
    // older/simpler clients (or a future API consumer) can still register without them.
    dateOfBirth: z.coerce.date().optional(),
    gender: z.enum(VOLUNTEER_GENDERS).optional(),
    bloodGroup: z.enum(VOLUNTEER_BLOOD_GROUPS).optional(),
    address: z.string().trim().min(5).optional(),
    state: z.string().trim().min(2).optional(),
    pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode").optional(),
    motivation: z.string().trim().optional(),
    experience: z.string().trim().optional(),
    schedulePreference: z.enum(VOLUNTEER_SCHEDULE_PREFERENCES).optional(),
    preferredRole: z.enum(VOLUNTEER_PREFERRED_ROLES).optional(),
  }),
});

export const listVolunteersQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(VOLUNTEER_STATUSES).optional(),
      city: z.string().trim().optional(),
    })
    .merge(paginationQueryShape),
});

export const updateVolunteerStatusSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: z.object({ status: z.enum(VOLUNTEER_STATUSES) }),
});

export const updateAvailabilitySchema = z.object({
  body: z.object({ availability: z.enum(VOLUNTEER_AVAILABILITY) }),
});

export const respondToAssignmentSchema = z.object({
  params: z.object({ assignmentId: z.string().trim().min(1) }),
  body: z.object({
    response: z.enum(["ACCEPTED", "DECLINED"]),
  }),
});
