import "./_migrationSetup";
import mongoose from "mongoose";
import { NamoContentKind } from "../src/models/namoContent.model";

interface Mapping { collection: string; kind: NamoContentKind; titleField?: string; slugField?: string; orderField?: string; fixedSlug?: string }
const MAPPINGS: Mapping[] = [
  { collection: "blogs", kind: "BLOG", titleField: "title", slugField: "slug" },
  { collection: "faqs", kind: "FAQ", titleField: "question" },
  { collection: "testimonials", kind: "TESTIMONIAL", titleField: "name" },
  { collection: "banners", kind: "BANNER", titleField: "title" },
  { collection: "galleryimages", kind: "GALLERY_IMAGE", titleField: "category", slugField: "slug" },
  { collection: "galleryvideos", kind: "GALLERY_VIDEO", titleField: "title", orderField: "orderBy" },
  { collection: "abouts", kind: "ABOUT", titleField: "title" },
  { collection: "achievements", kind: "ACHIEVEMENT", titleField: "title", slugField: "slug" },
  { collection: "initiatives", kind: "INITIATIVE", titleField: "title", slugField: "slug" },
  { collection: "objectives", kind: "OBJECTIVE", titleField: "title", slugField: "slug" },
  { collection: "recentupdates", kind: "RECENT_UPDATE", titleField: "title" },
  { collection: "trustbodies", kind: "TRUST_BODY", titleField: "name", slugField: "slug" },
  { collection: "seos", kind: "SEO", titleField: "page_name", slugField: "page_path" },
  { collection: "socialmedias", kind: "SOCIAL_MEDIA", fixedSlug: "primary" },
];

export function transformNamoContent(mapping: Mapping, source: Record<string, unknown>) {
  const { _id, createdAt, updatedAt, ...payload } = source;
  return {
    legacyId: String(_id), kind: mapping.kind,
    slug: mapping.fixedSlug ?? (mapping.slugField ? String(source[mapping.slugField] ?? "") || undefined : undefined),
    title: mapping.titleField ? String(source[mapping.titleField] ?? "") || undefined : undefined,
    payload,
    status: source.status === "Active" ? "ACTIVE" as const : "INACTIVE" as const,
    order: mapping.orderField ? Number(source[mapping.orderField] ?? 0) : 0,
    sourceCreatedAt: createdAt,
    sourceUpdatedAt: updatedAt,
  };
}

async function run() {
  const uri = process.env.MIGRATION_NAMOGANGE_MONGO_URI;
  if (!uri) throw new Error("Missing MIGRATION_NAMOGANGE_MONGO_URI");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error("Source database is unavailable");
  try {
    for (const mapping of MAPPINGS) {
      const collection = db.collection(mapping.collection);
      const count = await collection.countDocuments();
      const samples = await collection.find({}).limit(3).toArray();
      console.log(JSON.stringify({ collection: mapping.collection, kind: mapping.kind, count, samples: samples.map((row) => transformNamoContent(mapping, row)) }, null, 2));
    }
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
