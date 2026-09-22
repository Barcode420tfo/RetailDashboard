import {Router} from 'express';import mongoose from 'mongoose';import {randomUUID} from 'node:crypto';import {Region,Store,Executive,ExecutiveEvent,Transaction,ReportingPeriod,RegionalReportingPeriod,Agent,Cluster,AuditLog,Account} from '../models/index.js';import {validDay} from '../models/shared.js';import {requireRegion,requireAnalyst,requirePeopleEditor,seesAllRegions,isRestricted,isOwner} from '../middleware/access.js';
import {loadOperationalData} from '../services/operational-data.js';
export const workspaceRouter=Router();
workspaceRouter.get('/private-audit',async(req,res,next)=>{try{if(!isOwner(req.account))return res.status(403).json({error:'Private audit access is limited to its owner.'});const account=await Account.findOne({email:req.account.email}).select('_id').lean();if(!account)return res.status(403).json({error:'Private audit account is unavailable.'});const logs=await AuditLog.find({visibleTo:account._id}).sort({createdAt:-1}).limit(250).lean();res.set('Cache-Control','no-store').json({logs});}catch(e){next(e);}});
workspaceRouter.get('/regions',async(req,res,next)=>{try{
 const regions=await Region.find(seesAllRegions(req.account)?{}:{regionId:req.account.region}).lean();
 const result=await Promise.all(regions.map(async r=>{const d=await loadOperationalData(req.account,r.regionId),records=d.records.filter(t=>t.businessDate>='2026-09-01');return {...r,name:isRestricted(req.account)?req.account.clusterName||req.account.zone:r.name,reportingAsOf:d.period.asOf,salesValue:records.reduce((n,t)=>n+t.valueKobo,0)/100,salesCount:records.length,stores:d.stores.length,executives:d.executives.length,active:d.executives.filter(e=>e.status==='ACTIVE').length};}));
 res.set('Cache-Control','no-store').json({regions:result});
}catch(e){next(e);}});
workspaceRouter.get('/executives-all',async(req,res,next)=>{try{if(!seesAllRegions(req.account))return res.status(403).json({error:'All-region access required.'});const [executives,events]=await Promise.all([Executive.find().sort({region:1,name:1}).lean(),ExecutiveEvent.find().sort({createdAt:-1}).limit(100).lean()]);res.json({region:'ALL',stores:[],executives,events});}catch(e){next(e);}});
workspaceRouter.get('/directory',requireRegion,async(req,res,next)=>{try{const d=await loadOperationalData(req.account,req.region);const events=await ExecutiveEvent.find({region:req.region,executiveId:{$in:d.executives.map(e=>e.executiveId)}}).sort({createdAt:-1}).limit(100).lean();res.json({region:req.region,stores:d.stores.map(({_id,storeId,name,state,address,status,region,reviewNote})=>({_id,storeId,name,state,address,status,region,reviewNote})),executives:d.executives,events});}catch(e){next(e);}});
workspaceRouter.post('/executives',requireRegion,requirePeopleEditor,async(req,res,next)=>{try{
 const {name,state,joinedOn,clusterId,clusterName,storeName}=req.body;
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>150||!validDay(joinedOn)||joinedOn>new Date().toISOString().slice(0,10))return res.status(400).json({error:'Supply a name and a joining date no later than today.'});
 const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const current=await Executive.find({region:req.region}).select('name').lean();
 if(current.some(e=>normalize(e.name)===normalize(name)))return res.status(409).json({error:'An executive with this name already exists in this region. Find their record to update or reactivate it.'});
 let cluster;
 if(clusterId){if(req.region!=='LAG'||!mongoose.isValidObjectId(clusterId))return res.status(400).json({error:'Invalid cluster selection.'});cluster=await Cluster.findById(clusterId).lean();if(!cluster)return res.status(400).json({error:'Cluster not found.'});}
 const suffix=randomUUID().slice(0,12).toUpperCase(),executiveId=`EXE-${req.region}-${suffix}`,agentId=req.region==='LAG'?`AGT-LAG-${suffix}`:undefined;
 const entry={executiveId,agentId,region:req.region,name:name.trim(),state:typeof state==='string'?state.trim():undefined,clusterName:cluster?.name||(typeof clusterName==='string'?clusterName.trim():undefined),storeName:typeof storeName==='string'?storeName.trim():undefined,joinedOn,status:'ACTIVE',source:'Manual register entry'};
 const session=await mongoose.startSession();try{await session.withTransaction(async()=>{
   if(agentId)await Agent.create([{agentId,fullName:entry.name,role:'Sales executive',startDate:joinedOn,currentStatus:'ACTIVE',currentCluster:cluster?._id,sourceStoreOrAxis:entry.storeName}],{session});
   await Executive.create([entry],{session});await ExecutiveEvent.create([{executiveId,region:req.region,action:'JOIN',actor:req.account.email,effectiveDate:joinedOn,reason:'New sales executive',after:entry}],{session});
 });}finally{await session.endSession();}res.status(201).json({executiveId});
}catch(e){next(e);}});
workspaceRouter.patch('/executives/:id',requireRegion,requirePeopleEditor,async(req,res,next)=>{try{
 const {status,effectiveDate,reason}=req.body;
 if(!['ACTIVE','INACTIVE','RESIGNED','EXITED'].includes(status)||!validDay(effectiveDate)||effectiveDate>new Date().toISOString().slice(0,10)||typeof reason!=='string'||!reason.trim())return res.status(400).json({error:'Supply a status, an effective date no later than today, and a reason.'});
 const existing=await Executive.findOne({executiveId:req.params.id,region:req.region}).lean();
 if(!existing)return res.status(404).json({error:'Executive not found in this region.'});
 if(existing.joinedOn&&effectiveDate<existing.joinedOn)return res.status(400).json({error:'Change date cannot precede joining date.'});
 const latest=await ExecutiveEvent.findOne({executiveId:existing.executiveId,region:req.region}).sort({effectiveDate:-1}).lean();
 if(latest?.effectiveDate&&effectiveDate<latest.effectiveDate)return res.status(400).json({error:'Change date cannot precede the latest recorded status change.'});
 const change={status,exitedOn:['RESIGNED','EXITED'].includes(status)?effectiveDate:null};
 const session=await mongoose.startSession();try{await session.withTransaction(async()=>{
   const result=await Executive.updateOne({_id:existing._id,updatedAt:existing.updatedAt},{$set:change},{session,runValidators:true});
   if(result.modifiedCount!==1){const error=Error('Concurrent edit; reload the register');error.status=409;throw error;}
   if(existing.agentId&&req.region==='LAG')await Agent.updateOne({agentId:existing.agentId},{$set:{currentStatus:status==='EXITED'?'RESIGNED':status,exitDate:change.exitedOn}},{session,runValidators:true});
   await ExecutiveEvent.create([{executiveId:existing.executiveId,region:req.region,action:status,actor:req.account.email,effectiveDate,reason:reason.trim(),before:existing,after:change}],{session});
 });}finally{await session.endSession();}res.json({ok:true});
}catch(e){next(e);}});
