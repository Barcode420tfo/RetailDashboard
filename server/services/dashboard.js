import {buildStoreReporting} from './stores.js';
export function buildDashboard({ records, roster, clusters, stores = [], period, zone = 'All zones', asOf = period.asOf, from = `${period.month}-01` }) {
  if (from < `${period.month}-01` || from > asOf) throw new Error('Invalid start date');
  if (asOf < `${period.month}-01` || asOf > period.asOf) throw new Error('Date outside the available reporting period');
  const targetRows = period.zoneTargets.filter(row => zone === 'All zones' || row.zone === zone);
  if (!targetRows.length) throw new Error('Unknown zone');
  const rows = records.filter(row => row.businessDate >= from && row.businessDate <= asOf && row.businessDate.startsWith(period.month) && (zone === 'All zones' || row.sourceZone === zone));
  const elapsed = period.workingDates.filter(day => day >= from && day <= asOf).length;
  const totalDays = period.workingDates.length;
  const monthElapsed = period.workingDates.filter(day => day <= asOf).length;
  const remaining = totalDays - monthElapsed;
  const sum = list => list.reduce((total, row) => total + row.valueKobo, 0) / 100;
  const target = zone==='All zones'&&period.regionalMonthlyTargetKobo!=null?period.regionalMonthlyTargetKobo/100:targetRows.every(row=>row.valueKobo!=null)?targetRows.reduce((total, row) => total + row.valueKobo, 0) / 100:null;
  const sales = sum(rows);
  const metrics = (value, target) => ({ target, value, expected: target==null?null:target * elapsed / totalDays, achievement: target ? value / target : null, pace: target && elapsed ? value / (target * elapsed / totalDays) : null, gap: target==null?null:value - target * elapsed / totalDays, forecast: elapsed ? value / elapsed * totalDays : null });
  const group = (key, label) => [...new Set(rows.map(key))].map(name => { const selected = rows.filter(row => key(row) === name); return {name, value:sum(selected), count:selected.length, ...label?.(name)}; }).sort((a,b)=>b.value-a.value);
  const zones = targetRows.map(row => {const subset=rows.filter(tx=>tx.sourceZone===row.zone);return {name:row.zone,...metrics(sum(subset),row.valueKobo==null?null:row.valueKobo/100),count:subset.length};});
  const timeline = [];
  let cumulative = 0;
  for (let day = Number(from.slice(-2)); day <= Number(asOf.slice(-2)); day++) {
    const date = `${period.month}-${String(day).padStart(2,'0')}`;
    const available = period.availableDates.includes(date);
    const subset = rows.filter(row=>row.businessDate===date);
    cumulative += sum(subset);
    timeline.push({date,label:`Sep ${day}`,value:available?sum(subset):null,count:available?subset.length:null,cumulative:available?cumulative:null,expected:target==null?null:target*period.workingDates.filter(d=>d>=from&&d<=date).length/totalDays,requiredDaily:target==null?null:period.workingDates.includes(date)?target/totalDays:0,note:day===6?'No source worksheet':day===9?'Partial backend data; manual reconciliation pending':null});
  }
  const clusterById = new Map(clusters.map(row=>[String(row._id),row]));
  const rosterById = new Map(roster.map(row=>[String(row._id),row]));
  const eligible = roster.filter(agent=>zone==='All zones'||clusterById.get(String(agent.currentCluster))?.zone===zone);
  const agents = eligible.map(agent=>{
    const subset=rows.filter(row=>String(row.agent)===String(agent._id));
    return {id:agent.agentId,name:agent.fullName,cluster:clusterById.get(String(agent.currentCluster))?.name||'Unmapped',value:sum(subset),count:subset.length,daysSold:new Set(subset.map(row=>row.businessDate)).size,average:subset.length?sum(subset)/subset.length:0,roster:true};
  });
  for(const name of new Set(rows.filter(row=>!rosterById.has(String(row.agent))).map(row=>row.sourceAgentName))) {
    const subset=rows.filter(row=>!rosterById.has(String(row.agent))&&row.sourceAgentName===name);
    agents.push({id:`source:${name}`,name,cluster:'Outside active roster',value:sum(subset),count:subset.length,daysSold:new Set(subset.map(row=>row.businessDate)).size,average:sum(subset)/subset.length,roster:false});
  }
  const allocationRows=(period.agentTargets||[]).filter(row=>zone==='All zones'||row.zone===zone);
  const normalName=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const allocation of allocationRows){
    let agent=agents.find(a=>allocation.agentId?a.id===allocation.agentId:normalName(a.name)===normalName(allocation.name));
    if(!agent){agent={id:`target:${allocation.name}`,name:allocation.name,cluster:'Outside active roster',value:0,count:0,daysSold:0,average:0,roster:false};agents.push(agent);}
    agent.target=allocation.valueKobo/100;agent.employmentStatus=allocation.employmentStatus;agent.pendingAction=allocation.pendingAction;agent.targetZone=allocation.zone;
  }
  for(const agent of agents){
    const target=agent.target??null;
    Object.assign(agent,metrics(agent.value,target),{target});
    if(target==null){agent.expected=null;agent.gap=null;agent.employmentStatus=agent.roster?'ROSTER':'UNMATCHED';}
    agent.targetStatus=target==null?'Target pending':agent.employmentStatus==='ACTIVE'?'Allocated':'Reallocation pending';
  }
  agents.sort((a,b)=>b.value-a.value);
  const transactionRows = rows.map(row=>({id:row.transactionId,date:row.businessDate,agent:rosterById.get(String(row.agent))?.fullName||row.sourceAgentName,agentId:rosterById.get(String(row.agent))?.agentId||null,store:row.sourceStoreName,zone:row.sourceZone,cluster:clusterById.get(String(row.cluster))?.name||'Unmapped',device:row.device,brand:row.brand,plan:row.plan,value:row.valueKobo/100,identityMethod:row.identityMethod,needsAttribution:!rosterById.has(String(row.agent))})).sort((a,b)=>b.date.localeCompare(a.date));
  return {
    filters:{zone,asOf,from},period:{region:period.region||'LAG',rosterPending:Boolean(period.region),targetsAvailable:period.zoneTargets.some(r=>r.valueKobo!=null),month:period.month,asOf:period.asOf,sourceLabel:period.sourceLabel,sourceSha256:period.sourceSha256,notes:period.notes,availableDates:period.availableDates},
    summary:{...metrics(sales,target),count:rows.length,elapsed,totalDays,remaining,runRate:elapsed?sales/elapsed:null,requiredRate:target!=null && from === `${period.month}-01` && remaining?Math.max(target-sales,0)/remaining:null,averageTicket:rows.length?sales/rows.length:0,activeAgents:eligible.length,sellingAgents:agents.filter(row=>row.roster&&row.count>0).length,zeroSellers:agents.filter(row=>row.roster&&row.count===0).length},
    storeReporting:buildStoreReporting({rows,stores,clusters,zone}),
    targetAllocation:{source:(period.agentTargets||[]).length?period.targetSourceLabel||null:null,total:allocationRows.reduce((a,r)=>a+r.valueKobo,0)/100,pending:allocationRows.filter(r=>r.employmentStatus!=='ACTIVE').reduce((a,r)=>a+r.valueKobo,0)/100,pendingCount:allocationRows.filter(r=>r.employmentStatus!=='ACTIVE').length,missing:agents.filter(a=>a.roster&&a.target==null).map(a=>a.name)},
    zones,timeline,agents,clusters:group(row=>clusterById.get(String(row.cluster))?.name||'Unmapped'),brands:group(row=>row.brand),plans:group(row=>row.plan),devices:group(row=>row.device),transactions:transactionRows,
    quality:{fingerprints:rows.filter(row=>row.identityMethod==='FINGERPRINT').length,outsideRoster:rows.filter(row=>!rosterById.has(String(row.agent))).length,unmappedClusters:rows.filter(row=>!row.cluster).length,approvedBaselineCount:period.approvedCount,approvedBaselineValue:period.approvedValueKobo/100},
  };
}
