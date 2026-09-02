import { z } from "zod";
import { EXTERNAL_SERVICE_CATEGORIES, BILLING_CYCLES } from "../../models/externalService.model";

const emailList = z.array(z.string().trim().email()).optional();
const receiptList = z
  .array(
    z.object({
      url: z.string().trim().min(1),
      label: z.string().trim().optional(),
      uploadedAt: z.coerce.date().optional(),
    })
  )
  .optional();

export const createExternalServiceSchema = z.object({
  body: z.object({
    category: z.enum(EXTERNAL_SERVICE_CATEGORIES),
    name: z.string().trim().min(1),
    provider: z.string().trim().optional(),
    accountIdentifier: z.string().trim().optional(),
    loginUrl: z.string().trim().optional(),
    secretLabel: z.string().trim().optional(),
    secretValue: z.string().optional(),
    startDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date(),
    autoRenews: z.boolean().optional(),
    notes: z.string().trim().optional(),
    popupReminderDays: z.number().min(0).optional(),
    emailReminderDays: z.number().min(0).optional(),
    notifyEmails: emailList,
    remindersEnabled: z.boolean().optional(),
    pricingType: z.enum(["FREE", "PAID"]).optional(),
    costAmount: z.number().min(0).optional(),
    currency: z.string().trim().optional(),
    billingCycle: z.enum(BILLING_CYCLES).optional(),
    receipts: receiptList,
  }),
});

export const updateExternalServiceSchema = z.object({
  body: z.object({
    category: z.enum(EXTERNAL_SERVICE_CATEGORIES).optional(),
    name: z.string().trim().min(1).optional(),
    provider: z.string().trim().optional(),
    accountIdentifier: z.string().trim().optional(),
    loginUrl: z.string().trim().optional(),
    secretLabel: z.string().trim().optional(),
    secretValue: z.string().optional(),
    startDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    autoRenews: z.boolean().optional(),
    notes: z.string().trim().optional(),
    popupReminderDays: z.number().min(0).nullable().optional(),
    emailReminderDays: z.number().min(0).nullable().optional(),
    notifyEmails: emailList,
    remindersEnabled: z.boolean().optional(),
    pricingType: z.enum(["FREE", "PAID"]).optional(),
    costAmount: z.number().min(0).nullable().optional(),
    currency: z.string().trim().optional(),
    billingCycle: z.enum(BILLING_CYCLES).nullable().optional(),
    receipts: receiptList,
  }),
});
