import assert from 'node:assert/strict';
import express from 'express';
import supertest from 'supertest';
import mongoose from 'mongoose';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {ReconciliationCase} from '../models/index.js';
import {reconciliationRouter} from '../routes/reconciliation.js';

const uri=new URL(process.env.MONGODB_URI),database=`salesdashboard_reconciliation_test_${Date.now()}`;
uri.pathname=`/${database}`;await connectDatabase(uri.toString());
try{
  await ReconciliationCase.createIndexes();
  const example={caseKey:'test-lagos',region:'LAG',policyId:'policy-1',businessDate:'2026-09-14',agentName:'Test executive',valueKobo:900000,sourceFile:'Test.xlsx',sheet:'14TH',rowNumber:2,treatment:'HELD',issues:[{code:'PAYMENT_STATUS',message:'ACTIVE payment',nextStep:'Confirm payment'}]};
  const lagos=await ReconciliationCase.create(example);
  await ReconciliationCase.create({...example,caseKey:'test-north',region:'NOR'});
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.account={role:req.get('x-test-role')||'ANALYST',region:req.get('x-test-region')||'ALL',name:'Test reviewer'};next();});app.use('/reconciliation',reconciliationRouter);app.use((err,req,res,next)=>res.status(500).json({error:err.message}));
  let result=await supertest(app).get('/reconciliation?region=ALL');assert.equal(result.status,200);assert.equal(result.body.cases.length,2);assert.equal(result.body.cases[0].valueKobo,900000);assert.equal(result.body.cases[0].caseKey,undefined);
  result=await supertest(app).get('/reconciliation?region=NOR').set('x-test-role','RBM').set('x-test-region','NOR');assert.equal(result.body.cases.length,1);assert.equal(result.body.cases[0].region,'NOR');
  for(const region of ['ALL','LAG'])assert.equal((await supertest(app).get(`/reconciliation?region=${region}`).set('x-test-role','RBM').set('x-test-region','NOR')).status,403);
  const path=`/reconciliation/${lagos._id}`;
  assert.equal((await supertest(app).patch(path).set('x-test-role','RBM').set('x-test-region','NOR').send({status:'IN_REVIEW',version:0,note:'Check payment receipt'})).status,404);
  assert.equal((await supertest(app).patch(path).send({status:'RESOLVED',version:0,note:''})).status,400);
  assert.equal((await supertest(app).patch(path).send({status:'IN_REVIEW',version:0,note:'Check payment receipt'})).status,200);
  assert.equal((await supertest(app).patch(path).send({status:'RESOLVED',version:0,note:'Stale update must fail'})).status,409);
  const saved=await ReconciliationCase.findById(lagos._id).lean();assert.equal(saved.status,'IN_REVIEW');assert.equal(saved.treatment,'HELD');assert.equal(saved.valueKobo,900000);assert.equal(saved.history.length,1);assert.equal(saved.history[0].actor,'Test reviewer');
  console.log('PASS reconciliation list, region isolation, required notes, optimistic concurrency, review audit and unchanged sales treatment.');
}finally{if(mongoose.connection.name===database)await mongoose.connection.dropDatabase();await disconnectDatabase();}
