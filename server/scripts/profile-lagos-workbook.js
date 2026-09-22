import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Pass the Lagos workbook path as the first argument');
const directory = resolve('.local/source-data/lagos');
await mkdir(directory, { recursive: true });
// Preserve prior reviewed extractions before replacing the current source pointer.
try {
  const previous = JSON.parse(await readFile(`${directory}/profile.json`, 'utf8'));
  const archive = `${directory}/versions/${previous.sha256}`;
  await mkdir(archive, { recursive: true });
  for (const name of ['profile.json', 'raw-workbook.json', 'extracted-records.json']) await copyFile(`${directory}/${name}`, `${archive}/${name}`);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const bytes = await readFile(source);
const workbook = await new ExcelJS.Workbook().xlsx.load(bytes);
const hash = createHash('sha256').update(bytes).digest('hex');
await copyFile(source, `${directory}/${hash}.xlsx`);
const raw = workbook.worksheets.map(sheet => {
  const rows = [];
  sheet.eachRow((row, number) => rows.push({ row: number, hidden: row.hidden || false, cells: row.values.slice(1) }));
  return { sheet: sheet.name, state: sheet.state, rowCount: sheet.rowCount, columnCount: sheet.columnCount, merges: sheet.model.merges, rows };
});
const extract = (name, header) => {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new Error(`Missing sheet: ${name}`);
  const headers = Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(header).getCell(index + 1).text);
  const records = [];
  sheet.eachRow((row, number) => {
    if (number <= header || !row.getCell(1).text.trim()) return;
    records.push({ sourceRow: number, ...Object.fromEntries(headers.map((key, index) => [key, row.getCell(index + 1).text])) });
  });
  return records;
};
const stores = extract('Store Mapping', 5);
const agents = extract('Agent Mapping', 1);
const guide = extract('Cluster Guide', 1);
const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const count = (rows, field) => rows.reduce((result, row) => ({ ...result, [row[field]]: (result[row[field]] || 0) + 1 }), {});
const nameGroups = new Map();
for (const store of stores) {
  const key = normalize(store['Unified Store Name']);
  nameGroups.set(key, [...(nameGroups.get(key) || []), store.sourceRow]);
}
const aliases = {
  'Central 1': 'Lagos Central 1', 'Lagos Central 2': 'Lagos Central 2',
  'East 1': 'Lagos East 1', 'East 2': 'Lagos East 2', 'Lagos Island': 'Lagos Island',
  'West - Cynthia': 'Lagos West 1', 'West - Emmanuel': 'Lagos West 2',
};
const clusters = guide.map(row => ({ ...row, canonicalCluster: aliases[row['Cluster Name']] }));
const lookup = new Map(clusters.map(row => [row.canonicalCluster, row]));
const normalizedStores = stores.map(row => {
  const canonicalCluster = aliases[row['New Cluster']] || row['New Cluster'];
  const entry = lookup.get(canonicalCluster);
  return {
    ...row,
    sourceHierarchy: {
      cluster: row['New Cluster'], supervisor: row['Cluster Supervisor'],
      zone: row['New Lagos Zone'], zonalLead: row['Zonal Lead'],
    },
    'New Cluster': entry ? canonicalCluster : null,
    'Cluster Supervisor': entry?.['Cluster Supervisor'] ?? null,
    'New Lagos Zone': entry?.Zone ?? null,
    'Zonal Lead': entry?.['Zonal Lead'] ?? null,
    hierarchyStatus: entry ? 'RESOLVED_FROM_CLUSTER' : 'UNKNOWN_CLUSTER',
    hierarchyRule: 'User-approved cluster authority; Cluster Guide supplies supervisor, zone, and zonal lead',
    address: !row['Retail Address / Location'].trim() || row['Retail Address / Location'].trim() === '187' ? null : row['Retail Address / Location'].trim(),
    retailNameForMatching: row['Retail Store Name(s)'].trim() === '187' ? null : row['Retail Store Name(s)'].trim() || null,
    stepNameForMatching: row['STEP Store Name'].trim() === '187' ? null : row['STEP Store Name'].trim() || null,
  };
});
const hierarchyConflicts = [];
for (const agent of agents) {
  const entry = lookup.get(agent['New Cluster']);
  if (!entry || entry.Zone !== agent['New Zone'] || entry['Cluster Supervisor'] !== agent['Current Supervisor'] || entry['Zonal Lead'] !== agent['Zonal Lead']) hierarchyConflicts.push({ sheet: 'Agent Mapping', row: agent.sourceRow });
}
for (const store of stores.filter(row => row['New Cluster'] !== 'Review Required')) {
  const entry = lookup.get(aliases[store['New Cluster']]);
  if (!entry || entry.Zone !== store['New Lagos Zone'] || entry['Cluster Supervisor'] !== store['Cluster Supervisor'] || entry['Zonal Lead'] !== store['Zonal Lead']) hierarchyConflicts.push({ sheet: 'Store Mapping', row: store.sourceRow });
}
const sentinelCounts = {};
for (const row of stores) for (const [key, value] of Object.entries(row)) if (value === '187') sentinelCounts[key] = (sentinelCounts[key] || 0) + 1;
const exactKeys = stores.map(({sourceRow, ...row}) => JSON.stringify(Object.values(row).map(normalize)));
const profile = {
  source: resolve(source), sha256: hash, reviewedOn: new Date().toISOString().slice(0, 10),
  sheets: raw.map(({rows, ...metadata}) => ({ ...metadata, populatedRows: rows.length })),
  agentCount: agents.length, agentZones: count(agents, 'New Zone'), agentClusters: count(agents, 'New Cluster'),
  designations: count(agents, 'Designation'), supervisorCounts: count(agents, 'Current Supervisor'),
  uniqueAgentNames: new Set(agents.map(row => normalize(row['Agent Name']))).size,
  supervisorChanges: agents.filter(row => row['Previous Supervisor'] !== row['Current Supervisor']),
  storeRows: stores.length, storeZones: count(stores, 'New Lagos Zone'), storeClusters: count(stores, 'New Cluster'),
  sourceCoverage: count(stores, 'Source Coverage'),
  reviewRequired: stores.filter(row => row['New Cluster'] === 'Review Required').map(row => row.sourceRow),
  reviewZones: count(stores.filter(row => row['New Cluster'] === 'Review Required'), 'New Lagos Zone'),
  sentinelCounts, repeatedNames: [...nameGroups].filter(([, rows]) => rows.length > 1).map(([name, rows]) => ({ name, rows })),
  exactDuplicateRows: exactKeys.length - new Set(exactKeys).size,
  hierarchyConflicts,
  hierarchyRule: { source: 'User clarification, 2026-09-12', authority: 'Assigned cluster', lookup: 'Cluster Guide', derivedFields: ['Cluster Supervisor', 'New Lagos Zone', 'Zonal Lead'] },
  normalizedHierarchy: {
    resolved: normalizedStores.filter(row => row.hierarchyStatus === 'RESOLVED_FROM_CLUSTER').length,
    unresolvedRows: normalizedStores.filter(row => row.hierarchyStatus !== 'RESOLVED_FROM_CLUSTER').map(row => row.sourceRow),
    supervisorCorrections: normalizedStores.filter(row => row['Cluster Supervisor'] !== row.sourceHierarchy.supervisor).length,
    zoneCorrections: normalizedStores.filter(row => row['New Lagos Zone'] !== row.sourceHierarchy.zone).length,
    zonalLeadCorrections: normalizedStores.filter(row => row['Zonal Lead'] !== row.sourceHierarchy.zonalLead).length,
    zones: count(normalizedStores, 'New Lagos Zone'), supervisors: count(normalizedStores, 'Cluster Supervisor'),
  },
  icmOverrides: stores.filter(row => row['Mapping Note']?.includes('ICM operational override')).map(row => ({ row: row.sourceRow, name: row['Unified Store Name'], cluster: row['New Cluster'] })),
  addressRule: { source: 'User clarification, 2026-09-12', rule: 'Blank or exact 187 in address means no store address; preserve raw values. Do not erase a valid address because another field contains 187.' },
  missingAddresses: stores.filter(row => !row['Retail Address / Location'].trim() || row['Retail Address / Location'].trim() === '187').length,
  leadershipClarification: { source: 'User message, 2026-09-12', person: 'Olajide Tinuoye', roles: [{ role: 'REGIONAL_LEAD', scope: 'Lagos' }, { role: 'ZONAL_LEAD', scope: 'Lagos Central' }], effectiveFrom: null },
  clusterAliases: aliases,
};
await writeFile(`${directory}/raw-workbook.json`, JSON.stringify(raw, null, 2));
await writeFile(`${directory}/extracted-records.json`, JSON.stringify({ agents, stores, clusters, leadershipClarification: profile.leadershipClarification }, null, 2));
await writeFile(`${directory}/normalized-stores.json`, JSON.stringify(normalizedStores, null, 2));
await writeFile(`${directory}/profile.json`, JSON.stringify(profile, null, 2));
console.log(JSON.stringify({ ...profile, reviewRequired: profile.reviewRequired.length, supervisorChanges: profile.supervisorChanges.map(row => row['Agent Name']) }, null, 2));
