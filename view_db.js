const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const collection = mongoose.connection.collection('settings');
    const doc = await collection.findOne({});
    console.log("Settings keys:", Object.keys(doc || {}));
    if (doc && doc.servicesPage) {
      console.log("servicesPage exists");
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
