# Sales Operations Dashboard

V1 database foundation for Lagos sales, targets, attendance, and reconciliation.
Track implementation in [the build checklist](TODO.md) and see the
[dashboard visual blueprint](docs/dashboard-blueprint.md) for the agreed UI direction.
The supplied Lagos organization, roster, store mapping, and source issues are captured
in [sales-force context](docs/lagos-salesforce-context.md).
The latest workbook review and `187` address rule are in [current source update](docs/lagos-workbook-update.md).
Allocated IDs and store-link outcomes are documented in [agent/store identities](docs/agent-store-identities.md).
Leadership IDs and reporting relationships are documented in [leadership identities](docs/leadership-identities.md).
Node.js ESM with Mongoose, Express, and a React/Vite/Tailwind starter. A health
endpoint and connection-status page are provided. Authentication workflows,
file parsing, reconciliation, and analytics services are not implemented yet.

## Setup

1. Use Node.js 22.12 or later and run `npm ci`.
2. Copy `.env.example` to `.env` if absent. This Mac has a project-local MongoDB
   installation in `.local/mongodb/bin`; binaries and data are excluded from git.
3. Run `npm run db:start` to start MongoDB and initialize the local `rs0` replica set.
4. Run `npm run db:indexes` to create database collections and indexes.
5. Run `npm run dev` and visit http://127.0.0.1:5173. API runs on port 3001.

Use `npm run db:status` to check MongoDB and `npm run db:stop` to stop it. Data
persists in `.local/mongodb/data`; logs are in `.local/mongodb/mongod.log`.
MongoDB runs separately from the web/API process and survives stopping `npm run dev`.
It does not automatically start at login. Do not run `db:start` if already running.

Run `npm test` for offline schema tests, `npm run test:db` for live index/transaction
verification, and `npm run build` to build the frontend. After building, `npm start`
serves the API and frontend together at http://127.0.0.1:3001.

Index creation is explicit and does not drop existing indexes. Resolve existing
duplicates before creating unique indexes. Local MongoDB binds only to 127.0.0.1
and uses no authentication; this is a development environment. Use an authenticated
MongoDB Atlas deployment or managed replica set for production, and set MONGODB_URI.
The local start/stop scripts always target this project's local instance, not Atlas.

## Import the saved Lagos master registers

From this project directory, run `npm run db:import` for a read-only database
preview, then `npm run db:import -- --apply` to import. `--validate-only` checks
the files and schemas without connecting. The initial importer requires empty
master collections, preserves all saved IDs, and commits inserts in a transaction.
An exact completed rerun is skipped; revised inputs require reconciliation.

Imports: 7 clusters, 11 leadership people, 12 leadership assignments, 32 agents,
783 store inventory records, and 32 agent-store references (16 linked, 16 pending).
Zones are currently stored as cluster labels, not separate Zone documents.
Unprovided employment/role dates remain unset. Agents have current roster cluster
and supervisor references; historical AgentAssignment records are not invented.
Store operational status is UNKNOWN because the source does not establish it.
Original state text is retained pending geographic normalization. No login users,
sales, attendance, calendars, or targets are fabricated.

## Installed dependency groups

- UI: React, React DOM, React Router, Recharts, Lucide icons, TanStack Query/Table.
- Forms: React Hook Form, its validation resolvers, and Zod.
- API: Express, CORS, Helmet, rate limiting, Pino logging, and Multer uploads.
- Authentication building blocks: bcryptjs and JOSE (JWT). Login is still to be built.
- Data: Mongoose, ExcelJS for XLSX read/write, Papa Parse for CSV. Legacy `.xls`
  files must be converted to `.xlsx` or CSV; supporting `.xls` is not configured.
- Tooling: Vite, React/Tailwind Vite plugins, Tailwind CSS, concurrently, Supertest.

See [local runtime notes](docs/local-runtime.md) for MongoDB installation provenance.

See [database design](docs/database-schema.md) for relationships, reporting rules,
and the service requirements that schemas alone cannot enforce.

## Working September dashboard

