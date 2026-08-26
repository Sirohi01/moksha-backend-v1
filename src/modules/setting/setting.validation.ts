import { z } from "zod";

const timeOfDaySchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm, e.g. 21:00");
const shortText = z.string().trim().max(300).optional();
const mediumText = z.string().trim().max(1000).optional();
const longText = z.string().trim().max(5000).optional();
const urlText = z.string().trim().max(2000).optional();
const buttonText = z.string().trim().max(200).optional();

const landingSectionItemSchema = z.object({
  title: z.string().trim().max(300).optional(),
  label: z.string().trim().max(300).optional(),
  value: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  image: urlText,
  href: urlText,
  features: z.array(z.string().trim().max(300)).optional(),
}).passthrough();

const landingHeroSlideSchema = z.object({
  title: z.string().trim().max(300).optional(),
  description: z.string().trim().max(1000).optional(),
  image: urlText,
  alt: z.string().trim().max(500).optional(),
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
  variant: z.string().optional(),
}).passthrough();

const landingSectionSchema = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  enabled: z.boolean().optional(),
  eyebrow: shortText,
  title: longText,
  subtitle: longText,
  description: longText,
  image: urlText,
  logoImage: urlText,
  partnerLogoImage: urlText,
  secondaryLogoImage: urlText,
  secondaryImage: urlText,
  quote: longText,
  legalNotice: longText,
  lowerTitle: shortText,
  lowerDescription: longText,
  bottomStatement: longText,
  secondaryTitle: shortText,
  secondaryDescription: longText,
  supportTitle: longText,
  supportDescription: longText,
  regionTitle: shortText,
  regionDescription: shortText,
  phoneLabel: buttonText,
  phoneNumber: z.string().trim().max(50).optional(),
  contactEmail: z.string().trim().max(200).optional(),
  contactAddress: longText,
  availabilityText: mediumText,
  actionTitle: shortText,
  requestTitle: shortText,
  requestDescription: longText,
  inputPlaceholder: shortText,
  submitLabel: buttonText,
  submittedLabel: buttonText,
  successMessage: longText,
  initiativeLabel: shortText,
  quickLinksTitle: shortText,
  servicesTitle: shortText,
  initiativesTitle: shortText,
  contactTitle: shortText,
  buttonLabel: buttonText,
  buttonHref: urlText,
  secondaryButtonLabel: buttonText,
  secondaryButtonHref: urlText,
  tertiaryButtonLabel: buttonText,
  tertiaryButtonHref: urlText,
  sloganTitle: shortText,
  immediateHelpTitle: shortText,
  immediateHelpDescription: longText,
  supportNowLabel: buttonText,
  supportMissionTitle: shortText,
  supportMissionDescription: longText,
  slides: z.array(landingHeroSlideSchema).optional(),
  items: z.array(landingSectionItemSchema).optional(),
}).passthrough();

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
    aboutPage: z
      .object({
        sections: z.array(landingSectionSchema).optional(),
      })
      .optional(),
  }).passthrough(),
});
