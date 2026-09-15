// Performance is measured against the expected target for the selected period.
export function performanceTone(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return {color:'#64748b',background:'#f1f5f9',border:'#cbd5e1',label:'No target comparison'};
  if (ratio < .5) return {color:'#b91c1c',background:'#fef2f2',border:'#fca5a5',label:'Far below target'};
  if (ratio < .7) return {color:'#a16207',background:'#fffbeb',border:'#fcd34d',label:'Below target'};
  if (ratio < 1) return {color:'#2563eb',background:'#eff6ff',border:'#93c5fd',label:'Approaching target'};
  if (ratio < 1.2) return {color:'#15803d',background:'#f0fdf4',border:'#86efac',label:'At or above target'};
  return {color:'#166534',background:'#ecfdf5',border:'#6ee7b7',label:'Exceeding target'};
}
export function toneStyle(ratio) {const tone=performanceTone(ratio);return {'--performance-color':tone.color,'--performance-bg':tone.background,'--performance-border':tone.border};}
