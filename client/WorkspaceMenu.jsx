import React,{useEffect,useRef} from 'react';
import {X,LayoutDashboard,Users,Shield,Map,ClipboardList} from 'lucide-react';

export default function WorkspaceMenu({account,regions,region,view,onNavigate,onRegion,onClose}){
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current.querySelector('button').focus();return()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[]);
 return <div className="workspace-menu-backdrop" onClick={onClose}><aside id="workspace-navigation" ref={ref} className="workspace-menu" role="dialog" aria-modal="true" aria-label="Workspace navigation" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const buttons=[...ref.current.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}>
  <header><strong>DEVPRO</strong><button className="icon-button" onClick={onClose} aria-label="Close sidebar"><X size={22}/></button></header>
  <p className="nav-caption">WORKSPACE</p><nav aria-label="Workspace pages">{[['dashboard','Dashboard',LayoutDashboard],...(region!=='ALL'?[['operations','Team operations',Map]]:[]),['executives','People management',Users],['reconciliation','Reconciliation',ClipboardList],...(account.permissions?.manageAccess?[['accounts','Manage access',Shield]]:[])].map(([id,label,Icon])=><button key={id} className={view===id?'selected':''} aria-current={view===id?'page':undefined} onClick={()=>onNavigate(id)}><Icon size={18}/>{label}</button>)}</nav>
  <p className="nav-caption">REGIONS</p><nav aria-label="Sidebar regions">{[...(account.permissions?.allRegions?[{regionId:'ALL',name:'All regions'}]:[]),...regions].map(r=><button key={r.regionId} className={r.regionId===region?'selected':''} aria-pressed={r.regionId===region} onClick={()=>onRegion(r.regionId)}><Map size={18}/>{r.name}</button>)}</nav>
 </aside></div>;
}
