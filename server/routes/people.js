import {Router} from 'express';
import {ExecutiveEvent} from '../models/index.js';
import {canAccessRegion,seesAllRegions,permissions} from '../middleware/access.js';
import {validDay} from '../models/shared.js';
import {loadOperationalData,buildOperations} from '../services/operational-data.js';
export const peopleRouter=Router();
peopleRouter.get('/',async(req,res,next)=>{try{
 const region=req.query.region||req.account.region;
 if(region==='ALL'?!seesAllRegions(req.account):!canAccessRegion(req.account,region))return res.status(403).json({error:'This region is outside your account access.'});
 const regions=region==='ALL'?['LAG','NOR','SSE']:[region];
 const datasets=await Promise.all(regions.map(r=>loadOperationalData(req.account,r)));
 const maxDate=datasets.map(d=>d.period.asOf).sort()[0],from=req.query.from||'2026-09-01',asOf=req.query.asOf||maxDate;
 if(!validDay(from)||!validDay(asOf)||from<'2026-09-01'||asOf>maxDate||from>asOf)return res.status(400).json({error:'Choose valid dates within the available reporting period.'});
 const results=datasets.map((d,i)=>buildOperations(d,{account:req.account,region:regions[i],from,asOf}));
 const people=results.flatMap(d=>d.people);
 if(req.query.executiveId){const person=people.find(p=>p.executiveId===req.query.executiveId);if(!person)return res.status(404).json({error:'Executive not found in your assigned scope.'});const events=await ExecutiveEvent.find({executiveId:person.executiveId,region:person.region}).sort({createdAt:-1}).limit(100).lean();return res.json({person,events,from,asOf,maxDate});}
 res.set('Cache-Control','no-store').json({people:people.map(({transactions,...p})=>p),unassigned:{count:results.reduce((n,d)=>n+d.unassigned.count,0),value:results.reduce((n,d)=>n+d.unassigned.value,0)},from,asOf,maxDate,editableRegions:req.preview?[]:permissions(req.account).peopleRegions,clusters:datasets.flatMap((d,i)=>regions[i]==='LAG'?d.clusters.map(c=>({id:String(c._id),name:c.name,zone:c.zone})):[])});
}catch(e){next(e);}});
