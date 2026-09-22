import { Router } from 'express';
import {
  randomBytes,
  createHash,
  timingSafeEqual,
} from 'node:crypto';
import {
  readFile,
  writeFile,
  mkdir,
} from 'node:fs/promises';

import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';

import {
  Account,
  LoginSession,
  regionIds,
} from '../models/index.js';

import {
  requireAnalyst,
  isOwner,
} from '../middleware/access.js';

import {
  accessProfilesRouter,
  publicProfile,
} from './access-profiles.js';

import {
  lifecycleRouter,
  initializeLifecycle,
  validPassword,
} from './account-lifecycle.js';


export const authRouter = Router();

const digest = (value) =>
  createHash('sha256').update(value).digest('hex');

const publicAccount = publicProfile;


/* =========================================================
   INITIALIZE AUTH
========================================================= */

export async function initializeAuth() {
  await initializeLifecycle();
  await Account.createIndexes();
  await LoginSession.createIndexes();

  if (!(await Account.exists({}))) {
    if (process.env.NODE_ENV === 'production') {
      if (
        !process.env.ADMIN_SETUP_CODE ||
        process.env.ADMIN_SETUP_CODE.length < 32
      ) {
        throw new Error(
          'Set ADMIN_SETUP_CODE (at least 32 characters) for initial production setup'
        );
      }

      return;
    }

    await mkdir('.local', { recursive: true });

    try {
      await readFile('.local/analyst-setup-code');
    } catch {
      await writeFile(
        '.local/analyst-setup-code',
        randomBytes(24).toString('hex'),
        {
          mode: 0o600,
          flag: 'wx',
        }
      );
    }
  }
}


/* =========================================================
   SAME ORIGIN PROTECTION
========================================================= */

export function sameOrigin(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return next();
  }

  const origin = request.get('origin');

  const allowed = new Set([
    process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',

    ...(process.env.NODE_ENV === 'production'
      ? []
      : ['http://127.0.0.1:3001']),
  ]);

  if (
    (origin && !allowed.has(origin)) ||
    request.get('x-dashboard-request') !== '1'
  ) {
    return response.status(403).json({
      error: 'Invalid request origin.',
    });
  }

  next();
}


/* =========================================================
   AUTHENTICATION
========================================================= */

export async function authenticate(request, response, next) {
  try {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('sales_session='))
      ?.slice(14);

    if (!cookie) {
      return response.status(401).json({
        error: 'Please sign in.',
      });
    }

    const session = await LoginSession.findOne({
      tokenHash: digest(cookie),
      expiresAt: {
        $gt: new Date(),
      },
    }).lean();

    const account =
      session &&
      (await Account.findOne({
        _id: session.account,
        active: true,
      }).lean());

    if (!account) {
      return response.status(401).json({
        error: 'Session expired. Please sign in.',
      });
    }

    request.realAccount = account;
    request.account = account;
    request.sessionHash = session.tokenHash;
    request.preview = false;

    if (
      (session.previewAccount || session.previewProfile) &&
      isOwner(account)
    ) {
      const target =
        session.previewProfile ||
        (await Account.findById(session.previewAccount).lean());

      if (target) {
        request.account = target;
        request.preview = true;
      }
    }

    if (
      request.preview &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      !request.originalUrl.endsWith('/preview/exit') &&
      !request.originalUrl.endsWith('/logout')
    ) {
      return response.status(403).json({
        error:
          'Profile preview is read-only. Exit preview to make changes.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}


/* =========================================================
   LOGIN SESSION
========================================================= */

async function login(response, account) {
  const token = randomBytes(32).toString('hex');

  await LoginSession.create({
    tokenHash: digest(token),
    account: account._id,
    expiresAt: new Date(Date.now() + 12 * 3600000),
  });

  response.cookie('sales_session', token, {
    httpOnly: true,

    // Local = Strict
    // Production = None so the Vercel frontend can use the API cookie
    sameSite:
      process.env.NODE_ENV === 'production'
        ? 'none'
        : 'strict',

    secure: process.env.COOKIE_SECURE === 'true',

    maxAge: 12 * 3600000,

    path: '/',
  });

  response.json({
    account: publicAccount(account),
  });
}


/* =========================================================
   CREDENTIAL VALIDATION
========================================================= */

const credentials = (body) =>
  typeof body.name === 'string' &&
  body.name.trim().length >= 2 &&
  typeof body.email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) &&
  validPassword(body.password);


/* =========================================================
   AUTH RATE LIMIT
========================================================= */

authRouter.use(sameOrigin);

authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
  })
);


