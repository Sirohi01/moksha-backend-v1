// @ts-nocheck
import "./_migrationSetup";
import mongoose from 'mongoose';

const MIGRATION_NAMOGANGE_MONGO_URI = process.env.MIGRATION_NAMOGANGE_MONGO_URI;

async function runDryRun() {
  if (!MIGRATION_NAMOGANGE_MONGO_URI) {
    console.error('Missing MIGRATION_NAMOGANGE_MONGO_URI environment variable');
    process.exit(1);
    return;
  }

  try {
    await mongoose.connect(MIGRATION_NAMOGANGE_MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    } as any);
  } catch (err) {
    console.error('Failed to connect to Namo Gange MongoDB:', err);
    process.exit(1);
    return;
  }

  const db = mongoose.connection.db;
  if (!db) {
    console.error('Failed to get db instance');
    process.exit(1);
    return;
  }

  const coll = db.collection('members');

  const cursor = coll.find({});
  let i = 0;
  let unknownCount = 0;

  console.log(`\n=== Dry Run: namogange_members ===`);

  for await (const doc of cursor) {
    const mapped: Record<string, any> = {
      _id: doc._id,
      title: doc.title,
      applicantName: doc.applicantName,
      surname: doc.surname,
      fatherMotherSpouseName: doc.fatherMotherSpouseName,
      gender: doc.gender,
      qualification: doc.qualification,
      occupation: doc.occupation,
      organizationType: doc.organizationType,
      designation: doc.designation,
      dob: doc.dob,
      mobile: doc.mobile,
      alternateNo: doc.alternateNo,
      email: doc.email,
      // mask Aadhar No for security in output
      aadharNo: doc.aadharNo ? `********${doc.aadharNo.slice(-4)}` : undefined,
      address: doc.address,
      country: doc.country,
      state: doc.state,
      city: doc.city,
      pinCode: doc.pinCode,
      bloodGroup: doc.bloodGroup,
      relation: doc.relation,
      emergencyContact: doc.emergencyContact,
      initiatives: doc.initiatives,
      volunteeringFor: doc.volunteeringFor,
      networkingFor: doc.networkingFor,
      areaOfInterest: doc.areaOfInterest,
      monetarySupport: doc.monetarySupport,
      reference1: doc.reference1,
      reference2: doc.reference2,
      profilePic: doc.profilePic,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    let hasUnknown = false;

    if (doc.aadharNo) hasUnknown = true;
    if (doc.reference1 && Object.keys(doc.reference1).length > 0) hasUnknown = true;
    if (doc.reference2 && Object.keys(doc.reference2).length > 0) hasUnknown = true;

    if (hasUnknown) {
      unknownCount++;
    }

    if (i < 5) {
      console.log(`\nSample ${i + 1}:`);
      console.log(JSON.stringify(mapped, null, 2));
    }

    i++;
  }

  console.log(`\nTotal members processed: ${i}`);
  console.log(`Records with at least one UNKNOWN/unmapped field populated: ${unknownCount}`);

  await mongoose.disconnect();
}

runDryRun().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
