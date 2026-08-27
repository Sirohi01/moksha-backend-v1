import "./_migrationSetup";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";
import { Organisation } from "../src/models/organisation.model";
import { Member } from "../src/models/member.model";

/** Backend_Namo_Gange/src/models/membership/MemberModel.js field names are 1:1 with this
 * platform's Member model except: legacy `organizationType` (American spelling) -> this model's
 * `organisationType`, and legacy's single-string `volunteeringFor`/`networkingFor`/
 * `areaOfInterest` -> this model's array versions (wrapped, not dropped). Legacy has no `status`
 * field at all (no moderation queue ever existed for this form) — defaulted to PENDING here per
 * the same "safe engineering default, flag for review" reasoning already applied to
 * NamoVolunteer, not a claim that these were actually unreviewed. */
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

  try {
    const docs = await sourceDb.collection("members").find({}).toArray();
    for (const doc of docs) {
      const legacyId = String(doc._id);
      const asArray = (v: unknown) => (typeof v === "string" && v.trim() ? [v] : []);

      const payload: Record<string, unknown> = {
        organisationId: organisation._id,
        legacyId,
        title: doc.title,
        applicantName: doc.applicantName,
        surname: doc.surname,
        fatherMotherSpouseName: doc.fatherMotherSpouseName,
        gender: doc.gender,
        qualification: doc.qualification,
        occupation: doc.occupation,
        organisationType: doc.organizationType,
        designation: doc.designation,
        dob: doc.dob,
        mobile: doc.mobile,
        alternateNo: doc.alternateNo,
        email: doc.email,
        aadharNo: doc.aadharNo,
        address: doc.address,
        country: doc.country,
        state: doc.state,
        city: doc.city,
        pinCode: doc.pinCode,
        bloodGroup: doc.bloodGroup,
        relation: doc.relation,
        emergencyContact: doc.emergencyContact,
        initiatives: Array.isArray(doc.initiatives) ? doc.initiatives : [],
        volunteeringFor: asArray(doc.volunteeringFor),
        networkingFor: asArray(doc.networkingFor),
        areaOfInterest: asArray(doc.areaOfInterest),
        monetarySupport: doc.monetarySupport,
        reference1: doc.reference1,
        reference2: doc.reference2,
        profilePic: doc.profilePic,
        status: "PENDING" as const,
      };

      // Member.encryptFieldsOnSave and its mobileHash/emailHash pre-validate hook are both
      // document middleware (pre("save")/pre("validate")) — they do NOT run for query-based
      // findOneAndUpdate(), only for Model.create()/doc.save(). Using findOneAndUpdate here would
      // silently skip both PII encryption and hash computation. See lib/fieldEncryption.ts's own
      // comment warning about exactly this.
      try {
        const existing = await Member.findOne({ organisationId: organisation._id, legacyId });
        if (existing) {
          Object.assign(existing, payload);
          await existing.save();
          updated++;
        } else {
          await Member.create(payload);
          created++;
        }
      } catch (error) {
        skipped++;
        console.error(`  SKIPPED members/${legacyId}:`, error instanceof Error ? error.message : error);
      }
    }
  } finally {
    await sourceConn.close();
    await disconnectDB();
  }

  console.log(`Done. Created ${created}, updated ${updated}, skipped ${skipped}. Source database was never written to.`);
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
