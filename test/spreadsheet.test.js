import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

test('spreadsheet export/import round trip works with patched UUID dependency', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales');
  sheet.addRows([['Agent', 'Value'], ['Example', 195000]]);
  sheet.addConditionalFormatting({
    ref: 'B2:B2',
    rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF2563EB' }, gradient: false }],
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(buffer);
  assert.equal(restored.getWorksheet('Sales').getCell('B2').value, 195000);
  assert.ok(sheet.conditionalFormattings[0].rules[0].x14Id, 'UUID generated for extended formatting');
});
