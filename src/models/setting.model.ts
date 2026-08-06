import { Schema, model, Document, Types } from "mongoose";

/** Single-document collection holding site-wide settings, edited from the admin panel. */
export interface ISetting extends Document {
  _id: Types.ObjectId;
  siteName: string;
  helplineNumber: string;
  whatsappNumber?: string;
  supportEmail?: string;
  address?: string;
  // Real 80G registration details. donation.service.ts only issues a Receipt when
  // exemptionRef is actually set here — an unconfigured org must never claim a tax exemption it
  // doesn't have (this was flagged as a risk during the M4 design pass).
  organisation?: {
    legalName?: string;
    panNumber?: string;
    exemptionRef?: string;
    registeredAddress?: string;
  };
  // PRD Phase E1 — non-urgent (MARKETING-category) notifications are deferred until this window
  // ends rather than sent immediately; TRANSACTIONAL notifications (a receipt, an assignment)
  // always send right away regardless, since deferring those would be actively unhelpful.
  // 24h "HH:mm", server-local time. Both unset = quiet hours disabled.
  notifications?: {
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
  banners: { image: string; link?: string; title?: string }[];
  socialLinks: { platform: string; url: string }[];
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    siteName: { type: String, default: "Moksha Sewa" },
    helplineNumber: { type: String, required: true },
    whatsappNumber: { type: String },
    supportEmail: { type: String },
    address: { type: String },
    organisation: {
      legalName: { type: String, trim: true },
      panNumber: { type: String, trim: true },
      exemptionRef: { type: String, trim: true },
      registeredAddress: { type: String, trim: true },
    },
    notifications: {
      quietHoursStart: { type: String, trim: true },
      quietHoursEnd: { type: String, trim: true },
    },
    banners: {
      type: [
        {
          image: { type: String, required: true },
          link: { type: String },
          title: { type: String },
        },
      ],
      default: [],
    },
    socialLinks: {
      type: [
        {
          platform: { type: String, required: true },
          url: { type: String, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Setting = model<ISetting>("Setting", settingSchema);
