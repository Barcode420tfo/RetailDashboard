import {Agent,Cluster,Executive,Store,Transaction,ReportingPeriod,RegionalReportingPeriod,LeadershipAssignment,AgentStoreReference} from '../models/index.js';
import {scopeData,scopedPeriod,executiveCluster,norm,assignmentOptions} from './scope.js';
import {buildPeople} from './people.js';
import {isRestricted} from '../middleware/access.js';
import register from './target-register.js';

export async function loadOperationalData(account,region){
 const period=region==='LAG'?await ReportingPeriod.findOne({month:'2026-09'}).lean():await RegionalReportingPeriod.findOne({region,month:'2026-09'}).lean();
 if(!period)throw Object.assign(Error('Reporting data has not been loaded for this region.'),{status:503});
 const [records,agents,clusters,executives,stores,leaders,links]=await Promise.all([Transaction.find({region,businessDate:{$lte:period.asOf},status:{$in:['VALID','ACCEPTED_BASELINE']}}).lean(),region==='LAG'?Agent.find().lean():[],region==='LAG'?Cluster.find().lean():[],Executive.find({region}).lean(),Store.find({region}).lean(),LeadershipAssignment.find().populate('person','displayName').lean(),region==='LAG'?AgentStoreReference.find().lean():[]]);
 if(!(period.agentTargets||[]).length)period.agentTargets=register.rows.filter(r=>r.region===region&&Number.isSafeInteger(r.devProTargetKobo)).map(r=>({name:r.name,zone:r.zone,valueKobo:r.devProTargetKobo,employmentStatus:'AS_SUPPLIED'}));
 const scoped=scopeData(account,{records,agents,clusters,executives,stores});
 const activityDates=buildActivityDates({records,agents,clusters,executives},scoped.executives);
 return {...scoped,activityDates,period:scopedPeriod(period,account,scoped),fullCalendar:period,leaders:leaders.filter(l=>region==='LAG'&&(!isRestricted(account)||l.scope===account.zone||l.scope===account.clusterName||scoped.clusters.some(c=>c.name===l.scope))),links:links.filter(l=>scoped.agents.some(a=>String(a._id)===String(l.agent)))};
}
// Match against the complete regional roster before selecting visible staff, so
// restricted views cannot turn ambiguous names into unique identity matches.
// Only dates cross the cluster boundary; amounts and transaction details do not.
export function buildActivityDates(data, visibleExecutives) {
 const visible=new Set(visibleExecutives.map(e=>e.executiveId));
 return Object.fromEntries(buildPeople(data).people.filter(p=>visible.has(p.executiveId))
  .map(p=>[p.executiveId,[...new Set(p.transactions.map(t=>t.date))]]));
}
export function inactivity({sales,workingDates,availableDates,asOf,joinedOn,status}){
 const dates=new Set(sales.map(s=>s.date||s.businessDate)),lastSale=[...dates].filter(d=>d<=asOf).sort().at(-1)||null;
 if(['RESIGNED','EXITED'].includes(status))return {lastSale,consecutiveNoSaleDays:0,activity:'DEPARTED',inactive:false};
 let count=0,unknown=false;
 for(const day of workingDates.filter(d=>d<=asOf&&(!joinedOn||d>=joinedOn)).sort().reverse()){
  if(dates.has(day))break;
  // Sept 9 is explicitly a partial export; an absent row is not confirmed zero.
  if(!availableDates.includes(day)||day==='2026-09-09'){unknown=true;break;}
  count++;
 }
 return {lastSale,consecutiveNoSaleDays:count,activity:count>=3?'INACTIVE':unknown?'COVERAGE_PENDING':dates.has(asOf)?'SOLD':'NO_SALE',inactive:count>=3};
}
const sum=rows=>rows.reduce((n,r)=>n+(r.valueKobo??Math.round(r.value*100)),0)/100;
export function buildOperations(data,{account,region,from='2026-09-01',asOf=data.period.asOf}){
 const {period,fullCalendar,records,agents,clusters,executives,stores,leaders,links}=data;
 const history=records.filter(r=>r.businessDate<=asOf),selected=history.filter(r=>r.businessDate>=from),people=buildPeople({executives,agents,clusters,records:history}).people;
 const elapsed=fullCalendar.workingDates.filter(d=>d>=from&&d<=asOf).length,totalDays=fullCalendar.workingDates.length;
 const metrics=(rows,target)=>{const value=sum(rows),expected=target==null?null:target*elapsed/totalDays;return {count:rows.length,value,target,expected,achievement:target?value/target:null,pace:expected?value/expected:null,gap:expected==null?null:value-expected,forecast:elapsed?value/elapsed*totalDays:null};};
 const staff=people.map(p=>{
  const c=executiveCluster(p,agents,clusters),targetRows=(period.agentTargets||[]).filter(t=>p.agentId?t.agentId===p.agentId||norm(t.name)===norm(p.name):norm(t.name)===norm(p.name));
  const regionalAllocation=register.rows.filter(r=>r.region===region&&norm(r.name)===norm(p.name));
  // Target values are only taken from the imported target allocations.
  const target=targetRows.length===1?targetRows[0].valueKobo/100:regionalAllocation.length===1?regionalAllocation[0].devProTargetKobo/100:null;
  const activitySales=data.activityDates?.[p.executiveId]?.filter(date=>date<=asOf).map(date=>({date}))||p.transactions;
  const tx=p.transactions.filter(t=>t.date>=from),agent=agents.find(a=>a.agentId===p.agentId),link=links.find(l=>String(l.agent)===String(agent?._id));
  const named=stores.filter(s=>norm(s.name)===norm(p.storeName||regionalAllocation[0]?.store));
  const assigned=stores.filter(s=>p.storeId===s.storeId||link?.status==='LINKED'&&String(link.store)===String(s._id)||named.length===1&&String(s._id)===String(named[0]._id));
  const reported=[...new Set(tx.map(t=>t.store).filter(s=>s&&s!=='Not supplied'))];
  return {...p,...metrics(tx,target),daysSold:new Set(tx.map(t=>t.date)).size,average:tx.length?sum(tx)/tx.length:0,transactions:tx,clusterName:c.name||'Unmapped',zone:c.zone||'Unmapped',...inactivity({sales:activitySales,workingDates:fullCalendar.workingDates,availableDates:fullCalendar.availableDates,asOf,joinedOn:p.joinedOn,status:p.status}),soldOnAsOf:activitySales.some(t=>t.date===asOf),assignedStores:assigned.map(s=>({id:s.storeId,name:s.name,address:s.address||'Location not supplied',state:s.state})),reportedStores:reported,storeAssignmentStatus:assigned.length?'Linked':link?.status||'Assignment not confirmed'};
 });
 const clusterName=r=>clusters.find(c=>String(c._id)===String(r.cluster))?.name||r.sourceCluster||'Unmapped';
 const options=assignmentOptions(clusters).filter(o=>o.region===region&&(!isRestricted(account)||(account.role==='ZONAL_LEAD'?o.zone===account.zone:o.clusterName===account.clusterName&&o.zone===account.zone)));
 const clusterNames=[...new Set([...options.map(o=>o.clusterName),...selected.map(clusterName),...staff.map(p=>p.clusterName)])];
 const groupRows=clusterNames.map(name=>{
  const rows=selected.filter(r=>clusterName(r)===name),members=staff.filter(p=>p.clusterName===name),zone=options.find(o=>o.clusterName===name)?.zone||rows[0]?.sourceZone||members[0]?.zone||'Unmapped';
  const target=members.length&&members.every(p=>p.target!=null)?members.reduce((n,p)=>n+p.target,0):null;
  return {name,zone,supervisor:leaders.find(l=>l.role==='CLUSTER_SUPERVISOR'&&l.scope===name)?.person?.displayName||register.rows.find(r=>r.region===region&&r.newCluster===name)?.supervisor||'Not assigned',...metrics(rows,target),mbeCount:members.length,inactiveCount:members.filter(p=>p.inactive).length};
 });
 const zoneNames=[...new Set([...period.zoneTargets.map(z=>z.zone),...groupRows.map(c=>c.zone)])];
 const zones=zoneNames.map(name=>({name,leader:name==='Lagos Island'?'To be decided':leaders.find(l=>l.role==='ZONAL_LEAD'&&l.scope===name)?.person?.displayName||null,...metrics(selected.filter(r=>r.sourceZone===name),period.zoneTargets.find(t=>t.zone===name)?.valueKobo/100||null),clusters:groupRows.filter(c=>c.zone===name)}));
 const matchedStores=new Map();
 for(const sale of selected){const candidates=stores.filter(s=>String(s._id)===String(sale.store)||norm(s.name)===norm(sale.sourceStoreName)&&(region!=='LAG'||String(s.cluster)===String(sale.cluster)));if(candidates.length===1){const key=candidates[0].storeId;if(!matchedStores.has(key))matchedStores.set(key,[]);matchedStores.get(key).push(sale);}}
 const storeRows=stores.map(s=>({id:s.storeId,name:s.name,address:s.address||'Location not supplied',state:s.state,status:s.status,clusterName:clusters.find(c=>String(c._id)===String(s.cluster))?.name||'Assignment unconfirmed',...metrics(matchedStores.get(s.storeId)||[],null),lastSale:(matchedStores.get(s.storeId)||[]).map(r=>r.businessDate).sort().at(-1)||null}));
 const sourceStores=[...new Set(selected.map(r=>r.sourceStoreName).filter(Boolean))];
 const target=period.regionalMonthlyTargetKobo!=null?period.regionalMonthlyTargetKobo/100:period.zoneTargets.length&&period.zoneTargets.every(t=>t.valueKobo!=null)?period.zoneTargets.reduce((n,t)=>n+t.valueKobo,0)/100:null;
 const tx=selected.map(r=>({id:r.transactionId,date:r.businessDate,agent:r.sourceAgentName,agentId:agents.find(a=>String(a._id)===String(r.agent))?.agentId,store:r.sourceStoreName,clusterName:clusterName(r),zone:r.sourceZone,value:r.valueKobo/100,plan:r.plan,device:r.device}));
 return {region,from,asOf,maxDate:period.asOf,scope:account.clusterName||account.zone||{LAG:'Lagos',NOR:'North',SSE:'South West / South East'}[region],regionalLead:region==='LAG'?'Olajide Tinuoye · CCO / Lagos RBM':null,summary:{...metrics(selected,target),totalMbes:staff.length,activeMbes:staff.filter(p=>p.status==='ACTIVE').length,inactiveMbes:staff.filter(p=>p.inactive).length,zeroSaleMbes:staff.filter(p=>!p.count).length,totalStores:stores.length,activeStores:stores.filter(s=>s.status==='ACTIVE').length,storeStatusUnknown:stores.filter(s=>s.status==='UNKNOWN').length,productiveStores:matchedStores.size,zeroSaleStores:stores.length-matchedStores.size,reportedStoreLabels:sourceStores.length},zones,clusters:groupRows,people:staff,stores:storeRows,transactions:tx,unassigned:{count:selected.length-staff.reduce((n,p)=>n+p.count,0),value:sum(selected)-staff.reduce((n,p)=>n+p.value,0)},notes:['Agent last-sale and inactivity indicators include recorded sales across clusters; displayed sales amounts and transaction details remain restricted to your scope.','Inactivity means at least 3 consecutive confirmed selling days without a sale, through the reporting date. Missing or partial uploads do not establish zero sales.','Store productivity uses unique master matches. No matched sale does not prove inactivity when store links are incomplete.','Cluster/MBE targets and store assignments are shown only where confirmed; missing values remain unavailable.']};
}
