const mongoose = require('mongoose');
const { Schema } = mongoose;
mongoose.connect('mongodb://127.0.0.1:27017/test_db', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const s = new Schema({ name: String }, { strict: false });
    const TestModel = mongoose.model('TestId', s);
    const doc = new TestModel({ name: 'test' });
    await doc.save();
    
    try {
      doc._id = doc._id;
      doc.markModified('_id');
      await doc.save();
      console.log('Saved successfully');
    } catch(e) {
      console.log('Failed:', e.message);
    }
    process.exit(0);
  })
  .catch(console.error);
