import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import {app} from '../server/app.js';

test('HTTP smoke: database outage, health polling, invalid bodies, and authentication', async () => {
  const health = await request(app).get('/api/health');
  assert.equal(health.status,503);
  assert.equal(health.body.database,'disconnected');
  assert.equal(health.headers.ratelimit,undefined);
  const denied = await request(app).get('/api/dashboard');
  assert.equal(denied.status,401);
  const invalid = await request(app).post('/api/auth/login').set('Content-Type','application/json').send('{"password":"PRIVATE_SMOKE_MARKER",');
  assert.equal(invalid.status,400);
  assert.deepEqual(invalid.body,{error:'Invalid JSON body'});
  const large = await request(app).post('/api/auth/login').send({password:'x'.repeat(1024*1024)});
  assert.equal(large.status,413);
  assert.equal((await request(app).get('/api/health')).status,503);
  assert.equal(mongoose.connection.readyState,0);
});
