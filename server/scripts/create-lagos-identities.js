import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ExcelJS from 'exceljs';

const sourceDirectory = '.local/source-data/lagos';
const profile = JSON.parse(await readFile(`${sourceDirectory}/profile.json`, 'utf8'));
const { agents } = JSON.parse(await readFile(`${sourceDirectory}/extracted-records.json`, 'utf8'));
const sourceStores = JSON.parse(await readFile(`${sourceDirectory}/normalized-stores.json`, 'utf8'));
const registerPath = 'data/masters/lagos-identity-register.json';
await mkdir('data/masters', { recursive: true });
await mkdir('artifacts', { recursive: true });
const normalize = value => (value || '').toLowerCase().replace(/\(icm\)/g, '').replace(/[^a-z0-9]/g, '');
let register;
try {
  register = JSON.parse(await readFile(registerPath, 'utf8'));
  if (register.sourceSha256 !== profile.sha256) throw new Error('Source changed: reconcile the existing identity register before assigning IDs to revised records. IDs must never be regenerated.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  register = {
    version: 1, sourceSha256: profile.sha256,
    identityPolicy: 'IDs are allocated once and persisted. Source changes require identity reconciliation; never renumber existing people/stores.',
    storePolicy: 'Store IDs identify inventory records pending duplicate/branch reconciliation; they do not assert 783 unique physical locations.',
    agents: agents.map((row, index) => ({ agentId: `AGT-LAG-${String(index + 1).padStart(4, '0')}`, sourceRow: row.sourceRow, fullName: row['Agent Name'], designation: row.Designation, cluster: row['New Cluster'], supervisor: row['Current Supervisor'], zone: row['New Zone'], zonalLead: row['Zonal Lead'], sourceStoreOrAxis: row['Store / Current Axis'] })),
    stores: sourceStores.map((row, index) => ({ storeId: `STR-LAG-${String(index + 1).padStart(4, '0')}`, sourceRow: row.sourceRow, name: row['Unified Store Name'], address: row.address, cluster: row['New Cluster'], supervisor: row['Cluster Supervisor'], zone: row['New Lagos Zone'], zonalLead: row['Zonal Lead'], aliases: [row['Unified Store Name'], ...(row.retailNameForMatching || '').split('|'), row.stepNameForMatching].filter(Boolean).map(value => value.trim()) })),
  };
  await writeFile(registerPath, JSON.stringify(register, null, 2) + '\n', { flag: 'wx' });
}

// Matching is intentionally conservative: formatting-only normalization, unique
// exact name within the assigned cluster. Other candidates require review.
const links = register.agents.map(agent => {
  const axis = agent.sourceStoreOrAxis;
  const key = normalize(axis);
  const pool = register.stores.filter(store => store.cluster === agent.cluster);
  const exact = pool.filter(store => store.aliases.some(alias => normalize(alias) === key));
  const areaOnly = /portfolio|\baxis\b|^Surulere\s*\//i.test(axis);
  const brand = key.startsWith('3chub') ? '3chub' : key.split(/(?=\d)/)[0];
  const firstWord = normalize(axis.split(/\s+/)[0]);
  const suggested = pool.filter(store => store.aliases.some(alias => {
    const name = normalize(alias);
    return name.includes(key) || key.includes(name) || (name.startsWith(firstWord) && (firstWord.length >= 4 || brand === '3chub'));
  }));
  return {
    agentId: agent.agentId, agentName: agent.fullName, sourceStoreOrAxis: axis,
    storeId: !areaOnly && exact.length === 1 ? exact[0].storeId : null,
    status: areaOnly ? 'AREA_ONLY' : exact.length === 1 ? 'LINKED' : exact.length > 1 ? 'AMBIGUOUS' : suggested.length ? 'REVIEW_REQUIRED' : 'STORE_NOT_FOUND',
    basis: !areaOnly && exact.length === 1 ? 'Unique exact source-name match within assigned cluster (formatting and ICM abbreviation normalized)' : 'No unique exact store identity established',
    candidateStoreIds: areaOnly ? [] : (exact.length ? exact : suggested).map(store => store.storeId),
    effectiveFrom: null,
    scope: 'Roster store reference; non-exclusive. Does not prove attendance or authorize automatic sale attribution.',
  };
});
await writeFile('data/masters/lagos-agent-store-links.json', JSON.stringify({ sourceSha256: profile.sha256, links }, null, 2) + '\n');

const workbook = new ExcelJS.Workbook();
function sheet(name, rows) {
  const ws = workbook.addWorksheet(name);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  ws.columns = headers.map(key => ({ header: key, key, width: key.toLowerCase().includes('id') ? 22 : 32 }));
  ws.addRows(rows);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headers.length } };
  ws.getRow(1).font = { bold: true };
}
const storesById = new Map(register.stores.map(store => [store.storeId, store]));
sheet('Agents', register.agents);
sheet('Agent Store Links', links.map(link => ({ agentId: link.agentId, agentName: link.agentName, sourceStoreOrAxis: link.sourceStoreOrAxis, storeId: link.storeId || '', storeName: storesById.get(link.storeId)?.name || '', status: link.status, candidateStoreIds: link.candidateStoreIds.join(', '), basis: link.basis })));
sheet('Stores', register.stores.map(store => ({ ...store, aliases: store.aliases.join(' | ') })));
sheet('Review Candidates', links.filter(link => link.status !== 'LINKED').flatMap(link => link.candidateStoreIds.length ? link.candidateStoreIds.map(id => ({ agentId: link.agentId, agentName: link.agentName, sourceStoreOrAxis: link.sourceStoreOrAxis, status: link.status, candidateStoreId: id, candidateStoreName: storesById.get(id).name, candidateAddress: storesById.get(id).address || 'No store address' })) : [{ agentId: link.agentId, agentName: link.agentName, sourceStoreOrAxis: link.sourceStoreOrAxis, status: link.status, candidateStoreId: '', candidateStoreName: '', candidateAddress: '' }]));
sheet('Read Me', [
  { topic: 'IDs', note: 'Allocated once in data/masters/lagos-identity-register.json. Preserve this register; never renumber IDs.' },
  { topic: 'Store grain', note: 'Store IDs identify source inventory records, not deduplicated physical stores.' },
  { topic: 'Links', note: 'LINKED = one exact name/format match in the same cluster. Other rows require review; candidates are not assignments.' },
  { topic: 'Shared stores', note: 'Multiple agents may reference one store. A store link does not automatically attribute sales or prove attendance.' },
  { topic: 'Dates', note: 'No assignment/employment effective dates supplied; none invented. No database master import performed.' },
]);
await workbook.xlsx.writeFile('artifacts/lagos-agent-store-register.xlsx');
console.log(JSON.stringify({ agents: register.agents.length, storeRecords: register.stores.length, statuses: links.reduce((result, row) => ({ ...result, [row.status]: (result[row.status] || 0) + 1 }), {}), links: links.map(({agentId,agentName,storeId,status}) => ({agentId,agentName,storeId,status})) }, null, 2));
