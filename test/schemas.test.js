import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Transaction, Attendance, WorkingCalendar, Agent, Target, UploadRow } from '../server/models/index.js';

const id = () => new mongoose.Types.ObjectId();
const sale = overrides => new Transaction({ sourceSystem: 'sales-export', transactionId: 'TX1', businessDate: '2026-09-11', valueKobo: 1200000, sourceRow: id(), ...overrides });

test('valid sales require attribution, but not attendance or a store', async () => {
  await assert.rejects(sale({ status: 'VALID' }).validate());
  await sale({ status: 'VALID', agent: id(), cluster: id() }).validate();
  await sale({ status: 'UNATTRIBUTED' }).validate();
  await assert.rejects(sale({ status: 'UNATTRIBUTED', agent: id() }).validate());
});

test('money is positive safe integer kobo; impossible dates and unknown canonical plans fail', async () => {
  for (const valueKobo of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(sale({ valueKobo }).validate());
  }
  await assert.rejects(sale({ businessDate: '2026-02-30' }).validate());
  await assert.rejects(sale({ plan: 'NEW_PLAN' }).validate());
  const unknown = sale({ rawPlan: 'NEW_PLAN' });
  await unknown.validate();
  assert.equal(unknown.plan, 'UNCLASSIFIED');
});

test('raw staging retains invalid sales without canonical validation', async () => {
  await new UploadRow({ upload: id(), sheet: 'Sales', rowNumber: 2, raw: { value: 'bad', date: 'unknown' }, status: 'FLAGGED' }).validate();
});

test('calendars reject duplicate, impossible, and out-of-month days', async () => {
  for (const workingDates of [[], ['2026-09-01', '2026-09-01'], ['2026-09-31'], ['2026-10-01']]) {
    await assert.rejects(new WorkingCalendar({ month: '2026-09', name: 'Lagos', workingDates }).validate());
  }
  await new WorkingCalendar({ month: '2026-09', name: 'Lagos', workingDates: ['2026-09-01'] }).validate();
});

test('employment and clock-out cannot end before they start', async () => {
  await assert.rejects(new Agent({ agentId: 'A1', fullName: 'Example', role: 'Sales Executive', startDate: '2026-09-02', exitDate: '2026-09-01' }).validate());
  await assert.rejects(new Attendance({ agent: id(), businessDate: '2026-09-11', attendanceStatus: 'PRESENT', sourceRow: id(), clockIn: new Date('2026-09-11T09:00:00Z'), clockOut: new Date('2026-09-11T08:00:00Z') }).validate());
});

test('canonical grains declare compound unique indexes', () => {
  for (const [model, keys] of [[Transaction, { sourceSystem: 1, transactionId: 1 }], [Attendance, { agent: 1, businessDate: 1 }], [Target, { agent: 1, month: 1 }]]) {
    assert.ok(model.schema.indexes().some(([actual, options]) => JSON.stringify(actual) === JSON.stringify(keys) && options.unique));
  }
});
