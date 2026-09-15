import { Schema, schema, model, text, ref, day, choice, unique } from './shared.js';

export const LeadershipPerson = model('LeadershipPerson', schema({
  personId: { ...text(), immutable: true }, displayName: text(),
  nameStatus: choice(['AS_SUPPLIED', 'FULL_NAME_NOT_SUPPLIED']),
}, [[{ personId: 1 }, unique]]));

export const LeadershipAssignment = model('LeadershipAssignment', schema({
  assignmentId: { ...text(), immutable: true }, person: ref('LeadershipPerson'),
  role: choice(['REGIONAL_LEAD', 'ZONAL_LEAD', 'CLUSTER_SUPERVISOR']),
  scope: text(), effectiveFrom: day(false),
}, [[{ assignmentId: 1 }, unique]]));

export const AgentStoreReference = model('AgentStoreReference', schema({
  agent: ref('Agent'), store: ref('Store', false), sourceStoreOrAxis: text(),
  status: choice(['LINKED', 'AMBIGUOUS', 'REVIEW_REQUIRED', 'AREA_ONLY', 'STORE_NOT_FOUND']),
  candidateStores: [ref('Store')], basis: text(),
}, [[{ agent: 1 }, unique]]));

export const MasterImport = model('MasterImport', schema({
  importKey: { ...text(), immutable: true }, sourceSha256: text(), registerSha256: text(),
  counts: { type: Schema.Types.Mixed, required: true },
}, [[{ importKey: 1 }, unique]]));
