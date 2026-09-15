import {Router} from 'express';
import {Agent,Cluster,Store,Transaction,ReportingPeriod,RegionalReportingPeriod,Executive} from '../models/index.js';
import {buildDashboard} from '../services/dashboard.js';
import {loadOperationalData} from '../services/operational-data.js';
import {canAccessRegion} from '../middleware/access.js';
export const dashboardRouter=Router();
dashboardRouter.get('/',async(request,response,next)=>{try{
 const region=typeof request.query.region==='string'?request.query.region:'LAG';
 if(!canAccessRegion(request.account,region))return response.status(403).json({error:'This region is outside your account access.'});
 const scoped=await loadOperationalData(request.account,region);
 const {period,records,agents:roster,clusters:masterClusters,stores,executives}=scoped;
 let clusters=masterClusters;
 const suppliedTargets=period.zoneTargets;
 // Preserve the known overall target when sales have unresolved zone attribution.
 if(period.regionalMonthlyTargetKobo==null&&suppliedTargets.length&&suppliedTargets.every(r=>r.valueKobo!=null))period.regionalMonthlyTargetKobo=suppliedTargets.reduce((sum,r)=>sum+r.valueKobo,0);
 period.zoneTargets=[...new Set([...suppliedTargets.map(r=>r.zone),...records.map(r=>r.sourceZone||'Unmapped')])].sort().map(zone=>({zone,valueKobo:suppliedTargets.find(r=>r.zone===zone)?.valueKobo??null}));
 if(region!=='LAG'){
  const clusterMap=new Map();for(const row of records){if(row.sourceCluster){const key=region+':'+row.sourceCluster.toLowerCase().replace(/\s/g,'');if(!clusterMap.has(key))clusterMap.set(key,{_id:key,name:row.sourceCluster,zone:row.sourceZone});row.cluster=key;}}
  clusters=[...clusterMap.values()];for(const store of stores)store.reportingZone=/^(fct|abuja)$/i.test(store.state)?'FCT':store.state;
 }
 const zone=typeof request.query.zone==='string'?request.query.zone:'All zones';const asOf=typeof request.query.asOf==='string'?request.query.asOf:period.asOf;const from=typeof request.query.from==='string'?request.query.from:'2026-09-01';
 if(!/^2026-09-\d{2}$/.test(from)||from<'2026-09-01'||from>asOf||!/^2026-09-\d{2}$/.test(asOf)||asOf>period.asOf||!['All zones',...period.zoneTargets.map(r=>r.zone)].includes(zone))return response.status(400).json({error:'Invalid reporting filters'});
 const result=buildDashboard({records,roster,clusters,stores,period,zone,asOf,from});
 result.filterOptions=period.zoneTargets.map(r=>r.zone);result.breakdownLabel=region==='LAG'?'Zone':'State';
 if(region!=='LAG'){
  const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const agent of result.agents){const matches=executives.filter(e=>norm(e.name)===norm(agent.name));agent.matchStatus=matches.length===1?'Name match candidate':matches.length>1?'Ambiguous name match':'Pending full roster';agent.candidateIds=matches.map(e=>e.executiveId);agent.cluster=[...new Set(result.transactions.filter(r=>r.agent===agent.name).map(r=>r.cluster))].join(' / ');}
  result.summary.activeAgents=null;result.summary.zeroSellers=null;result.summary.sellingAgents=result.agents.length;
 }
 response.set('Cache-Control','no-store').json(result);
}catch(e){next(e);}});
