import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = process.argv[2] || 'status';
const uri = 'mongodb://127.0.0.1:27017/admin?directConnection=true';
const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
try {
  if (command === 'start') {
    await mkdir(`${root}.local/mongodb/data`, { recursive: true });
    const result = spawnSync(`${root}.local/mongodb/bin/mongod`, [
      '--dbpath', `${root}.local/mongodb/data`, '--logpath', `${root}.local/mongodb/mongod.log`,
      '--logappend', '--bind_ip', '127.0.0.1', '--port', '27017', '--replSet', 'rs0', '--fork',
    ], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('MongoDB did not start. Check .local/mongodb/mongod.log; it may already be running.');
  }
  await client.connect();
  const admin = client.db('admin');
  if (command === 'stop') {
    const configuration = await admin.command({ getCmdLineOpts: 1 });
    if (configuration.parsed?.storage?.dbPath !== `${root}.local/mongodb/data`) throw new Error('Refusing to stop a MongoDB instance not owned by this project');
    try { await admin.command({ shutdown: 1 }); }
    catch (error) { if (!(error instanceof mongoose.mongo.MongoNetworkError)) throw error; }
    console.log('Project MongoDB stopped');
  } else {
    if (command === 'start') {
      try { await admin.command({ replSetGetStatus: 1 }); }
      catch (error) {
        if (error.code !== 94) throw error;
        await admin.command({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] } });
      }
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        if ((await admin.command({ hello: 1 })).isWritablePrimary) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!ready) throw new Error('MongoDB did not become primary within 30 seconds');
    }
    const status = await admin.command({ hello: 1 });
    console.log(JSON.stringify({ connected: true, replicaSet: status.setName, writable: status.isWritablePrimary }));
  }
} finally { await client.close(); }
