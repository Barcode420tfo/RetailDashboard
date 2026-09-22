// Run after npm run build. Uses the configured database and normal startup;
// does not create test accounts, sessions, or business records.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {existsSync} from 'node:fs';

const port = process.env.SMOKE_PORT || '3307';
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server/index.js'], {
  env: {...process.env, NODE_ENV:'production', HOST:'127.0.0.1', PORT:port, CLIENT_ORIGIN:'https://smoke.example.com', COOKIE_SECURE:'true'},
  stdio: ['ignore','pipe','pipe'],
});
let output = '';
child.stdout.on('data', data => { output += data; });
child.stderr.on('data', data => { output += data; });
const exited = once(child, 'exit');
let browser;
try {
  let ready = false;
  for (let i=0; i<100; i++) {
    if (child.exitCode !== null) throw new Error('Production process exited before becoming ready');
    if (output.includes('API listening')) { ready=true; break; }
    await new Promise(resolve => setTimeout(resolve,300));
  }
  assert.ok(ready,'Production startup timed out');
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status,200);
  assert.equal((await health.json()).database,'connected');
  const status = await fetch(`${base}/api/auth/status`);
  assert.equal(status.status,200);
  assert.equal(typeof (await status.json()).setupRequired,'boolean');
  assert.equal((await fetch(`${base}/api/dashboard`)).status,401);
  const pageResponse = await fetch(base);
  assert.equal(pageResponse.status,200);
  assert.match(pageResponse.headers.get('content-type'),/text\/html/);
  const html = await pageResponse.text();
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(`${base}${asset}`)).status,200);
  console.log('PASS: production startup, Atlas health, auth status, protected API, HTML and JS asset.');
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch(existsSync(chrome) ? {executablePath:chrome} : {});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror',error => errors.push(error.name));
  await page.goto(base);
  await page.locator('input[type="password"]').waitFor();
  assert.deepEqual(errors,[],'Browser runtime errors');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('input[type="password"]').isVisible());
  console.log('PASS: desktop/mobile sign-in renders without browser runtime errors.');
} finally {
  await browser?.close();
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'),12000);
  const [code] = await exited;
  clearTimeout(timer);
  assert.equal(code,0,'Production process should shut down cleanly');
  console.log('PASS: graceful shutdown.');
}
