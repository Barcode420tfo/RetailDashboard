import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGODB_URI);

console.log('DB:', mongoose.connection.name);

const ref = await mongoose.connection
  .collection('applicationreferences')
  .findOne({ _id: 'september-2026-target-clusters' });

console.log('FOUND:', !!ref);
console.log('ROWS:', ref?.data?.rows?.length);

await mongoose.disconnect();
