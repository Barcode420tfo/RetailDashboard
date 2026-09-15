import {readFile} from 'node:fs/promises';
import mongoose from 'mongoose';
import {connectDatabase,disconnectDatabase} from '../db.js';
const data=JSON.parse(await readFile('data/masters/september-2026-target-clusters.json','utf8'));
if(!data.rows?.length)throw Error('Reference is empty');
await connectDatabase();
try{await mongoose.connection.collection('applicationreferences').updateOne({_id:'september-2026-target-clusters'},{$set:{data}},{upsert:true});console.log('Private target reference stored for database migration.');}finally{await disconnectDatabase();}
