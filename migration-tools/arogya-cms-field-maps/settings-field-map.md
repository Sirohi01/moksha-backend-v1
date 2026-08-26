# Arogya Settings Field Map

## Settings
Source Model: `backend-arogya/models/settings/Settings.js`

| OLD FIELD | FINAL FIELD | TRANSFORM NOTES |
| :--- | :--- | :--- |
| `_id` | `_id` | Keep original string ID. |
| `logo` | `logo` | no transform |
| `websiteLogo` | `websiteLogo` | no transform |
| `websiteLogo.url` | `websiteLogo.url` | no transform |
| `websiteLogo.alt` | `websiteLogo.alt` | no transform |
| `footerLogo` | `footerLogo` | no transform |
| `footerLogo.url` | `footerLogo.url` | no transform |
| `footerLogo.alt` | `footerLogo.alt` | no transform |
| `footerAboutText` | `footerAboutText` | no transform |
| `footerAboutHighlighted` | `footerAboutHighlighted` | no transform |
| `footerStats` | `UNKNOWN` | UNKNOWN — needs review: Arogya specific stats hardcoded to delegates/speakers/countries/sessions. Should this be a generic stats model? |
| `adminLogo` | `adminLogo` | no transform |
| `topbarEmails` | `topbarEmails` | no transform |
| `contactEmails` | `contactEmails` | no transform |
| `footerEmails` | `footerEmails` | no transform |
| `contactPhones` | `contactPhones` | no transform |
| `footerPhones` | `footerPhones` | no transform |
| `topbarPhones` | `topbarPhones` | no transform |
| `paperPresentationSameAsTopbar` | `UNKNOWN` | UNKNOWN — needs review: Arogya specific setting for paper presentation routing? |
| `paperPresentationEmails` | `UNKNOWN` | UNKNOWN — needs review: Arogya specific setting. |
| `paperPresentationPhones` | `UNKNOWN` | UNKNOWN — needs review: Arogya specific setting. |
| `addresses` | `addresses` | no transform |
| `mapIframe` | `mapIframe` | no transform |
| `mapCardTitle` | `mapCardTitle` | no transform |
| `mapCardAddress` | `mapCardAddress` | no transform |
| `infoBarCards` | `infoBarCards` | no transform |
| `marqueeText` | `marqueeText` | no transform |
| `topbarDate` | `topbarDate` | no transform |
| `footerQuickLinksTitle` | `footerQuickLinksTitle` | no transform |
| `footerGetInTouchTitle` | `footerGetInTouchTitle` | no transform |
| `footerQuickLinks` | `footerQuickLinks` | no transform |
| `footerHighlightsTitle` | `footerHighlightsTitle` | no transform |
| `footerHighlights` | `footerHighlights` | no transform |
| `supportDeskText` | `UNKNOWN` | UNKNOWN — needs review: Arogya specific text mentioning "expo period" and international support. |
| `footerWebsite` | `footerWebsite` | no transform |
| `footerAddress` | `footerAddress` | no transform |
| `footerHelplineTitle` | `footerHelplineTitle` | no transform |
| `footerHelplinePhone` | `footerHelplinePhone` | no transform |
| `footerHelplineTiming` | `footerHelplineTiming` | no transform |
| `msmeLogos` | `UNKNOWN` | UNKNOWN — needs review: Arogya specific MSME logos setup, maybe generalize to partners? |
| `isMsmeLogoActive` | `UNKNOWN` | UNKNOWN — needs review: Arogya specific. |
| `createdAt` | `createdAt` | Keep original timestamps. |
| `updatedAt` | `updatedAt` | Keep original timestamps. |
