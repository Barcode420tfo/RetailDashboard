import {schema,model,text,ref,day,choice,integer,Schema,unique} from './shared.js';

// One queue entry per source transaction; multiple issues do not multiply its value.
export const ReconciliationCase=model('ReconciliationCase',schema({
  caseKey:text(),region:choice(['LAG','NOR','SSE','UNKNOWN']),
  transaction:ref('Transaction',false),sourceRow:ref('UploadRow',false),
  policyId:text(false),businessDate:day(false),sheetDate:day(false),sourceTimestamp:text(false),
  agentName:text(false),storeName:text(false),zone:text(false),clusterName:text(false),
  valueKobo:integer(),paymentStatus:text(false),sourceFile:text(),sheet:text(),rowNumber:integer(1),
  treatment:choice(['INCLUDED','HELD']),status:choice(['OPEN','IN_REVIEW','RESOLVED'],'OPEN'),
  issues:[{_id:false,code:text(),message:text(),nextStep:text()}],
  previous:Schema.Types.Mixed,
  history:[{_id:false,at:{type:Date,required:true},actor:text(),status:text(),note:text()}],
},[[{caseKey:1},unique],[{region:1,status:1,businessDate:1}]]));
