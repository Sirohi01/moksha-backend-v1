import "./_migrationSetup";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";
import { Organisation } from "../src/models/organisation.model";
import { Job } from "../src/models/job.model";

/** Backend_Namo_Gange/src/models/job/JobModel.js has no slug/summary/description/employmentType
 * fields at all — this platform's Job model requires all four for its own richer admin-authoring
 * form, so they're synthesized here from the real legacy fields (title, exp, salary, location,
 * desc[]) rather than left blank. Nothing from the legacy record is dropped: exp/salary/desc still
 * land in experienceText/salaryText/requirements exactly as they were. */
function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "job";
}

async function run() {
  const sourceUri = process.env.MIGRATION_NAMOGANGE_MONGO_URI;
  if (!sourceUri) throw new Error("Missing MIGRATION_NAMOGANGE_MONGO_URI");

  await connectDB();
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" });
  if (!organisation) throw new Error("NAMOGANGE organisation is not seeded");

  const sourceConn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const sourceDb = sourceConn.db;
  if (!sourceDb) throw new Error("Source database is unavailable");

  let created = 0, updated = 0, skipped = 0;
  const usedSlugs = new Set<string>((await Job.find({ organisationId: organisation._id }).select("slug")).map((j) => j.slug));

  try {
    const docs = await sourceDb.collection("jobs").find({}).toArray();
    for (const doc of docs) {
      const legacyId = String(doc._id);
      const desc: string[] = Array.isArray(doc.desc) ? doc.desc.filter((d: unknown): d is string => typeof d === "string") : [];
      let slug = slugify(String(doc.title ?? "job"));
      let suffix = 1;
      const existing = await Job.findOne({ organisationId: organisation._id, legacyId }).select("slug");
      if (!existing) {
        while (usedSlugs.has(slug)) slug = `${slugify(String(doc.title ?? "job"))}-${++suffix}`;
        usedSlugs.add(slug);
      } else {
        slug = existing.slug;
      }

      const payload = {
        organisationId: organisation._id,
        legacyId,
        title: String(doc.title ?? "Untitled Role"),
        slug,
        location: String(doc.location ?? "Not specified"),
        employmentType: "Full time",
        summary: (desc[0] ?? String(doc.title ?? "")).slice(0, 500) || "Role details to follow.",
        description: desc.length > 0 ? desc.join("\n") : String(doc.title ?? "Details to follow."),
        requirements: desc,
        experienceText: doc.exp ? String(doc.exp) : undefined,
        salaryText: doc.salary ? String(doc.salary) : undefined,
        status: doc.status === "Inactive" ? "CLOSED" as const : "PUBLISHED" as const,
        publishedAt: doc.status !== "Inactive" ? (doc.createdAt ?? new Date()) : undefined,
      };

      try {
        const result = await Job.findOneAndUpdate(
          { organisationId: organisation._id, legacyId },
          payload,
          { upsert: true, new: true, rawResult: true, runValidators: true }
        ) as unknown as { lastErrorObject?: { updatedExisting?: boolean } };
        if (result.lastErrorObject?.updatedExisting) updated++; else created++;
      } catch (error) {
        skipped++;
        console.error(`  SKIPPED jobs/${legacyId}:`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    await sourceConn.close();
    await disconnectDB();
  }

  console.log(`Done. Created ${created}, updated ${updated}, skipped ${skipped}. Source database was never written to.`);
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
