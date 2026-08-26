/// <reference types="node" />
import "./_migrationSetup";
import mongoose from 'mongoose';

const MIGRATION_NAMOGANGE_MONGO_URI = process.env.MIGRATION_NAMOGANGE_MONGO_URI;

async function runInventory() {
  if (!MIGRATION_NAMOGANGE_MONGO_URI) {
    console.error('Missing MIGRATION_NAMOGANGE_MONGO_URI environment variable');
    return;
  }

  try {
    await mongoose.connect(MIGRATION_NAMOGANGE_MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    } as any);
  } catch (err) {
    console.error('Failed to connect to Namo Gange MongoDB:', err);
    return;
  }

  const db = mongoose.connection.db;
  if (!db) {
    console.error('Failed to get db instance');
    return;
  }

  const collections = ['agsdelegates', 'agspayments', 'clientstatuses'];

  for (const collName of collections) {
    console.log(`\n=== Collection: ${collName} ===`);
    const coll = db.collection(collName);
    
    try {
      const totalCount = await coll.countDocuments();
      console.log(`Total documents: ${totalCount}`);

      if (collName === 'agsdelegates') {
        const clientStatusCounts = await coll.aggregate([
          {
            $group: {
              _id: '$clientStatus',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ]).toArray();

        console.log(`\nDistinct clientStatus values:`);
        clientStatusCounts.forEach(item => {
          console.log(`  - "${item._id}": ${item.count}`);
        });
      }
    } catch (err) {
      console.error(`Error processing collection ${collName}:`, err);
    }
  }

  await mongoose.disconnect();
}

runInventory().catch(err => {
  console.error('Unexpected error:', err);
});
