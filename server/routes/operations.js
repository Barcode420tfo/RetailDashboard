import {Router} from 'express';
import {canAccessRegion} from '../middleware/access.js';
import {validDay} from '../models/shared.js';
import {loadOperationalData,buildOperations} from '../services/operational-data.js';
export const operationsRouter=Router();
operationsRouter.get('/',async(req,res,next)=>{try{
 const region=req.query.region||req.account.region;
 if(!canAccessRegion(req.account,region))return res.status(403).json({error:'This region is outside your account access.'});
 const data=await loadOperationalData(req.account,region),from=req.query.from||'2026-09-01',asOf=req.query.asOf||data.period.asOf;
 if(!validDay(from)||!validDay(asOf)||from<'2026-09-01'||from>asOf||asOf>data.period.asOf)return res.status(400).json({error:'Choose dates within the reporting period.'});
 res.set('Cache-Control','no-store').json(buildOperations(data,{account:req.account,region,from,asOf}));
}catch(e){next(e);}});
