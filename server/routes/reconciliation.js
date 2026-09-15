import {Router} from 'express';
import mongoose from 'mongoose';
import {ReconciliationCase} from '../models/index.js';
import {seesAllRegions,isRestricted} from '../middleware/access.js';
import {canAccessRegion} from '../middleware/access.js';

export const reconciliationRouter=Router();
const allowed=(account,region)=>region==='ALL'?seesAllRegions(account):canAccessRegion(account,region);
reconciliationRouter.get('/',async(req,res,next)=>{try{
  const region=req.query.region||req.account.region;
  if(!allowed(req.account,region))return res.status(403).json({error:'This region is outside your account access.'});
  const scope={...(region==='ALL'?{}:{region}),...(isRestricted(req.account)?req.account.role==='ZONAL_LEAD'?{zone:req.account.zone}:{clusterName:req.account.clusterName,zone:req.account.zone}:{})};
  const cases=await ReconciliationCase.find(scope).sort({treatment:1,businessDate:-1,_id:1}).lean();
  res.set('Cache-Control','no-store').json({cases:cases.map(({_id,__v,caseKey,transaction,sourceRow,...row})=>({...row,id:String(_id),version:__v||0}))});
}catch(e){next(e);}});
reconciliationRouter.patch('/:id',async(req,res,next)=>{try{
  if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:'Invalid reconciliation record.'});
  const {status,note,version}=req.body;
  if(!['OPEN','IN_REVIEW','RESOLVED'].includes(status)||typeof note!=='string'||note.trim().length<5||note.trim().length>2000||!Number.isSafeInteger(version)||version<0)return res.status(400).json({error:'Select a review status and enter a note of 5–2,000 characters.'});
  const scope={...(seesAllRegions(req.account)?{}:{region:req.account.region}),...(isRestricted(req.account)?req.account.role==='ZONAL_LEAD'?{zone:req.account.zone}:{clusterName:req.account.clusterName,zone:req.account.zone}:{})};
  const row=await ReconciliationCase.findOne({_id:req.params.id,...scope}).lean();
  if(!row)return res.status(404).json({error:'Reconciliation record not found in your region.'});
  const result=await ReconciliationCase.updateOne({_id:row._id,__v:version},{$set:{status},$inc:{__v:1},$push:{history:{at:new Date(),actor:req.account.name||req.account.email||'Workspace user',status,note:note.trim()}}},{runValidators:true});
  if(!result.modifiedCount)return res.status(409).json({error:'This record was changed by another reviewer. Reload before saving.'});
  res.json({ok:true});
}catch(e){next(e);}});
