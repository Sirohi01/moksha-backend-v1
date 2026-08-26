import "./_migrationSetup";
import mongoose from "mongoose";
import { ArogyaContentKind } from "../src/models/arogyaContent.model";

interface Mapping { collection: string; kind: ArogyaContentKind; titleField?: string; slugField?: string; orderField?: string; fixedSlug?: string }

// Collection names confirmed by connecting directly to the real legacy database (2026-08-26,
// 57 collections total — see migration-tools/arogya-cms-field-maps/ for the field-level detail
// on the ones that were mapped from source before that; titleField/orderField below for the
// collections that were NOT previously mapped are a reasonable best guess for display purposes
// only — payload always retains every original field regardless of whether titleField guesses
// right, so nothing is lost even where the guess is wrong).
export const MAPPINGS: Mapping[] = [
  { collection: "heros", kind: "HERO", titleField: "title" },
  { collection: "chairmanmessages", kind: "CHAIRMAN_MESSAGE", fixedSlug: "primary" },
  { collection: "foundermessages", kind: "FOUNDER_MESSAGE", fixedSlug: "primary" },
  { collection: "faqitems", kind: "FAQ_ITEM", titleField: "question", orderField: "order" },
  { collection: "faqsettings", kind: "FAQ_SETTINGS", fixedSlug: "primary" },
  { collection: "glimpsesettings", kind: "GLIMPSE_SETTINGS", fixedSlug: "primary" },
  { collection: "glimpsegalleries", kind: "GLIMPSE_GALLERY", titleField: "title" },
  { collection: "glimpsevideos", kind: "GLIMPSE_VIDEO", titleField: "title", orderField: "orderNumber" },
  { collection: "glimpsecounters", kind: "GLIMPSE_COUNTER", titleField: "label", orderField: "order" },
  { collection: "glimpseyears", kind: "GLIMPSE_YEAR", titleField: "year" },
  { collection: "glimpsecategories", kind: "GLIMPSE_CATEGORY", titleField: "category" },
  { collection: "globalvoicessettings", kind: "GLOBAL_VOICES_SETTINGS", fixedSlug: "primary" },
  { collection: "globalvoicescategories", kind: "GLOBAL_VOICES_CATEGORY", titleField: "category" },
  { collection: "globalvoicescounters", kind: "GLOBAL_VOICES_COUNTER", titleField: "label", orderField: "order" },
  { collection: "globalvoicesspeakers", kind: "GLOBAL_VOICES_SPEAKER", titleField: "name", orderField: "order" },
  { collection: "globalvoicescarouselspeakers", kind: "GLOBAL_VOICES_CAROUSEL_SPEAKER", titleField: "name", orderField: "order" },
  { collection: "partnerscategories", kind: "PARTNER_CATEGORY", titleField: "name", orderField: "order" },
  { collection: "partnerslogos", kind: "PARTNER_LOGO", titleField: "name", orderField: "order" },
  { collection: "partnerssettings", kind: "PARTNER_SETTINGS", fixedSlug: "primary" },
  { collection: "eminentspeakers", kind: "SPEAKER_EMINENT", titleField: "name", orderField: "order" },
  { collection: "eminentspeakerheadings", kind: "SPEAKER_EMINENT_HEADING", fixedSlug: "primary" },
  { collection: "expertspeakers", kind: "SPEAKER_EXPERT", titleField: "name", orderField: "order" },
  { collection: "expertspeakerheadings", kind: "SPEAKER_EXPERT_HEADING", fixedSlug: "primary" },
  { collection: "morespeakercategories", kind: "SPEAKER_MORE_CATEGORY", titleField: "heading" },
  { collection: "morespeakeritems", kind: "SPEAKER_MORE_ITEM", titleField: "name", orderField: "order" },
  { collection: "organisingheadings", kind: "SPEAKER_ORGANISING_HEADING", fixedSlug: "primary" },
  { collection: "organisingmembers", kind: "SPEAKER_ORGANISING_MEMBER", titleField: "name", orderField: "order" },
  { collection: "previousspeakers", kind: "SPEAKER_PREVIOUS", titleField: "name", orderField: "order" },
  { collection: "previousspeakerheadings", kind: "SPEAKER_PREVIOUS_HEADING", fixedSlug: "primary" },
  { collection: "speakerheros", kind: "SPEAKER_HERO", fixedSlug: "primary" },
  { collection: "speakercounters", kind: "SPEAKER_COUNTER", titleField: "label", orderField: "order" },
  { collection: "esteemedspeakers", kind: "SPEAKER_ESTEEMED", titleField: "name", orderField: "order" },
  { collection: "esteemedspeakersettings", kind: "SPEAKER_ESTEEMED_SETTINGS", fixedSlug: "primary" },
  { collection: "testimonialitems", kind: "TESTIMONIAL_ITEM", titleField: "name", orderField: "order" },
  { collection: "testimonialsettings", kind: "TESTIMONIAL_SETTINGS", fixedSlug: "primary" },
  { collection: "testimonialcounters", kind: "TESTIMONIAL_COUNTER", titleField: "label", orderField: "order" },
  { collection: "videotestimonialitems", kind: "VIDEO_TESTIMONIAL_ITEM", titleField: "name", orderField: "order" },
  { collection: "resourcesettings", kind: "RESOURCE_SETTINGS", fixedSlug: "primary" },
  { collection: "pdfcards", kind: "PDF_CARD", titleField: "title", orderField: "order" },
  { collection: "seos", kind: "SEO", titleField: "page", slugField: "page" },
  { collection: "socialmedias", kind: "SOCIAL_MEDIA", fixedSlug: "primary" },
  { collection: "settings", kind: "SETTINGS", fixedSlug: "primary" },
];

// Deliberately NOT mapped here — these are delegate registration / payment / CRM / auth data,
// not CMS content, and have no target model yet (see UNIFIED_PLATFORM_STATE.md §H, P-07/P-08/
// P-09): delegateregistrations, delegatecounters, coupons, delegatepasses, passes,
// registrationpasses, registrationsettings, passsettings, users, otps, roles, categories,
// crmcountries, crmstates, crmcities.

export function transformArogyaContent(mapping: Mapping, source: Record<string, unknown>) {
  const { _id, createdAt, updatedAt, ...payload } = source;
  return {
    legacyId: String(_id), kind: mapping.kind,
    slug: mapping.fixedSlug ?? (mapping.slugField ? String(source[mapping.slugField] ?? "") || undefined : undefined),
    title: mapping.titleField ? String(source[mapping.titleField] ?? "") || undefined : undefined,
    payload,
    status: source.isActive === false || source.status === "Inactive" || source.status === false ? "INACTIVE" as const : "ACTIVE" as const,
    order: mapping.orderField ? Number(source[mapping.orderField] ?? 0) : 0,
    sourceCreatedAt: createdAt,
    sourceUpdatedAt: updatedAt,
  };
}

async function run() {
  const uri = process.env.MIGRATION_AROGYA_MONGO_URI;
  if (!uri) throw new Error("Missing MIGRATION_AROGYA_MONGO_URI");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error("Source database is unavailable");
  try {
    let totalDocs = 0;
    for (const mapping of MAPPINGS) {
      const collection = db.collection(mapping.collection);
      const count = await collection.countDocuments();
      totalDocs += count;
      const samples = await collection.find({}).limit(2).toArray();
      console.log(JSON.stringify({ collection: mapping.collection, kind: mapping.kind, count, samples: samples.map((row) => transformArogyaContent(mapping, row)) }, null, 2));
    }
    console.log(`\nTOTAL across all mapped CMS collections: ${totalDocs}`);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
