import { z } from "zod";
import { JOB_STATUSES } from "../../models/job.model";

const body = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  department: z.string().trim().max(120).optional(),
  location: z.string().trim().min(2).max(160),
  employmentType: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(10).max(500),
  description: z.string().trim().min(20),
  requirements: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  applicationUrl: z.string().trim().url().optional().or(z.literal("")),
  applicationEmail: z.string().trim().email().optional().or(z.literal("")),
  status: z.enum(JOB_STATUSES).default("DRAFT"),
  closesAt: z.coerce.date().optional(),
});

const createBody = body.refine((value) => value.applicationUrl || value.applicationEmail, {
  message: "An application URL or email is required",
  path: ["applicationUrl"],
});

export const createJobSchema = z.object({ body: createBody });
export const updateJobSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: body.partial(),
});
