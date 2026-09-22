import test from 'node:test';import assert from 'node:assert/strict';
import {permissions,canManagePeople,canAccessRegion} from '../server/middleware/access.js';
import {scopeData} from '../server/services/scope.js';
import {inactivity} from '../server/services/operational-data.js';
test('only Babatunde administers access; regional analysts edit only their region',()=>{assert(permissions({role:'ANALYST',email:'liltomsky@gmail.com'}).manageAccess);for(const role of ['CCO','RBM','ZONAL_LEAD','CLUSTER_SUPERVISOR','ANALYST'])assert.equal(permissions({role,region:'NOR',email:'other@example.com'}).manageAccess,false);assert(canManagePeople({role:'ANALYST',region:'NOR'},'NOR'));assert(!canManagePeople({role:'ANALYST',region:'NOR'},'LAG'));assert(!canManagePeople({role:'CCO',region:'ALL'},'NOR'));assert(canAccessRegion({role:'CCO'},'SSE'));});
test('cluster scope excludes another cluster even in the same zone',()=>{const clusters=[{_id:'1',name:'Central 1',zone:'Central'},{_id:'2',name:'Central 2',zone:'Central'}];const d=scopeData({role:'CLUSTER_SUPERVISOR',clusterName:'Central 1',zone:'Central'},{clusters,records:[{cluster:'1',valueKobo:100},{cluster:'2',valueKobo:200}],agents:[{currentCluster:'1'},{currentCluster:'2'}],stores:[{cluster:'1'},{cluster:'2'}]});assert.equal(d.records.length,1);assert.equal(d.records[0].valueKobo,100);assert.equal(d.agents.length,1);assert.equal(d.stores.length,1);});
test('inactivity counts selling days, preserves last sale and stops at unconfirmed coverage',()=>{const calendar=['2026-09-10','2026-09-11','2026-09-12','2026-09-14'];const args={workingDates:calendar,availableDates:calendar,asOf:'2026-09-14',status:'ACTIVE',sales:[{date:'2026-09-10'}]};const r=inactivity(args);assert(r.inactive);assert.equal(r.consecutiveNoSaleDays,3);assert.equal(r.lastSale,'2026-09-10');assert(!inactivity({...args,availableDates:['2026-09-10','2026-09-12','2026-09-14']}).inactive);assert(!inactivity({...args,joinedOn:'2026-09-12',sales:[]}).inactive);assert(!inactivity({...args,status:'RESIGNED'}).inactive);});

test('cross-cluster activity clears false inactivity without sharing sale details',async()=>{
 const {buildActivityDates}=await import('../server/services/operational-data.js');
 const executives=[{executiveId:'I',agentId:'A',region:'LAG',name:'Ifeoma'},{executiveId:'S1',region:'LAG',name:'Sam'},{executiveId:'S2',region:'LAG',name:'Sam'}];
 const dates=buildActivityDates({executives,agents:[{_id:'a',agentId:'A'}],clusters:[],records:[{agent:'a',region:'LAG',businessDate:'2026-09-14',transactionId:'private',valueKobo:900000,cluster:'other'},{region:'LAG',businessDate:'2026-09-15',sourceAgentName:'Sam',valueKobo:10000,transactionId:'ambiguous'}]},[executives[0],executives[1]]);
 assert.deepEqual(dates,{I:['2026-09-14'],S1:[]});
 const days=['2026-09-10','2026-09-11','2026-09-12','2026-09-14','2026-09-15'];
 const result=inactivity({sales:dates.I.map(date=>({date})),workingDates:days,availableDates:days,asOf:'2026-09-15',status:'ACTIVE'});
 assert.equal(result.inactive,false);assert.equal(result.consecutiveNoSaleDays,1);
 assert.equal(result.lastSale,'2026-09-14');
});
