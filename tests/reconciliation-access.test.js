import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import supertest from 'supertest';
import {reconciliationRouter} from '../server/routes/reconciliation.js';

test('reconciliation warnings and notes are private to the workspace owner',async()=>{
  const app=express();
  app.use((req,res,next)=>{req.account={email:'other.analyst@example.com',role:'ANALYST',region:'LAG'};next();});
  app.use('/reconciliation',reconciliationRouter);
  const response=await supertest(app).get('/reconciliation?region=LAG');
  assert.equal(response.status,403);
  assert.match(response.body.error,/private to the workspace owner/i);
});
