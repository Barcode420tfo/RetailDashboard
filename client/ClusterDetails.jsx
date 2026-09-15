import React, {useEffect, useRef} from 'react';
import {X} from 'lucide-react';
import {buildClusterDetail} from './cluster-detail.js';

const money = value => `₦${value.toLocaleString('en-NG', {maximumFractionDigits:2})}`;
export default function ClusterDetails({name, transactions, agents, from, asOf, zone, onClose}) {
  const detail = buildClusterDetail(name, transactions, agents);
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current.querySelector('button').focus();
    return () => {document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus();};
  }, []);
  function onKeyDown(event) {
    if (event.key === 'Escape') {event.stopPropagation(); onClose();}
    if (event.key !== 'Tab') return;
    const items = [...panel.current.querySelectorAll('button, summary')];
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
  }
  return <div className="drawer-backdrop" onClick={onClose}>
    <section ref={panel} className="drawer cluster-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="cluster-detail-title" onClick={e=>e.stopPropagation()} onKeyDown={onKeyDown}>
      <div className="drawer-top"><span>CLUSTER BREAKDOWN</span><button className="icon-button" aria-label="Close cluster breakdown" onClick={onClose}><X size={22}/></button></div>
      <h2 id="cluster-detail-title">{name}</h2><p>{from} to {asOf} · {zone}</p>
      <div className="cluster-detail-totals"><div><span>Sales value</span><strong>{money(detail.value)}</strong></div><div><span>Sales count</span><strong>{detail.count.toLocaleString()}</strong></div></div>
      {name === 'Unmapped' && <p>These sales are included in the total. Their cluster assignments are pending.</p>}
      <h3>Agent contributions</h3><p>{detail.agents.filter(a=>a.count>0).length} contributing agents · ranked by sales value</p>
      {detail.agents.map(agent=><details className="cluster-agent-contribution" key={agent.key}>
        <summary><span><strong>{agent.name}</strong><small>{agent.count} sales · {(agent.share*100).toFixed(1)}% of cluster sales</small></span><b>{money(agent.value)}</b></summary>
        {agent.transactions.length ? agent.transactions.map(row=><div className="drawer-sale" key={row.id}><div><strong>{row.store || 'Store not supplied'}</strong><small>{row.date} · {row.plan}</small></div><b>{money(row.value)}</b></div>) : <p>No sales recorded for this agent in this cluster during the selected period.</p>}
      </details>)}
      {!detail.agents.length && <p>No contributions recorded for this selection.</p>}
    </section>
  </div>;
}
