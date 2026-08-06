import { z } from "zod";
import { REQUEST_TYPES } from "../../utils/constants";
import { zBoolean, paginationQueryShape } from "../../utils/zodHelpers";

const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");

export const createRequestSchema = z.object({
  body: z.object({
    type: z.enum(REQUEST_TYPES).default("NORMAL"),
    requester: z.object({
      name: z.string().trim().min(2, "Requester name is required"),
      phone: phoneSchema,
      altPhone: z.string().trim().optional(),
      email: z.string().trim().email().optional(),
      relation: z.string().trim().min(2, "Relation to the deceased is required"),
    }),
    deceased: z.object({
      name: z.string().trim().min(2, "Deceased's name is required"),
      age: z.coerce.number().int().min(0).optional(),
      gender: z.string().trim().optional(),
      dateOfDeath: z.coerce.date().optional(),
    }),
    location: z.object({
      address: z.string().trim().min(5, "Address is required"),
      area: z.string().trim().optional(),
      city: z.string().trim().min(2, "City is required"),
      state: z.string().trim().min(2, "State is required"),
      pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
    }),
    cremationPreference: z.enum(["WOOD", "ELECTRIC", "AS_AVAILABLE"]).optional(),
    notes: z.string().trim().max(2000).optional(),
    consent: z.object({
      dataProcessing: zBoolean(false),
      publishStory: zBoolean(false),
    }),
  }),
});

export const updateRequestSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createRequestSchema.shape.body.partial(),
});

export const trackRequestSchema = z.object({
  query: z.object({
    caseId: z.string().trim().min(1, "Case ID is required"),
    phone: phoneSchema,
  }),
});

export const listRequestsQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(["SUBMITTED", "CONVERTED", "REJECTED"]).optional(),
      type: z.enum(REQUEST_TYPES).optional(),
    })
    .merge(paginationQueryShape),
});
