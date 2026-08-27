import "./_migrationSetup";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";
import { Organisation } from "../src/models/organisation.model";
import { NamoLookup, NamoLookupType } from "../src/models/namoLookup.model";
import { NamoContent } from "../src/models/namoContent.model";
import { NamoAgsCollege } from "../src/models/namoAgsCollege.model";
import { NamoAgsClientStatusLog } from "../src/models/namoAgsClientStatusLog.model";
import { NamoAgsDelegate } from "../src/models/namoAgsDelegate.model";

/**
 * Imports everything explicitly requested as "don't skip anything" on 2026-08-27: the ~15 small
 * admin lookup/master tables (as NamoLookup), agsevents (as a NamoContent AGS_EVENT), colleges
 * (as NamoAgsCollege), and clientstatuses (as NamoAgsClientStatusLog, best-effort linked to
 * NamoAgsDelegate — see that model's own comment on the real legacy dangling "Client" ref).
 * Deliberately NOT migrated (see UNIFIED_PLATFORM_STATE.md): users/admins/roles/rolerights
 * (legacy staff auth — Moksha's own RBAC replaces this; importing old bcrypt hashes into a
 * different hashing scheme would be actively insecure, not just redundant), activitylogs/sidebars
 * (legacy-admin-UI-only artifacts with no equivalent concept in the new system), otps (empty,
 * superseded by NamoOtp).
 */

interface LookupMapping { collection: string; type: NamoLookupType; nameField: string }
const LOOKUP_MAPPINGS: LookupMapping[] = [
  { collection: "categories", type: "CATEGORY", nameField: "name" },
  { collection: "occupations", type: "OCCUPATION", nameField: "name" },
  { collection: "designations", type: "DESIGNATION", nameField: "name" },
  { collection: "departments", type: "DEPARTMENT", nameField: "name" },
  { collection: "professions", type: "PROFESSION", nameField: "name" },
  { collection: "universities", type: "UNIVERSITY", nameField: "name" },
  { collection: "datas", type: "DATA", nameField: "name" },
  { collection: "objnames", type: "OBJ_NAME", nameField: "name" },
  { collection: "organizations", type: "ORGANIZATION", nameField: "name" },
  { collection: "sources", type: "SOURCE", nameField: "name" },
  { collection: "calltargets", type: "CALL_TARGET", nameField: "employee" },
  { collection: "coordinatorstatuses", type: "COORDINATOR_STATUS", nameField: "title" },
  { collection: "banks", type: "BANK", nameField: "bank_name" },
  { collection: "statusoptions", type: "STATUS_OPTION", nameField: "name" },
  { collection: "ips", type: "IP", nameField: "ip_name" },
];

