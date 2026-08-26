import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ArogyaContent, ArogyaContentKind, IArogyaContent } from "../../models/arogyaContent.model";
import { Organisation } from "../../models/organisation.model";

/**
 * Legacy-compatible public read routes for Arogya's real public website (Arogya-frontend),
 * which calls backend-arogya's original flat paths and response shapes directly — see
 * UNIFIED_PLATFORM_STATE.md §D/§E. These exist so that repo's code never has to change; only its
 * API base URL needs to point here (mounted at /legacy/arogya to avoid colliding with Moksha's
 * own /settings, /faq, etc. — see the same section for why a shared root mount doesn't work).
 *
 * Every handler reads from the already-migrated ArogyaContent collection (see
 * migration-tools/arogya-cms-import.ts) — nothing here queries the legacy database directly.
 */

let cachedOrgId: string | null = null;
async function orgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const organisation = await Organisation.findOne({ code: "AROGYA", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Arogya organisation is not configured");
  cachedOrgId = organisation._id.toString();
  return cachedOrgId;
}

/** Reconstructs the legacy document shape exactly: the original Mongo _id (as legacyId) plus
 * every original field flattened from payload — this is what the old collection's documents
 * looked like before migration, byte-for-byte, since transformArogyaContent never dropped a
 * field. */
function toLegacyShape(entry: IArogyaContent): Record<string, unknown> {
  return { _id: entry.legacyId ?? entry._id.toString(), ...entry.payload };
}

async function listActive(kind: ArogyaContentKind) {
  const entries = await ArogyaContent.find({ organisationId: await orgId(), kind, status: "ACTIVE" }).sort({ order: 1 });
  return entries.map(toLegacyShape);
}
async function singleton(kind: ArogyaContentKind) {
  const entry = await ArogyaContent.findOne({ organisationId: await orgId(), kind, status: "ACTIVE" });
  return entry ? toLegacyShape(entry) : null;
}

const list = (kind: ArogyaContentKind) => asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listActive(kind) });
});
const single = (kind: ArogyaContentKind) => asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await singleton(kind) });
});

export const heroAll = list("HERO");
export const settingsGet = single("SETTINGS");
export const glimpseSettings = single("GLIMPSE_SETTINGS");
export const glimpseYears = list("GLIMPSE_YEAR");
export const glimpseCategories = list("GLIMPSE_CATEGORY");
export const glimpseGallery = list("GLIMPSE_GALLERY");
export const glimpseCounters = list("GLIMPSE_COUNTER");
export const glimpseVideos = list("GLIMPSE_VIDEO");
export const globalVoicesSettings = single("GLOBAL_VOICES_SETTINGS");
export const globalVoicesCategories = list("GLOBAL_VOICES_CATEGORY");
export const globalVoicesCounters = list("GLOBAL_VOICES_COUNTER");
export const globalVoicesSpeakers = list("GLOBAL_VOICES_SPEAKER");
export const globalVoicesCarouselSpeakers = list("GLOBAL_VOICES_CAROUSEL_SPEAKER");
export const testimonialsSettings = single("TESTIMONIAL_SETTINGS");
export const testimonialsItems = list("TESTIMONIAL_ITEM");
export const testimonialsCounters = list("TESTIMONIAL_COUNTER");
export const testimonialsVideos = list("VIDEO_TESTIMONIAL_ITEM");
export const previousSpeakersHeading = single("SPEAKER_PREVIOUS_HEADING");
export const previousSpeakersItems = list("SPEAKER_PREVIOUS");
export const socialMedia = single("SOCIAL_MEDIA");
export const organisingCommittee = list("SPEAKER_ORGANISING_MEMBER");
export const eminentSpeakers = list("SPEAKER_EMINENT");

// Composite endpoints — exact shape confirmed from the real legacy controllers
// (backend-arogya/controllers/faq/faqController.js#getPublicFaqData,
// controllers/partners/partnersPageController.js#getPublicPartnersData) — not guessed.
export const faqGet = asyncHandler(async (_req: Request, res: Response) => {
  const settings = (await singleton("FAQ_SETTINGS")) ?? {};
  const items = await listActive("FAQ_ITEM");
  res.json({ success: true, data: { ...settings, items } });
});

export const partnersPageGet = asyncHandler(async (_req: Request, res: Response) => {
  const settings = (await singleton("PARTNER_SETTINGS")) ?? {};
  const categoryEntries = await ArogyaContent.find({ organisationId: await orgId(), kind: "PARTNER_CATEGORY", status: "ACTIVE" }).sort({ order: 1 });
  const logoEntries = await ArogyaContent.find({ organisationId: await orgId(), kind: "PARTNER_LOGO", status: "ACTIVE" }).sort({ order: 1 });
  const logos = logoEntries.map(toLegacyShape);
  const categories = categoryEntries.map((cat) => {
    const shaped = toLegacyShape(cat);
    const catLegacyId = String(shaped._id);
    return {
      ...shaped,
      logos: logos.filter((logo) => {
        const categoryId = logo.categoryId as { _id?: string } | string | undefined;
        const linkedId = typeof categoryId === "object" ? categoryId?._id : categoryId;
        return linkedId === catLegacyId;
      }),
    };
  });
  res.json({ success: true, data: { settings, categories } });
});
