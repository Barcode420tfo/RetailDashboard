# Vercel frontend and hosted backend

Recommended layout: Vercel (Vite frontend), a paid Render or Railway service
(Express backend), and MongoDB Atlas (replica set). The app uses database
transactions. A GitHub push does not migrate sales, users or target allocations.

## Prepare private data locally

Run `node --env-file=.env server/scripts/prepare-hosted-reference.js` against the
local database before exporting it. Migrate that database, including the
applicationreferences collection, into an empty Atlas database. Do not copy
loginsessions or passwordrecoveries. Keep the local database as a backup and
verify totals/accounts before allowing production use.

The private reference is deliberately not committed. A fresh hosted backend
refuses to start without the migrated reference rather than showing invented
or incomplete allocations. Local imports still use the existing local file.

## Backend

Deploy the Dockerfile on Render or Railway. Set these environment variables in
the hosting dashboard, never in Git:

- MONGODB_URI: Atlas replica-set connection string
- CLIENT_ORIGIN: exact HTTPS Vercel production origin
- COOKIE_SECURE: true
- HOST: 0.0.0.0
- TRUST_PROXY_HOPS: 1 (verify against the chosen proxy chain)
- NODE_ENV: production

The platform can supply PORT. Health endpoint: `/api/health`. A Render blueprint
is supplied; choose the instance plan explicitly. No hosting resources have been
provisioned by committing these files. Use a plan that does not sleep if immediate
availability is required. Uploaded source-file persistence needs private object
storage or a persistent backend disk if web uploads are added later.

## Vercel

Import the GitHub repository as Vite. Build: `npm run build`; output: `dist`.
Copy `deploy/vercel.example.json` to `vercel.json` and replace YOUR-BACKEND-HOST
with the actual backend hostname before deployment. API rewrites must precede
SPA fallback. Keeping browser requests on the Vercel origin preserves the
current same-origin secure-cookie authentication. Do not expose MONGODB_URI
through VITE_ variables or frontend code.

## Go-live checks

Verify same-origin `/api/health`, login/logout, owner role assignment, RBM/zone/
cluster restrictions, all-region totals, profile preview exit, and secure cookies.
Confirm that disabled profiles cannot sign in. Only the configured owner account
can manage access. No credentials or business spreadsheets belong in this public
repository.
