import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import {authRouter,authenticate,sameOrigin} from './routes/auth.js';
import {workspaceRouter} from './routes/workspace.js';
import {peopleRouter} from './routes/people.js';
import {reconciliationRouter} from './routes/reconciliation.js';
import {operationsRouter} from './routes/operations.js';
import { dashboardRouter } from './routes/dashboard.js';

export const app = express();
app.disable('x-powered-by');
if(process.env.TRUST_PROXY_HOPS)app.set('trust proxy',Number(process.env.TRUST_PROXY_HOPS));
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173' }));
app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', async (_request, response) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('Disconnected');
    await mongoose.connection.db.admin().ping();
    response.json({ status: 'ok', database: 'connected' });
  } catch {
    response.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});
app.use('/api/auth',authRouter);
app.use('/api',authenticate,sameOrigin);
app.use('/api/workspace/operations',operationsRouter);
app.use('/api/workspace/people',peopleRouter);
app.use('/api/workspace/reconciliation',reconciliationRouter);
app.use('/api/workspace',workspaceRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', (_request, response) => response.status(404).json({ error: 'Not found' }));
if (process.env.NODE_ENV === 'production') {
  const directory = fileURLToPath(new URL('../dist/', import.meta.url));
  app.use(express.static(directory));
  app.get('/{*path}', (_request, response) => response.sendFile(`${directory}index.html`));
}
app.use((error, request, response, _next) => {
  request.log.error({ err: error }, 'Request failed');
  const status=[400,403,404,409].includes(error.status)?error.status:500;
  response.status(status).json({error:status===500?'Internal server error':error.message});
});
