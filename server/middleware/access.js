export const OWNER_EMAIL='liltomsky@gmail.com';
export const isOwner=a=>a?.email?.toLowerCase()===OWNER_EMAIL&&a.role==='ANALYST';
export const seesAllRegions=a=>['ANALYST','CCO'].includes(a?.role);
export const isRestricted=a=>['ZONAL_LEAD','CLUSTER_SUPERVISOR'].includes(a?.role);
export function canAccessRegion(account,region){return ['LAG','NOR','SSE'].includes(region)&&(seesAllRegions(account)||['RBM','ZONAL_LEAD','CLUSTER_SUPERVISOR'].includes(account?.role)&&account.region===region);}
export const canManagePeople=(a,region)=>isOwner(a)||a?.role==='ANALYST'&&['LAG','NOR','SSE'].includes(region)&&a.region===region;
export const permissions=a=>({manageAccess:isOwner(a),allRegions:seesAllRegions(a),peopleRegions:isOwner(a)?['LAG','NOR','SSE']:a?.role==='ANALYST'&&['LAG','NOR','SSE'].includes(a.region)?[a.region]:[]});
export function requireRegion(req,res,next){const region=req.query.region||req.body?.region;if(!canAccessRegion(req.account,region))return res.status(403).json({error:'This region is outside your account access.'});req.region=region;next();}
export function requireAnalyst(req,res,next){if(!isOwner(req.account))return res.status(403).json({error:'Only Babatunde can manage account access.'});next();}
export function requirePeopleEditor(req,res,next){if(req.preview||!canManagePeople(req.account,req.region))return res.status(403).json({error:'Only Regional Analysts can change people records, within their assigned region.'});next();}
