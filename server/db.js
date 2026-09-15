import mongoose from 'mongoose';

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required');
  return mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
}
export const disconnectDatabase = () => mongoose.disconnect();
