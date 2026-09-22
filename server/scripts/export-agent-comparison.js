import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {performanceTone} from '../../client/performance.js';
const rows=JSON.parse(await readFile('data/reports/agent-performance-september-11.json','utf8'));
const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Agent target vs actual',{views:[{state:'frozen',xSplit:2,ySplit:1}]});
sheet.columns=[['Agent ID','id',25],['Agent','name',34],['Cluster','cluster',24],['Status','employmentStatus',18],['Allocation status','targetStatus',24],['Monthly target','target',19],['MTD sales','value',19],['Achieved %','achievement',16],['Expected pace','expected',19],['Pace %','pace',16],['Gap to pace','gap',19],['Forecast','forecast',19],['Transactions','count',16],['Pending proposal (not applied)','pendingAction',75]].map(([header,key,width])=>({header,key,width}));
for(const row of rows){const r=sheet.addRow(row);for(const c of ['target','value','expected','gap','forecast'])r.getCell(c).numFmt='"₦"#,##0;[Red]-"₦"#,##0';for(const c of ['achievement','pace'])r.getCell(c).numFmt='0.0%';r.getCell('pace').font={color:{argb:'FF'+performanceTone(row.pace).color.slice(1)},bold:true};}
sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF24314B'}};sheet.autoFilter={from:'A1',to:'N1'};
const notes=book.addWorksheet('Read me');notes.getColumn(1).width=120;[
'Sources: Updated LAGOS_TARGET_ALLOCATION_FLAGGED.xlsx and approved 1st to 11th raw data.xlsx.',
'Period: September 1–11, 2026. Currency NGN. DevPro only; DevFin excluded.',
'Monthly allocation: 28,100,000. Sales: 5,716,850 across 219 transactions.',
'30 current roster agents matched. Four resigned/exited allocations retain 3,281,818 pending reallocation.',
'Eniola Sarah and Esan Ayobami Appolus have no assigned target. Blank target comparisons mean unknown, not zero.',
'Achieved % = sales / monthly target. Expected pace = monthly target × 10 / 26 selling days.',
'Pace % = sales / expected pace. Gap = sales minus expected pace. Positive gap means ahead.',
'Forecast = sales / 10 × 26. This is a simple sales-rate projection, including historical rows; it does not assume continued employment or a target transfer.',
'No September 6 sheet; September 9 partial backend records. Forecasts and actuals remain provisional.',
'Source proposed transfers are retained as notes only. No targets were redistributed.',
'Colours for pace: red <50%; amber 50–69%; blue 70–99%; green 100%+.',
].forEach(s=>notes.addRow([s]));await book.xlsx.writeFile('data/reports/Lagos-Agent-Targets-vs-MTD-11-Sep-2026.xlsx');
