import { z } from "zod";

const timeOfDaySchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm, e.g. 21:00");
const shortText = z.string().trim().max(80).optional();
const mediumText = z.string().trim().max(160).optional();
const longText = z.string().trim().max(700).optional();
const urlText = z.string().trim().max(500).optional();
const buttonText = z.string().trim().max(40).optional();

const landingSectionItemSchema = z.object({
  title: z.string().trim().max(120).optional(),
  label: z.string().trim().max(70).optional(),
  value: z.string().trim().max(50).optional(),
  description: z.string().trim().max(260).optional(),
  image: urlText,
  href: urlText,
  features: z.array(z.string().trim().max(80)).optional(),
});

const landingHeroSlideSchema = z.object({
  title: z.string().trim().min(1).max(110),
  description: z.string().trim().min(1).max(160),
  image: z.string().trim().min(1).max(500),
  alt: z.string().trim().min(1).max(180),
  buttonLabel: buttonText,
  buttonHref: urlText,
  secondaryButtonLabel: buttonText,
  secondaryButtonHref: urlText,
  sloganTitle: mediumText,
  immediateHelpTitle: shortText,
  immediateHelpDescription: mediumText,
  supportNowLabel: buttonText,
  supportMissionTitle: shortText,
  supportMissionDescription: mediumText,
  variant: z.enum(["default", "family-support", "journey-prayer", "volunteer-impact"]).optional(),
});

const landingSectionSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().optional(),
  eyebrow: shortText,
  title: z.string().trim().max(120).optional(),
  subtitle: mediumText,
  description: longText,
  image: urlText,
  logoImage: urlText,
  partnerLogoImage: urlText,
  secondaryLogoImage: urlText,
  secondaryImage: urlText,
  quote: longText,
  legalNotice: z.string().trim().max(200).optional(),
  lowerTitle: z.string().trim().max(90).optional(),
  lowerDescription: z.string().trim().max(220).optional(),
  bottomStatement: z.string().trim().max(240).optional(),
  secondaryTitle: shortText,
  secondaryDescription: mediumText,
  supportTitle: mediumText,
  supportDescription: mediumText,
  regionTitle: shortText,
  regionDescription: shortText,
  phoneLabel: buttonText,
  phoneNumber: z.string().trim().max(24).optional(),
  contactEmail: z.string().trim().max(100).optional(),
  contactAddress: mediumText,
  availabilityText: mediumText,
  actionTitle: z.string().trim().max(90).optional(),
  requestTitle: z.string().trim().max(90).optional(),
  requestDescription: z.string().trim().max(180).optional(),
  inputPlaceholder: z.string().trim().max(70).optional(),
  submitLabel: buttonText,
  submittedLabel: buttonText,
  successMessage: z.string().trim().max(180).optional(),
  initiativeLabel: z.string().trim().max(90).optional(),
  quickLinksTitle: z.string().trim().max(50).optional(),
  servicesTitle: z.string().trim().max(50).optional(),
  initiativesTitle: z.string().trim().max(50).optional(),
  contactTitle: z.string().trim().max(50).optional(),
  buttonLabel: buttonText,
  buttonHref: urlText,
  secondaryButtonLabel: buttonText,
  secondaryButtonHref: urlText,
  tertiaryButtonLabel: buttonText,
  tertiaryButtonHref: urlText,
  sloganTitle: z.string().trim().max(90).optional(),
  immediateHelpTitle: shortText,
  immediateHelpDescription: mediumText,
  supportNowLabel: buttonText,
  supportMissionTitle: shortText,
  supportMissionDescription: mediumText,
  slides: z.array(landingHeroSlideSchema).optional(),
  items: z.array(landingSectionItemSchema).optional(),
});

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
    landingPage: z
      .object({
        sections: z.array(landingSectionSchema).optional(),
      })
      .optional(),
  }),
});
