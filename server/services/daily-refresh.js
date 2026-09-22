import ExcelJS from 'exceljs';
import {parseMoney,normalizeName,stateIdentity,agentMatchesName} from './sales-workbook.js';
import {resolveCluster} from './cluster-aliases.js';
import {validDay} from '../models/shared.js';
import register from './target-register.js';

export const issue=(code,message,nextStep)=>({code,message,nextStep});
export function sourceDate(timestamp,sheetDate){
  let date;
  if(/^\d{4}-\d{2}-\d{2}T/.test(timestamp)&&Number.isFinite(Date.parse(timestamp)))date=timestamp.slice(0,10);
  else {
    // This export's September 2 dates have no timezone. Do not apply the host timezone.
    const match=timestamp.match(/^Sep (\d{2}), (2026), \d{2}:\d{2} [AP]M$/);
    if(match)date=`${match[2]}-09-${match[1]}`;
  }
  if(!validDay(date))throw new Error('Unrecognized source timestamp');
  const inPeriod=date>='2026-09-01'&&date<='2026-09-14';
  return {businessDate:inPeriod?date:sheetDate,issues:date===sheetDate?[]:[issue('DATE_CONFLICT',`Worksheet date ${sheetDate}; recorded date ${date}. ${inPeriod?'Recorded date used.':'Worksheet date provisionally included in September.'}`,'Confirm the sale date and reporting-month eligibility against the original payment record.')]};
}
export async function parseDailyRefresh(bytes){
  const book=await new ExcelJS.Workbook().xlsx.load(bytes),rows=[];
  for(const sheet of book.worksheets){
    const renewal=sheet.name==='RENEWAL',match=sheet.name.match(/^(\d{1,2})(?:ST|ND|RD|TH)$/);
    if(!renewal&&(!match||Number(match[1])<1||Number(match[1])>14))throw new Error(`Unreviewed worksheet ${sheet.name}`);
    const headers=sheet.getRow(1).values;
    const required=renewal?['Timestamp','Sentinel Price (Confirm price before inputing)','STATE']:['Policy ID','Premium','Sales Date','Payment Status','MBE Name','Store Name','State','Cluster'];
    for(const name of required)if(headers.indexOf(name)<1)throw new Error(`Missing ${name} in ${sheet.name}`);
    sheet.eachRow((row,n)=>{
      if(n===1)return;
      const cell=name=>headers.indexOf(name)>0?row.getCell(headers.indexOf(name)):null;
      const get=name=>cell(name)?.text.trim()||'';
      const amount=get(renewal?'Sentinel Price (Confirm price before inputing)':'Premium');
      if(!amount){if(get('Policy ID'))throw new Error(`Missing amount ${sheet.name}:${n}`);return;}
      const timestampCell=cell(renewal?'Timestamp':'Sales Date');
      const sourceTimestamp=timestampCell.value instanceof Date?timestampCell.value.toISOString():timestampCell.text.trim();
      const sheetDate=renewal?sourceTimestamp.slice(0,10):`2026-09-${match[1].padStart(2,'0')}`;
      const dates=sourceDate(sourceTimestamp,sheetDate),valueKobo=parseMoney(amount),issues=[...dates.issues];
      const payment=get('Payment Amount');
      if(payment&&parseMoney(payment)!==valueKobo)issues.push(issue('PAYMENT_MISMATCH','Premium and payment amount differ.','Verify the settled amount before including this sale.'));
      const sourceState=get(renewal?'STATE':'State');
      const identity=stateIdentity(/^Lagos(?:\s|$)/i.test(sourceState)?'Lagos':sourceState);
      const sourceAgentName=renewal?(get("If your name is not listed above, select 'Others' and type your full name on RELAY below")||get("Sales Rep (If your name is not listed below, select 'Others')")):get('MBE Name');
      const policyId=get('Policy ID');
      if(!renewal&&!policyId)throw new Error(`Missing policy ID ${sheet.name}:${n}`);
      const paymentStatus=renewal?'UNVERIFIED':get('Payment Status').toUpperCase();
      if(renewal)issues.push(issue('RENEWAL_UNVERIFIED','Renewal has no policy ID or confirmed payment status in this sheet.','Confirm payment, identify the policy, and confirm whether renewals belong in sales totals.'));
      else if(paymentStatus!=='SUCCESS')issues.push(issue('PAYMENT_STATUS',`Payment status is ${paymentStatus||'missing'}, not SUCCESS.`,'Confirm successful payment before including this sale.'));
      if(!identity.region)issues.push(issue('REGION_UNKNOWN','State does not identify a reporting region.','Confirm the state and region.'));
      rows.push({sheet:sheet.name,sourceRow:n,policyId,sourceTimestamp,sheetDate,businessDate:dates.businessDate,valueKobo,paymentStatus,sourceAgentName:sourceAgentName||'Unattributed',sourceStoreName:get('Store Name'),sourceState,sourceCluster:get('Cluster'),sourceZone:identity.region==='LAG'?sourceState:identity.state,region:identity.region||'UNKNOWN',device:get(renewal?'Device Name and Spec (Type in full e.g Samsung A05 4+128Gb)':'Device Name'),rawPlan:get(renewal?'Sentinel Package':'Variant/Plan'),kind:renewal?'RENEWAL':'SALE',issues,treatment:renewal||paymentStatus!=='SUCCESS'||!identity.region||issues.some(i=>i.code==='PAYMENT_MISMATCH')?'HELD':'INCLUDED'});
    });
  }
  const ids=rows.filter(r=>r.policyId).map(r=>r.policyId);
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate policy IDs in the replacement source; review before refreshing.');
  return rows;
}
export function matchExisting(row,existing){
  const policy=existing.filter(t=>t.transactionId===row.policyId);
  if(policy.length>1)throw new Error('Ambiguous policy identity');
  if(policy.length)return policy[0];
  // Fingerprint migration needs exact independent evidence, not a name-only match.
  const candidates=existing.filter(t=>t.identityMethod==='FINGERPRINT'&&t.valueKobo===row.valueKobo&&t.sourceTimestamp===row.sourceTimestamp&&t.businessDate===row.businessDate&&normalizeName(t.sourceAgentName)===normalizeName(row.sourceAgentName)&&normalizeName(t.sourceStoreName)===normalizeName(row.sourceStoreName));
  if(candidates.length>1)throw new Error(`Ambiguous fingerprint match at ${row.sheet}:${row.sourceRow}`);
  return candidates[0];
}
export function mapDailyRow(row,{agents,clusters,executives},old){
  const mapped={...row,issues:[...row.issues]};
  const names=agents.filter(a=>agentMatchesName(a,row.sourceAgentName));
  // Preserve previously reviewed identity links; newly supplied names can fill a missing link.
  const agent=names.length===1?names[0]:old?.agent?agents.find(a=>String(a._id)===String(old.agent)):null;
  if(row.region==='LAG'){
    mapped.agent=agent?._id||null;
    const resolved=resolveCluster({region:row.region,month:'2026-09',cluster:row.sourceCluster,zone:row.sourceZone,agentName:row.sourceAgentName,storeName:row.sourceStoreName});
    const prior=clusters.find(c=>String(c._id)===String(old?.cluster));
    const assigned=clusters.find(c=>String(c._id)===String(agent?.currentCluster));
    const candidate=resolved.status==='MATCHED'?clusters.find(c=>c.name===resolved.name):null;
    const chosen=candidate||((prior?.zone===row.sourceZone)?prior:null)||((assigned?.zone===row.sourceZone)?assigned:null);
    mapped.cluster=chosen?._id||null;mapped.clusterName=chosen?.name||'Unmapped';
    mapped.sourceZone=chosen?.zone||row.sourceZone||'Unmapped';
    if(!chosen)mapped.issues.push(issue('CLUSTER_UNRESOLVED',`Source cluster ${row.sourceCluster||'missing'} could not be assigned uniquely. Sales remain in ${mapped.sourceZone}.`,'Confirm the current cluster using the agent and store; legacy split clusters need both.'));
    if(candidate&&assigned&&candidate.name!==assigned.name)mapped.issues.push(issue('CLUSTER_CONFLICT',`Workbook maps to ${candidate.name}; agent roster maps to ${assigned.name}. Workbook cluster is used.`,'Confirm the historical cluster assignment for this sale.'));
  }else{
    const resolved=resolveCluster({region:row.region,month:'2026-09',cluster:row.sourceCluster,zone:row.sourceZone,agentName:row.sourceAgentName,storeName:row.sourceStoreName});
    const key=value=>normalizeName(value).replace(/cluster$/,'');
    const canonical=[...new Set(register.rows.filter(r=>r.region===row.region&&key(r.newCluster)===key(row.sourceCluster)).map(r=>r.newCluster))];
    mapped.clusterName=resolved.status==='MATCHED'?resolved.name:canonical.length===1?canonical[0]:row.sourceCluster||'Unmapped';
    mapped.sourceCluster=mapped.clusterName;
  }
  const people=executives.filter(e=>e.region===row.region&&normalizeName(e.name)===normalizeName(row.sourceAgentName));
  if(!agent&&people.length!==1)mapped.issues.push(issue('AGENT_UNRESOLVED',people.length>1?'Multiple executives match the source name.':`No unique executive match for ${row.sourceAgentName}.`,'Confirm the sales executive identity; do not merge people on a partial name.'));
  if(!row.sourceStoreName&&row.kind==='SALE')mapped.issues.push(issue('STORE_MISSING','No store was supplied.','Confirm the store for this sale.'));
  return mapped;
}
