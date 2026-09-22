import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../db.js';
import * as models from '../models/index.js';

try {
  await connectDatabase();
  for (const model of Object.values(models).filter(value => value?.modelName)) {
    const indexes = await model.collection.indexes();
    for (const [key, options] of model.schema.indexes()) {
      assert.ok(indexes.some(index => JSON.stringify(index.key) === JSON.stringify(key) && (!options.unique || index.unique)), `Missing index on ${model.modelName}: ${JSON.stringify(key)}`);
    }
  }
  const session = await mongoose.startSession();
  const agentId = `VERIFY-${new mongoose.Types.ObjectId()}`;
  try {
    session.startTransaction();
    const agent = { agentId, fullName: 'Temporary verification', role: 'Sales Executive', startDate: '2026-09-01' };
    await models.Agent.create([agent], { session });
    await assert.rejects(models.Agent.create([agent], { session }), error => error.code === 11000);
    await session.abortTransaction();
    assert.equal(await models.Agent.countDocuments({ agentId }), 0);
  } finally { await session.endSession(); }
  console.log('All model indexes verified; duplicate rejected; transaction rollback verified. No test records retained.');
} finally { await disconnectDatabase(); }
