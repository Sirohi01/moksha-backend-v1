import "./_migrationSetup";
import mongoose from "mongoose";
import { NamoContentKind } from "../src/models/namoContent.model";

interface Mapping { collection: string; kind: NamoContentKind; titleField?: string; slugField?: string; orderField?: string; fixedSlug?: string }

// Collection names and every field name below are confirmed by connecting directly to the real
// legacy database (2026-08-27, 59 collections total) AND cross-checked against
// Backend_Namo_Gange's actual Mongoose model source files (not old field-map docs) — see
// UNIFIED_PLATFORM_STATE.md. titleField/slugField/orderField are display-purposes-only; payload
// always retains every original field regardless.
export const MAPPINGS: Mapping[] = [
  { collection: "abouts", kind: "ABOUT", titleField: "title" },
  { collection: "achievements", kind: "ACHIEVEMENT", titleField: "title", slugField: "slug" },
  { collection: "banners", kind: "BANNER", titleField: "title" },
  { collection: "blogs", kind: "BLOG", titleField: "title", slugField: "slug" },
  { collection: "categoryimages", kind: "CATEGORY_IMAGE", titleField: "title", slugField: "slug", orderField: "order_by" },
  { collection: "events", kind: "EVENT", titleField: "name" },
  { collection: "faqs", kind: "FAQ", titleField: "question" },
  { collection: "galleryimages", kind: "GALLERY_IMAGE", titleField: "category", slugField: "slug" },
  { collection: "galleryvideos", kind: "GALLERY_VIDEO", titleField: "title", orderField: "orderBy" },
  { collection: "heros", kind: "HERO", titleField: "title" },
  { collection: "initiatives", kind: "INITIATIVE", titleField: "title", slugField: "slug" },
  { collection: "newsletters", kind: "NEWSLETTER", titleField: "title", slugField: "slug", orderField: "order_by" },
  { collection: "objectives", kind: "OBJECTIVE", titleField: "title", slugField: "slug" },
  { collection: "publisheds", kind: "PUBLISHED", titleField: "name" },
  { collection: "recentupdates", kind: "RECENT_UPDATE", titleField: "title" },
  { collection: "seos", kind: "SEO", titleField: "page_name", slugField: "page_path" },
  { collection: "seocodes", kind: "SEO_CODE", fixedSlug: "primary" },
  { collection: "socialmedias", kind: "SOCIAL_MEDIA", fixedSlug: "primary" },
  { collection: "testimonials", kind: "TESTIMONIAL", titleField: "name" },
  { collection: "trustbodies", kind: "TRUST_BODY", titleField: "name", slugField: "slug" },
];

// Deliberately NOT mapped here — these have their own dedicated models, not the generic
// NamoContent kind system: jobs, jobapplications, members, volunteers, enquirylists, supports,
// donations, clickanalytics (see the standalone namogange-*-import.ts scripts). Also not migrated
// at all (see UNIFIED_PLATFORM_STATE.md): users/admins/roles/rolerights (legacy staff auth —
// Moksha's own RBAC replaces this), activitylogs/sidebars (legacy admin-UI-only, no equivalent
// needed), otps (empty, superseded by NamoOtp), agsevents/agsdelegates/agspayments (AGS already
// has its own models — agsevents specifically has no target model yet, flagged separately),
// clientstatuses/colleges (AGS-CRM extras, not built), and the ~15 small admin lookup/master
// tables (categories, occupations, designations, departments, professions, universities, datas,
// objnames, organizations, sources, calltargets, coordinatorstatuses, banks, statusoptions, ips) —
// none of these are read by the real public site (confirmed via the frontend audit), so they're
// internal-admin-convenience only and out of scope for this pass.

export function transformNamoContent(mapping: Mapping, source: Record<string, unknown>) {
  const { _id, createdAt, updatedAt, ...payload } = source;
  return {
    legacyId: String(_id),
    kind: mapping.kind,
    slug: mapping.fixedSlug ?? (mapping.slugField ? String(source[mapping.slugField] ?? "") || undefined : undefined),
    title: mapping.titleField ? String(source[mapping.titleField] ?? "") || undefined : undefined,
    payload,
    status: source.status === "Inactive" ? "INACTIVE" as const : "ACTIVE" as const,
    order: mapping.orderField ? Number(source[mapping.orderField] ?? 0) : 0,
  };
}

async function run() {
  const uri = process.env.MIGRATION_NAMOGANGE_MONGO_URI;
  if (!uri) throw new Error("Missing MIGRATION_NAMOGANGE_MONGO_URI");
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
      console.log(JSON.stringify({ collection: mapping.collection, kind: mapping.kind, count, samples: samples.map((row) => transformNamoContent(mapping, row)) }, null, 2));
    }
    console.log(`\nTOTAL across all mapped CMS collections: ${totalDocs}`);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
