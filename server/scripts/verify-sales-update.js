import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import express from 'express';
import supertest from 'supertest';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {Transaction,ReportingPeriod,RegionalReportingPeriod} from '../models/index.js';
import {dashboardRouter} from '../routes/dashboard.js';
import {workspaceRouter} from '../routes/workspace.js';

const path=process.argv[2];if(!path)throw new Error('Provide the saved import report');
const report=JSON.parse(await readFile(path));
await connectDatabase();
try{
  const accepted=report.rows.filter(r=>r.disposition==='ACCEPTED');
  const imported=await Transaction.find({transactionId:{$in:accepted.map(r=>r.transactionId)},sourceSystem:'DEVPRO'}).lean();
  assert.equal(imported.length,accepted.length);
  for(const row of accepted){const found=imported.find(t=>t.transactionId===row.transactionId);assert.equal(found.valueKobo,row.valueKobo);assert.equal(found.businessDate,row.businessDate);assert.equal(found.region,row.region);assert.equal(found.sourceZone,row.sourceZone);}
  assert.equal(await Transaction.countDocuments({sourceSystem:'DEVPRO',transactionId:{$in:report.rows.filter(r=>r.disposition==='HELD').map(r=>r.transactionId)}}),0);
  const app=express();app.use((req,_res,next)=>{req.account={role:'ANALYST',region:'ALL'};next();});app.use('/dashboard',dashboardRouter);app.use('/workspace',workspaceRouter);
  const results=[];
  for(const region of ['LAG','NOR','SSE']){
    const response=await supertest(app).get(`/dashboard?region=${region}`);assert.equal(response.status,200,JSON.stringify(response.body));
    const d=response.body,previous=report.previous.find(r=>r._id===region),added=report.byRegion.find(r=>r.name===region)||{count:0,valueKobo:0};
    assert.equal(d.filters.asOf,report.through);
    assert.equal(d.summary.count,previous.count+added.count);
    assert.equal(Math.round(d.summary.value*100),previous.valueKobo+added.valueKobo);
    for(const key of ['zones','clusters','agents']){
      assert.equal(d[key].reduce((s,r)=>s+r.count,0),d.summary.count,`${region} ${key} counts`);
      assert.equal(Math.round(d[key].reduce((s,r)=>s+r.value,0)*100),Math.round(d.summary.value*100),`${region} ${key} values`);
    }
    assert.equal(d.transactions.length,d.summary.count);
    assert.equal(d.quality.approvedBaselineCount,d.summary.count);
    assert.equal(d.quality.approvedBaselineValue,d.summary.value);
    const historical=(await supertest(app).get(`/dashboard?region=${region}&asOf=2026-09-11`)).body;
    for(const key of ['zones','clusters','agents']){
      assert.equal(historical[key].reduce((s,r)=>s+r.count,0),historical.summary.count,`${region} historical ${key} counts`);
      assert.equal(Math.round(historical[key].reduce((s,r)=>s+r.value,0)*100),Math.round(historical.summary.value*100),`${region} historical ${key} values`);
    }
    const range=(await supertest(app).get(`/dashboard?region=${region}&from=${report.through}&asOf=${report.through}`)).body;
    assert.equal(range.summary.count,added.count);assert.equal(Math.round(range.summary.value*100),added.valueKobo);
    for(const zone of d.zones){const scoped=await supertest(app).get('/dashboard').query({region,zone:zone.name,asOf:report.through});assert.equal(scoped.status,200);assert.equal(scoped.body.summary.count,zone.count);assert.equal(scoped.body.summary.value,zone.value);}
    results.push({region,asOf:d.period.asOf,added:{count:added.count,value:added.valueKobo/100},total:{count:d.summary.count,value:d.summary.value},zones:d.zones.map(({name,count,value})=>({name,count,value})),clusters:d.clusters});
  }
  const workspace=await supertest(app).get('/workspace/regions');assert.equal(workspace.status,200);
  for(const region of results){const r=workspace.body.regions.find(r=>r.regionId===region.region);assert.equal(r.salesCount,region.total.count);assert.equal(r.salesValue,region.total.value);assert.equal(r.reportingAsOf,report.through);}
  const receipt={source:report.source,through:report.through,checks:['Imported policy IDs, integer-kobo amounts, dates and regions match the reviewed source','Held policy IDs excluded','Historical September 1–11 dashboard totals reconcile across zones, clusters and agents','Each region reconciles across zones, clusters, agents and transactions','Each zone/state filter reconciles',`${report.through} daily range reconciles`,'Workspace totals and reporting dates match dashboard'],results,held:report.held};
  await writeFile(path.replace('.json','-verified.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
}finally{await disconnectDatabase();}
