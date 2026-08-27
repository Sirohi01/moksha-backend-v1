import "./_migrationSetup";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";
import { Organisation } from "../src/models/organisation.model";
import { NamoContent } from "../src/models/namoContent.model";
import { transformNamoContent, MAPPINGS } from "./namogange-cms-dryrun";

/**
 * WRITE migration: reads from the legacy Namo Gange database (read-only — no write call is ever
 * made against `sourceConn`) and upserts into this platform's own NamoContent collection, keyed
 * on {organisationId, kind, legacyId} — the same unique index the model already enforces.
 * Idempotent and safe to re-run.
 */
async function run() {
  const sourceUri = process.env.MIGRATION_NAMOGANGE_MONGO_URI;
  if (!sourceUri) throw new Error("Missing MIGRATION_NAMOGANGE_MONGO_URI");

  await connectDB();
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" });
  if (!organisation) throw new Error("NAMOGANGE organisation is not seeded — run `npm run seed:organisations` first");

  const sourceConn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const sourceDb = sourceConn.db;
  if (!sourceDb) throw new Error("Source database is unavailable");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const mapping of MAPPINGS) {
      const docs = await sourceDb.collection(mapping.collection).find({}).toArray();
      for (const doc of docs) {
        const transformed = transformNamoContent(mapping, doc as unknown as Record<string, unknown>);
        try {
          const result = await NamoContent.findOneAndUpdate(
            { organisationId: organisation._id, kind: transformed.kind, legacyId: transformed.legacyId },
            { ...transformed, organisationId: organisation._id },
            { upsert: true, new: true, rawResult: true }
          ) as unknown as { lastErrorObject?: { updatedExisting?: boolean } };
          if (result.lastErrorObject?.updatedExisting) updated++;
          else created++;
        } catch (error) {
          skipped++;
          console.error(`  SKIPPED ${mapping.collection}/${transformed.legacyId}:`, error instanceof Error ? error.message : error);
        }
      }
      console.log(`${mapping.collection} -> ${mapping.kind}: processed ${docs.length}`);
    }
  } finally {
    await sourceConn.close();
    await disconnectDB();
  }

  console.log(`\nDone. Created ${created}, updated ${updated}, skipped ${skipped}. Source database was never written to.`);
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
