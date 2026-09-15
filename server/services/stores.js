// Source names are grouped conservatively within a zone; ambiguous master links stay pending.
export function buildStoreReporting({rows,stores=[],clusters=[],zone='All zones'}) {
 const clusterMap=new Map(clusters.map(c=>[String(c._id),c]));
 const normalize=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
 const directory=stores.filter(s=>zone==='All zones'||(clusterMap.get(String(s.cluster))?.zone||s.reportingZone)===zone).map(s=>({id:s.storeId,name:s.name,address:s.address||null,state:s.state,cluster:clusterMap.get(String(s.cluster))?.name||'Unmapped',zone:clusterMap.get(String(s.cluster))?.zone||s.reportingZone||'Unmapped',status:s.status}));
 const grouped=new Map();
 for(const row of rows){const name=String(row.sourceStoreName||'').trim().replace(/\s+/g,' ')||'Store not supplied';const key=JSON.stringify([row.sourceZone,normalize(name)]);if(!grouped.has(key))grouped.set(key,{key,name,zone:row.sourceZone,valueKobo:0,count:0,days:new Set(),agents:new Set()});const entry=grouped.get(key);entry.valueKobo+=row.valueKobo;entry.count++;entry.days.add(row.businessDate);if(row.agent||row.sourceAgentName)entry.agents.add(String(row.agent||row.sourceAgentName));}
 const total=rows.reduce((n,r)=>n+r.valueKobo,0);
 const performance=[...grouped.values()].map(r=>{const matches=directory.filter(s=>s.zone===r.zone&&normalize(s.name)===normalize(r.name));const master=matches.length===1?matches[0]:null;return {key:r.key,name:r.name,zone:r.zone,id:master?.id||null,state:master?.state||null,matchStatus:master?'Exact master match':matches.length>1?'Multiple master candidates':'Master match pending',value:r.valueKobo/100,count:r.count,daysSold:r.days.size,agents:r.agents.size,average:r.valueKobo/100/r.count,share:total?r.valueKobo/total:0};}).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
 return {performance,directory};
}
