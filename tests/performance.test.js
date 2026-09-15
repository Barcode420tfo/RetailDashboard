import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceTone} from '../client/performance.js';
test('target colours distinguish missing targets and respect attainment boundaries',()=>{assert.equal(performanceTone(null).label,'No target comparison');assert.equal(performanceTone(NaN).label,'No target comparison');assert.equal(performanceTone(0).label,'Far below target');assert.equal(performanceTone(.5).label,'Below target');assert.equal(performanceTone(.8).label,'Approaching target');assert.equal(performanceTone(.9999).label,'Approaching target');assert.equal(performanceTone(1).label,'At or above target');assert.equal(performanceTone(1.2).label,'Exceeding target');});

test('red amber blue green scale changes at 50%, 70% and 100%',()=>{assert.equal(performanceTone(.4999).color,'#b91c1c');assert.equal(performanceTone(.5).color,'#a16207');assert.equal(performanceTone(.6999).color,'#a16207');assert.equal(performanceTone(.7).color,'#2563eb');assert.equal(performanceTone(.9999).color,'#2563eb');assert.equal(performanceTone(1).color,'#15803d');assert.equal(performanceTone(1.2).color,'#166534');});
