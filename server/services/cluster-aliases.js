import register from './target-register.js';

const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const clusterKey = value => normalize(value).replace(/^lagos(?=mainland)/, '');

// Resolve from the source month onward, within the region. Split legacy clusters require context.
export function resolveCluster({region, month, cluster, agentName, storeName, zone}) {
  if (!/^\d{4}-\d{2}$/.test(month ?? '') || month < register.month || !clusterKey(cluster)) return {status: 'UNMATCHED', candidates: []};
  let rows = register.rows.filter(row => row.region === region &&
    [row.oldCluster, row.newCluster].some(name => clusterKey(name) === clusterKey(cluster)));
  if (zone) rows = rows.filter(row => normalize(row.zone) === normalize(zone));
  for (const [field, value] of [['name', agentName], ['store', storeName]]) {
    if (!value) continue;
    const matches = rows.filter(row => normalize(row[field]) === normalize(value));
    // Supplied identity context must agree; never silently ignore a conflict.
    if (matches.length) rows = matches;
    else if (new Set(rows.map(row => row.newCluster)).size > 1) return {status: 'AMBIGUOUS', candidates: [...new Set(rows.map(row => row.newCluster))]};
  }
  const candidates = [...new Set(rows.map(row => row.newCluster))];
  return candidates.length === 1
    ? {status: 'MATCHED', name: candidates[0], candidates}
    : {status: candidates.length ? 'AMBIGUOUS' : 'UNMATCHED', candidates};
}
