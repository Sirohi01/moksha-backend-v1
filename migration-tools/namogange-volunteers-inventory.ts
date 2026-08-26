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

  const collName = 'volunteers';
  console.log(`\n=== Collection: ${collName} ===`);
  const coll = db.collection(collName);
  
  try {
    const totalCount = await coll.countDocuments();
    console.log(`Total documents: ${totalCount}`);

    const missingContactCount = await coll.countDocuments({
      $or: [
        { mobile: { $exists: false } },
        { mobile: null },
        { mobile: '' },
        { email: { $exists: false } },
        { email: null },
        { email: '' }
      ]
    });
    console.log(`Missing mobile or email: ${missingContactCount}`);

    // Duplicates by mobile
    const mobileDuplicates = await coll.aggregate([
      { $match: { mobile: { $exists: true, $nin: [null, ''] } } },
      {
        $group: {
          _id: '$mobile',
          count: { $sum: 1 },
          docs: { $push: { _id: '$_id', name: { $ifNull: ['$applicantName', 'Unknown'] } } }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 10 }
    ]).toArray();

    if (mobileDuplicates.length > 0) {
      console.log(`Sample duplicate groups by mobile (up to 10):`);
      mobileDuplicates.forEach(group => {
        console.log(`  Mobile: ${group._id} (Count: ${group.count})`);
        group.docs.forEach((doc: any) => {
          console.log(`    - _id: ${doc._id}, name: ${doc.name}`);
        });
      });
    } else {
      console.log('No mobile duplicates found in sample.');
    }

    // Duplicates by email
    const emailDuplicates = await coll.aggregate([
      { $match: { email: { $exists: true, $nin: [null, ''] } } },
      {
        $group: {
          _id: { $toLower: '$email' },
          count: { $sum: 1 },
          docs: { $push: { _id: '$_id', name: { $ifNull: ['$applicantName', 'Unknown'] } } }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 10 }
    ]).toArray();

    if (emailDuplicates.length > 0) {
      console.log(`Sample duplicate groups by email (up to 10):`);
      emailDuplicates.forEach(group => {
        console.log(`  Email: ${group._id} (Count: ${group.count})`);
        group.docs.forEach((doc: any) => {
          console.log(`    - _id: ${doc._id}, name: ${doc.name}`);
        });
      });
    } else {
      console.log('No email duplicates found in sample.');
    }

  } catch (err) {
    console.error(`Error processing collection ${collName}:`, err);
  }

  await mongoose.disconnect();
}

runInventory().catch(err => {
  console.error('Unexpected error:', err);
});
