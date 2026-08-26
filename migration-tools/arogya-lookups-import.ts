import "./_migrationSetup";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../src/config/db";
import { Organisation } from "../src/models/organisation.model";
import { CrmCountry, CrmState, CrmCity } from "../src/models/crmLocation.model";
import { ArogyaCategory } from "../src/models/arogyaCategory.model";
import { ArogyaPass } from "../src/models/arogyaPass.model";
import { ArogyaCoupon } from "../src/models/arogyaCoupon.model";

/** WRITE migration for the reference/lookup data a delegate registration form needs: CRM
 * country/state/city (shared, not org-scoped), and Arogya's categories/passes/coupons
 * (org-scoped). Read-only against the source database, idempotent upserts against the target —
 * same guarantees as arogya-cms-import.ts. */
async function run() {
  const sourceUri = process.env.MIGRATION_AROGYA_MONGO_URI;
  if (!sourceUri) throw new Error("Missing MIGRATION_AROGYA_MONGO_URI");

  await connectDB();
  const organisation = await Organisation.findOne({ code: "AROGYA", status: "ACTIVE" });
  if (!organisation) throw new Error("AROGYA organisation is not seeded — run `npm run seed:organisations` first");

  const sourceConn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const sourceDb = sourceConn.db;
  if (!sourceDb) throw new Error("Source database is unavailable");

  const counts: Record<string, number> = {};

  try {
    // Bulk upserts, not one findOneAndUpdate per document — crmcities alone is ~48,000 rows, and
    // one round-trip per document against a remote Atlas cluster made this take the better part of
    // an hour. A single bulkWrite batch is one round-trip for the whole collection.
    const countries = await sourceDb.collection("crmcountries").find({}).toArray();
    if (countries.length) {
      await CrmCountry.bulkWrite(countries.map((doc) => ({
        updateOne: {
          filter: { countryCode: doc.countryCode },
          update: { $set: { countryCode: doc.countryCode, sortName: doc.sortName, name: doc.name } },
          upsert: true,
        },
      })));
    }
    counts.countries = countries.length;

    const states = await sourceDb.collection("crmstates").find({}).toArray();
    if (states.length) {
      await CrmState.bulkWrite(states.map((doc) => ({
        updateOne: {
          filter: { stateCode: doc.stateCode },
          update: { $set: { stateCode: doc.stateCode, name: doc.name, countryCode: doc.countryCode } },
          upsert: true,
        },
      })));
    }
    counts.states = states.length;

    const cities = await sourceDb.collection("crmcities").find({}).toArray();
    for (let i = 0; i < cities.length; i += 5000) {
      const batch = cities.slice(i, i + 5000);
      await CrmCity.bulkWrite(batch.map((doc) => ({
        updateOne: {
          filter: { cityCode: doc.cityCode },
          update: { $set: { cityCode: doc.cityCode, name: doc.name, stateCode: doc.stateCode } },
          upsert: true,
        },
      })));
    }
    counts.cities = cities.length;

    const categories = await sourceDb.collection("categories").find({}).toArray();
    for (const doc of categories) {
      await ArogyaCategory.findOneAndUpdate(
        { organisationId: organisation._id, legacyId: String(doc._id) },
        { organisationId: organisation._id, legacyId: String(doc._id), name: doc.name, type: doc.type },
        { upsert: true }
      );
    }
    counts.categories = categories.length;

    const passes = await sourceDb.collection("delegatepasses").find({}).toArray();
    for (const doc of passes) {
      await ArogyaPass.findOneAndUpdate(
        { organisationId: organisation._id, legacyId: String(doc._id) },
        {
          organisationId: organisation._id, legacyId: String(doc._id), name: doc.name, price: doc.price,
          daysText: doc.daysText ?? "1 Day", applicableTo: doc.applicableTo ?? "both", includes: doc.includes ?? [],
          isMostPopular: !!doc.isMostPopular, status: doc.status ?? (doc.isActive === false ? "inactive" : "active"),
          order: doc.order ?? 0,
        },
        { upsert: true }
      );
    }
    counts.passes = passes.length;

    const coupons = await sourceDb.collection("coupons").find({}).toArray();
    for (const doc of coupons) {
      await ArogyaCoupon.findOneAndUpdate(
        { organisationId: organisation._id, legacyId: String(doc._id) },
        {
          organisationId: organisation._id, legacyId: String(doc._id), code: doc.code, discountPercent: doc.discountPercent,
          applicableTo: doc.applicableTo ?? "both", status: doc.isActive === false ? "inactive" : (doc.status ?? "available"),
          usageLimit: doc.usageLimit ?? 1, usedCount: doc.usedCount ?? 0, usedBy: doc.usedBy ?? [],
        },
        { upsert: true }
      );
    }
    counts.coupons = coupons.length;
  } finally {
    await sourceConn.close();
    await disconnectDB();
  }

  console.log("Imported (upserted, idempotent):", counts);
}

if (require.main === module) run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
