import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCluster} from '../server/services/cluster-aliases.js';

const resolve = (cluster, context = {}) => resolveCluster({region:'LAG',month:'2026-09',cluster,...context});
test('legacy and current cluster names resolve without double counting', () => {
  for (const name of ['Mainland 1', ' LAGOS MAINLAND 1 ', 'Lagos East 1']) {
    assert.equal(resolve(name).name, 'Lagos East 1');
  }
  assert.equal(resolve('Mainland 3').name, 'Lagos East 2');
  assert.equal(resolve('Mainland 4').name, 'Lagos East 2');
  assert.equal(resolve('Computer Village').name, 'Lagos Central 1');
  assert.equal(resolve('Surulere').name, 'Lagos Central 2');
  assert.equal(resolve('Lagos Island').name, 'Lagos Island 1');
});
test('split legacy clusters require distinguishing context', () => {
  assert.equal(resolve('Mainland 2').status, 'AMBIGUOUS');
  assert.equal(resolve('Mainland 2', {agentName:'Philip Okafor'}).name, 'Lagos West 1');
  assert.equal(resolve('Mainland 2', {storeName:'SLOT Festac'}).name, 'Lagos West 2');
  assert.equal(resolve('Mainland 2', {agentName:'Unknown'}).status, 'AMBIGUOUS');
});
test('aliases are scoped to their region and effective start month', () => {
  assert.equal(resolve('Mainland 1', {region:'NOR'}).status, 'UNMATCHED');
  assert.equal(resolve('Mainland 1', {month:'2026-08'}).status, 'UNMATCHED');
  assert.equal(resolve('Mainland 1', {month:'2026-10'}).name, 'Lagos East 1');
  assert.equal(resolve('Unknown').status, 'UNMATCHED');
});
