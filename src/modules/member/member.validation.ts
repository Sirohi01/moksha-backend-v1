import { z } from "zod";
import { MEMBER_STATUSES } from "../../models/member.model";

const stringArray = z.array(z.string().trim().min(1).max(200)).max(50).default([]);
export const memberApplicationBody = z.object({
  title: z.string().trim().max(20).optional(),
  applicantName: z.string().trim().min(2).max(160),
  surname: z.string().trim().max(100).optional(),
  fatherMotherSpouseName: z.string().trim().max(160).optional(),
  gender: z.string().trim().max(40).optional(),
  qualification: z.string().trim().max(160).optional(),
  occupation: z.string().trim().max(160).optional(),
  organisationType: z.string().trim().max(120).optional(),
  designation: z.string().trim().max(120).optional(),
  dob: z.coerce.date().optional(),
  mobile: z.string().trim().regex(/^\+?[0-9][0-9 -]{7,15}$/),
  alternateNo: z.string().trim().max(20).optional(),
  email: z.string().trim().email(),
  aadharNo: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(12)).optional(),
  address: z.string().trim().max(500).optional(),
  country: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  pinCode: z.string().trim().max(12).optional(),
  bloodGroup: z.string().trim().max(10).optional(),
  relation: z.string().trim().max(80).optional(),
  emergencyContact: z.string().trim().max(20).optional(),
  initiatives: stringArray,
  volunteeringFor: stringArray,
  networkingFor: stringArray,
  areaOfInterest: stringArray,
  monetarySupport: z.string().trim().max(200).optional(),
  reference1: z.record(z.unknown()).optional(),
  reference2: z.record(z.unknown()).optional(),
  profilePic: z.string().trim().url().optional(),
});

export const createMemberApplicationSchema = z.object({ body: memberApplicationBody });
export const listMembersSchema = z.object({ query: z.object({ status: z.enum(MEMBER_STATUSES).optional() }) });
export const updateMemberSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: memberApplicationBody.partial().extend({ status: z.enum(MEMBER_STATUSES).optional() }),
});
