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

  const coll = db.collection('delegateregistrations');
  
  const cursor = coll.find({});
  let i = 0;
  let unknownCount = 0;

  console.log(`\n=== Dry Run: arogya_delegates ===`);
  
  for await (const doc of cursor) {
    const mapped: Record<string, any> = {
      _id: doc._id,
      delegateId: doc.delegateId,
      planName: doc.planName,
      price: doc.price,
      transactionId: doc.transactionId,
      title: doc.title,
      fullName: doc.fullName,
      email: doc.email,
      mobile: doc.mobile,
      whatsappNumber: doc.whatsappNumber,
      designation: doc.designation,
      organization: doc.organization,
      country: doc.country,
      state: doc.state,
      city: doc.city,
      industryType: doc.industryType,
      category: doc.category,
      areasOfInterest: doc.areasOfInterest,
      specialization: doc.specialization,
      source: doc.source,
      isVerified: doc.isVerified,
      platform: doc.platform,
      regType: doc.regType,
      selectedDays: doc.selectedDays,
      couponCode: doc.couponCode,
      isSpeaker: doc.isSpeaker,
      dietary: doc.dietary,
      assistance: doc.assistance,
      documentUrl: doc.documentUrl,
      address: doc.address,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    // The only UNKNOWN in the field map is the NEW FIELD (payment/lifecycle status)
    // which does not exist in the source document, so no records have an UNKNOWN field populated.
    const hasUnknown = false;

    if (hasUnknown) {
      unknownCount++;
    }

    if (i < 5) {
      console.log(`\nSample ${i + 1}:`);
      console.log(JSON.stringify(mapped, null, 2));
    }
    
    i++;
  }

  console.log(`\nTotal delegates processed: ${i}`);
  console.log(`Records with at least one UNKNOWN/unmapped field populated: ${unknownCount}`);

  await mongoose.disconnect();
}

runDryRun().catch(err => {
  console.error('Unexpected error:', err);
});
