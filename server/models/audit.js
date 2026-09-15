import { Schema, schema, model, text, ref, choice, integer, unique } from './shared.js';

export const Reconciliation = model('Reconciliation', schema({
  entityType: choice(['TRANSACTION', 'ATTENDANCE', 'UPLOAD_ROW']),
  entityId: { type: Schema.Types.ObjectId, required: true },
  action: choice(['ASSIGN_AGENT', 'CORRECT', 'LEAVE_UNATTRIBUTED', 'EXCLUDE', 'MARK_TEST', 'RESTORE']),
  before: { type: Schema.Types.Mixed, required: true, immutable: true },
  after: { type: Schema.Types.Mixed, required: true, immutable: true },
  reason: { ...text(), immutable: true }, performedBy: { ...ref('User'), immutable: true },
  expectedVersion: integer(), idempotencyKey: { ...text(), immutable: true },
}, [[{ idempotencyKey: 1 }, unique], [{ entityType: 1, entityId: 1, createdAt: -1 }]]));

export const AuditLog = model('AuditLog', schema({
  actor: ref('User'), action: text(), entityType: text(), entityId: { type: Schema.Types.ObjectId, required: true },
  before: Schema.Types.Mixed, after: Schema.Types.Mixed, reason: text(), requestId: text(false),
}, [[{ entityType: 1, entityId: 1, createdAt: -1 }], [{ actor: 1, createdAt: -1 }]]));
