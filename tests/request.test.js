import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from '../client/request.js';

test('API requests handle proxy failures and preserve authentication behavior', async t => {
  let response;
  t.mock.method(globalThis, 'fetch', async () => response);
  const events = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = {dispatchEvent: event => events.push(event.type)};
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  for (const body of ['', '<html>Bad Gateway</html>']) {
    response = new Response(body, {status: 502});
    await assert.rejects(request('/api/auth/status'), /server is temporarily unavailable/);
  }
  response = new Response('Too many requests', {status: 429});
  await assert.rejects(request('/api/auth/login'), /Too many requests/);
  response = new Response('{"error":"Email or password is incorrect."}', {status: 401});
  await assert.rejects(request('/api/auth/login'), /Email or password is incorrect/);
  assert.deepEqual(events, ['session-expired']);
  response = new Response('{"setupRequired":false}');
  assert.deepEqual(await request('/api/auth/status'), {setupRequired: false});
  response = new Response('');
  await assert.rejects(request('/api/auth/status'), /invalid response/);
});
