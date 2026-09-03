import { Schema, model, Document, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

export const EXTERNAL_SERVICE_CATEGORIES = [
  "DOMAIN",
  "HOSTING",
  "SSL_CERTIFICATE",
  "PAYMENT_GATEWAY",
  "EMAIL_SMTP",
  "SMS_WHATSAPP",
  "MEDIA_STORAGE",
  "AI_API",
  "ANALYTICS",
  "DATABASE",
  "CDN",
  "SOFTWARE_LICENSE",
  "SOCIAL_MEDIA",
  "API_SERVICE",
  "OTHER",
] as const;
export type ExternalServiceCategory = (typeof EXTERNAL_SERVICE_CATEGORIES)[number];

export const BILLING_CYCLES = ["ONE_TIME", "MONTHLY", "YEARLY"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export interface IExternalServiceReceipt {
  url: string;
  label?: string;
  uploadedAt: Date;
}

export interface IExternalService extends Document {
  _id: Types.ObjectId;
  category: ExternalServiceCategory;
  name: string;
  provider?: string;
  accountIdentifier?: string;
  loginUrl?: string;
  secretLabel?: string;
  secretValue?: string;
  startDate?: Date;
  expiryDate: Date;
  autoRenews?: boolean;
  notes?: string;
  details?: Record<string, string>;
  popupReminderDays?: number;
  emailReminderDays?: number;
  notifyEmails?: string[];
  remindersEnabled: boolean;
  lastEmailSentForDay?: string;
  lastPopupNotifiedForDay?: string;
  pricingType: "FREE" | "PAID";
  costAmount?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  receipts: IExternalServiceReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

const externalServiceSchema = new Schema<IExternalService>(
  {
    category: { type: String, enum: EXTERNAL_SERVICE_CATEGORIES, required: true, default: "OTHER" },
    name: { type: String, required: true, trim: true },
    provider: { type: String, trim: true },
    accountIdentifier: { type: String, trim: true },
    loginUrl: { type: String, trim: true },
    secretLabel: { type: String, trim: true },
    secretValue: { type: String },
    startDate: { type: Date },
    expiryDate: { type: Date, required: true, index: true },
    autoRenews: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    details: { type: Schema.Types.Mixed, default: {} },
    popupReminderDays: { type: Number, min: 0 },
    emailReminderDays: { type: Number, min: 0 },
    notifyEmails: { type: [String], default: [] },
    remindersEnabled: { type: Boolean, default: true },
    lastEmailSentForDay: { type: String },
    lastPopupNotifiedForDay: { type: String },
    pricingType: { type: String, enum: ["FREE", "PAID"], required: true, default: "PAID" },
    costAmount: { type: Number, min: 0 },
    currency: { type: String, trim: true, default: "INR" },
    billingCycle: { type: String, enum: BILLING_CYCLES },
    receipts: {
      type: [
        {
          url: { type: String, required: true },
          label: { type: String, trim: true },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

encryptFieldsOnSave(externalServiceSchema, ["secretValue"]);

export const ExternalService = model<IExternalService>("ExternalService", externalServiceSchema);
