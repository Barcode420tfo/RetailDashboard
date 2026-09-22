# Build pipeline and delivery checklist

This is the working implementation checklist for the Sales Operations & Performance
Dashboard. Check items only when implemented and verified; a schema does not mean
its workflow is complete. This pipeline describes delivery order, not an existing CI service.

## Agreed product

- Lagos V1: sales, monthly targets, attendance, reconciliation, and performance analytics.
- Excel/CSV → preserved raw uploads → validation preview → approved import / exception
  review → canonical database → analytics API → fixed dashboard and exports.
- Looker Studio-style reporting with scorecards, interactive charts, clear filters,
  and drill-down tables. The user's STEP dashboard is a visual reference; its actual
  appearance has not yet been supplied. See [dashboard blueprint](docs/dashboard-blueprint.md).
- Corrections are approved by an administrator and survive subsequent uploads.
- No store coverage, agent/store ownership, GPS, clock-in app, or store attendance validation.
- Attendance supports analysis and never determines whether a sale is valid.

## 0. Database foundation — implemented locally

- [x] Create Node.js/Mongoose project and dependency lockfile.
- [x] Define agents, stores, clusters, dated agent assignments, targets, and calendars.
- [x] Define transactions, attendance, uploads, raw rows, and plan mappings.
- [x] Define users, reconciliations, and audit logs.
- [x] Define unique keys, reporting indexes, business-date validation, and integer-kobo money.
- [x] Document database relationships and service-level enforcement requirements.
- [x] Pass six offline schema tests.
- [x] Install frontend/API/form/chart/spreadsheet dependencies and development tools.
- [x] Add React starter, Express health endpoint, local environment, and run/build scripts.
- [x] Verify frontend production build and spreadsheet compatibility; dependency audit is clean.
- [x] Connect project-local MongoDB 7.0.43 replica set and create all model indexes.
- [x] Verify unique constraints and transaction rollback against local MongoDB.
- [x] Verify frontend → API → MongoDB health response.

Exit: database connects, indexes exist, and duplicate writes are rejected.

## 1. Confirm source contracts and reporting definitions

- [x] Consume supplied Lagos roster/store mapping, cluster guide, and structure summary; preserve source and document issues.
- [ ] Inspect actual sales, targets, and attendance exports.
- [x] Review updated Lagos workbook and normalize blank/187 addresses as missing, preserving raw data.
- [x] Use assigned cluster and Cluster Guide to resolve all store supervisors and matching zone/zonal lead; preserve original source hierarchy.
- [x] Allocate stable internal IDs to all 32 agents and 783 store inventory records; save registers and export a review workbook.
- [x] Allocate 11 leadership person IDs and 12 scoped role IDs; link all agents/stores to their covering leaders and export the leadership register.
- [x] Build initial master import command with preview, schema validation, existing-data protection, transactional writes, and repeat-import receipt.
- [ ] Run `npm run db:import -- --apply` to persist the prepared masters.
- [x] Link 16 agents by unique exact store-name/cluster matches; preserve shared-store references.
- [ ] Resolve the remaining 16 store references, employment/assignment effective dates, and repeated store identities; see docs/agent-store-identities.md.
- [ ] Implement and import auditable AgentStoreAssignment relationships supporting multiple agents/stores.
- [ ] Extend hierarchy for Region/Zone leadership, including Olajide Tinuoye's regional and Central zonal roles.
- [ ] Define column mappings, required fields, source systems, stable IDs, and date parsing.
- [ ] Define transaction fingerprint from reliable source fields where no source ID exists.
- [ ] Define repeated-file, repeated-transaction, changed-record, and missing-ID handling.
- [ ] Confirm NGN value meaning, refunds/reversals, test-record identification, and plan mappings.
- [ ] Agree working calendars, leave treatment, attendance statuses, and eligible employment days.
- [ ] Agree approved-unattributed sales treatment and target revision/proration rules.
- [ ] Freeze KPI definitions, zone/cluster names, report structure, and export columns.
- [ ] Obtain STEP reference for visual alignment when available; proceed from blueprint meanwhile.

Exit: real sample rows map to documented canonical fields, with no silent assumptions.

## 2. API, access control, and master-data administration

- [ ] Scaffold Express API, configuration validation, consistent errors, and health checks.
- [ ] Implement secure login, password hashing, session/token lifecycle, and logout.
- [ ] Enforce ADMIN write access and MANAGEMENT read-only access on the server.
- [ ] Build agent, store, cluster/supervisor, calendar, and monthly target administration.
- [ ] Validate foreign references and reject overlapping agent assignment periods.
- [ ] Audit master-data changes and preserve historical targets/assignments.
- [ ] Bootstrap the first administrator without committing credentials.

