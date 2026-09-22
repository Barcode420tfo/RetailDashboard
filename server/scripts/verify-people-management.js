import assert from 'node:assert/strict';
import express from 'express';
import supertest from 'supertest';
import mongoose from 'mongoose';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {Executive,ExecutiveEvent,Agent,Transaction,ReportingPeriod,Cluster} from '../models/index.js';
import {workspaceRouter} from '../routes/workspace.js';
import {peopleRouter} from '../routes/people.js';

// Isolated disposable database; never creates test people in the working dashboard.
const uri=new URL(process.env.MONGODB_URI);
const database=`salesdashboard_people_test_${Date.now()}`;uri.pathname=`/${database}`;
await connectDatabase(uri.toString());
try{
  await Promise.all([Executive.createIndexes(),Agent.createIndexes(),Transaction.createIndexes()]);
  const cluster=await Cluster.create({clusterId:'TEST-CLUSTER',name:'Lagos East 1',zone:'Lagos East'});
  await ReportingPeriod.create({month:'2026-09',asOf:'2026-09-14',sourceLabel:'Test',sourceSha256:'a'.repeat(64),approvedCount:1,approvedValueKobo:10000});
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.account={role:req.get('x-test-role')||'ANALYST',region:req.get('x-test-region')||'ALL',email:'test@local.invalid'};next();});app.use('/people',peopleRouter);app.use('/workspace',workspaceRouter);
  app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.message}));
  const create=await supertest(app).post('/workspace/executives').send({region:'LAG',name:'Test Sales Agent',joinedOn:'2026-09-01',clusterId:String(cluster._id)});
  assert.equal(create.status,201,JSON.stringify(create.body));
  const id=create.body.executiveId,executive=await Executive.findOne({executiveId:id}).lean(),agent=await Agent.findOne({agentId:executive.agentId}).lean();
  assert(agent);assert.equal(agent.currentStatus,'ACTIVE');
  await Transaction.create({sourceSystem:'TEST',transactionId:'sale-1',businessDate:'2026-09-14',region:'LAG',agent:agent._id,cluster:cluster._id,valueKobo:10000,sourceAgentName:'Test Sales Agent',sourceZone:'Lagos East',sourceRow:new mongoose.Types.ObjectId(),status:'ACCEPTED_BASELINE'});
  const update=await supertest(app).patch(`/workspace/executives/${id}`).send({region:'LAG',status:'RESIGNED',effectiveDate:'2026-09-14',reason:'Resigned'});assert.equal(update.status,200,JSON.stringify(update.body));
  assert.equal((await Agent.findById(agent._id)).currentStatus,'RESIGNED');assert.equal(await Transaction.countDocuments(),1);assert.equal(await ExecutiveEvent.countDocuments({executiveId:id}),2);
  const detail=await supertest(app).get('/people').query({region:'LAG',executiveId:id,from:'2026-09-01',asOf:'2026-09-14'});assert.equal(detail.status,200);assert.equal(detail.body.person.status,'RESIGNED');assert.equal(detail.body.person.value,100);assert.equal(detail.body.person.count,1);assert.equal(detail.body.events.length,2);
  const duplicate=await supertest(app).post('/workspace/executives').send({region:'LAG',name:'Test Sales Agent',joinedOn:'2026-09-01'});assert.equal(duplicate.status,409);
  const backdate=await supertest(app).patch(`/workspace/executives/${id}`).send({region:'LAG',status:'ACTIVE',effectiveDate:'2026-09-02',reason:'Invalid backdate'});assert.equal(backdate.status,400);
  const forbidden=await supertest(app).get('/people?region=LAG').set('x-test-role','RBM').set('x-test-region','NOR');assert.equal(forbidden.status,403);
  const forbiddenAll=await supertest(app).get('/people?region=ALL').set('x-test-role','RBM').set('x-test-region','NOR');assert.equal(forbiddenAll.status,403);
  const forbiddenWrite=await supertest(app).patch(`/workspace/executives/${id}`).set('x-test-role','RBM').set('x-test-region','NOR').send({region:'LAG',status:'ACTIVE',effectiveDate:'2026-09-14',reason:'Denied'});assert.equal(forbiddenWrite.status,403);
  const hidden=await supertest(app).get('/people').query({region:'NOR',executiveId:id});assert.equal(hidden.status,404);
  const reactivate=await supertest(app).patch(`/workspace/executives/${id}`).send({region:'LAG',status:'ACTIVE',effectiveDate:'2026-09-14',reason:'Returned to team'});assert.equal(reactivate.status,200,JSON.stringify(reactivate.body));
  const restored=await Agent.findById(agent._id);assert.equal(restored.currentStatus,'ACTIVE');assert.equal(restored.exitDate,null);assert.equal(await Transaction.countDocuments(),1);
  console.log('Passed: add linked agent, resign, retain sales, audit history, duplicate prevention, date validation and regional read/write access.');
}finally{
  if(mongoose.connection.name===database)await mongoose.connection.dropDatabase();
  await disconnectDatabase();
}
