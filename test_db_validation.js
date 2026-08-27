const mongoose = require('mongoose');
const { updateSettingSchema } = require('./src/modules/setting/setting.validation.ts');
mongoose.connect('mongodb://127.0.0.1:27017/moksha_sewa', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    // We can't easily run Zod in this plain node script because updateSettingSchema is TS.
    // We will just fetch it and run it via ts-node.
  })
  .catch(console.error);
