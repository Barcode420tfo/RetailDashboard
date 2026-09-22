import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../db.js';
import { Agent, Store, Cluster, LeadershipPerson, LeadershipAssignment, AgentStoreReference, MasterImport } from '../models/index.js';

const flags = process.argv.slice(2);
if (flags.some(flag => !['--apply', '--validate-only'].includes(flag)) || (flags.includes('--apply') && flags.includes('--validate-only'))) throw new Error('Use no flags for preview, --validate-only for offline validation, or --apply to import');
const apply = flags.includes('--apply');
const files = ['data/masters/lagos-identity-register.json', 'data/masters/lagos-leadership-register.json', 'data/masters/lagos-agent-store-links.json', '.local/source-data/lagos/extracted-records.json', '.local/source-data/lagos/profile.json'];
const contents = await Promise.all(files.map(file => readFile(file, 'utf8')));
const [master, leadership, links, extracted, profile] = contents.map(content => JSON.parse(content));
if ([leadership.sourceSha256, links.sourceSha256, profile.sha256].some(hash => hash !== master.sourceSha256)) throw new Error('Source versions differ; reconcile registers first');
const digest = createHash('sha256').update(JSON.stringify(contents)).digest('hex');
const importKey = `lagos-initial-masters-v1:${digest}`;
const id = value => new mongoose.Types.ObjectId(createHash('sha256').update(`sales-operations:${value}`).digest('hex').slice(0, 24));
const clusterId = name => `CLU-LAG-${name.replace(/^Lagos /, '').toUpperCase().replaceAll(' ', '-')}`;
const agentIds = new Set(master.agents.map(row => row.agentId));
const storeIds = new Set(master.stores.map(row => row.storeId));
const clusterNames = new Set(extracted.clusters.map(row => row.canonicalCluster));
const leaderIds = new Set(leadership.people.map(row => row.personId));
if (agentIds.size !== master.agents.length || storeIds.size !== master.stores.length || leaderIds.size !== leadership.people.length) throw new Error('Duplicate IDs in registers');
const personName = personId => leadership.people.find(row => row.personId === personId)?.displayName;
const supervisorFor = cluster => leadership.assignments.find(row => row.role === 'CLUSTER_SUPERVISOR' && row.scope === cluster);
for (const row of [...master.agents, ...master.stores]) {
  if (!clusterNames.has(row.cluster)) throw new Error(`Unknown cluster: ${row.cluster}`);
  const guide = extracted.clusters.find(entry => entry.canonicalCluster === row.cluster);
  if (row.zone !== guide.Zone || personName(supervisorFor(row.cluster)?.personId) !== row.supervisor) throw new Error('Hierarchy mismatch');
}
for (const role of leadership.assignments) if (!leaderIds.has(role.personId)) throw new Error('Unknown leadership person');
if (links.links.length !== master.agents.length || new Set(links.links.map(row => row.agentId)).size !== agentIds.size) throw new Error('Incomplete agent-store references');
for (const row of links.links) {
  if (!agentIds.has(row.agentId) || (row.storeId && !storeIds.has(row.storeId)) || row.candidateStoreIds.some(value => !storeIds.has(value))) throw new Error('Invalid agent/store reference');
  if ((row.status === 'LINKED') !== Boolean(row.storeId)) throw new Error('Store link status mismatch');
}
const batches = [
  [Cluster, extracted.clusters.map(row => ({ _id: id(clusterId(row.canonicalCluster)), clusterId: clusterId(row.canonicalCluster), name: row.canonicalCluster, zone: row.Zone }))],
  [LeadershipPerson, leadership.people.map(row => ({ _id: id(row.personId), ...row }))],
  [LeadershipAssignment, leadership.assignments.map(row => ({ _id: id(row.assignmentId), assignmentId: row.assignmentId, person: id(row.personId), role: row.role, scope: row.scope }))],
  [Agent, master.agents.map(row => ({ _id: id(row.agentId), agentId: row.agentId, fullName: row.fullName, role: row.designation, currentCluster: id(clusterId(row.cluster)), currentSupervisor: id(supervisorFor(row.cluster).personId), currentStatus: 'ACTIVE', sourceStoreOrAxis: row.sourceStoreOrAxis }))],
  [Store, master.stores.map(row => ({ _id: id(row.storeId), storeId: row.storeId, name: row.name, address: row.address || undefined, state: extracted.stores.find(store => store.sourceRow === row.sourceRow)?.State, cluster: id(clusterId(row.cluster)), status: 'UNKNOWN' }))],
  [AgentStoreReference, links.links.map(row => ({ _id: id(`agent-store-reference:${row.agentId}`), agent: id(row.agentId), store: row.storeId ? id(row.storeId) : undefined, sourceStoreOrAxis: row.sourceStoreOrAxis, status: row.status, candidateStores: row.candidateStoreIds.map(id), basis: row.basis }))],
];
const counts = {};
for (const [model, rows] of batches) {
  counts[model.modelName] = rows.length;
  for (const row of rows) await new model(row).validate();
}
console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'PREVIEW', counts, linkedStores: links.links.filter(row => row.status === 'LINKED').length, pendingStoreReferences: links.links.filter(row => row.status !== 'LINKED').length, dates: 'Unknown dates remain unset; current roster references are not historical assignments' }, null, 2));
if (!flags.includes('--validate-only')) {
  try {
    await connectDatabase();
    console.log(`Connected database: ${mongoose.connection.name}`);
    const receipt = await MasterImport.findOne({ importKey }).lean();
    if (receipt) console.log('This exact import already completed. No records changed.');
    else {
      for (const [model] of batches) if (await model.exists({})) throw new Error(`${model.modelName} already contains data. Initial importer will not overwrite existing masters.`);
      if (!apply) console.log('Preview passed. Run npm run db:import -- --apply to insert these records. No data written.');
      else {
        for (const model of [...batches.map(([model]) => model), MasterImport]) await model.createIndexes();
        await mongoose.connection.transaction(async session => {
          for (const [model, rows] of batches) {
            if (await model.exists({}).session(session)) throw new Error('Master records changed during import; aborting');
            await model.insertMany(rows, { session });
          }
          await MasterImport.create([{ importKey, sourceSha256: master.sourceSha256, registerSha256: digest, counts }], { session });
        });
        for (const [model, rows] of batches) {
          if (await model.countDocuments({ _id: { $in: rows.map(row => row._id) } }) !== rows.length) throw new Error(`Post-import verification failed for ${model.modelName}`);
        }
        console.log('Import committed and verified. Existing IDs preserved. Repeating this command will not duplicate records.');
      }
    }
  } finally { await disconnectDatabase(); }
}
