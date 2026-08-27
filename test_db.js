const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Setting } = require('./src/models/setting.model');

dotenv.config({ path: './.env' });

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    let settings = await Setting.findOne();
    console.log("Before keys:", Object.keys(settings.toObject()));
    
    Object.assign(settings, {
      testPage: { sections: [{ key: "test" }] }
    });
    // Wait, Mongoose requires markModified for mixed/unknown types!
    settings.markModified('testPage');
    await settings.save();
    
    const settingsAfter = await Setting.findOne();
    console.log("After keys:", Object.keys(settingsAfter.toObject()));
    
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
