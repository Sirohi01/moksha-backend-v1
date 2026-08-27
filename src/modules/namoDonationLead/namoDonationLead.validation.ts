import { z } from "zod";
import { NAMO_DONATION_LEAD_GENDERS } from "../../models/namoDonationLead.model";

// DonationForm.tsx sends the literal JSON key "SewaType" (capitalized) — preserved here exactly
// since this is what's actually received, not a stylistic choice.
export const createNamoDonationLeadSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(160),
    email: z.string().trim().email(),
    phone: z.string().trim().min(6).max(20),
    gender: z.enum(NAMO_DONATION_LEAD_GENDERS).optional(),
    country: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(500),
    SewaType: z.string().trim().min(1).max(160),
    donationPackage: z.string().trim().min(1).max(160),
    amount: z.coerce.number().positive(),
    pan: z.string().trim().max(20).optional(),
    message: z.string().trim().max(2000).optional(),
    anonymous: z.boolean().optional(),
  }),
});
