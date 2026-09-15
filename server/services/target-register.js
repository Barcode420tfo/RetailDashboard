import {readFileSync} from 'node:fs';
import mongoose from 'mongoose';
// Private reference data stays outside Git. Local imports use the supplied file;
// hosted deployments load the same reference from the migrated database.
let local;
try { local=JSON.parse(readFileSync(new URL('../../data/masters/september-2026-target-clusters.json',import.meta.url),'utf8')); }
catch(error){if(error.code!=='ENOENT')throw error;}
const register=local||{month:'2026-09',rows:[]};
export default register;
export async function initializeTargetRegister(){
 if(local)return;
 const saved=await mongoose.connection.collection('applicationreferences').findOne({_id:'september-2026-target-clusters'});
 if(!saved?.data?.rows?.length)throw new Error('Private target reference missing. Migrate applicationreferences before starting the hosted dashboard.');
 Object.assign(register,saved.data);
}
