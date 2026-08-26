import { z } from "zod";
import { PROJECT_STATUSES } from "../../utils/constants";
const optionalDate = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.coerce.date().optional()
);

export const createProjectSchema = z.object({
  body: z.object({
    organisationId: z.string().trim().min(1, "organisationId is required"),
    programCode: z
      .string()
      .trim()
      .min(2, "Program code is required")
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, "Program code may only contain letters, numbers, - and _"),
    code: z
      .string()
      .trim()
      .min(2, "Code is required")
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, - and _"),
    name: z.string().trim().min(2, "Name is required"),
    editionLabel: z.string().trim().optional(),
    status: z.enum(PROJECT_STATUSES).default("ACTIVE"),
    description: z.string().trim().optional(),
    branding: z
      .object({
        primaryColor: z.string().trim().optional(),
      })
      .optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    startDate: optionalDate,
    endDate: optionalDate,
  }),
});
export const updateProjectSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createProjectSchema.shape.body
    .omit({ organisationId: true, programCode: true, code: true })
    .partial(),
});

export const listProjectsQuerySchema = z.object({
  query: z.object({
    organisationId: z.string().trim().optional(),
    programCode: z.string().trim().optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
  }),
});
