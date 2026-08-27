const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    const collection = mongoose.connection.collection('settings');
    
    // Clear out ambulancePage to force fallback defaults
    const result = await collection.updateMany(
      {},
      { $unset: { ambulancePage: "" } }
    );
    console.log("Cleared ambulancePage from settings. Result:", result);
    
    process.exit(0);
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    process.exit(1);
  });
