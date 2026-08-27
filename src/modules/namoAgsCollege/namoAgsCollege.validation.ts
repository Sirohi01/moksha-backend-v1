import { z } from "zod";

const contactSchema = z.object({
  contactPerson: z.string().trim().max(160).optional(),
  designation: z.string().trim().max(160).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  mobile: z.string().trim().max(20).optional(),
  alternate: z.string().trim().max(20).optional(),
  landline: z.string().trim().max(20).optional(),
});

export const createNamoAgsCollegeSchema = z.object({
  body: z.object({
    collegeName: z.string().trim().min(1).max(200),
    category: z.string().trim().max(160).optional(),
    website: z.string().trim().max(300).optional(),
    address: z.string().trim().max(500).optional(),
    country: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    pincode: z.string().trim().max(12).optional(),
    affilatedTo: z.string().trim().max(200).optional(),
    status: z.enum(["Active", "Inactive"]).default("Active"),
    contacts: z.array(contactSchema).max(20).default([]),
  }),
});

export const updateNamoAgsCollegeSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createNamoAgsCollegeSchema.shape.body.partial(),
});
