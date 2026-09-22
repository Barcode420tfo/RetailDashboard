import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import mongoose from 'mongoose';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {Agent,Cluster,Executive,Transaction,Upload,UploadRow,User,ReportingPeriod,RegionalReportingPeriod,ReconciliationCase,AuditLog} from '../models/index.js';
import {parseDailyRefresh,mapDailyRow,matchExisting,issue} from '../services/daily-refresh.js';

const source=process.argv[2],apply=process.argv.includes('--apply');
if(!source)throw new Error('Supply the reviewed September 1–14 daily workbook. Default is preview only.');
const bytes=await readFile(source),hash=createHash('sha256').update(bytes).digest('hex');
const parsed=await parseDailyRefresh(bytes),filename=basename(source);
const oid=key=>new mongoose.Types.ObjectId(createHash('sha256').update(key).digest('hex').slice(0,24));
const uploadId=`DAILY-REFRESH-${hash.slice(0,16)}`,batchId=oid(uploadId);
const totals=rows=>({count:rows.length,valueKobo:rows.reduce((n,r)=>n+r.valueKobo,0)});
await connectDatabase();
try{
  if(await Upload.exists({uploadId,status:'COMPLETED'})){console.log('This exact refresh is already complete. No changes.');}
  else{
    const [agents,clusters,executives,existing,lagos,regional,uploader,oldHeld]=await Promise.all([
      Agent.find().lean(),Cluster.find().lean(),Executive.find().lean(),
      Transaction.find({sourceSystem:'DEVPRO',businessDate:{$gte:'2026-09-01',$lte:'2026-09-14'}}).lean(),
      ReportingPeriod.findOne({month:'2026-09'}).lean(),RegionalReportingPeriod.find({month:'2026-09'}).lean(),
      User.findOne({email:'baseline-importer@local.invalid'}).lean(),
      UploadRow.find({status:'FLAGGED','normalized.disposition':'HELD'}).populate('upload','filename').lean(),
    ]);
    if(!lagos||regional.length!==2||!uploader)throw new Error('Required reporting periods or import identity missing.');
    const used=new Set(),entries=[],cases=[];
    for(const sourceRow of parsed){
      const old=sourceRow.policyId?matchExisting(sourceRow,existing):null;
      if(old&&used.has(String(old._id)))throw new Error('More than one source row matched the same existing sale.');
      if(old)used.add(String(old._id));
      const row=mapDailyRow(sourceRow,{agents,clusters,executives},old);
      if(old&&old.valueKobo!==row.valueKobo){row.treatment='HELD';row.issues.push(issue('AMOUNT_CONFLICT',`Previous amount ₦${old.valueKobo/100}; new amount ₦${row.valueKobo/100}.`,'Verify the settled amount before restoring this transaction.'));}
      const sourceRowId=oid(`${uploadId}:${row.sheet}:${row.sourceRow}`);
      const id=old?._id||(row.kind==='SALE'?oid(`DEVPRO:${row.policyId}`):null);
      const transaction=row.kind==='SALE'?{...(old||{}),_id:id,region:row.region==='UNKNOWN'?'LAG':row.region,sourceSystem:'DEVPRO',transactionId:row.policyId,businessDate:row.businessDate,valueKobo:row.valueKobo,sourceTimestamp:row.sourceTimestamp,identityMethod:'POLICY_ID',sourceAgentName:row.sourceAgentName,sourceStoreName:row.sourceStoreName,sourceCluster:row.sourceCluster,sourceState:row.sourceState,sourceZone:row.sourceZone,agent:row.agent||null,cluster:row.cluster||null,device:row.device,rawPlan:row.rawPlan,plan:['SLD','SAP','ESSENTIAL'].includes(row.rawPlan.toUpperCase())?row.rawPlan.toUpperCase():'UNCLASSIFIED',brand:old?.brand||(/samsung/i.test(row.device)?'Samsung':/infinix/i.test(row.device)?'Infinix':/xiaomi|redmi/i.test(row.device)?'Xiaomi / Redmi':/tecno/i.test(row.device)?'Tecno':/itel/i.test(row.device)?'Itel':/oppo/i.test(row.device)?'Oppo':/honor/i.test(row.device)?'Honor':'Other'),status:row.treatment==='INCLUDED'?'ACCEPTED_BASELINE':'PENDING',sourceRow:old?.sourceRow||sourceRowId,latestSourceRow:sourceRowId}:null;
      // An unknown region is a staged row only, never guessed into a regional transaction.
      const tx=row.region==='UNKNOWN'?null:transaction;
      if(tx)await new Transaction(tx).validate();
      entries.push({row,original:sourceRow,old,transaction:tx,sourceRowId});
      if(row.issues.length)cases.push({caseKey:row.policyId?`DEVPRO:${row.policyId}`:`${uploadId}:${row.sheet}:${row.sourceRow}`,region:row.region,transaction:tx?._id,sourceRow:sourceRowId,policyId:row.policyId||undefined,businessDate:row.businessDate,sheetDate:row.sheetDate,sourceTimestamp:row.sourceTimestamp,agentName:row.sourceAgentName,storeName:row.sourceStoreName,zone:row.sourceZone,clusterName:row.clusterName,valueKobo:row.valueKobo,paymentStatus:row.paymentStatus,sourceFile:filename,sheet:row.sheet,rowNumber:row.sourceRow,treatment:row.treatment,status:'OPEN',issues:row.issues,previous:old?{businessDate:old.businessDate,sourceTimestamp:old.sourceTimestamp,policyId:old.transactionId,valueKobo:old.valueKobo,zone:old.sourceZone,cluster:clusters.find(c=>String(c._id)===String(old.cluster))?.name,agentName:old.sourceAgentName}:undefined});
    }
    const missing=existing.filter(t=>!used.has(String(t._id))&&['VALID','ACCEPTED_BASELINE'].includes(t.status));
    for(const old of missing){
      const original=await UploadRow.findById(old.latestSourceRow||old.sourceRow).populate('upload','filename').lean();
      cases.push({caseKey:`DEVPRO:${old.transactionId}`,region:old.region,transaction:old._id,sourceRow:original?._id,policyId:old.transactionId,businessDate:old.businessDate,sourceTimestamp:old.sourceTimestamp,agentName:old.sourceAgentName,storeName:old.sourceStoreName,zone:old.sourceZone,clusterName:clusters.find(c=>String(c._id)===String(old.cluster))?.name||'Unmapped',valueKobo:old.valueKobo,paymentStatus:'PREVIOUSLY_ACCEPTED',sourceFile:original?.upload?.filename||'Previous import',sheet:original?.sheet||'Unknown',rowNumber:original?.rowNumber||1,treatment:'HELD',status:'OPEN',issues:[issue('MISSING_FROM_REPLACEMENT',`Previously counted sale is absent from ${filename}. Retained for review and excluded from the replacement totals.`,'Confirm whether this is a valid omitted sale or a cancelled record; retain the original evidence.')],previous:{status:old.status,businessDate:old.businessDate,valueKobo:old.valueKobo}});
    }
    const newIds=new Set(parsed.map(r=>r.policyId).filter(Boolean));
    for(const held of oldHeld){
      const r=held.normalized;
      if(newIds.has(r.transactionId)||existing.some(t=>t.transactionId===r.transactionId))continue;
      cases.push({caseKey:`DEVPRO:${r.transactionId}`,region:r.region||'UNKNOWN',sourceRow:held._id,policyId:r.transactionId,businessDate:r.businessDate,sourceTimestamp:r.sourceTimestamp,agentName:r.sourceAgentName,storeName:r.sourceStoreName,valueKobo:r.valueKobo,paymentStatus:r.paymentStatus,sourceFile:held.upload.filename,sheet:held.sheet,rowNumber:held.rowNumber,treatment:'HELD',status:'OPEN',issues:[issue('PREVIOUS_HOLD_UNRESOLVED','Previously held record is absent from the replacement workbook and still lacks confirmed attribution.','Confirm payment, region, agent and whether this record belongs in the reporting period.')]});
    }
    const included=entries.filter(e=>e.row.treatment==='INCLUDED').map(e=>e.row);
    const report={source:filename,sha256:hash,dateRule:'Use latest recorded calendar date within September 1–14. Out-of-period timestamp on a September sheet remains provisionally counted on the worksheet date with an open date issue. Renewals/non-SUCCESS are held.',before:totals(existing.filter(t=>['VALID','ACCEPTED_BASELINE'].includes(t.status))),after:totals(included),matched:entries.filter(e=>e.old).length,policyIdsRepaired:entries.filter(e=>e.old?.identityMethod==='FINGERPRINT').length,added:totals(entries.filter(e=>!e.old&&e.row.treatment==='INCLUDED').map(e=>e.row)),removedFromTotals:totals(missing),byRegion:['LAG','NOR','SSE'].map(region=>({region,...totals(included.filter(r=>r.region===region))})),byZone:[...new Set(included.map(r=>r.sourceZone))].sort().map(zone=>({zone,...totals(included.filter(r=>r.sourceZone===zone))})),byCluster:[...new Set(included.map(r=>`${r.region}:${r.clusterName}`))].sort().map(cluster=>({cluster,...totals(included.filter(r=>`${r.region}:${r.clusterName}`===cluster))})),cases:{count:cases.length,included:totals(cases.filter(c=>c.treatment==='INCLUDED')),held:totals(cases.filter(c=>c.treatment==='HELD')),issues:[...new Set(cases.flatMap(c=>c.issues.map(i=>i.code)))].map(code=>({code,count:cases.filter(c=>c.issues.some(i=>i.code===code)).length}))}};
    await mkdir('data/reports',{recursive:true});
    await writeFile(`data/reports/daily-refresh-${hash.slice(0,12)}.json`,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
    if(!apply)console.log('Preview only. Dashboard unchanged.');
    else{
      await mkdir('.local/source-data/daily-refresh',{recursive:true});
      const storageKey=`.local/source-data/daily-refresh/${hash}.xlsx`;
      await copyFile(source,storageKey);
      await writeFile(`.local/source-data/daily-refresh/${hash}-before.json`,JSON.stringify({transactions:existing,periods:[lagos,...regional]},null,2),{mode:0o600,flag:'wx'});
      await ReconciliationCase.createIndexes();
      await mongoose.connection.transaction(async session=>{
        await Upload.create([{_id:batchId,uploadId,type:'SALES',sourceSystem:'DEVPRO',filename,fileSha256:hash,storageKey,uploadedBy:uploader._id,reportingDate:'2026-09-14',status:'COMPLETED',mappingVersion:'daily-refresh-v1',recordCount:parsed.length,acceptedCount:included.length,flaggedCount:cases.length,approvedBy:uploader._id,approvedAt:new Date()}],{session});
        await UploadRow.insertMany(entries.map(({row,original,transaction,sourceRowId})=>({_id:sourceRowId,upload:batchId,sheet:row.sheet,rowNumber:row.sourceRow,raw:original,normalized:row,status:row.treatment==='INCLUDED'?'IMPORTED':'FLAGGED',transaction:transaction?._id,issues:row.issues.map(i=>({code:i.code,message:i.message,severity:'WARNING'}))})),{session});
        for(const {old,transaction:tx} of entries){
          if(!tx)continue;
          if(old){
            const {_id,createdAt,updatedAt,__v,...fields}=tx;
            // Preserve document identity and original sourceRow. Only the 1:1 verified
            // fingerprint migrations change immutable external IDs; validate above first.
            const result=await Transaction.collection.updateOne({_id:old._id,updatedAt:old.updatedAt,transactionId:old.transactionId},{$set:{...fields,updatedAt:new Date()},$inc:{__v:1}},{session});
            if(result.matchedCount!==1)throw new Error('Transaction changed during refresh. Retry after review.');
          }else await Transaction.create([tx],{session});
          await AuditLog.create([{actor:uploader._id,action:'REFRESH_DAILY_SOURCE',entityType:'TRANSACTION',entityId:tx._id,before:old||{},after:tx,reason:`User approved replacement source ${filename}; matched identity, no duplicate addition.`}],{session});
        }
        for(const old of missing){
          const result=await Transaction.updateOne({_id:old._id,updatedAt:old.updatedAt},{$set:{status:'PENDING'}},{session,runValidators:true});
          if(result.modifiedCount!==1)throw new Error('Missing-source record changed concurrently.');
          await AuditLog.create([{actor:uploader._id,action:'HOLD_MISSING_SOURCE',entityType:'TRANSACTION',entityId:old._id,before:old,after:{status:'PENDING'},reason:`Absent from approved replacement ${filename}; retained in reconciliation.`}],{session});
        }
        for(const c of cases)await ReconciliationCase.updateOne({caseKey:c.caseKey},{$setOnInsert:{...c,history:[]}},{upsert:true,session,runValidators:true});
        for(const held of oldHeld){
          const entry=entries.find(e=>e.row.policyId===held.normalized.transactionId);
          if(entry)await UploadRow.updateOne({_id:held._id},{$set:{status:'DUPLICATE',transaction:entry.transaction?._id,issues:[{code:'SUPERSEDED_SOURCE',message:`Superseded by ${filename}; see latest source row and reconciliation.`,severity:'WARNING'}]}},{session});
        }
        for(const period of [lagos,...regional]){
          const region=period.region||'LAG',model=region==='LAG'?ReportingPeriod:RegionalReportingPeriod;
          const current=await Transaction.find({region,businessDate:{$gte:'2026-09-01',$lte:'2026-09-14'},status:{$in:['VALID','ACCEPTED_BASELINE']}}).session(session).lean();
          const expected=totals(included.filter(r=>r.region===region)),actual=totals(current);
          if(actual.count!==expected.count||actual.valueKobo!==expected.valueKobo)throw new Error(`Region ${region} does not reconcile to replacement source.`);
          const notes=[`Reporting source replaced with ${filename}. Each policy counted once; 48 existing fingerprint records now carry policy IDs.`,report.dateRule,'September 6 has no worksheet; September 9 is partial. No standalone September 13 worksheet; only recorded sales are shown.',`Reconciliation contains ${cases.filter(c=>c.region===region).length} regional records with issues. INCLUDED entries remain in sales; HELD entries are excluded.`,...(region==='LAG'?['₦195,000 on September 3 is provisionally included despite an August 28 timestamp. Larry Store ₦21,000 is held because it is missing from the replacement.']:[])];
          const result=await model.updateOne({_id:period._id,updatedAt:period.updatedAt},{$set:{asOf:'2026-09-14',availableDates:[...new Set(current.map(r=>r.businessDate))].sort(),approvedCount:actual.count,approvedValueKobo:actual.valueKobo,sourceLabel:filename,sourceSha256:hash,notes}},{session,runValidators:true});
          if(result.modifiedCount!==1)throw new Error('Reporting period changed concurrently.');
        }
      });
      console.log('Committed: replacement sales, original audit evidence, reporting totals and reconciliation queue.');
    }
  }
}finally{await disconnectDatabase();}
