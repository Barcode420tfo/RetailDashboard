import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {chromium} from '@playwright/test';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {Account,LoginSession} from '../models/index.js';
import {app} from '../app.js';
import supertest from 'supertest';
await connectDatabase();let browser;const created=[];
try{
 const owner=await Account.findOne({email:'liltomsky@gmail.com'});assert(owner);
 const profiles=[['CCO','ALL','',''],['ANALYST','NOR','',''],['RBM','LAG','',''],['ZONAL_LEAD','LAG','Lagos Central',''],['CLUSTER_SUPERVISOR','LAG','Lagos Central','Lagos Central 1']];
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const [role,region,zone,clusterName] of profiles.filter(p=>!process.env.TEST_ROLE||p[0]===process.env.TEST_ROLE)){
  const password=randomBytes(20).toString('hex'),a=await Account.create({name:`QA ${role}`,email:`qa-${role}-${Date.now()}@local.invalid`,passwordHash:await bcrypt.hash(password,12),role,region,zone,clusterName});created.push(a._id);
  const agent=supertest.agent(app);let response=await agent.post('/api/auth/login').set('X-Dashboard-Request','1').send({email:a.email,password});assert.equal(response.status,200);
  const accessible=role==='CCO'||role==='ANALYST'?['LAG','NOR','SSE']:[region];
  for(const r of ['LAG','NOR','SSE']){response=await agent.get(`/api/workspace/operations?region=${r}`);assert.equal(response.status,accessible.includes(r)?200:403,JSON.stringify(response.body));if(response.status===200){assert(response.body.summary.count>=0);if(zone)assert(response.body.transactions.every(t=>t.zone===zone));if(clusterName)assert(response.body.transactions.every(t=>t.clusterName===clusterName));}}
  assert.equal((await agent.get('/api/auth/accounts')).status,403);
  assert.equal((await agent.post('/api/workspace/executives').set('X-Dashboard-Request','1').send({region:'LAG'})).status,403);
  response=await agent.get(`/api/dashboard?region=${accessible[0]}`);assert.equal(response.status,200,JSON.stringify(response.body));if(zone)assert(response.body.transactions.every(t=>t.zone===zone));if(clusterName)assert(response.body.transactions.every(t=>t.cluster===clusterName));
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.request.post('http://127.0.0.1:3001/api/auth/login',{headers:{'X-Dashboard-Request':'1'},data:{email:a.email,password}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'People management',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Manage access',exact:true}).count(),0);if(!['CCO','ANALYST'].includes(role))await page.getByRole('heading',{name:/overview$/}).waitFor().catch(async e=>{console.log('SCREEN', (await page.locator('body').innerText()).slice(0,1000));throw e;});await page.screenshot({path:`.local/qa/role-${role}.png`,fullPage:true});await page.getByRole('button',{name:'People management',exact:true}).click();await page.getByRole('heading',{name:'Sales executives',exact:true}).waitFor();if(role!=='ANALYST')assert.equal(await page.getByRole('button',{name:'Add sales executive',exact:true}).count(),0);assert.deepEqual(errors,[]);await context.close();console.log('PASS',role,region,zone,clusterName);
 }
}finally{if(browser)await browser.close();await LoginSession.deleteMany({account:{$in:created}});await Account.deleteMany({_id:{$in:created}});await disconnectDatabase();}
