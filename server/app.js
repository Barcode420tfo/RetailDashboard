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
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
    credentials: true,
  })
);
app.use(pinoHttp({
  serializers: {
    req: req => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
    res: res => ({ statusCode: res.statusCode }),
  },
  customLogLevel: (_req, res, error) => error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug',
}));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, skip: req => req.path === '/health' }));
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
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  const status=[400,401,403,404,409,413,415,429,503].includes(error.status)?error.status:500;
  // Parser errors can contain submitted passwords; never log raw error bodies.
  request.log[status >= 500 ? 'error' : 'warn']({ errorType: error.name, status }, 'Request failed');
  const message = error.type === 'entity.parse.failed' ? 'Invalid JSON body'
    : status === 413 ? 'Request body too large'
    : status === 500 ? 'Internal server error'
    : status === 503 ? 'Service temporarily unavailable' : error.message;
  response.status(status).json({error:message});
});
