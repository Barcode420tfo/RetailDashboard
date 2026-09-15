import { schema, model, text, day, integer, unique } from './shared.js';

export const ReportingPeriod = model('ReportingPeriod', schema({
  month: text(), asOf: day(), currency: { ...text(), default: 'NGN' },
  workingDates: [String], availableDates: [String],
  zoneTargets: [{ _id: false, zone: text(), valueKobo: integer() }],
  sourceLabel: text(), sourceSha256: text(), approvedCount: integer(), approvedValueKobo: integer(),
  regionalMonthlyTargetKobo: integer(0,false),
  targetSourceLabel: text(false), targetSourceSha256: text(false),
  agentTargets: [{_id:false, name:text(), agentId:text(false), zone:text(), valueKobo:integer(), employmentStatus:text(), pendingAction:text(false), sourceSheet:text(), sourceRow:integer(1)}],
  notes: [String],
}, [[{ month: 1 }, unique]]));

const regionalPeriodSchema=ReportingPeriod.schema.clone();
regionalPeriodSchema.clearIndexes();
regionalPeriodSchema.add({region:{type:String,enum:['NOR','SSE'],required:true}});
regionalPeriodSchema.index({region:1,month:1},unique);
export const RegionalReportingPeriod=model('RegionalReportingPeriod',regionalPeriodSchema);
