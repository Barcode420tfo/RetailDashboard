import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseDailyRefresh,sourceDate,matchExisting,mapDailyRow} from '../server/services/daily-refresh.js';

test('latest source dates move existing sales, while a different month remains visibly provisional',()=>{
  assert.deepEqual(sourceDate('2026-09-12T18:26:13.432Z','2026-09-12'),{businessDate:'2026-09-12',issues:[]});
  const sunday=sourceDate('2026-09-13T10:15:34.001Z','2026-09-14');
  assert.equal(sunday.businessDate,'2026-09-13');assert.equal(sunday.issues[0].code,'DATE_CONFLICT');
  const august=sourceDate('2026-08-28T18:57:10.496Z','2026-09-03');
  assert.equal(august.businessDate,'2026-09-03');assert.match(august.issues[0].message,/provisionally/);
  assert.equal(sourceDate('Sep 02, 2026, 09:52 PM','2026-09-02').businessDate,'2026-09-02');
  assert.throws(()=>sourceDate('unparseable','2026-09-02'));
});
test('fingerprint migration requires an exact unique match; policy ID wins across changed dates',()=>{
  const row={policyId:'new-policy',valueKobo:900000,sourceTimestamp:'2026-09-05T10:00:00Z',businessDate:'2026-09-05',sourceAgentName:'Agent One',sourceStoreName:'Store One'};
  const old={...row,transactionId:'FP:old',identityMethod:'FINGERPRINT'};
  assert.equal(matchExisting(row,[old]),old);
  assert.equal(matchExisting({...row,valueKobo:600000},[old]),undefined);
  assert.equal(matchExisting({...row,sourceStoreName:'Different'},[old]),undefined);
  assert.throws(()=>matchExisting(row,[old,{...old,transactionId:'FP:duplicate'}]),/Ambiguous/);
  const policy={transactionId:'new-policy',businessDate:'2026-09-15'};
  assert.equal(matchExisting(row,[policy,old]),policy);
});
test('parser holds non-success payments and rejects repeated policy IDs',async()=>{
  const b=new ExcelJS.Workbook(),s=b.addWorksheet('12TH');
  s.addRow(['Policy ID','Premium','Payment Amount','Sales Date','Payment Status','MBE Name','Store Name','State','Cluster']);
  s.addRow(['one',6000,6000,'2026-09-12T12:00:00Z','ACTIVE','Anyika','Store','Lagos Central','Lagos Central 1']);
  s.addRow(['two',12000,12000,'2026-09-12T12:01:00Z','SUCCESS','Anyika','Store','Lagos Central','Lagos Central 1']);
  let rows=await parseDailyRefresh(await b.xlsx.writeBuffer());
  assert.equal(rows[0].treatment,'HELD');assert.equal(rows[1].treatment,'INCLUDED');assert.equal(rows[1].valueKobo,1200000);assert.equal(rows[1].region,'LAG');
  s.addRow(['one',6000,6000,'2026-09-12T12:00:00Z','SUCCESS','Anyika','Store','Lagos Central','Lagos Central 1']);
  await assert.rejects(()=>b.xlsx.writeBuffer().then(parseDailyRefresh),/Duplicate policy IDs/);
});
test('source cluster conflicts are visible and regional spelling variants reconcile',()=>{
  const context={agents:[{_id:'a',fullName:'Ogbonna Ifeoma Joy',currentCluster:'central'}],clusters:[{_id:'central',name:'Lagos Central 2',zone:'Lagos Central'},{_id:'east',name:'Lagos East 1',zone:'Lagos East'}],executives:[]};
  const row={region:'LAG',sourceAgentName:'Ogbonna Ifeoma Joy',sourceStoreName:'Store',sourceCluster:'Lagos Mainland 1',sourceZone:'Lagos East',issues:[],kind:'SALE'};
  const mapped=mapDailyRow(row,context);
  assert.equal(mapped.cluster,'east');assert(mapped.issues.some(i=>i.code==='CLUSTER_CONFLICT'));
  for(const [zone,cluster,expected] of [['Imo','Imo','Imo Cluster'],['Ondo','Southwest 1','South West 1']])assert.equal(mapDailyRow({...row,region:'SSE',sourceZone:zone,sourceCluster:cluster},{agents:[],clusters:[],executives:[]}).clusterName,expected);
});
