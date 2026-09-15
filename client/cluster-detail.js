export function buildClusterDetail(name, transactions, agents = []) {
  const rows = transactions.filter(row => row.cluster === name);
  const groups = new Map();
  for (const row of rows) {
    const key = row.agentId ? `id:${row.agentId}` : `source:${row.agent || 'Unattributed'}`;
    if (!groups.has(key)) groups.set(key, {key, name:row.agent || 'Unattributed', agentId:row.agentId, count:0, value:0, transactions:[]});
    const group = groups.get(key);
    group.count++;
    group.value += row.value;
    group.transactions.push(row);
  }
  // Include known roster members with no sales in this cluster/selection.
  for (const agent of agents.filter(agent => agent.roster && agent.cluster === name)) {
    const key = `id:${agent.id}`;
    if (!groups.has(key)) groups.set(key, {key, name:agent.name, agentId:agent.id, count:0, value:0, transactions:[]});
  }
  const value = rows.reduce((total, row) => total + row.value, 0);
  return {name, count:rows.length, value, agents:[...groups.values()].sort((a,b) => b.value-a.value || a.name.localeCompare(b.name)).map(agent => ({...agent, share:value ? agent.value/value : 0}))};
}
