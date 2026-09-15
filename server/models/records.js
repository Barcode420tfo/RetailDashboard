import { schema, model, text, ref, day, choice, integer, plans, unique, dateRange } from './shared.js';

const transactionSchema = schema({
  region: choice(['LAG','NOR','SSE'], 'LAG'),
  sourceSystem: { ...text(), immutable: true },
  transactionId: { ...text(), immutable: true },
  businessDate: day(), agent: ref('Agent', false), store: ref('Store', false),
  // Snapshot resolved from the agent assignment effective on businessDate.
  cluster: ref('Cluster', false),
  valueKobo: integer(1), currency: { type: String, enum: ['NGN'], default: 'NGN', required: true },
  brand: text(false), device: text(false), rawPlan: text(false), plan: choice(plans, 'UNCLASSIFIED'),
  sourceCluster: text(false), sourceState:text(false), sourceZone: text(false), sourceAgentName: text(false), sourceStoreName: text(false),
  sourceTimestamp: text(false), identityMethod: choice(['POLICY_ID', 'FINGERPRINT'], 'POLICY_ID'),
  status: choice(['PENDING', 'VALID', 'ACCEPTED_BASELINE', 'UNATTRIBUTED', 'EXCLUDED', 'TEST'], 'PENDING'),
  sourceRow: { ...ref('UploadRow'), immutable: true },
  latestSourceRow: ref('UploadRow', false),
  lastReconciliation: ref('Reconciliation', false),
}, [[{ sourceSystem: 1, transactionId: 1 }, unique], [{ status: 1, businessDate: 1, agent: 1 }], [{ cluster: 1, businessDate: 1, status: 1 }], [{ store: 1, businessDate: 1 }]]);
transactionSchema.pre('validate', function() {
  if (this.status === 'VALID' && (!this.agent || !this.cluster)) this.invalidate('agent', 'Valid sales require an agent and historical cluster');
  if (this.status === 'UNATTRIBUTED' && this.agent) this.invalidate('agent', 'Unattributed sales cannot have an agent');
});
export const Transaction = model('Transaction', transactionSchema);

export const Attendance = model('Attendance', dateRange(schema({
  agent: ref('Agent'), businessDate: day(),
  attendanceStatus: choice(['PRESENT', 'ABSENT', 'LEAVE', 'OFF_DAY']),
  clockIn: Date, clockOut: Date, lateMinutes: integer(0, false),
  sourceRow: ref('UploadRow'), lastReconciliation: ref('Reconciliation', false),
}, [[{ agent: 1, businessDate: 1 }, unique], [{ businessDate: 1, attendanceStatus: 1 }]]), 'clockIn', 'clockOut'));
