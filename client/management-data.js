// Combine already-authorized region reports without averaging regional percentages.
export function buildManagementOverview(reports) {
  const values=reports.map(r=>r.data.summary);
  const sum=key=>values.reduce((total,row)=>total+row[key],0);
  const completeSum=key=>values.length&&values.every(row=>Number.isFinite(row[key]))?sum(key):null;
  const value=sum('value'),count=sum('count'),target=completeSum('target'),expected=completeSum('expected');
  const regions=reports.map(report=>({...report,...report.data.summary,topAgents:report.data.agents.filter(a=>a.count>0&&a.name?.trim()&&!/^(unmapped|unattributed|unknown|blank|n\/a)$/i.test(a.name.trim())).slice().sort((a,b)=>b.value-a.value||b.count-a.count||a.name.localeCompare(b.name)).slice(0,3)}));
  const dates=[...new Set(reports.flatMap(r=>r.data.timeline.map(t=>t.date)))].sort();
  const timeline=dates.map(date=>{const row={date,label:date.slice(5).replace('-','/')};for(const report of reports){const day=report.data.timeline.find(t=>t.date===date);row[report.regionId]=day?.value??null;row[`${report.regionId}Cumulative`]=day?.cumulative??null;}return row;});
  return {regions,timeline,summary:{value,count,target,expected,pace:expected>0?value/expected:null,achievement:target>0?value/target:null,gap:expected==null?null:value-expected,forecast:completeSum('forecast')}};
}
