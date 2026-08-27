import "./_migrationSetup";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";
import { Organisation } from "../src/models/organisation.model";
import { NamoVolunteer } from "../src/models/namoVolunteer.model";

/** Backend_Namo_Gange/src/models/volunteer/VolunteerModel.js fields are already a 1:1 match with
 * NamoVolunteer (that model was built directly from this source) — straight field copy, no
 * transformation needed beyond the legacyId link. */
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
  const FIELDS = [
    "title", "applicantName", "surname", "fatherName", "gender", "qualification", "occupation",
    "organisationType", "designation", "dob", "mobile", "alternateMobile", "email", "aadhaar",
    "address", "country", "state", "city", "pincode", "emergencyRelation", "emergencyContact",
    "initiatives", "volunteeringFor", "networkingFor", "areaOfInterest", "monetarySupport",
    "reference1", "reference2", "areaOfRegion", "reportTo", "volunteerDesignation", "bankName",
    "accountNo", "ifscCode", "companyName", "businessAddress", "businessCountry", "businessState",
    "businessCity", "businessPincode", "businessDesignation", "businessContactNo", "profilePic",
  ] as const;

  try {
    const docs = await sourceDb.collection("volunteers").find({}).toArray();
    for (const doc of docs) {
      const legacyId = String(doc._id);
      const payload: Record<string, unknown> = { organisationId: organisation._id, legacyId, status: "PENDING_REVIEW" };
      for (const field of FIELDS) if (doc[field] !== undefined) payload[field] = doc[field];

      // Same reasoning as namogange-members-import.ts: encryptFieldsOnSave/hash computation are
      // pre("save")/pre("validate") document middleware, which findOneAndUpdate() bypasses
      // entirely — must go through create()/doc.save() for PII to actually get encrypted.
      try {
        const existing = await NamoVolunteer.findOne({ organisationId: organisation._id, legacyId });
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          updated++;
        } else {
          await NamoVolunteer.create(payload);
          created++;
        }
      } catch (error) {
        skipped++;
        console.error(`  SKIPPED volunteers/${legacyId}:`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    await sourceConn.close();
    await disconnectDB();
  }

  console.log(`Done. Created ${created}, updated ${updated}, skipped ${skipped}. Source database was never written to.`);
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
