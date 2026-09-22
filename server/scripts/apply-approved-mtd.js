// One-time, explicitly approved September 1–15 workbook reconciliation.
// Preview by default. --apply commits only the two renewals and approved ACTIVE policy.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import {Transaction,Upload,UploadRow,User,Agent,Cluster,ReportingPeriod,RegionalReportingPeriod} from '../models/index.js';
const source=process.argv[2];if(!source)throw Error('Supply the reviewed workbook path');
const bytes=await readFile(source),hash=createHash('sha256').update(bytes).digest('hex');
const book=await new ExcelJS.Workbook().xlsx.load(bytes),sheet=book.getWorksheet('RENEWAL');
assert.ok(sheet,'Renewal worksheet missing');const headers=sheet.getRow(1).values,renewals=[];
sheet.eachRow((r,n)=>{if(n===1)return;const get=k=>r.getCell(headers.indexOf(k)).text.trim();const serial=get('S/N');if(!serial)return;renewals.push({sheet:'RENEWAL',row:n,id:`RENEWAL-${serial}`,agent:get("Sales Rep (If your name is not listed below, select 'Others')"),valueKobo:Math.round(Number(get('Sentinel Price (Confirm price before inputing)'))*100),timestamp:r.getCell(headers.indexOf('Timestamp')).value.toISOString(),state:get('STATE'),device:get('Device Name and Spec (Type in full e.g Samsung A05 4+128Gb)'),plan:get('Sentinel Package')});});
assert.equal(renewals.length,2);assert.equal(renewals.reduce((s,r)=>s+r.valueKobo,0),23940000);
const activeId='a280d286-d5bb-4b58-bdee-d46e34e18e7f';
let activeSource;
for(const s of book.worksheets){const h=s.getRow(1).values;if(!h.includes('Policy ID'))continue;s.eachRow((r,n)=>{const get=k=>r.getCell(h.indexOf(k)).text.trim();if(get('Policy ID')===activeId)activeSource={sheet:s.name,row:n,policyId:activeId,status:get('Payment Status'),valueKobo:Number(get('Premium'))*100};});}
assert.ok(activeSource);assert.equal(activeSource.valueKobo,600000);assert.equal(activeSource.status.toUpperCase(),'ACTIVE');
const uploadId=`APPROVED-MTD-${hash.slice(0,16)}`,oid=s=>new mongoose.Types.ObjectId(createHash('sha256').update(s).digest('hex').slice(0,24));
const expected={LAG:[288,816210000],NOR:[113,273385000],SSE:[325,667870000]};
await mongoose.connect(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:10000});
try {
 const active=await Transaction.findOne({sourceSystem:'DEVPRO',transactionId:activeId}).lean();assert.equal(active?.region,'LAG');assert.equal(active.valueKobo,600000);
 const periods=[await ReportingPeriod.findOne({month:'2026-09'}).lean(),...await RegionalReportingPeriod.find({month:'2026-09'}).lean()];assert.equal(periods.length,3);
 if(await Upload.exists({uploadId,status:'COMPLETED'})){console.log('Already applied; no changes.');}
 else {
  assert.equal(active.status,'PENDING');
  assert.equal(await Transaction.countDocuments({transactionId:{$in:renewals.map(r=>r.id)}}),0);
  const agents=await Agent.find().lean(),clusters=await Cluster.find().lean(),norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const uploader=await User.findOne({email:'baseline-importer@local.invalid'}).lean();assert.ok(uploader);
  const note='User approved all daily-sheet sales, including unresolved attribution, ACTIVE policy and renewals; August 28 source timestamp retained as September 3 reporting exception. Approved MTD: 726 / NGN 17,574,650. No September 16 sales supplied.';
  const uploadObject=oid(uploadId);
  const docs=renewals.map(r=>{const matches=agents.filter(a=>norm(a.fullName)===norm(r.agent));const agent=matches.length===1?matches[0]:null;const cluster=agent&&clusters.find(c=>String(c._id)===String(agent.currentCluster));return {_id:oid(r.id),sourceSystem:'DEVPRO_RENEWAL',transactionId:r.id,region:'LAG',businessDate:r.timestamp.slice(0,10),sourceTimestamp:r.timestamp,valueKobo:r.valueKobo,status:'ACCEPTED_BASELINE',sourceRow:oid(`${uploadId}:${r.row}`),sourceAgentName:r.agent,sourceState:r.state,sourceZone:cluster?.zone||'Unmapped',sourceCluster:cluster?.name,agent:agent?._id,cluster:cluster?._id,device:r.device,rawPlan:r.plan,plan:r.plan,identityMethod:'POLICY_ID'};});
  for(const d of docs)await new Transaction(d).validate();
  console.log(JSON.stringify({newRenewals:2,renewalNaira:239400,approvedActiveNaira:6000,expected}));
  if(!process.argv.includes('--apply')){console.log('Preview only');}
  else {
   await mkdir('.local/backups',{recursive:true});await writeFile(`.local/backups/${uploadId}.json`,JSON.stringify({active,periods},null,2),{mode:0o600});
   const storageKey=`.local/backups/${uploadId}.xlsx`;await copyFile(source,storageKey);
   await mongoose.connection.transaction(async session=>{
    await Upload.create([{_id:uploadObject,uploadId,type:'SALES',sourceSystem:'DEVPRO',filename:source.split('/').at(-1),fileSha256:hash,storageKey,uploadedBy:uploader._id,approvedBy:uploader._id,approvedAt:new Date(),reportingDate:'2026-09-15',status:'COMPLETED',mappingVersion:'approved-mtd-renewals-v1',recordCount:3,acceptedCount:3,flaggedCount:3}],{session});
    await UploadRow.insertMany([...renewals.map((r,i)=>({_id:docs[i].sourceRow,upload:uploadObject,sheet:r.sheet,rowNumber:r.row,raw:r,normalized:r,status:'IMPORTED',transaction:docs[i]._id,issues:[{code:'USER_APPROVED_RENEWAL',message:note,severity:'WARNING'}]})),{_id:oid(`${uploadId}:active`),upload:uploadObject,sheet:activeSource.sheet,rowNumber:activeSource.row,raw:activeSource,normalized:activeSource,status:'IMPORTED',transaction:active._id,issues:[{code:'USER_APPROVED_ACTIVE',message:note,severity:'WARNING'}]}],{session});
    await Transaction.insertMany(docs,{session});
    const update=await Transaction.updateOne({_id:active._id,status:'PENDING',updatedAt:active.updatedAt},{$set:{status:'ACCEPTED_BASELINE',latestSourceRow:oid(`${uploadId}:active`)}},{session,runValidators:true});assert.equal(update.modifiedCount,1);
    for(const p of periods){const region=p.region||'LAG';const [totals]=await Transaction.aggregate([{$match:{region,businessDate:{$gte:'2026-09-01',$lte:'2026-09-15'},status:{$in:['VALID','ACCEPTED_BASELINE']}}},{$group:{_id:null,count:{$sum:1},value:{$sum:'$valueKobo'}}}]).session(session);assert.deepEqual([totals.count,totals.value],expected[region]);const model=region==='LAG'?ReportingPeriod:RegionalReportingPeriod;const result=await model.updateOne({_id:p._id,updatedAt:p.updatedAt},{$set:{approvedCount:totals.count,approvedValueKobo:totals.value},$addToSet:{notes:note}},{session,runValidators:true});assert.equal(result.modifiedCount,1);}
   });console.log('Committed atomically; approved regional totals matched.');
  }
 }
 for(const region of Object.keys(expected)){const [t]=await Transaction.aggregate([{$match:{region,businessDate:{$gte:'2026-09-01',$lte:'2026-09-15'},status:{$in:['VALID','ACCEPTED_BASELINE']}}},{$group:{_id:null,count:{$sum:1},value:{$sum:'$valueKobo'}}}]);if(process.argv.includes('--apply'))assert.deepEqual([t.count,t.value],expected[region]);console.log(JSON.stringify({region,count:t.count,valueNaira:t.value/100}));}
}finally{await mongoose.disconnect();}
