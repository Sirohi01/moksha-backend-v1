import { z } from "zod";
import { AGS_CLIENT_STATUSES, AGS_DELEGATE_STATUSES } from "../../models/namoAgsDelegate.model";

const delegateBody = z.object({
  title: z.string().trim().max(20).optional(),
  firstName: z.string().trim().min(2).max(120),
  lastName: z.string().trim().max(120).optional(),
  profession: z.string().trim().max(160).optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  event: z.string().trim().max(160).optional(),
  mobile: z.string().trim().regex(/^\+?[0-9][0-9 -]{7,15}$/),
  alternate: z.string().trim().max(20).optional(),
  landline: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional(),
  address: z.string().trim().max(500).optional(),
  country: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  pin: z.string().trim().max(12).optional(),
  category: z.string().trim().max(120).optional(),
  college: z.string().trim().max(200).optional(),
  university: z.string().trim().max(200).optional(),
  enquiryFor: z.string().trim().max(160).optional(),
  leadForward: z.string().trim().max(160).optional(),
  mode: z.string().trim().max(60).optional(),
  status: z.enum(AGS_DELEGATE_STATUSES).optional(),
  clientStatus: z.enum(AGS_CLIENT_STATUSES).optional(),
  coordinator: z.string().trim().max(120).optional(),
  remark: z.string().trim().max(1000).optional(),
  companyName: z.string().trim().max(200).optional(),
  companyAddress: z.string().trim().max(500).optional(),
  companyCountry: z.string().trim().max(100).optional(),
  companyState: z.string().trim().max(100).optional(),
  companyCity: z.string().trim().max(100).optional(),
  companyPin: z.string().trim().max(12).optional(),
});

export const createAgsDelegateSchema = z.object({ body: delegateBody });
export const updateAgsDelegateSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: delegateBody.partial(),
});
export const listAgsDelegatesSchema = z.object({
  query: z.object({
    status: z.enum(AGS_DELEGATE_STATUSES).optional(),
    clientStatus: z.enum(AGS_CLIENT_STATUSES).optional(),
    search: z.string().trim().max(200).optional(),
  }),
});