Exit: admin can manage masters; management cannot mutate data via UI or API.

## 3. Upload and sales ingestion engine

- [ ] Accept Excel/CSV with file size/type limits and safe parsing.
- [ ] Generate unique internal batch IDs independently of filenames.
- [ ] Hash and preserve originals, record uploader/time, and persist raw rows.
- [ ] Build column-mapping preview and validation summaries with row-level reasons.
- [ ] Detect duplicate files and transactions, including within the same batch.
- [ ] Flag unknown agents/stores, missing attribution, invalid values/dates, and test records.
- [ ] Preserve unknown plans as UNCLASSIFIED with a warning.
- [ ] Require import approval and import clean rows without discarding exceptions.
- [ ] Implement retry-safe writes and accurate accepted/flagged/rejected/duplicate counts.
- [ ] Build Upload Centre with batch history, details, and downloadable error rows.

Exit: uploading the same report twice never doubles sales; every row has a traceable outcome.

## 4. Admin reconciliation workflow

- [ ] Build queue with transaction/date/value/device/store, source agent, issue, and status.
- [ ] Add agent selection and evidence-based suggestions; suggestions never auto-approve.
- [ ] Support assign agent, correct, leave unattributed, exclude, mark test, and review later.
- [ ] Require a reason and show original versus proposed values before approval.
- [ ] Atomically save the corrected record and permanent audit/reconciliation event.
- [ ] Enforce idempotency and version checks for repeated/concurrent approvals.
- [ ] Show correction history, approver, timestamp, and reason.
- [ ] Ensure reuploads link to existing corrected records rather than overwriting them.
- [ ] Refresh affected agent, cluster, zone, product, and overall analytics after approval.
- [ ] Test Towobola/Queen attribution and test-agent exclusion using explicitly labelled fixtures.

Exit: approve a correction, reupload the uncorrected source, and confirm attribution and
all related totals remain correct. Example amounts/names are scenarios, not seeded real data.

## 5. Core analytics API

- [ ] Implement shared month/as-of date, zone, cluster, supervisor, and agent filters.
- [ ] Calculate target, MTD, achievement, expected MTD, expected achievement, and pace.
- [ ] Calculate current/required run rate, remaining balance, and month-end forecast.
- [ ] Aggregate zone/cluster performance using historical agent attribution.
- [ ] Calculate selling agents, zero sellers, transaction counts, Days Sold, and average ticket.
- [ ] Aggregate daily actual/required sales and cumulative actual/expected progress.
- [ ] Aggregate plan and device/brand count, value, and mix.
- [ ] Handle zero denominators, missing targets, empty periods, and month-end reporting explicitly.
- [ ] Expose freshness, unresolved exceptions, active filters, and reporting definitions.

Exit: independently calculated fixtures match API totals and filtered subtotals.

## 6. Dashboard interface and visualizations

- [x] Scaffold React/Vite/Tailwind and install Recharts.
- [ ] Build shared dashboard UI components.
- [ ] Build navigation, report header, global filters, reset, and freshness indicators.
- [ ] Build fixed overview layout following the dashboard blueprint.
- [ ] Add KPI scorecards, zone/cluster comparisons, daily trend, and plan/device charts.
- [ ] Build sortable agent table with target, MTD, %, count, Days Sold, plan metrics, and average ticket.
- [ ] Add drill-down navigation from zone → cluster → agent → source transactions.
- [ ] Show unresolved values separately and link admins to reconciliation.
- [ ] Implement loading, error, empty, partial-data, and permission states.
- [ ] Verify responsive layout, keyboard use, readable labels, tooltips, and accessible colours.

Exit: filters consistently affect every relevant visual; charts and tables agree with the API.

## 7. Attendance and productivity

- [ ] Import/validate attendance through the same batch and raw-row infrastructure.
- [ ] Resolve employee IDs and consolidate duplicate clock events to agent-day grain safely.
- [ ] Distinguish missing records from confirmed absence.
- [ ] Calculate active days, attendance rate, productive attendance days, and zero-sale active days.
- [ ] Calculate productive-day rate and transactions/value per active day.
- [ ] Keep Days Sold distinct from Productive Attendance Days.
- [ ] Flag sales on confirmed absence/missing-attendance dates without rejecting sales.
- [ ] Build attendance/productivity table, trend, and attendance-versus-sales scatter plot.
- [ ] Add configurable performance categories only after thresholds are agreed.

