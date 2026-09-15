import { schema, model, text, ref, day, month, choice, integer, unique, optionalUnique, dateRange } from './shared.js';

export const User = model('User', schema({
  name: text(), email: { ...text(), lowercase: true },
  passwordHash: { ...text(), select: false },
  role: choice(['ADMIN', 'MANAGEMENT', 'SUPERVISOR']),
  active: { type: Boolean, default: true }, clusterScope: [ref('Cluster')],
}, [[{ email: 1 }, unique]]));

export const Cluster = model('Cluster', schema({
  clusterId: { ...text(), immutable: true }, name: text(), zone: text(),
  active: { type: Boolean, default: true },
}, [[{ clusterId: 1 }, unique], [{ name: 1 }, unique]]));

export const Agent = model('Agent', dateRange(schema({
  agentId: { ...text(), immutable: true }, employeeId: text(false), fullName: text(), role: text(),
  startDate: day(false), exitDate: day(false),
  currentCluster: ref('Cluster', false), currentSupervisor: ref('LeadershipPerson', false),
  currentStatus: choice(['ACTIVE', 'INACTIVE', 'RESIGNED', 'UNKNOWN'], 'UNKNOWN'),
  sourceStoreOrAxis: text(false),
}, [[{ agentId: 1 }, unique], [{ employeeId: 1 }, optionalUnique('employeeId')]]), 'startDate', 'exitDate'));

// Effective periods are inclusive. The service must reject overlapping periods.
export const AgentAssignment = model('AgentAssignment', dateRange(schema({
  agent: ref('Agent'), cluster: ref('Cluster'), supervisor: ref('Agent', false),
  status: choice(['ACTIVE', 'INACTIVE', 'RESIGNED']), effectiveFrom: day(), effectiveTo: day(false),
}, [[{ agent: 1, effectiveFrom: 1 }, unique], [{ cluster: 1, effectiveFrom: 1 }]]), 'effectiveFrom', 'effectiveTo'));

export const Store = model('Store', schema({
  storeId: { ...text(), immutable: true }, name: text(), address: text(false),
  area: text(false), state: text(), cluster: ref('Cluster', false),
  region: choice(['LAG','NOR','SSE'], 'LAG'), sourceCode:text(false), sourceRef:text(false), sourceRows:[Number], reviewNote:text(false),
  status: choice(['ACTIVE', 'INACTIVE', 'UNKNOWN'], 'UNKNOWN'),
}, [[{ storeId: 1 }, unique], [{ cluster: 1, status: 1 }]]));

const calendarSchema = schema({
  month: month(), name: text(), timezone: { ...text(), default: 'Africa/Lagos' },
  workingDates: { type: [String], required: true, default: undefined },
}, [[{ month: 1, name: 1 }, unique]]);
calendarSchema.path('workingDates').validate(function(dates) {
  return dates.length > 0 && new Set(dates).size === dates.length && dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d && d.slice(0, 7) === this.month);
}, 'Working dates must be unique, valid dates within the calendar month');
export const WorkingCalendar = model('WorkingCalendar', calendarSchema);

export const Target = model('Target', schema({
  agent: ref('Agent'), month: month(), valueKobo: integer(),
  calendar: ref('WorkingCalendar'), effectiveDate: day(),
  status: choice(['DRAFT', 'APPROVED'], 'DRAFT'),
  revision: { ...integer(1), default: 1 }, updatedBy: ref('User'),
}, [[{ agent: 1, month: 1 }, unique], [{ month: 1, status: 1 }]]));

export const PlanMapping = model('PlanMapping', schema({
  sourceSystem: text(), rawPlan: text(), plan: choice(['SLD', 'SAP', 'ESSENTIAL']), approvedBy: ref('User'),
}, [[{ sourceSystem: 1, rawPlan: 1 }, unique]]));
