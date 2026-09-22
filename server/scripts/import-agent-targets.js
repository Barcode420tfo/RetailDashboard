import {readFile,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import ExcelJS from 'exceljs';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {Agent,ReportingPeriod} from '../models/index.js';
const source=process.argv[2];if(!source)throw Error('Supply target workbook path');
const bytes=await readFile(source),hash=createHash('sha256').update(bytes).digest('hex');
const book=await new ExcelJS.Workbook().xlsx.load(bytes);
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
await connectDatabase();
try{
 const period=await ReportingPeriod.findOne({month:'2026-09'});if(!period)throw Error('Import baseline first');
 if(period.targetSourceSha256){if(period.targetSourceSha256===hash){console.log('Identical target allocation already imported; no changes.');}else throw Error('Existing targets require explicit reconciliation, not replacement');}
 else{
 const roster=await Agent.find().lean(),entries=[];
 for(const sheet of book.worksheets){const headers=sheet.getRow(7).values;const col=name=>headers.indexOf(name);if(col('Sep DevPro Target')<1)throw Error('Missing target header');const zone=period.zoneTargets.find(r=>r.zone.toLowerCase()===sheet.name.toLowerCase())?.zone;if(!zone)throw Error('Unknown source zone');
 sheet.eachRow((row,n)=>{if(n<8)return;const name=row.getCell(col('Team Member')).text.trim();if(!name||name==='ALLOCATED TOTAL')return;const value=row.getCell(col('Sep DevPro Target')).value;if(typeof value!=='number'||value<=0||!Number.isSafeInteger(value*100))throw Error('Invalid DevPro target');const matches=roster.filter(a=>norm(a.fullName)===norm(name));if(matches.length>1)throw Error('Ambiguous agent');entries.push({name,agentId:matches[0]?.agentId,zone,valueKobo:value*100,employmentStatus:row.getCell(col('Agent Status')).text.trim(),pendingAction:row.getCell(col('Reallocation Action')).text.trim(),sourceSheet:sheet.name,sourceRow:n});});
 }
 if(new Set(entries.map(r=>norm(r.name))).size!==entries.length)throw Error('Duplicate target names');
 for(const z of period.zoneTargets)if(entries.filter(r=>r.zone===z.zone).reduce((s,r)=>s+r.valueKobo,0)!==z.valueKobo)throw Error(`Zone target does not reconcile: ${z.zone}`);
 const unmatched=entries.filter(r=>!r.agentId);if(unmatched.some(r=>!['RESIGNED','EXITED'].includes(r.employmentStatus)))throw Error('Unmatched active target requires review');
 const report={source:basename(source),hash,entries,matched:entries.filter(r=>r.agentId).length,pendingReallocation:entries.filter(r=>r.employmentStatus!=='ACTIVE').reduce((a,r)=>a+r.valueKobo,0)/100,withoutTarget:roster.filter(a=>!entries.some(r=>r.agentId===a.agentId)).map(a=>({id:a.agentId,name:a.fullName}))};
 console.log(JSON.stringify({count:entries.length,matched:report.matched,pendingReallocation:report.pendingReallocation,withoutTarget:report.withoutTarget},null,2));
 await mkdir('data/reports',{recursive:true});await writeFile('data/reports/agent-target-match.json',JSON.stringify(report,null,2));
 if(process.argv.includes('--apply')){await mkdir('.local/source-data/targets',{recursive:true});await copyFile(source,`.local/source-data/targets/${hash}.xlsx`);period.agentTargets=entries;period.targetSourceLabel=basename(source);period.targetSourceSha256=hash;await period.save();console.log('Target snapshot saved; proposed reallocations remain pending.');}
 }
}finally{await disconnectDatabase();}
