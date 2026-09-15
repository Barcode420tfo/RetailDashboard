import {randomBytes,createHash} from 'node:crypto';
import mongoose from 'mongoose';
import {connectDatabase,disconnectDatabase} from '../db.js';
import {Account,AccountAdminLock,AccountEvent,PasswordRecovery} from '../models/index.js';
import {initializeLifecycle} from '../routes/account-lifecycle.js';
const email=process.argv[2]?.trim().toLowerCase();
if(!email)throw Error('Usage: node server/scripts/issue-recovery.js account@example.com');
try {
  await connectDatabase();
  await initializeLifecycle();
  const code=randomBytes(24).toString('hex');
  const expiresAt=new Date(Date.now()+30*60*1000);
  await mongoose.connection.transaction(async session=>{
    await AccountAdminLock.updateOne({_id:'account-administration'},{$inc:{revision:1}},{session});
    const account=await Account.findOne({email,active:true}).session(session);
    if(!account)throw Error('Active account not found.');
    await PasswordRecovery.deleteMany({account:account._id},{session});
    await PasswordRecovery.create([{account:account._id,tokenHash:createHash('sha256').update(code).digest('hex'),expiresAt,issuedBy:'SERVER_OPERATOR'}],{session});
    await AccountEvent.create([{account:String(account._id),actor:'SERVER_OPERATOR',action:'RECOVERY_ISSUED'}],{session});
  });
  console.log(`Private recovery code: ${code}\nExpires: ${expiresAt.toISOString()}\nShare only with the verified account owner.`);
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {await disconnectDatabase();}
