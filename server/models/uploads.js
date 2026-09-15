import { Schema, schema, model, text, ref, day, choice, integer, unique } from './shared.js';

export const Upload = model('Upload', schema({
  uploadId: { ...text(), immutable: true },
  type: choice(['AGENTS', 'STORES', 'TARGETS', 'SALES', 'ATTENDANCE']),
  sourceSystem: text(), filename: text(), fileSha256: { ...text(), match: /^[a-f0-9]{64}$/ },
  storageKey: text(), uploadedBy: ref('User'), reportingDate: day(),
  status: choice(['RECEIVED', 'VALIDATING', 'PREVIEW', 'IMPORTING', 'COMPLETED', 'FAILED'], 'RECEIVED'),
  mappingVersion: text(), mapping: { type: Map, of: String },
  recordCount: integer(), acceptedCount: { ...integer(), default: 0 },
  flaggedCount: { ...integer(), default: 0 }, rejectedCount: { ...integer(), default: 0 },
  duplicateCount: { ...integer(), default: 0 },
  approvedBy: ref('User', false), approvedAt: Date, failureMessage: text(false),
}, [[{ uploadId: 1 }, unique], [{ fileSha256: 1, type: 1 }], [{ createdAt: -1 }]]));

export const UploadRow = model('UploadRow', schema({
  upload: { ...ref('Upload'), immutable: true }, sheet: { ...text(), immutable: true },
  rowNumber: { ...integer(1), immutable: true },
  raw: { type: Schema.Types.Mixed, required: true, immutable: true },
  normalized: Schema.Types.Mixed,
  status: choice(['PENDING', 'VALID', 'FLAGGED', 'REJECTED', 'DUPLICATE', 'IMPORTED'], 'PENDING'),
  issues: [{ _id: false, code: text(), field: text(false), message: text(), severity: choice(['WARNING', 'ERROR']) }],
  transaction: ref('Transaction', false), attendance: ref('Attendance', false),
}, [[{ upload: 1, sheet: 1, rowNumber: 1 }, unique], [{ status: 1, upload: 1 }]]));
