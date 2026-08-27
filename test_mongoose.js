const mongoose = require('mongoose');
const { Schema } = mongoose;
mongoose.connect('mongodb://127.0.0.1:27017/test_db', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const s = new Schema({
      name: String,
      mixedData: Schema.Types.Mixed
    }, { strict: false });
    const TestModel = mongoose.model('Test', s);
    const doc = new TestModel({ name: 'test' });
    await doc.save();
    
    doc.mixedData = { a: 1 };
    doc.markModified('mixedData');
    
    doc.someUnknownKey = { b: 2 };
    doc.markModified('someUnknownKey'); // Does this throw?
    
    await doc.save();
    console.log('Saved successfully');
    process.exit(0);
  })
  .catch(console.error);
