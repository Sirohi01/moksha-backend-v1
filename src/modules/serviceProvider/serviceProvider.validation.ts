import { z } from "zod";
import { SERVICE_PROVIDER_CATEGORIES } from "../../utils/constants";
import { zBoolean } from "../../utils/zodHelpers";

export const createServiceProviderSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name is required"),
    category: z.enum(SERVICE_PROVIDER_CATEGORIES),
    contactPerson: z.string().trim().optional(),
    contactPhone: z.string().trim().min(6, "Contact phone is required"),
    address: z.string().trim().optional(),
    isActive: zBoolean(true),
    notes: z.string().trim().optional(),
  }),
});

export const updateServiceProviderSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createServiceProviderSchema.shape.body.partial(),
});
