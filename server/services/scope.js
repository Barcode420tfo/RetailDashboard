import register from './target-register.js';
import {isRestricted} from '../middleware/access.js';
export const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function executiveCluster(e,agents,clusters){
 const a=agents.find(a=>a.agentId===e.agentId),c=clusters.find(c=>String(c._id)===String(a?.currentCluster));
 if(c)return {name:c.name,zone:c.zone};
 const candidates=register.rows.filter(r=>r.region===e.region&&norm(r.name)===norm(e.name));
 const names=[...new Set(candidates.map(r=>r.newCluster))];
 return {name:e.clusterName||(names.length===1?names[0]:null),zone:candidates[0]?.zone||e.state};
}
export function scopeData(account,{records=[],agents=[],clusters=[],executives=[],stores=[]}){
 if(!isRestricted(account))return {records,agents,clusters,executives,stores};
 const permits=(name,zone)=>account.role==='ZONAL_LEAD'?zone===account.zone:name===account.clusterName&&(!account.zone||zone===account.zone);
 const allowedClusters=clusters.filter(c=>permits(c.name,c.zone)),allowedIds=new Set(allowedClusters.map(c=>String(c._id)));
 const tx=records.filter(r=>{const c=clusters.find(c=>String(c._id)===String(r.cluster));return permits(c?.name||r.sourceCluster,c?.zone||r.sourceZone);});
 const staff=executives.filter(e=>{const c=executiveCluster(e,agents,clusters);return permits(c.name,c.zone);});
 return {records:tx,agents:agents.filter(a=>allowedIds.has(String(a.currentCluster))),clusters:allowedClusters,executives:staff,stores:stores.filter(s=>allowedIds.has(String(s.cluster))||staff.some(e=>e.storeId===s.storeId||register.rows.some(r=>r.region===e.region&&norm(r.name)===norm(e.name)&&norm(r.store)===norm(s.name))&&stores.filter(t=>norm(t.name)===norm(s.name)).length===1))};
}
export function scopedPeriod(period,account,{records,agents,executives}){
 if(!isRestricted(account))return period;
 const targets=(period.agentTargets||[]).filter(t=>agents.some(a=>t.agentId?a.agentId===t.agentId:norm(a.fullName)===norm(t.name))||executives.some(e=>norm(e.name)===norm(t.name)));
 const zoneTargets=period.zoneTargets.filter(t=>t.zone===account.zone);
 const known=targets.length?targets.reduce((n,t)=>n+t.valueKobo,0):null;
 const target=account.role==='ZONAL_LEAD'?(zoneTargets[0]?.valueKobo??null):known;
 return {...period,agentTargets:targets,zoneTargets:account.role==='ZONAL_LEAD'?zoneTargets:[{zone:account.zone,valueKobo:target}],regionalMonthlyTargetKobo:target,approvedCount:records.length,approvedValueKobo:records.reduce((n,r)=>n+r.valueKobo,0),notes:[`Reporting is restricted to ${account.clusterName||account.zone}.`,...(target===null?['A confirmed target for this scope has not been supplied.']:[])],scopeLabel:account.clusterName||account.zone};
}
export function assignmentOptions(clusters){
 const rows=[...clusters.map(c=>({region:'LAG',zone:c.zone,clusterName:c.name})),...register.rows.filter(r=>r.region!=='LAG').map(r=>({region:r.region,zone:r.zone,clusterName:r.newCluster}))];
 return [...new Map(rows.map(r=>[JSON.stringify(r),r])).values()];
}
