import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ExcelJS from 'exceljs';

const master = JSON.parse(await readFile('data/masters/lagos-identity-register.json', 'utf8'));
const source = JSON.parse(await readFile('.local/source-data/lagos/extracted-records.json', 'utf8'));
const profile = JSON.parse(await readFile('.local/source-data/lagos/profile.json', 'utf8'));
if (profile.sha256 !== master.sourceSha256) throw new Error('Reconcile source versions before allocating leadership IDs');
const path = 'data/masters/lagos-leadership-register.json';
let register;
try {
  register = JSON.parse(await readFile(path, 'utf8'));
  if (register.sourceSha256 !== master.sourceSha256) throw new Error('Preserve existing leadership IDs and reconcile the revised source first');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const people = [];
  const assignments = [];
  const personId = name => {
    const existing = people.find(person => person.displayName === name);
    if (existing) return existing.personId;
    const person = { personId: `LDR-LAG-${String(people.length + 1).padStart(4, '0')}`, displayName: name, nameStatus: ['Titi', 'TCD'].includes(name) ? 'FULL_NAME_NOT_SUPPLIED' : 'AS_SUPPLIED' };
    people.push(person);
    return person.personId;
  };
  const add = (assignmentId, role, scope, name, basis) => assignments.push({ assignmentId, personId: personId(name), role, scope, effectiveFrom: null, basis });
  add('RL-LAG-0001', 'REGIONAL_LEAD', 'Lagos', source.leadershipClarification.person, 'Explicit user clarification');
  const zones = [...new Map(source.clusters.map(cluster => [cluster.Zone, cluster['Zonal Lead']]))];
  zones.forEach(([zone, name], index) => add(`ZL-LAG-${String(index + 1).padStart(4, '0')}`, 'ZONAL_LEAD', zone, name, 'Cluster Guide'));
  source.clusters.forEach((cluster, index) => add(`CS-LAG-${String(index + 1).padStart(4, '0')}`, 'CLUSTER_SUPERVISOR', cluster.canonicalCluster, cluster['Cluster Supervisor'], 'Cluster Guide'));
  register = {
    version: 1, sourceSha256: master.sourceSha256,
    identityPolicy: 'One permanent person ID per leader. Separate IDs identify scoped role assignments. Reuse person IDs across role changes; never renumber.',
    people, assignments,
  };
  await writeFile(path, JSON.stringify(register, null, 2) + '\n', { flag: 'wx' });
}

function hierarchy(row) {
  const supervisor = register.assignments.find(role => role.role === 'CLUSTER_SUPERVISOR' && role.scope === row.cluster);
  const zonal = register.assignments.find(role => role.role === 'ZONAL_LEAD' && role.scope === row.zone);
  const regional = register.assignments.find(role => role.role === 'REGIONAL_LEAD' && role.scope === 'Lagos');
  if (!supervisor || !zonal || !regional) throw new Error(`Missing leadership mapping for ${row.agentId || row.storeId}`);
  const name = id => register.people.find(person => person.personId === id)?.displayName;
  if (name(supervisor.personId) !== row.supervisor || name(zonal.personId) !== row.zonalLead) throw new Error('Leadership differs from saved master: review before linking');
  return {
    ...(row.agentId ? { agentId: row.agentId } : { storeId: row.storeId }),
    cluster: row.cluster, zone: row.zone,
    supervisorPersonId: supervisor.personId, supervisorAssignmentId: supervisor.assignmentId,
    zonalLeadPersonId: zonal.personId, zonalLeadAssignmentId: zonal.assignmentId,
    regionalLeadPersonId: regional.personId, regionalLeadAssignmentId: regional.assignmentId,
  };
}
const links = { sourceSha256: master.sourceSha256, agents: master.agents.map(hierarchy), stores: master.stores.map(hierarchy) };
await writeFile('data/masters/lagos-leadership-links.json', JSON.stringify(links, null, 2) + '\n');
const workbook = new ExcelJS.Workbook();
function addSheet(name, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key, width: key === 'displayName' || key === 'scope' ? 34 : 26 }));
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: { row: rows.length + 1, column: sheet.columnCount } };
}
addSheet('Leaders', register.people);
addSheet('Role Assignments', register.assignments.map(role => ({ ...role, displayName: register.people.find(person => person.personId === role.personId).displayName })));
addSheet('Agent Leadership', links.agents);
addSheet('Store Leadership', links.stores);
addSheet('Read Me', [
  { topic: 'Identity', note: '11 distinct people, 12 scoped leadership assignments. Olajide Tinuoye has one person ID and both regional and Central zonal assignments.' },
  { topic: 'Dates and names', note: 'Effective dates are unknown. Titi and TCD are retained as supplied; their full names are not invented.' },
  { topic: 'Persistence', note: 'Preserve data/masters/lagos-leadership-register.json. IDs are allocated once and reused on reruns. No MongoDB import performed.' },
]);
await mkdir('artifacts', { recursive: true });
await workbook.xlsx.writeFile('artifacts/lagos-leadership-register.xlsx');
console.log(JSON.stringify({ people: register.people.length, roles: register.assignments.length, assignments: register.assignments.map(role => ({ id: role.assignmentId, personId: role.personId, name: register.people.find(person => person.personId === role.personId).displayName, scope: role.scope })) }, null, 2));
