import { z } from "zod";

const timeOfDaySchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm, e.g. 21:00");

export const updateSettingSchema = z.object({
  body: z.object({
    siteName: z.string().trim().optional(),
    helplineNumber: z.string().trim().min(10).optional(),
    whatsappNumber: z.string().trim().optional(),
    supportEmail: z.string().trim().email().optional(),
    address: z.string().trim().optional(),
    organisation: z
      .object({
        legalName: z.string().trim().optional(),
        panNumber: z.string().trim().optional(),
        exemptionRef: z.string().trim().optional(),
        registeredAddress: z.string().trim().optional(),
      })
      .optional(),
    notifications: z
      .object({
        quietHoursStart: timeOfDaySchema.optional(),
        quietHoursEnd: timeOfDaySchema.optional(),
      })
      .optional(),
    banners: z
      .array(
        z.object({
          image: z.string().trim().min(1),
          link: z.string().trim().optional(),
          title: z.string().trim().optional(),
        })
      )
      .optional(),
    socialLinks: z
      .array(
        z.object({
          platform: z.string().trim().min(1),
          url: z.string().trim().min(1),
        })
      )
      .optional(),
  }),
});
