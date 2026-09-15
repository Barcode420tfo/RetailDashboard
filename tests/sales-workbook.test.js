import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseMoney,parseSalesWorkbook,stateIdentity} from '../server/services/sales-workbook.js';

test('sales money retains exact kobo and rejects invalid premiums',()=>{
  assert.equal(parseMoney('7150.01'),715001);
  assert.equal(parseMoney('0.29'),29);
  for(const input of ['',0,-1,'1.001','NaN','1e6','9007199254740992'])assert.throws(()=>parseMoney(input));
});
test('state spellings are normalized without guessing missing regions',()=>{
  assert.deepEqual(stateIdentity(' Fct '),{state:'FCT',region:'NOR'});
  assert.deepEqual(stateIdentity('Abuja'),{state:'FCT',region:'NOR'});
  assert.deepEqual(stateIdentity('Rivers State'),{state:'Rivers',region:'SSE'});
  assert.deepEqual(stateIdentity(''),{state:null,region:null});
});
test('workbook parsing uses recorded dates, not the filename, and retains review statuses',async()=>{
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('other states');
  sheet.addRow(['Policy ID','Premium','Payment Amount','Sales Date','Payment Status','MBE Name','Store Name','State','Device Name','Variant/Plan']);
  sheet.addRow(['p1','6000','6000','2026-09-15T04:00:00.000Z','ACTIVE','','','Fct','Samsung','SLD']);
  const [row]=await parseSalesWorkbook(await book.xlsx.writeBuffer());
  assert.equal(row.businessDate,'2026-09-15');
  assert.equal(row.paymentStatus,'ACTIVE');
  assert.equal(row.sourceAgentName,'Unattributed');
  assert.equal(row.valueKobo,600000);
  sheet.getCell('C2').value='5999';
  await assert.rejects(parseSalesWorkbook(await book.xlsx.writeBuffer()),/Payment mismatch/);
});
