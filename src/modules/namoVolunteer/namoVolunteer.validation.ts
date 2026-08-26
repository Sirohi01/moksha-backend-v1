import { z } from "zod";
import { NAMO_VOLUNTEER_STATUSES } from "../../models/namoVolunteer.model";
const optional = z.string().trim().max(500).optional();
const reference = z.object({ name: optional, mobile: optional, email: z.string().trim().email().optional().or(z.literal("")) }).optional();
export const volunteerBody = z.object({
  title: z.string().trim().min(1).max(20), applicantName: z.string().trim().min(2).max(160), surname: z.string().trim().min(1).max(100), fatherName: z.string().trim().min(2).max(160), gender: z.string().trim().min(1).max(40),
  qualification: optional, occupation: optional, organisationType: optional, designation: optional, dob: z.coerce.date().optional(),
  mobile: z.string().trim().regex(/^\+?[0-9][0-9 -]{7,15}$/), alternateMobile: optional, email: z.string().trim().email(),
  aadhaar: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().length(12)).optional(), address: optional,
  country: optional, state: optional, city: optional, pincode: optional, emergencyRelation: optional, emergencyContact: optional,
  initiatives: z.array(z.string().trim().min(1).max(200)).max(50).default([]), volunteeringFor: optional, networkingFor: optional,
  areaOfInterest: optional, monetarySupport: optional, reference1: reference, reference2: reference, areaOfRegion: optional,
  reportTo: optional, volunteerDesignation: optional, bankName: optional, accountNo: optional, ifscCode: optional,
  companyName: optional, businessAddress: optional, businessCountry: optional, businessState: optional, businessCity: optional,
  businessPincode: optional, businessDesignation: optional, businessContactNo: optional, profilePic: z.string().trim().url().optional(),
});
export const applyNamoVolunteerSchema = z.object({ body: volunteerBody });
export const listNamoVolunteersSchema = z.object({ query: z.object({ status: z.enum(NAMO_VOLUNTEER_STATUSES).optional() }) });
export const updateNamoVolunteerSchema = z.object({ params: z.object({ id: z.string().trim().min(1) }), body: volunteerBody.partial().extend({ status: z.enum(NAMO_VOLUNTEER_STATUSES).optional(), reviewNotes: optional }) });
