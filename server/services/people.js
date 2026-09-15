const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function buildPeople({executives, agents, clusters, records}) {
  const agentById = new Map(agents.map(a=>[String(a._id),a]));
  const clusterById = new Map(clusters.map(c=>[String(c._id),c]));
  const people = executives.map(e=>({...e,transactions:[],matchStatus:e.agentId?'Linked agent':'No matched sales'}));
  const unassigned = [];
  for (const sale of records) {
    const agent = agentById.get(String(sale.agent));
    let matches = agent ? people.filter(p=>p.region===sale.region && p.agentId===agent.agentId) : [];
    let candidate = false;
    if (!agent && norm(sale.sourceAgentName) && !['unattributed','unknown','unmapped'].includes(norm(sale.sourceAgentName))) {
      matches = people.filter(p=>p.region===sale.region && norm(p.name)===norm(sale.sourceAgentName));
      candidate = true;
    }
    if(matches.length!==1) {
      unassigned.push(sale);
      if(matches.length>1)matches.forEach(p=>{p.matchStatus='Ambiguous name; sales not assigned';});
      continue;
    }
    const person = matches[0];
    if(candidate)person.matchStatus='Name match — unverified';
    person.transactions.push({id:sale.transactionId,date:sale.businessDate,value:sale.valueKobo/100,store:sale.sourceStoreName||'Not supplied',cluster:clusterById.get(String(sale.cluster))?.name||sale.sourceCluster||'Unmapped',zone:sale.sourceZone,plan:sale.plan,device:sale.device});
  }
  for (const person of people) {
    person.transactions.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
    const agent=agents.find(a=>a.agentId===person.agentId);
    person.clusterName=clusterById.get(String(agent?.currentCluster))?.name||person.clusterName||null;
    person.value=person.transactions.reduce((s,r)=>s+Math.round(r.value*100),0)/100;
    person.count=person.transactions.length;
    person.daysSold=new Set(person.transactions.map(r=>r.date)).size;
    person.average=person.count?person.value/person.count:0;
    person.lastSale=person.transactions[0]?.date||null;
  }
  return {people,unassigned:{count:unassigned.length,value:unassigned.reduce((s,r)=>s+r.valueKobo,0)/100}};
}
