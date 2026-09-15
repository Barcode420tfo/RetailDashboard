import {initializeTargetRegister} from './services/target-register.js';
import {initializeAuth} from './routes/auth.js';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './db.js';

await connectDatabase();
await initializeTargetRegister();
await initializeAuth();
const port = Number(process.env.PORT || 3001);
if(process.env.NODE_ENV==='production'&&(!process.env.CLIENT_ORIGIN?.startsWith('https://')||process.env.COOKIE_SECURE!=='true'))throw Error('Production requires HTTPS CLIENT_ORIGIN and COOKIE_SECURE=true');
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`API listening at http://127.0.0.1:${port}`));
server.on('error', async error => { console.error(error.message); await disconnectDatabase(); process.exit(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(async () => { await disconnectDatabase(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