Run `npm run db:start`, then `npm run dev`; open http://127.0.0.1:5173.
The dashboard reads MongoDB through `/api/dashboard`. It includes overview,
zone/cluster reporting, agent details, product charts, searchable transactions,
source notes, date/zone filters, and CSV exports scoped to the current selection.

The approved baseline is 219 transactions / ₦5,716,850 from the September 1–11
raw workbook. Monthly zone targets total ₦28,100,000. Percentage achievement in
the zone table is against the expected MTD target; monthly achievement is shown
separately. Pace and forecasts use 26 selling days, excluding Sundays (10 elapsed
through September 11). Missing September 6 data stays null; September 9 remains
flagged as partial. Raw source zones are retained for reporting.

The reproducible importer is:

```sh
node --env-file=.env server/scripts/import-approved-sales.js '/Users/mac/Downloads/1st to 11th raw data.xlsx' --apply
```

An identical completed batch is skipped. The source workbook is preserved under
`.local/source-data/accepted-sales/`. ReportingPeriod holds the source receipt,
calendar and zone targets; accepted sales carry `ACCEPTED_BASELINE` status.
A disabled service user attributes the import, without creating a login account.
Admin reconciliation editing and upload approval UI remain pending. Authentication
and individual agent targets are implemented as described below. This is the local working dashboard.

Date controls support MTD through a chosen date or an inclusive custom range within
the imported September 1–11 coverage. Range targets use selling days within that
range, and cumulative charts restart at its beginning. Monthly forecasts and
required run rates are available in MTD mode. The desktop sidebar collapse
preference is remembered locally; charts and tables use larger type and thicker bars.

Performance colours compare sales with the expected target for the selected dates:
under 50% red, 50–69% amber, 70–99% blue, 100–119% green, and 120%+
deep green. The run-rate strip, achievement card, zone progress/gaps and forecasts
share this palette and a visible legend. Zone-share colours identify categories;
agent/cluster contribution charts remain neutral until their targets are loaded.

## Agent targets loaded provisionally

The September DevPro allocation snapshot is stored on ReportingPeriod with source
hash, worksheet/row references, matched stable agent IDs, employment status and
pending proposals. Thirty current agents match; four departed allocations retain
₦3,281,818. Eniola Sarah and Esan Ayobami Appolus have no allocated target.
Reallocation text is documentary and has not been executed. DevFin is excluded.

Agent reporting now includes target, actual, monthly achievement, expected pace,
pace attainment, gap and forecast. Blank targets produce null comparisons, never
zero-target success. Forecasts are simple sales-rate projections, available in MTD
mode, and do not infer continuing employment. CSV exports include these metrics.
See `data/reports/Lagos-Agent-Targets-vs-MTD-11-Sep-2026.xlsx` for the initial comparison.
The importer is `server/scripts/import-agent-targets.js` (source path then `--apply`);
identical sources skip and changed sources require reconciliation.

## Lagos store reporting

Store performance ranks reported source names by sales value within each zone,
with count, average ticket, selling days, share and transaction details. Case and
whitespace variants are grouped; other aliases remain distinct pending review.
An exact name/zone match links to a master store only when unique. The directory
shows all existing inventory records with state and stable IDs, independently of
the sales date filter. A missing link does not imply zero sales. CSV export follows
the selected store tab and search. Other-state and region dashboards remain planned.

## Regional access and executive register

Three regions are now separate workspaces: LAG (Olajide Tinuoye), NOR (Faith Gold),
and SSE (EFE; includes South-South). The analyst administrator can see all regions;
RBMs can access only their assigned region, enforced by the API. Lagos reporting
continues against its approved baseline. Other regions currently show store and
executive directories; their sales and targets have not been supplied.

Open the dashboard to create the first analyst account. Use the code in
`.local/analyst-setup-code`, your name/email and a 12–72 character password. Then use
**Manage access** to create RBM accounts. Passwords are hashed and sessions use
HttpOnly, SameSite cookies. This remains a local deployment; use HTTPS and
`COOKIE_SECURE=true` when configuring a shared deployment.

