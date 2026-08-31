const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://amanchaudhary:aman123@ac-aczc7dp-shard-00-00.bkbsqjj.mongodb.net:27017,ac-aczc7dp-shard-00-01.bkbsqjj.mongodb.net:27017,ac-aczc7dp-shard-00-02.bkbsqjj.mongodb.net:27017/mokshasewa?ssl=true&replicaSet=atlas-ckrjwh-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

function repairObj(obj) {
  if (Array.isArray(obj)) {
    return obj.map(repairObj);
  }
  if (obj && typeof obj === 'object') {
    // If it's the corrupted date object
    if (Object.keys(obj).length === 0 && obj.constructor === Object) {
      // It might be a corrupted Date. We can't know for sure unless we check the key, 
      // but let's just handle this in the main loop if possible, or just ignore empty objects
    }

    // If it's a corrupted ObjectId
    if (obj.i0 !== undefined && obj.i1 !== undefined) {
      return undefined; // We'll just delete this key
    }

    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'createdAt' || k === 'updatedAt') {
        if (v && typeof v === 'object' && Object.keys(v).length === 0) {
          out[k] = new Date();
          continue;
        }
      }
      
      const repaired = repairObj(v);
      if (repaired !== undefined) {
        out[k] = repaired;
      }
    }
    return out;
  }
  return obj;
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB!');
    
    const db = client.db('mokshasewa');
    const col = db.collection('settings');
    
    const doc = await col.findOne({});
    if (!doc) {
      console.error('No settings document found!');
      return;
    }
    console.log('Found settings doc, ID:', doc._id);
    
    const updated = repairObj(doc);
    
    // Ensure we don't mess up _id of the main document
    updated._id = doc._id;
    
    const result = await col.updateOne({ _id: doc._id }, { $set: updated });
    console.log(`✅ Updated! Modified count: ${result.modifiedCount}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

main();
