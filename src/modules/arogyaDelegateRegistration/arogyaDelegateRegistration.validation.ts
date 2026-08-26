import { z } from "zod";

const channelSchema = z.enum(["email", "whatsapp"]);

export const initiateSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(160),
    email: z.string().trim().email().optional(),
    mobile: z.string().trim().optional(),
    whatsappNumber: z.string().trim().optional(),
    channel: channelSchema,
  }).refine((v) => (v.channel === "email" ? !!v.email : !!(v.whatsappNumber || v.mobile)), {
    message: "email is required for the email channel; whatsappNumber is required for the whatsapp channel",
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().trim().email().optional(),
    whatsappNumber: z.string().trim().optional(),
    channel: channelSchema,
    otp: z.string().trim().length(6),
  }),
});

const delegateFormFields = z.object({
  title: z.string().trim().max(20).optional(),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  mobile: z.string().trim().min(6).max(20),
  whatsappNumber: z.string().trim().max(20).optional(),
  designation: z.string().trim().max(160).optional(),
  organization: z.string().trim().max(200).optional(),
  country: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  industryType: z.string().trim().max(160).optional(),
  areasOfInterest: z.string().trim().max(200).optional(),
  source: z.string().trim().max(160).optional(),
  isSpeaker: z.boolean().optional(),
  dietary: z.string().trim().max(200).optional(),
  assistance: z.string().trim().max(200).optional(),
  documentUrl: z.string().trim().url().optional(),
});

export const completeSingleSchema = z.object({
  body: z.object({
    paymentRecordId: z.string().trim().min(1),
    otpChannel: channelSchema,
    otpDestination: z.string().trim().min(1),
    otp: z.string().trim().length(6),
  }).merge(delegateFormFields),
});

export const completeGroupSchema = z.object({
  body: z.object({
    paymentRecordId: z.string().trim().min(1),
    otpChannel: channelSchema,
    otpDestination: z.string().trim().min(1),
    otp: z.string().trim().length(6),
    primary: delegateFormFields,
    members: z.array(delegateFormFields).min(1).max(50),
  }),
});

const paymentModeSchema = z.enum(["CASH", "CHEQUE", "PAYTM", "NEFT_RTGS", "OTHER"]);

const offlineBase = z.object({
  passId: z.string().trim().min(1),
  selectedDays: z.array(z.number().int().min(1).max(3)).default([]),
  couponCode: z.string().trim().max(30).optional(),
  paymentMode: paymentModeSchema,
  note: z.string().trim().max(300).optional(),
});

export const adminOfflineSingleSchema = z.object({
  body: offlineBase.extend({ form: delegateFormFields }),
});

export const adminOfflineGroupSchema = z.object({
  body: offlineBase.extend({
    groupSize: z.number().int().min(2).max(100),
    primary: delegateFormFields,
    members: z.array(delegateFormFields).min(1).max(99),
  }),
});

export const createOrderSchema = z.object({
  body: z.object({
    passId: z.string().trim().min(1),
    selectedDays: z.array(z.number().int().min(1).max(3)).default([]),
    registrationType: z.enum(["single", "group"]),
    groupSize: z.number().int().min(1).max(100).optional(),
    couponCode: z.string().trim().max(30).optional(),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().trim().min(1),
    razorpay_payment_id: z.string().trim().min(1),
    razorpay_signature: z.string().trim().min(1),
  }),
});
