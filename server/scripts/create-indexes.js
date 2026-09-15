import { connectDatabase, disconnectDatabase } from '../db.js';
import * as models from '../models/index.js';

try {
  await connectDatabase();
  for (const model of Object.values(models)) {
    await model.createIndexes();
    console.log(`Indexes created: ${model.modelName}`);
  }
} finally {
  await disconnectDatabase();
}