Imported 333 North and 507 SSE store records, preserving 783 Lagos IDs. The 43
non-test up-country executive records contain four pairs of duplicate-name
candidates retained for review. Lagos has 32 roster members plus four historical
exited/resigned target holders. These are record counts, not deduplicated headcounts.
Store source codes and row references are preserved. New joins and status changes
have dated audit events; imported unknown dates remain blank. The executive register
tracks staffing separately from the approved historical sales/target snapshot.

The analyst has a combined **All regions → Sales executive register** as well as
individual region views. See `data/reports/Regional-Stores-and-Executives.xlsx`.
`server/scripts/import-regional-workspace.js` preserves an exact completed import;
updated workbooks require reconciliation before reusing or changing assignments.

## North and South sales dashboards

All three regional tabs now use the shared sales dashboard, protected by regional
API authorization. `/api/dashboard?region=NOR` and `region=SSE` read separate
RegionalReportingPeriod records and region-filtered transactions. North has 87
sales / ₦2,328,850; South has 245 / ₦4,860,850, through September 11, 2026.
The importer `server/scripts/import-regional-sales.js` verifies the source hash,
rejects overlapping identifiers, and atomically saves the batch and source rows.
An exact repeat is skipped.

These regions show state comparisons until official zones are provided. Source
cluster labels are retained; simple spacing variants are grouped. Selling names
are not assigned to canonical agent IDs yet. Exact and ambiguous executive-name
candidates remain provisional, and active roster/zero-seller counts stay unknown.
Regional targets, percentages, expected pace and gap remain null until supplied.
Forecasts use the provisional 26-day calendar (Sundays excluded). September 6 is
absent and September 9 has no sales rows; the trend preserves those data gaps.
Store directories, sales rankings, agent details, product analytics, date/state
filters and exports are independently scoped to each region. The analyst's
All regions view also shows the individual regional sales totals.

## Regional state targets from the management screenshot

North monthly target is ₦9,800,000 (FCT ₦8,800,000; Kaduna ₦1,000,000).
South monthly target is ₦18,200,000 (Imo ₦6,700,000; Rivers ₦4,900,000;
Delta ₦4,300,000; Oyo ₦1,100,000; Osun ₦1,200,000). Ondo's target is unknown.
The explicit regional total is used for all-state reporting without inventing an
Ondo target. Filtering Ondo leaves target comparisons blank.

Only targets were taken from the screenshot. Workbook actuals remain authoritative:
Osun ₦285,000 / 6 sales and Ondo ₦46,000 / 2, versus screenshot Osun ₦331,000 / 8.
Combined actuals remain ₦12,906,550 / 551 sales. Screenshot actuals were not imported.
See `data/reports/regional-target-screenshot-reconciliation.json` and the repeat-safe
`server/scripts/import-regional-targets.js` for the target source receipt.

## Password recovery and deployment

Analysts can now enable/disable accounts and issue one-use recovery codes in
**Manage access**. Codes expire after 30 minutes; changing or recovering a
password invalidates existing sessions. **Change password** is available to
signed-in users. Email delivery is not configured.

Run `node --env-file=.env server/scripts/verify-account-lifecycle.js` for the
MongoDB integration check (temporary test accounts are removed afterward).

The [deployment guide](docs/DEPLOYMENT.md) covers the Docker/Caddy package,
hosting/domain setup, database migration and first login. Hosting has not yet
been provisioned. The local database is not automatically copied online.

## Management overview

Analysts land on **All regions**: combined value, volume, weighted attainment,
and provisional forecast; regional actual/expected bars; daily or cumulative
sales trends; and three separate regional scorecards with the top three named
agents by accepted sales value. Source-name rankings outside Lagos remain
provisional until full roster mapping. Blank/unattributed labels do not rank.

MTD and inclusive custom dates update every metric, chart and leaderboard
within the imported September 1–11 coverage. Missing observations remain gaps.
Custom ranges starting after September 1 have no monthly forecast. Export
summary uses the applied dates; region arrows open the detailed dashboards.
Cross-region data is still protected by the existing region authorization.