/* =========================================================
   AUTH STATUS
========================================================= */

authRouter.get('/status', async (_request, response) => {
  response.json({
    setupRequired: !(await Account.exists({})),
  });
});


/* =========================================================
   INITIAL ADMIN SETUP
========================================================= */

authRouter.post('/setup', async (request, response, next) => {
  try {
    if (await Account.exists({})) {
      return response.status(409).json({
        error: 'Administrator setup is already complete.',
      });
    }

    if (!credentials(request.body)) {
      return response.status(400).json({
        error:
          'Supply name, valid email and a password of at least 4 characters including one capital letter (maximum 72 UTF-8 bytes).',
      });
    }

    const expected =
      process.env.ADMIN_SETUP_CODE ||
      (
        await readFile(
          '.local/analyst-setup-code',
          'utf8'
        )
      ).trim();

    if (
      typeof request.body.code !== 'string' ||
      !timingSafeEqual(
        Buffer.from(digest(request.body.code.trim())),
        Buffer.from(digest(expected))
      )
    ) {
      return response.status(403).json({
        error: 'Incorrect setup code.',
      });
    }

    const account = await Account.create({
      _id: '000000000000000000000001',
      name: request.body.name,
      email: request.body.email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(
        request.body.password,
        12
      ),
      role: 'ANALYST',
      region: 'ALL',
    });

    await login(response, account);
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({
        error: 'Setup already completed.',
      });
    }

    next(error);
  }
});


/* =========================================================
   LOGIN
========================================================= */

authRouter.post('/login', async (request, response, next) => {
  try {
    if (
      typeof request.body.email !== 'string' ||
      typeof request.body.password !== 'string' ||
      request.body.password.length > 72
    ) {
      return response.status(400).json({
        error: 'Invalid credentials.',
      });
    }

    const account = await Account.findOne({
      email: request.body.email.trim().toLowerCase(),
      active: true,
    }).select('+passwordHash');

    if (
      !account ||
      !(await bcrypt.compare(
        request.body.password,
        account.passwordHash
      ))
    ) {
      return response.status(401).json({
        error: 'Email or password is incorrect.',
      });
    }

    await login(response, account);
  } catch (error) {
    next(error);
  }
});


/* =========================================================
   CURRENT USER
========================================================= */

authRouter.get(
  '/me',
  authenticate,
  (request, response) => {
    response.json({
      account: {
        ...publicAccount(request.account),

        preview: request.preview,

        permissions: {
          ...publicAccount(request.account).permissions,

          ...(request.preview
            ? {
                manageAccess: false,
                peopleRegions: [],
              }
            : {}),
        },
      },
    });
  }
);


/* =========================================================
   LOGOUT
========================================================= */

authRouter.post(
  '/logout',
  authenticate,
  async (request, response) => {
    await LoginSession.deleteOne({
      tokenHash: request.sessionHash,
    });

    response
      .clearCookie('sales_session', {
        path: '/',
        httpOnly: true,
        sameSite:
          process.env.NODE_ENV === 'production'
            ? 'none'
            : 'strict',
        secure:
          process.env.COOKIE_SECURE === 'true',
      })
      .json({
        ok: true,
      });
  }
);


/* =========================================================
   ADDITIONAL AUTH ROUTES
========================================================= */

authRouter.use(
  accessProfilesRouter(authenticate)
);

authRouter.use(
  lifecycleRouter(authenticate)
);