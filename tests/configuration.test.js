import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfiguration} from '../server/configuration.js';
const valid = {MONGODB_URI:'mongodb://127.0.0.1/test', NODE_ENV:'production', CLIENT_ORIGIN:'https://example.com', COOKIE_SECURE:'true'};
test('production configuration rejects nested URI assignments without exposing credentials', () => {
  assert.throws(() => validateConfiguration({...valid,MONGODB_URI:'MONGODB_URI="mongodb://user:secret@host/test"'}), error => !error.message.includes('secret'));
  for (const CLIENT_ORIGIN of ['http://example.com','https://example.com/','https://example.com/path']) assert.throws(() => validateConfiguration({...valid,CLIENT_ORIGIN}));
  assert.throws(() => validateConfiguration({...valid,COOKIE_SECURE:'false'}));
  for (const PORT of ['bad','0','65536']) assert.throws(() => validateConfiguration({...valid,PORT}));
  assert.throws(() => validateConfiguration({...valid,TRUST_PROXY_HOPS:'true'}));
  assert.deepEqual(validateConfiguration({...valid,PORT:'8080'}), {port:8080,host:'0.0.0.0'});
});
