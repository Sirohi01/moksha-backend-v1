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
  landingPage?: {
    sections: {
      key: string;
      name: string;
      enabled: boolean;
      eyebrow?: string;
      title?: string;
      subtitle?: string;
      description?: string;
      image?: string;
      logoImage?: string;
      partnerLogoImage?: string;
      secondaryLogoImage?: string;
      secondaryImage?: string;
      quote?: string;
      legalNotice?: string;
      lowerTitle?: string;
      lowerDescription?: string;
      bottomStatement?: string;
      secondaryTitle?: string;
      secondaryDescription?: string;
      supportTitle?: string;
      supportDescription?: string;
      regionTitle?: string;
      regionDescription?: string;
      phoneLabel?: string;
      phoneNumber?: string;
      contactEmail?: string;
      contactAddress?: string;
      availabilityText?: string;
      actionTitle?: string;
      requestTitle?: string;
      requestDescription?: string;
      inputPlaceholder?: string;
      submitLabel?: string;
      submittedLabel?: string;
      successMessage?: string;
      initiativeLabel?: string;
      quickLinksTitle?: string;
      servicesTitle?: string;
      initiativesTitle?: string;
      contactTitle?: string;
      buttonLabel?: string;
      buttonHref?: string;
      secondaryButtonLabel?: string;
      secondaryButtonHref?: string;
      tertiaryButtonLabel?: string;
      tertiaryButtonHref?: string;
      sloganTitle?: string;
      immediateHelpTitle?: string;
      immediateHelpDescription?: string;
      supportNowLabel?: string;
      supportMissionTitle?: string;
      supportMissionDescription?: string;
      slides?: {
        title: string;
        description: string;
        image: string;
        alt: string;
        buttonLabel?: string;
        buttonHref?: string;
        secondaryButtonLabel?: string;
        secondaryButtonHref?: string;
        variant?: string;
      }[];
      items?: {
        title?: string;
        label?: string;
        value?: string;
        description?: string;
        image?: string;
        href?: string;
        features?: string[];
      }[];
    }[];
  };
  aboutPage?: ISetting["landingPage"];
  servicesPage?: ISetting["landingPage"];
  ambulancePage?: ISetting["landingPage"];
  panditPage?: ISetting["landingPage"];
  funeralPage?: ISetting["landingPage"];
  funeralDecorationPage?: ISetting["landingPage"];
  prayerHallPage?: ISetting["landingPage"];
  specialServicePage?: ISetting["landingPage"];
  callingRelativesPage?: ISetting["landingPage"];
  harsevanPage?: ISetting["landingPage"];
  unclaimedBodyPage?: ISetting["landingPage"];
  volunteerPage?: ISetting["landingPage"];
  partnershipPage?: ISetting["landingPage"];
  csrPage?: ISetting["landingPage"];
  requestHelpPage?: ISetting["landingPage"];
  donationPage?: ISetting["landingPage"];
  contactPage?: ISetting["landingPage"];
  trackPage?: ISetting["landingPage"];
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
    landingPage: {
      sections: {
        type: [
          {
            key: { type: String, required: true, trim: true },
            name: { type: String, required: true, trim: true },
            enabled: { type: Boolean, default: true },
            eyebrow: { type: String, trim: true },
            title: { type: String, trim: true },
            subtitle: { type: String, trim: true },
            description: { type: String, trim: true },
            image: { type: String, trim: true },
            logoImage: { type: String, trim: true },
            partnerLogoImage: { type: String, trim: true },
            secondaryLogoImage: { type: String, trim: true },
            secondaryImage: { type: String, trim: true },
            quote: { type: String, trim: true },
            legalNotice: { type: String, trim: true },
            lowerTitle: { type: String, trim: true },
            lowerDescription: { type: String, trim: true },
            bottomStatement: { type: String, trim: true },
                        secondaryTitle: { type: String, trim: true },
                        secondaryDescription: { type: String, trim: true },
                        supportTitle: { type: String, trim: true },
                        supportDescription: { type: String, trim: true },
                        regionTitle: { type: String, trim: true },
                        regionDescription: { type: String, trim: true },
                        phoneLabel: { type: String, trim: true },
                        phoneNumber: { type: String, trim: true },
                        contactEmail: { type: String, trim: true },
                        contactAddress: { type: String, trim: true },
                        availabilityText: { type: String, trim: true },
                        actionTitle: { type: String, trim: true },
                        requestTitle: { type: String, trim: true },
                        requestDescription: { type: String, trim: true },
                        inputPlaceholder: { type: String, trim: true },
                        submitLabel: { type: String, trim: true },
                        submittedLabel: { type: String, trim: true },
                        successMessage: { type: String, trim: true },
                        initiativeLabel: { type: String, trim: true },
                        quickLinksTitle: { type: String, trim: true },
                        servicesTitle: { type: String, trim: true },
                        initiativesTitle: { type: String, trim: true },
                        contactTitle: { type: String, trim: true },
            buttonLabel: { type: String, trim: true },
            buttonHref: { type: String, trim: true },
            secondaryButtonLabel: { type: String, trim: true },
            secondaryButtonHref: { type: String, trim: true },
            tertiaryButtonLabel: { type: String, trim: true },
            tertiaryButtonHref: { type: String, trim: true },
            sloganTitle: { type: String, trim: true },
            immediateHelpTitle: { type: String, trim: true },
            immediateHelpDescription: { type: String, trim: true },
            supportNowLabel: { type: String, trim: true },
            supportMissionTitle: { type: String, trim: true },
            supportMissionDescription: { type: String, trim: true },
            slides: {
              type: [
                {
                  title: { type: String, required: true, trim: true },
                  description: { type: String, required: true, trim: true },
                  image: { type: String, required: true, trim: true },
                  alt: { type: String, required: true, trim: true },
                  buttonLabel: { type: String, trim: true },
                  buttonHref: { type: String, trim: true },
                  secondaryButtonLabel: { type: String, trim: true },
                  secondaryButtonHref: { type: String, trim: true },
                  variant: { type: String, trim: true },
                },
              ],
              default: [],
            },
            items: {
              type: [
                {
                  title: { type: String, trim: true },
                  label: { type: String, trim: true },
                  value: { type: String, trim: true },
                  description: { type: String, trim: true },
                  image: { type: String, trim: true },
                  href: { type: String, trim: true },
                  features: { type: [String], default: [] },
                },
              ],
              default: [],
            },
          },
        ],
        default: [],
      },
    },
    aboutPage: {
      sections: {
        type: [
          {
            key: { type: String, required: true, trim: true },
            name: { type: String, required: true, trim: true },
            enabled: { type: Boolean, default: true },
            eyebrow: { type: String, trim: true },
            title: { type: String, trim: true },
            subtitle: { type: String, trim: true },
            description: { type: String, trim: true },
            image: { type: String, trim: true },
            logoImage: { type: String, trim: true },
            partnerLogoImage: { type: String, trim: true },
            secondaryLogoImage: { type: String, trim: true },
            secondaryImage: { type: String, trim: true },
            quote: { type: String, trim: true },
            legalNotice: { type: String, trim: true },
            lowerTitle: { type: String, trim: true },
            lowerDescription: { type: String, trim: true },
            bottomStatement: { type: String, trim: true },
            secondaryTitle: { type: String, trim: true },
            secondaryDescription: { type: String, trim: true },
            supportTitle: { type: String, trim: true },
            supportDescription: { type: String, trim: true },
            regionTitle: { type: String, trim: true },
            regionDescription: { type: String, trim: true },
            phoneLabel: { type: String, trim: true },
            phoneNumber: { type: String, trim: true },
            contactEmail: { type: String, trim: true },
            contactAddress: { type: String, trim: true },
            availabilityText: { type: String, trim: true },
            actionTitle: { type: String, trim: true },
            requestTitle: { type: String, trim: true },
            requestDescription: { type: String, trim: true },
            inputPlaceholder: { type: String, trim: true },
            submitLabel: { type: String, trim: true },
            submittedLabel: { type: String, trim: true },
            successMessage: { type: String, trim: true },
            initiativeLabel: { type: String, trim: true },
            quickLinksTitle: { type: String, trim: true },
            servicesTitle: { type: String, trim: true },
            initiativesTitle: { type: String, trim: true },
            contactTitle: { type: String, trim: true },
            buttonLabel: { type: String, trim: true },
            buttonHref: { type: String, trim: true },
            secondaryButtonLabel: { type: String, trim: true },
            secondaryButtonHref: { type: String, trim: true },
            tertiaryButtonLabel: { type: String, trim: true },
            tertiaryButtonHref: { type: String, trim: true },
            sloganTitle: { type: String, trim: true },
            immediateHelpTitle: { type: String, trim: true },
            immediateHelpDescription: { type: String, trim: true },
            supportNowLabel: { type: String, trim: true },
            supportMissionTitle: { type: String, trim: true },
            supportMissionDescription: { type: String, trim: true },
            slides: {
              type: [
                {
                  title: { type: String, required: true, trim: true },
                  description: { type: String, required: true, trim: true },
                  image: { type: String, required: true, trim: true },
                  alt: { type: String, required: true, trim: true },
                  buttonLabel: { type: String, trim: true },
                  buttonHref: { type: String, trim: true },
                  secondaryButtonLabel: { type: String, trim: true },
                  secondaryButtonHref: { type: String, trim: true },
                  variant: { type: String, trim: true },
                },
              ],
              default: [],
            },
            items: {
              type: [
                {
                  title: { type: String, trim: true },
                  label: { type: String, trim: true },
                  value: { type: String, trim: true },
                  description: { type: String, trim: true },
                  image: { type: String, trim: true },
                  href: { type: String, trim: true },
                  features: { type: [String], default: [] },
                },
              ],
              default: [],
            },
          },
        ],
        default: [],
      },
    },
    servicesPage: { type: Schema.Types.Mixed },
    ambulancePage: { type: Schema.Types.Mixed },
    panditPage: { type: Schema.Types.Mixed },
    funeralPage: { type: Schema.Types.Mixed },
    funeralDecorationPage: { type: Schema.Types.Mixed },
    prayerHallPage: { type: Schema.Types.Mixed },
    specialServicePage: { type: Schema.Types.Mixed },
    callingRelativesPage: { type: Schema.Types.Mixed },
    harsevanPage: { type: Schema.Types.Mixed },
    unclaimedBodyPage: { type: Schema.Types.Mixed },
    volunteerPage: { type: Schema.Types.Mixed },
    partnershipPage: { type: Schema.Types.Mixed },
    csrPage: { type: Schema.Types.Mixed },
    requestHelpPage: { type: Schema.Types.Mixed },
    donationPage: { type: Schema.Types.Mixed },
    contactPage: { type: Schema.Types.Mixed },
    trackPage: { type: Schema.Types.Mixed },
  },
  { timestamps: true, strict: false }
);

export const Setting = model<ISetting>("Setting", settingSchema);
