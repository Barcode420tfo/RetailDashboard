import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {Agent,Cluster,Store,Transaction,Upload,UploadRow,User,ReportingPeriod,RegionalReportingPeriod} from '../models/index.js';
import {parseSalesWorkbook,normalizeName,agentMatchesName} from '../services/sales-workbook.js';
import {resolveCluster} from '../services/cluster-aliases.js';

const source=process.argv[2];
if (!source) throw new Error('Provide a sales workbook path');
const through=process.argv.find(a=>a.startsWith('--through='))?.split('=')[1]||'2026-09-14';
if (!/^2026-09-(?:1[2-9]|2\d|30)$/.test(through)) throw new Error('This reviewed update must end September 12–30, 2026');
const includeActive=process.argv.includes('--include-active');
const apply=process.argv.includes('--apply');
const bytes=await readFile(source),hash=createHash('sha256').update(bytes).digest('hex');
const rows=await parseSalesWorkbook(bytes);
const batchKey=`sales-update:${hash}:${through}:${includeActive}`;
const oid=value=>new mongoose.Types.ObjectId(createHash('sha256').update(value).digest('hex').slice(0,24));
const batchId=oid(batchKey),uploadId=`UPDATE-${hash.slice(0,12)}-${through}-${includeActive?'active':'success'}`;
const storeSource='data/sources/UPDATED sapphire_admin_sapphire (1).xlsx';
const storeBytes=await readFile(storeSource),storeHash=createHash('sha256').update(storeBytes).digest('hex');
const storeBook=await new ExcelJS.Workbook().xlsx.load(storeBytes),referenceStores=[];
for(const sheet of storeBook.worksheets){
  const headers=sheet.getRow(1).values;
  sheet.eachRow((r,n)=>{if(n===1)return;const get=k=>headers.indexOf(k)>0?r.getCell(headers.indexOf(k)).text.trim():'';
    if(get('record_type')==='store'&&get('state').toLowerCase()==='lagos')referenceStores.push({name:get('name'),cluster:get('New Cluster name')});
  });
}
const summarize=list=>({count:list.length,valueKobo:list.reduce((sum,r)=>sum+r.valueKobo,0)});
const group=(list,key)=>[...new Set(list.map(r=>r[key]||'Unassigned'))].sort().map(name=>({name,...summarize(list.filter(r=>(r[key]||'Unassigned')===name))}));
await connectDatabase();
try {
  const [agents,clusters,stores,existing,lagos,regional,uploader]=await Promise.all([
    Agent.find().lean(),Cluster.find().lean(),Store.find({region:'LAG'}).lean(),
    Transaction.find({sourceSystem:'DEVPRO',transactionId:{$in:rows.map(r=>r.transactionId)}}).lean(),
    ReportingPeriod.findOne({month:'2026-09'}).lean(),RegionalReportingPeriod.find({month:'2026-09'}).lean(),
    User.findOne({email:'baseline-importer@local.invalid'}).lean(),
  ]);
  if(!lagos||regional.length!==2||!uploader)throw new Error('Existing reporting periods/import identity missing');
  const seen=new Map(),existingById=new Map(existing.map(r=>[r.transactionId,r]));
  for (const row of rows) {
    row.issues=[];
    const old=existingById.get(row.transactionId)||seen.get(row.transactionId);
    if(old){
      if(old.valueKobo!==row.valueKobo||old.sourceTimestamp!==row.sourceTimestamp)throw new Error(`Conflicting duplicate policy at ${row.sheet}:${row.sourceRow}`);
      row.disposition='DUPLICATE';continue;
    }
    seen.set(row.transactionId,row);
    if(row.businessDate<'2026-09-12'||row.businessDate>through){row.disposition='HELD';row.issues.push('Outside approved date range');continue;}
    if(row.paymentStatus!=='SUCCESS'&&!(includeActive&&row.paymentStatus==='ACTIVE')){row.disposition='HELD';row.issues.push(`Payment status ${row.paymentStatus} needs confirmation`);continue;}
    if(!row.region){
      const rosterMatches=agents.filter(a=>agentMatchesName(a,row.sourceAgentName));
      const storeMatches=referenceStores.filter(s=>normalizeName(s.name)===normalizeName(row.sourceStoreName));
      if(rosterMatches.length===1){row.state='Lagos';row.region='LAG';row.issues.push('State blank; inferred Lagos from exact roster agent name');}
      else if(storeMatches.length===1){row.state='Lagos';row.region='LAG';row.issues.push('State blank; inferred Lagos from exact store name in latest reference');}
    }
    if(!row.region){row.disposition='HELD';row.issues.push('Missing or unknown state/region');continue;}
    row.disposition='ACCEPTED';row.sourceZone=row.region==='LAG'?'Unmapped':row.state;
    if(row.paymentStatus!=='SUCCESS')row.issues.push('ACTIVE status accepted by explicit user instruction');
    if(row.region==='LAG'){
      const matches=agents.filter(a=>agentMatchesName(a,row.sourceAgentName));
      let cluster;
      if(matches.length===1){row.agent=matches[0]._id;cluster=clusters.find(c=>String(c._id)===String(matches[0].currentCluster));row.mappingBasis='Exact roster agent name';}
      else {
        const sourceMatches=referenceStores.filter(s=>normalizeName(s.name)===normalizeName(row.sourceStoreName));
        const referenceNames=[...new Set(sourceMatches.map(s=>s.cluster).filter(Boolean))];
        const oldMatches=stores.filter(s=>[s.name,...(s.aliases||[])].some(n=>normalizeName(n)===normalizeName(row.sourceStoreName)));
        const oldNames=[...new Set(oldMatches.map(s=>clusters.find(c=>String(c._id)===String(s.cluster))?.name).filter(Boolean))];
        if(referenceNames.length===1&&(!oldNames.length||oldNames.every(n=>n===referenceNames[0]))){cluster=clusters.find(c=>c.name===referenceNames[0]);row.mappingBasis='Exact store name in latest reference';}
        else if(!referenceNames.length&&oldNames.length===1){cluster=clusters.find(c=>c.name===oldNames[0]);row.mappingBasis='Exact existing store alias';}
        else row.issues.push('Store cluster mapping missing, ambiguous, or conflicting');
        row.issues.push('Agent identity unassigned; source name retained');
      }
      if(cluster){row.cluster=cluster._id;row.clusterName=cluster.name;row.sourceZone=cluster.zone;}
      else {row.clusterName='Unmapped';row.issues.push('Zone/cluster unassigned; included in Lagos total');}
    }else{
      const match=resolveCluster({region:row.region,month:row.businessDate.slice(0,7),cluster:row.sourceCluster,zone:row.state,agentName:row.sourceAgentName,storeName:row.sourceStoreName});
      row.clusterName=match.status==='MATCHED'?match.name:row.sourceCluster||'Unmapped';
      row.issues.push('Regional agent names retained; no unconfirmed identity merge');
    }
  }
  const accepted=rows.filter(r=>r.disposition==='ACCEPTED'),held=rows.filter(r=>r.disposition==='HELD'),duplicates=rows.filter(r=>r.disposition==='DUPLICATE');
  const previous=await Transaction.aggregate([{$match:{businessDate:{$gte:'2026-09-01',$lte:through},status:{$in:['VALID','ACCEPTED_BASELINE']}}},{$group:{_id:'$region',count:{$sum:1},valueKobo:{$sum:'$valueKobo'}}}]);
  const report={source:basename(source),sha256:hash,storeReferenceSha256:storeHash,through,includeActive,dateRule:'Business date uses the UTC calendar date explicitly recorded in Sales Date. No date shifting.',sourceTotals:summarize(rows),accepted:summarize(accepted),held:summarize(held),duplicates:summarize(duplicates),byRegion:group(accepted,'region'),byDate:group(accepted,'businessDate'),byZone:group(accepted,'sourceZone'),byCluster:group(accepted,'clusterName'),previous,rows};
  await mkdir('data/reports',{recursive:true});
  const reportPath=`data/reports/sales-update-${through}-${hash.slice(0,12)}.json`;
  if(!await Upload.exists({uploadId,status:'COMPLETED'}))await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({source:report.source,through,sourceTotals:report.sourceTotals,accepted:report.accepted,held:report.held,duplicates:report.duplicates,byRegion:report.byRegion,byZone:report.byZone,byCluster:report.byCluster,issues:rows.filter(r=>r.issues.length&&!r.issues.every(i=>i.startsWith('Regional agent'))).map(r=>({sheet:r.sheet,row:r.sourceRow,date:r.businessDate,agent:r.sourceAgentName,store:r.sourceStoreName,valueKobo:r.valueKobo,disposition:r.disposition,issues:r.issues})),reportPath},null,2));
  if(!apply) {console.log('Preview only; no database changes.');}
  else if(await Upload.exists({uploadId,status:'COMPLETED'})){console.log('Identical completed import; no changes.');}
  else {
    await mkdir('.local/source-data/sales-updates',{recursive:true});
    const storageKey=`.local/source-data/sales-updates/${hash}.xlsx`;await copyFile(source,storageKey);
    const transactions=accepted.map(row=>({_id:oid(`DEVPRO:${row.transactionId}`),region:row.region,sourceSystem:'DEVPRO',transactionId:row.transactionId,businessDate:row.businessDate,valueKobo:row.valueKobo,agent:row.agent,cluster:row.cluster,sourceZone:row.sourceZone,sourceState:row.sourceState,sourceCluster:row.sourceCluster,sourceAgentName:row.sourceAgentName,sourceStoreName:row.sourceStoreName,sourceTimestamp:row.sourceTimestamp,identityMethod:'POLICY_ID',device:row.device,rawPlan:row.rawPlan,plan:['SLD','SAP','ESSENTIAL'].includes(row.rawPlan.toUpperCase())?row.rawPlan.toUpperCase():'UNCLASSIFIED',brand:/samsung/i.test(row.device)?'Samsung':/infinix/i.test(row.device)?'Infinix':/xiaomi|redmi/i.test(row.device)?'Xiaomi / Redmi':/tecno/i.test(row.device)?'Tecno':/itel/i.test(row.device)?'Itel':/oppo/i.test(row.device)?'Oppo':/honor/i.test(row.device)?'Honor':'Other',status:'ACCEPTED_BASELINE',sourceRow:oid(`${uploadId}:${row.sheet}:${row.sourceRow}`)}));
    for(const tx of transactions)await new Transaction(tx).validate();
    await mongoose.connection.transaction(async session=>{
      // Optimistic guards protect period totals if another import runs concurrently.
      await Upload.create([{_id:batchId,uploadId,type:'SALES',sourceSystem:'DEVPRO',filename:basename(source),fileSha256:hash,storageKey,uploadedBy:uploader._id,reportingDate:through,status:'COMPLETED',mappingVersion:'sales-update-v1',recordCount:rows.length,acceptedCount:accepted.length,flaggedCount:held.length+accepted.filter(r=>r.issues.length).length,duplicateCount:duplicates.length,approvedBy:uploader._id,approvedAt:new Date()}],{session});
      await UploadRow.insertMany(rows.map(row=>({_id:oid(`${uploadId}:${row.sheet}:${row.sourceRow}`),upload:batchId,sheet:row.sheet,rowNumber:row.sourceRow,raw:row,normalized:row,status:row.disposition==='ACCEPTED'?'IMPORTED':row.disposition==='DUPLICATE'?'DUPLICATE':'FLAGGED',transaction:row.disposition==='ACCEPTED'?oid(`DEVPRO:${row.transactionId}`):undefined,issues:row.issues.map(message=>({code:row.disposition==='HELD'?'HELD_FOR_REVIEW':'ATTRIBUTION_NOTE',message,severity:'WARNING'}))})),{session});
      if(transactions.length)await Transaction.insertMany(transactions,{session});
      for(const period of [lagos,...regional]){
        const region=period.region||'LAG',additions=accepted.filter(r=>r.region===region),model=region==='LAG'?ReportingPeriod:RegionalReportingPeriod;
        const asOf=period.asOf>through?period.asOf:through;
        const totals=await Transaction.aggregate([{$match:{region,businessDate:{$gte:'2026-09-01',$lte:asOf},status:{$in:['VALID','ACCEPTED_BASELINE']}}},{$group:{_id:null,count:{$sum:1},valueKobo:{$sum:'$valueKobo'}}}]).session(session);
        const notes=[...period.notes,`${basename(source)}: ${additions.length} added sales; ${through} cutoff. Source UTC dates retained. ${held.length} workbook rows held for date/status/region review.`,...(region==='LAG'?['New Lagos sales are mapped by exact roster names or unambiguous store reference. Conflicting/unmatched store locations remain Unmapped and are included in Lagos totals.']:[])];
        const result=await model.updateOne({_id:period._id,updatedAt:period.updatedAt},{$set:{asOf,availableDates:[...new Set([...period.availableDates,...additions.map(r=>r.businessDate)])].sort(),approvedCount:totals[0]?.count||0,approvedValueKobo:totals[0]?.valueKobo||0,sourceLabel:`${period.sourceLabel} + ${basename(source)}`,notes}},{session,runValidators:true});
        if(result.modifiedCount!==1)throw new Error('Reporting period changed concurrently; retry after review');
      }
    });
    console.log('Sales update committed atomically. Targets and prior sales unchanged.');
  }
} finally {await disconnectDatabase();}
