import "./_migrationSetup";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";
import { Organisation } from "../src/models/organisation.model";
import { NamoJobApplication } from "../src/models/namoJobApplication.model";
import { NamoEnquiry } from "../src/models/namoEnquiry.model";
import { NamoSupportRequest } from "../src/models/namoSupportRequest.model";
import { NamoDonationLead } from "../src/models/namoDonationLead.model";

/**
 * Imports the four lead-capture collections (job applications, contact enquiries, support
 * requests, donation pledges) — all straightforward field-for-field copies from the real legacy
 * models, confirmed from Backend_Namo_Gange source. None of these models had a legacyId field
 * originally since they were built fresh in this session with only new submissions in mind; a
 * `legacyId` field is added to each below (optional, matching every other migrated model's
 * pattern) purely so this script is idempotent and re-runnable.
 */

// All four target models use encryptFieldsOnSave, which is pre("save") document middleware —
// it does NOT run for query-based findOneAndUpdate()/updateOne(), only for
// Model.create()/doc.save(). An earlier version of this script used findOneAndUpdate and silently
// wrote unencrypted PII; fixed to always go through create()/doc.save() instead.
async function importCollection<T extends mongoose.Document>(
  sourceDb: mongoose.mongo.Db,
  collectionName: string,
  organisationId: mongoose.Types.ObjectId,
  Model: mongoose.Model<T>,
  buildPayload: (doc: Record<string, unknown>) => Record<string, unknown>
) {
  let created = 0, updated = 0, skipped = 0;
  const docs = await sourceDb.collection(collectionName).find({}).toArray();
  for (const doc of docs) {
    const legacyId = String(doc._id);
    const payload = { organisationId, legacyId, ...buildPayload(doc as Record<string, unknown>) };
    try {
      const existing = await Model.findOne({ organisationId, legacyId } as mongoose.FilterQuery<T>);
      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        updated++;
      } else {
        await Model.create(payload);
        created++;
      }
    } catch (error) {
      skipped++;
      console.error(`  SKIPPED ${collectionName}/${legacyId}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`${collectionName}: created ${created}, updated ${updated}, skipped ${skipped} (of ${docs.length})`);
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

  try {
    await importCollection(sourceDb, "jobapplications", organisation._id, NamoJobApplication, (doc) => ({
      name: doc.name, email: doc.email, phone: doc.phone, city: doc.city, state: doc.state,
      currentLocation: doc.currentLocation, role: doc.role, message: doc.message,
      status: doc.status ?? "Pending",
    }));

    await importCollection(sourceDb, "enquirylists", organisation._id, NamoEnquiry, (doc) => ({
      name: doc.name, email: doc.email, mobile: doc.mobile, message: doc.message,
    }));

    await importCollection(sourceDb, "supports", organisation._id, NamoSupportRequest, (doc) => ({
      name: doc.name, email: doc.email, mobile: doc.mobile, gender: doc.gender, dob: doc.dob,
      supportType: doc.supportType, fullAddress: doc.fullAddress, state: doc.state, city: doc.city,
      prefferedContribution: doc.prefferedContribution, message: doc.message,
    }));

    await importCollection(sourceDb, "donations", organisation._id, NamoDonationLead, (doc) => ({
      fullName: doc.fullName, email: doc.email, phone: doc.phone, gender: doc.gender || undefined,
      country: doc.country, state: doc.state, city: doc.city, address: doc.address,
      sewaType: doc.SewaType, donationPackage: doc.donationPackage, amount: doc.amount,
      pan: doc.pan, message: doc.message, anonymous: doc.anonymous ?? false,
    }));
  } finally {
    await sourceConn.close();
    await disconnectDB();
  }

  console.log("\nDone. Source database was never written to.");
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
