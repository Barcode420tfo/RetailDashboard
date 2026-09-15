import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPeople} from '../server/services/people.js';

test('people performance preserves resigned sales and does not duplicate ambiguous names',()=>{
  const executives=[{executiveId:'L1',region:'LAG',name:'Alex',agentId:'A1',status:'RESIGNED'},{executiveId:'N1',region:'NOR',name:'Sam',status:'ACTIVE'},{executiveId:'N2',region:'NOR',name:'Sam',status:'ACTIVE'},{executiveId:'S1',region:'SSE',name:'Sam',status:'UNKNOWN'}];
  const sale=(id,region,name,valueKobo,agent)=>({transactionId:id,businessDate:'2026-09-14',region,sourceAgentName:name,valueKobo,agent});
  const {people,unassigned}=buildPeople({executives,agents:[{_id:'a',agentId:'A1',fullName:'Alex'}],clusters:[],records:[sale('1','LAG','Alex',10000,'a'),sale('2','NOR','Sam',20000),sale('3','SSE','Sam',30000),sale('4','LAG','Unattributed',40000)]});
  assert.equal(people[0].count,1);assert.equal(people[0].value,100);assert.equal(people[0].status,'RESIGNED');
  assert.equal(people[1].count,0);assert.match(people[1].matchStatus,/Ambiguous/);
  assert.equal(people[2].count,0);assert.equal(people[3].value,300);assert.match(people[3].matchStatus,/unverified/);
  assert.deepEqual(unassigned,{count:2,value:600});
  assert.equal(people.reduce((s,p)=>s+p.value,0)+unassigned.value,1000);
});
test('registered executives without sales remain visible',()=>{
  const {people}=buildPeople({executives:[{executiveId:'1',name:'New agent',region:'LAG',status:'ACTIVE'}],agents:[],clusters:[],records:[]});
  assert.equal(people.length,1);assert.equal(people[0].value,0);assert.equal(people[0].average,0);assert.equal(people[0].lastSale,null);
});
