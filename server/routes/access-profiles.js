import {Router} from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {Account,AccountEvent,LoginSession,PasswordRecovery,Cluster} from '../models/index.js';
import {isOwner,requireAnalyst,permissions} from '../middleware/access.js';
import {assignmentOptions} from '../services/scope.js';
import {validPassword} from './account-lifecycle.js';
export const publicProfile=a=>({id:String(a._id),name:a.name,email:a.email,role:a.role,region:a.region,zone:a.zone||'',clusterName:a.clusterName||'',titles:a.titles||[],active:a.active,permissions:permissions(a)});
export function accessProfilesRouter(authenticate){
 const r=Router();
 r.get('/accounts/options',authenticate,requireAnalyst,async(req,res,next)=>{try{res.json({assignments:assignmentOptions(await Cluster.find().lean())});}catch(e){next(e);}});
 r.get('/accounts',authenticate,requireAnalyst,async(req,res,next)=>{try{res.set('Cache-Control','no-store').json({accounts:(await Account.find().sort({name:1}).lean()).map(publicProfile)});}catch(e){next(e);}});
 async function assignment(body,email){
  const {role}=body,region=role==='CCO'?'ALL':body.region;
  if(!['ANALYST','CCO','RBM','ZONAL_LEAD','CLUSTER_SUPERVISOR'].includes(role))throw Object.assign(Error('Select a valid role.'),{status:400});
  if(email==='liltomsky@gmail.com'){if(role!=='ANALYST'||region!=='ALL')throw Object.assign(Error('Babatunde retains sole access management and all-region administration.'),{status:400});return {role,region,zone:'',clusterName:''};}
  if(role!=='CCO'&&!['LAG','NOR','SSE'].includes(region))throw Object.assign(Error('Assign a region. Regional Analysts can view all regions but edit people only in their assigned region.'),{status:400});
  let zone='',clusterName='';
  if(['ZONAL_LEAD','CLUSTER_SUPERVISOR'].includes(role)){
   const options=assignmentOptions(await Cluster.find().lean());zone=body.zone;
   if(role==='CLUSTER_SUPERVISOR')clusterName=body.clusterName;
   if(!options.some(o=>o.region===region&&o.zone===zone&&(!clusterName||o.clusterName===clusterName))||role==='CLUSTER_SUPERVISOR'&&!clusterName)throw Object.assign(Error('Choose a valid zone and cluster assignment.'),{status:400});
  }
  return {role,region,zone,clusterName};
 }
 r.post('/accounts',authenticate,requireAnalyst,async(req,res,next)=>{try{
  const {name,email,password}=req.body;if(typeof name!=='string'||name.trim().length<2||typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!validPassword(password))return res.status(400).json({error:'Supply a name, valid email and a password of at least 4 characters including one capital letter (maximum 72 UTF-8 bytes).'});
  const canonical=email.trim().toLowerCase(),scope=await assignment(req.body,canonical);
  const a=await Account.create({name:name.trim(),email:canonical,passwordHash:await bcrypt.hash(password,12),...scope,active:req.body.active!==false});
  await AccountEvent.create({account:String(a._id),actor:req.account.email,action:'PROFILE_CREATED'});
  res.status(201).json({account:publicProfile(a)});
 }catch(e){if(e.code===11000)return res.status(409).json({error:'An account with this email already exists.'});next(e);}});
 r.patch('/accounts/:id/profile',authenticate,requireAnalyst,async(req,res,next)=>{try{
  if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid account.'});
  const a=await Account.findById(req.params.id).lean();if(!a)return res.status(404).json({error:'Account not found.'});
  const scope=await assignment(req.body,a.email);
  if(typeof req.body.name!=='string'||req.body.name.trim().length<2||req.body.password&&!validPassword(req.body.password))return res.status(400).json({error:'Supply a name and a valid new password, or leave the password blank to keep it.'});
  if(isOwner(a)&&req.body.active===false)return res.status(400).json({error:'Your administrator account must remain enabled.'});
  const changes={...scope,name:req.body.name.trim(),active:req.body.active!==false,...(req.body.password?{passwordHash:await bcrypt.hash(req.body.password,12)}:{})};
  await mongoose.connection.transaction(async session=>{
   const result=await Account.updateOne({_id:a._id,updatedAt:a.updatedAt},{$set:changes},{session,runValidators:true});if(!result.modifiedCount)throw Object.assign(Error('Account changed; reload before saving.'),{status:409});
   // Every request reloads the role; also revoke the changed user's existing sessions.
   if(String(a._id)!==String(req.account._id))await LoginSession.deleteMany({account:a._id},{session});
   else if(req.body.password)await LoginSession.deleteMany({account:a._id,tokenHash:{$ne:req.sessionHash}},{session});
   if(req.body.password)await PasswordRecovery.deleteMany({account:a._id},{session});
   await AccountEvent.create([{account:String(a._id),actor:req.account.email,action:`PROFILE_UPDATED:${scope.role}:${scope.region}:${scope.zone}:${scope.clusterName}${req.body.password?':PASSWORD_SET':''}`}],{session});
  });res.json({ok:true});
 }catch(e){next(e);}});
 r.post('/preview',authenticate,requireAnalyst,async(req,res,next)=>{try{
  if(!req.body.accountId){const scope=await assignment(req.body,'preview@local.invalid');await LoginSession.updateOne({tokenHash:req.sessionHash},{$set:{previewProfile:{_id:'preview',name:'Profile preview',email:'preview@local.invalid',active:true,...scope}},$unset:{previewAccount:1}});return res.json({ok:true});}
  if(!mongoose.isValidObjectId(req.body.accountId))return res.status(400).json({error:'Select a profile.'});
  const a=await Account.findById(req.body.accountId).lean();if(!a||isOwner(a))return res.status(400).json({error:'Select a non-owner profile to preview.'});
  await LoginSession.updateOne({tokenHash:req.sessionHash},{$set:{previewAccount:a._id},$unset:{previewProfile:1}});res.json({ok:true});
 }catch(e){next(e);}});
 r.post('/preview/exit',authenticate,async(req,res,next)=>{try{
  if(!isOwner(req.realAccount))return res.status(403).json({error:'Only Babatunde can exit a profile preview.'});
  await LoginSession.updateOne({tokenHash:req.sessionHash},{$unset:{previewAccount:1,previewProfile:1}});res.json({ok:true});
 }catch(e){next(e);}});
 return r;
}
