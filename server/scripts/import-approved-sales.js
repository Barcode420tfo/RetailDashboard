import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import {resolveCluster} from '../services/cluster-aliases.js';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../db.js';
import { Agent, Cluster, Transaction, Upload, UploadRow, User, ReportingPeriod } from '../models/index.js';

const source = process.argv[2];
if (!source) throw new Error('Provide the approved raw workbook path');
const apply = process.argv.includes('--apply');
const bytes = await readFile(source);
const hash = createHash('sha256').update(bytes).digest('hex');
const workbook = await new ExcelJS.Workbook().xlsx.load(bytes);
const entries = [];
const normalize = value => String(value || '').toLowerCase().replace(/\(queen\)/g, '').replace(/[^a-z0-9]/g, '');
const objectId = value => new mongoose.Types.ObjectId(createHash('sha256').update(value).digest('hex').slice(0, 24));
for (const sheet of workbook.worksheets) {
  const day = Number(sheet.name.match(/^\d+/)?.[0]);
  if (!day || day > 11) throw new Error(`Unexpected sheet: ${sheet.name}`);
  const headers = sheet.getRow(1).values;
  const field = (row, name) => headers.indexOf(name) > 0 ? row.getCell(headers.indexOf(name)).value : null;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || field(row, 'Premium') == null) return;
    const valueKobo = Math.round(Number(field(row, 'Premium')) * 100);
    if (!Number.isSafeInteger(valueKobo) || valueKobo <= 0 || String(field(row, 'Payment Status')).toUpperCase() !== 'SUCCESS') throw new Error(`Invalid sale ${sheet.name}:${rowNumber}`);
    const policyId = field(row, 'Policy ID');
    // Sensitive customer fields are excluded from normalized/API records. IMEI
    // participates only in the hashed fallback identity, never in UI/export.
    const fingerprint = createHash('sha256').update(JSON.stringify([field(row, 'Sales Date'), field(row, 'Device IMEI'), field(row, 'Store Name'), field(row, 'Premium'), field(row, 'Variant/Plan')])).digest('hex');
    entries.push({ sheet: sheet.name, rowNumber, transactionId: policyId || `FP-${fingerprint}`, identityMethod: policyId ? 'POLICY_ID' : 'FINGERPRINT', businessDate: `2026-09-${String(day).padStart(2, '0')}`, valueKobo, sourceAgentName: String(field(row, 'MBE Name') || 'Unattributed'), sourceZone: String(field(row, 'State') || 'Unmapped'), sourceCluster: String(field(row, 'Cluster') || ''), sourceStoreName: String(field(row, 'Store Name') || ''), sourceTimestamp: String(field(row, 'Sales Date') || ''), device: String(field(row, 'Device Name') || 'Unclassified'), rawPlan: String(field(row, 'Variant/Plan') || 'UNCLASSIFIED') });
  });
}
if (entries.length !== 219 || entries.reduce((sum, row) => sum + row.valueKobo, 0) !== 571685000) throw new Error('Workbook differs from the explicitly approved 219 / NGN 5,716,850 baseline');
if (new Set(entries.map(row => row.transactionId)).size !== entries.length) throw new Error('Duplicate source identities; review required');
console.log(`Validated ${entries.length} records / NGN 5,716,850. ${apply ? 'Importing approved baseline.' : 'Preview only.'}`);
if (apply) {
  try {
    await connectDatabase();
    const uploadId = `UPLOAD-20260911-${hash.slice(0, 12)}`;
    if (await Upload.exists({ uploadId, status: 'COMPLETED' })) console.log('Approved batch already imported; existing records and corrections preserved.');
    else {
      if (await ReportingPeriod.exists({ month: '2026-09' })) throw new Error('Reporting period already exists; reconcile before replacing');
      const agents = await Agent.find().lean();
      const clusters = await Cluster.find().lean();
      if (agents.length !== 32 || clusters.length !== 7) throw new Error('Import master data first');
      const uploaderId = objectId('local-approved-baseline-importer');
      const batchId = objectId(uploadId);
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      await mkdir('.local/source-data/accepted-sales', { recursive: true });
      const storageKey = `.local/source-data/accepted-sales/${hash}.xlsx`;
      await copyFile(source, storageKey);
      const transactions = entries.map(entry => {
        const agent = agents.find(agent => normalize(agent.fullName) === normalize(entry.sourceAgentName));
        const resolved = resolveCluster({region:'LAG',month:entry.businessDate.slice(0,7),cluster:entry.sourceCluster,agentName:entry.sourceAgentName,storeName:entry.sourceStoreName,zone:entry.sourceZone});
        const cluster = clusters.find(cluster => cluster.zone === entry.sourceZone && (entry.sourceCluster ? resolved.status === 'MATCHED' && cluster.name === resolved.name : String(cluster._id) === String(agent?.currentCluster)));
        const { sheet, rowNumber, ...fields } = entry;
        return { _id: objectId(`DEVPRO:${entry.transactionId}`), ...fields, agent: agent?._id, cluster: cluster?._id, sourceSystem: 'DEVPRO', sourceRow: objectId(`${uploadId}:${sheet}:${rowNumber}`), status: 'ACCEPTED_BASELINE', plan: ['SLD', 'SAP', 'ESSENTIAL'].includes(entry.rawPlan.toUpperCase()) ? entry.rawPlan.toUpperCase() : 'UNCLASSIFIED', brand: /samsung/i.test(entry.device) ? 'Samsung' : /infinix/i.test(entry.device) ? 'Infinix' : /xiaomi|redmi/i.test(entry.device) ? 'Xiaomi / Redmi' : /tecno/i.test(entry.device) ? 'Tecno' : /itel/i.test(entry.device) ? 'Itel' : /oppo/i.test(entry.device) ? 'Oppo' : /honor/i.test(entry.device) ? 'Honor' : 'Other' };
      });
      const workingDates = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`).filter(date => new Date(`${date}T12:00:00Z`).getUTCDay() !== 0);
      const period = { month: '2026-09', asOf: '2026-09-11', workingDates, availableDates: [...new Set(entries.map(row => row.businessDate))], zoneTargets: [{zone:'Lagos Central',valueKobo:1080000000},{zone:'Lagos East',valueKobo:720000000},{zone:'Lagos Island',valueKobo:460000000},{zone:'Lagos West',valueKobo:550000000}], sourceLabel: '1st to 11th raw data.xlsx', sourceSha256: hash, approvedCount:219,approvedValueKobo:571685000,notes:['User-approved working baseline; manual corrections may be added later.','September 6 has no source worksheet; September 9 is incomplete due to the reported system glitch.','Business dates follow source sheet labels; original timestamps retained.','26 selling days; Sundays excluded, consistent with the supplied pace reports.','Zone reporting retains raw source zone attribution. Cluster breakdown uses roster mapping where zone agrees.'] };
      for (const tx of transactions) await new Transaction(tx).validate();
      await new ReportingPeriod(period).validate();
      for (const model of [User, Upload, UploadRow, Transaction, ReportingPeriod]) await model.createIndexes();
      await mongoose.connection.transaction(async session => {
        await User.updateOne({ _id:uploaderId }, { $setOnInsert:{ name:'Local baseline importer',email:'baseline-importer@local.invalid',passwordHash,role:'ADMIN',active:false } }, {upsert:true,session});
        await Upload.create([{ _id:batchId,uploadId,type:'SALES',sourceSystem:'DEVPRO',filename:'1st to 11th raw data.xlsx',fileSha256:hash,storageKey,uploadedBy:uploaderId,reportingDate:'2026-09-11',status:'COMPLETED',mappingVersion:'approved-baseline-v1',recordCount:219,acceptedCount:219,flaggedCount:0,approvedBy:uploaderId,approvedAt:new Date() }],{session});
        await UploadRow.insertMany(entries.map((entry,index)=>({ _id:transactions[index].sourceRow,upload:batchId,sheet:entry.sheet,rowNumber:entry.rowNumber,raw:entry,normalized:entry,status:'IMPORTED',transaction:transactions[index]._id })),{session});
        await Transaction.insertMany(transactions,{session});
        await ReportingPeriod.create([period],{session});
      });
      console.log('Approved source batch, 219 transactions, and September zone targets committed.');
    }
  } finally { await disconnectDatabase(); }
}