async function run() {
  const sourceUri = process.env.MIGRATION_NAMOGANGE_MONGO_URI;
  if (!sourceUri) throw new Error("Missing MIGRATION_NAMOGANGE_MONGO_URI");

  await connectDB();
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" });
  if (!organisation) throw new Error("NAMOGANGE organisation is not seeded");
  const organisationId = organisation._id;

  const sourceConn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const sourceDb = sourceConn.db;
  if (!sourceDb) throw new Error("Source database is unavailable");

  try {
    // --- 15 lookup tables -> NamoLookup ---
    for (const mapping of LOOKUP_MAPPINGS) {
      let created = 0, updated = 0, skipped = 0;
      const docs = await sourceDb.collection(mapping.collection).find({}).toArray();
      for (const doc of docs) {
        const legacyId = String(doc._id);
        const { _id, createdAt, updatedAt, status, ...rest } = doc as Record<string, unknown>;
        const payload = { organisationId, legacyId, type: mapping.type, name: String(doc[mapping.nameField] ?? "Unnamed"), payload: rest, status: status === "Inactive" ? "INACTIVE" as const : "ACTIVE" as const };
        try {
          const result = await NamoLookup.findOneAndUpdate(
            { organisationId, type: mapping.type, legacyId },
            payload,
            { upsert: true, new: true, rawResult: true, runValidators: true }
          );
          if (result.lastErrorObject?.updatedExisting) updated++; else created++;
        } catch (error) {
          skipped++;
          console.error(`  SKIPPED ${mapping.collection}/${legacyId}:`, error instanceof Error ? error.message : error);
        }
      }
      console.log(`${mapping.collection} -> NamoLookup(${mapping.type}): created ${created}, updated ${updated}, skipped ${skipped} (of ${docs.length})`);
    }

    // --- agsevents -> NamoContent (AGS_EVENT) ---
    {
      let created = 0, updated = 0, skipped = 0;
      const docs = await sourceDb.collection("agsevents").find({}).toArray();
      for (const doc of docs) {
        const legacyId = String(doc._id);
        const { _id, createdAt, updatedAt, name, status, ...rest } = doc as Record<string, unknown>;
        const payload = { organisationId, legacyId, kind: "AGS_EVENT" as const, title: String(name ?? "Untitled Event"), payload: { name, ...rest }, status: status === "Inactive" ? "INACTIVE" as const : "ACTIVE" as const, order: 0 };
        try {
          const result = await NamoContent.findOneAndUpdate(
            { organisationId, kind: "AGS_EVENT", legacyId },
            payload,
            { upsert: true, new: true, rawResult: true, runValidators: true }
          );
          if (result.lastErrorObject?.updatedExisting) updated++; else created++;
        } catch (error) {
          skipped++;
          console.error(`  SKIPPED agsevents/${legacyId}:`, error instanceof Error ? error.message : error);
        }
      }
      console.log(`agsevents -> NamoContent(AGS_EVENT): created ${created}, updated ${updated}, skipped ${skipped} (of ${docs.length})`);
    }

    // --- colleges -> NamoAgsCollege ---
    {
      let created = 0, updated = 0, skipped = 0;
      const docs = await sourceDb.collection("colleges").find({}).toArray();
      for (const doc of docs) {
        const legacyId = String(doc._id);
        const contacts = Array.isArray(doc.contacts) ? doc.contacts.map((c: Record<string, unknown>) => ({
          contactPerson: c.contact_person, designation: c.designation, email: c.email, mobile: c.mobile, alternate: c.alternate, landline: c.landline,
        })) : [];
        const payload = {
          organisationId, legacyId, collegeName: doc.college_name, category: doc.category, website: doc.website,
          address: doc.address, country: doc.country, state: doc.state, city: doc.city, pincode: doc.pincode,
          affilatedTo: doc.affilated_to, status: doc.status === "Inactive" ? "Inactive" as const : "Active" as const, contacts,
        };
        try {
          const result = await NamoAgsCollege.findOneAndUpdate(
            { organisationId, legacyId },
            payload,
            { upsert: true, new: true, rawResult: true, runValidators: true }
          );
          if (result.lastErrorObject?.updatedExisting) updated++; else created++;
        } catch (error) {
          skipped++;
          console.error(`  SKIPPED colleges/${legacyId}:`, error instanceof Error ? error.message : error);
        }
      }
      console.log(`colleges -> NamoAgsCollege: created ${created}, updated ${updated}, skipped ${skipped} (of ${docs.length})`);
    }

    // --- clientstatuses -> NamoAgsClientStatusLog (best-effort agsDelegateId link) ---
    {
      let created = 0, updated = 0, skipped = 0;
      const docs = await sourceDb.collection("clientstatuses").find({}).toArray();
      for (const doc of docs) {
        const legacyId = String(doc._id);
        const legacyClientId = doc.client_id ? String(doc.client_id) : undefined;
        const linkedDelegate = legacyClientId
          ? await NamoAgsDelegate.findOne({ organisationId, legacyId: legacyClientId }).select("_id")
          : null;
        const payload = {
          organisationId, legacyId, agsDelegateId: linkedDelegate?._id, legacyClientId,
          selectedStatus: doc.selected_status, selectedEvent: doc.selected_event, previousStatus: doc.previous_status,
          description: doc.desc, reminderAt: doc.reminder_date_time,
        };
        try {
          const result = await NamoAgsClientStatusLog.findOneAndUpdate(
            { organisationId, legacyId },
            payload,
            { upsert: true, new: true, rawResult: true, runValidators: true }
          );
          if (result.lastErrorObject?.updatedExisting) updated++; else created++;
        } catch (error) {
          skipped++;
          console.error(`  SKIPPED clientstatuses/${legacyId}:`, error instanceof Error ? error.message : error);
        }
      }
      console.log(`clientstatuses -> NamoAgsClientStatusLog: created ${created}, updated ${updated}, skipped ${skipped} (of ${docs.length})`);
    }
  } finally {
    await sourceConn.close();
    await disconnectDB();
  }

  console.log("\nDone. Source database was never written to.");
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
