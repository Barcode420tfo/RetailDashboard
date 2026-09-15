import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClusterDetail} from '../client/cluster-detail.js';

test('cluster contributions reconcile and keep same-name agents separate', () => {
  const transactions = [
    {id:'1',cluster:'East 1',agentId:'A',agent:'Alex',value:100},
    {id:'2',cluster:'East 1',agentId:'A',agent:'Alex',value:50},
    {id:'3',cluster:'East 1',agentId:'B',agent:'Alex',value:200},
    {id:'4',cluster:'East 1',agentId:null,agent:'Source name',value:50},
    {id:'5',cluster:'West 1',agentId:'A',agent:'Alex',value:900},
  ];
  const detail = buildClusterDetail('East 1', transactions, [
    {id:'A',name:'Alex',cluster:'East 1',roster:true},
    {id:'C',name:'No sales',cluster:'East 1',roster:true},
    {id:'D',name:'Other cluster',cluster:'West 1',roster:true},
  ]);
  assert.equal(detail.count,4);
  assert.equal(detail.value,400);
  assert.equal(detail.agents.length,4);
  assert.equal(detail.agents.filter(a=>a.name==='Alex').length,2);
  assert.equal(detail.agents.find(a=>a.agentId==='A').value,150);
  assert.equal(detail.agents.find(a=>a.agentId==='C').count,0);
  assert.equal(detail.agents.reduce((s,a)=>s+a.value,0),detail.value);
  assert.equal(detail.agents.reduce((s,a)=>s+a.count,0),detail.count);
  assert.equal(detail.agents.reduce((s,a)=>s+a.share,0),1);
});

test('unmapped and empty selections have inspectable contributions', () => {
  const detail = buildClusterDetail('Unmapped', [{id:'1',cluster:'Unmapped',agent:null,value:20}]);
  assert.equal(detail.agents[0].name,'Unattributed');
  assert.equal(detail.agents[0].transactions.length,1);
  assert.deepEqual(buildClusterDetail('Empty', []),{name:'Empty',count:0,value:0,agents:[]});
});
