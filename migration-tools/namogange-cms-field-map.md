# Namo Gange CMS Migration Contract

Legacy CMS records migrate to the unified `NamoContent` collection with `organisationId` fixed to
the Namo Gange organisation. `kind` identifies the legacy collection. AGS and TGYM operational
records are not CMS and are excluded.

| Legacy collection | `kind` | Canonical fields | Payload policy |
| --- | --- | --- | --- |
| `blogs` | `BLOG` | `slug`, `title`, `status` | Preserve category, author, image, image_alt, description and authorship fields. |
| `faqs` | `FAQ` | question → `title`, `status` | Preserve question, answer and category. |
| `testimonials` | `TESTIMONIAL` | name → `title`, `status` | Preserve name, image, image_alt, desc and authorship fields. |
| `banners` | `BANNER` | `title`, `status` | Preserve image, alt_text, link, schedule and authorship fields. |
| `galleryimages` | `GALLERY_IMAGE` | `slug`, category → `title`, `status` | Preserve images array, image_alt, category and createdBy. |
| `galleryvideos` | `GALLERY_VIDEO` | `title`, `status`, orderBy → `order` | Preserve video_link, category, orderBy and createdBy. |
| `abouts` | `ABOUT` | `title`, `status` | Preserve all legacy fields. |
| `achievements` | `ACHIEVEMENT` | `slug`, `title`, `status` | Preserve all legacy fields. |
| `initiatives` | `INITIATIVE` | `slug`, `title`, `status` | Preserve all legacy fields including pages_images and misspelled objective_catagory. |
| `objectives` | `OBJECTIVE` | `slug`, `title`, `status` | Preserve all legacy fields. |
| `recentupdates` | `RECENT_UPDATE` | `title`, `status` | Preserve date, image, description and authorship fields. |
| `trustbodies` | `TRUST_BODY` | `slug`, name → `title`, `status` | Preserve designation, image and description. |
| `seos` | `SEO` | page_path → `slug`, page_name → `title`, `status` | Preserve every SEO/meta/banner/schema field. |
| `socialmedias` | `SOCIAL_MEDIA` | fixed slug `primary`, `status` | Preserve social links, phone, mail, address and WhatsApp fields. |

Status mapping is exact: legacy `Active` → `ACTIVE`, everything else → `INACTIVE`. Source `_id`
is stored as `legacyId`; source timestamps remain in the migration envelope for controlled import.
The dry-run never writes to either database and prints only counts plus sanitized sample envelopes.