Exit: attendance updates change productivity metrics without changing validated sales totals.

## 8. Reporting and management exports

- [ ] Add detailed plan/device mix, configurable value bands, and zero-seller analysis.
- [ ] Implement Excel exports matching filters, definitions, and dashboard totals.
- [ ] Add reporting date, freshness, and unresolved-data notes to exports.
- [ ] Verify output against the approved management reporting template.
- [ ] Add PDF management summary if confirmed as a V1 priority.
- [ ] Add historical month comparisons after calendar and target rules are stable.

Exit: dashboard and exported management report reconcile exactly for the same scope.

## 9. Release verification and deployment

- [ ] Add CI checks for schema/domain tests, API integration tests, and frontend production build.
- [ ] Run end-to-end upload → reconcile → reupload → report → export tests.
- [ ] Test unauthorized writes, concurrent corrections, failed imports/retries, and empty months.
- [ ] Verify real-data totals against approved reporting, including known attribution cases.
- [ ] Configure secrets, backups/restore, logging, error monitoring, and file retention.
- [ ] Prepare deployment configuration and operator instructions.
- [ ] Deploy to the agreed environment and run smoke tests.

Exit: a real reporting cycle is repeatable, auditable, and accepted by the reporting owner.

## Immediate next work

The supplied Lagos source is documented in [sales-force context](docs/lagos-salesforce-context.md)
and [full agent roster](docs/lagos-agent-roster.md). The review has not imported master records.

Start Phase 1 source contracts. The local database, API health route, and visual
starter are running; live charts must wait for validated analytics. Update this checklist as each item passes
its verification; do not mark planned UI or business rules complete because models exist.

## Delivered: approved-baseline dashboard

- [x] Import 219 approved raw sales / ₦5,716,850 with source receipt and fingerprints.
- [x] Persist September zone targets and reporting calendar in MongoDB.
- [x] Build analytics API with consistent zone and as-of filters.
- [x] Build Looker Studio-inspired overview with scorecards, trends and zone share.
- [x] Add zone table, cluster ranking, agent details and product analytics.
- [x] Add searchable/paginated transactions and filtered CSV export.
- [x] Show missing source coverage and unmatched roster names without hiding sales.
- [ ] Implement admin reconciliation approval and audit workflow.
- [ ] Implement incremental upload preview, deduplication and approval UI.
- [ ] Add login and role authorization before shared deployment.
- [ ] Load confirmed agent/cluster targets and attendance when supplied.

## Store reporting and later regional expansion

- [x] Lagos store sales ranking, top 10, transaction drilldown and date/zone filtering.
- [x] Searchable master inventory directory with existing store IDs, state and cluster.
- [x] Export the selected store ranking or directory search to CSV.
- [x] Preserve unmatched/ambiguous master links instead of merging uncertain stores.
- [ ] Reconcile store aliases and duplicate inventory records with updated master data.
- [ ] Load other-state store masters and define explicit regional membership.
- [ ] Add region selection, reporting periods and targets after Lagos is settled.

## Regional workspaces and access — delivered

- [x] Separate Lagos, North and South West / South East region tabs and store scopes.
- [x] Include South-South states under EFE's region; preserve existing Lagos IDs.
- [x] Assign IDs to 333 North and 507 South store records and preserve source keys.
- [x] Analyst administrator cross-region overview and combined executive register.
- [x] RBM region restrictions enforced on reads and management mutations in the API.
- [x] First-admin setup, sign-in/out and analyst-managed account creation.
- [x] Regional executive registers, new joins, status changes and audit history.
- [ ] Reconcile four duplicate-name executive pairs and remaining store candidates.
- [ ] Import North/South sales, targets, zone/cluster structures and dated assignments.
- [ ] Configure shared hosting, HTTPS, account recovery and access lifecycle controls.

## Regional sales dashboards — delivered

- [x] Import 332 reviewed regional sales with repeat-batch and policy-ID protections.
- [x] Replicate the Lagos dashboard across North and South tabs with isolated data.
- [x] Add state/source-cluster breakdowns, agents, stores, products and transactions.
- [x] Preserve unknown targets/roster metrics and missing source-day coverage.
- [x] Verify regional totals, filters, all dashboard pages and RBM access restrictions.
- [ ] Load confirmed regional targets and official zone hierarchy.
- [ ] Reconcile the full agent roster and approve candidate identity links.
