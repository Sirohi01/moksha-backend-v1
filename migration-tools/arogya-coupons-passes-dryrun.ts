/// <reference types="node" />
import "./_migrationSetup";
import mongoose from 'mongoose';

const MIGRATION_AROGYA_MONGO_URI = process.env.MIGRATION_AROGYA_MONGO_URI;

async function runDryRun() {
  if (!MIGRATION_AROGYA_MONGO_URI) {
    console.error('Missing MIGRATION_AROGYA_MONGO_URI environment variable');
    return;
  }

  try {
    await mongoose.connect(MIGRATION_AROGYA_MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    } as any);
  } catch (err) {
    console.error('Failed to connect to Arogya MongoDB:', err);
    return;
  }

  const db = mongoose.connection.db;
  if (!db) {
    console.error('Failed to get db instance');
    return;
  }

  // --- Coupons ---
  console.log(`\n=== Dry Run: arogya_coupons ===`);
  const couponsColl = db.collection('coupons');
  let cCursor = couponsColl.find({});
  let cCount = 0;
  let cUnknownCount = 0;

  for await (const doc of cCursor) {
    const mapped: Record<string, any> = {
      _id: doc._id,
      code: doc.code,
      discountPercent: doc.discountPercent,
      applicableTo: doc.applicableTo,
      status: doc.status,
      isActive: doc.isActive,
      usageLimit: doc.usageLimit,
      usedCount: doc.usedCount,
      usedBy: doc.usedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    const hasUnknown = false; // No fields mapped as UNKNOWN

    if (hasUnknown) {
      cUnknownCount++;
    }

    if (cCount < 2) {
      console.log(`\nSample Coupon ${cCount + 1}:`);
      console.log(JSON.stringify(mapped, null, 2));
    }
    
    cCount++;
  }

  console.log(`\nTotal coupons processed: ${cCount}`);
  console.log(`Coupons with UNKNOWN fields: ${cUnknownCount}`);

  // --- DelegatePasses ---
  console.log(`\n=== Dry Run: arogya_delegatepasses ===`);
  const passesColl = db.collection('delegatepasses');
  let pCursor = passesColl.find({});
  let pCount = 0;
  let pUnknownCount = 0;

  for await (const doc of pCursor) {
    const mapped: Record<string, any> = {
      _id: doc._id,
      name: doc.name,
      price: doc.price,
      daysText: doc.daysText,
      applicableTo: doc.applicableTo,
      includes: doc.includes,
      isMostPopular: doc.isMostPopular,
      status: doc.status,
      isActive: doc.isActive,
      order: doc.order,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    const hasUnknown = false; // No fields mapped as UNKNOWN

    if (hasUnknown) {
      pUnknownCount++;
    }

    if (pCount < 2) {
      console.log(`\nSample Pass ${pCount + 1}:`);
      console.log(JSON.stringify(mapped, null, 2));
    }
    
    pCount++;
  }

  console.log(`\nTotal passes processed: ${pCount}`);
  console.log(`Passes with UNKNOWN fields: ${pUnknownCount}`);

  await mongoose.disconnect();
}

runDryRun().catch(err => {
  console.error('Unexpected error:', err);
});
