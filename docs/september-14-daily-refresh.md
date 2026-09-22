# September 1–14 replacement source and reconciliation

User-approved source: `DEVPRO DAILY SALES SEPT 2026-7.xlsx`.
SHA256: `87286ba756acd745718470fdd11b17b5e2604f12f952499920c2505afa18021c`.

The replacement committed atomically with source staging, transaction audit
history, reporting-period totals and reconciliation cases. The original workbook
and the pre-refresh transactions/reporting periods are retained privately in
`.local/source-data/daily-refresh/`. Existing transaction document IDs and original
source-row links are preserved; `latestSourceRow` points to the replacement.

| Region | Count | Sales value NGN |
| --- | ---: | ---: |
| Lagos | 268 | 7,634,700 |
| North | 110 | 2,712,850 |
| SW / SE | 310 | 6,143,700 |
| Total | 688 | 16,491,250 |

660 existing sales match the replacement, including 48 September 5 fingerprint
records now matched uniquely to policy IDs using original timestamp, amount,
agent and store. These IDs are repaired in place, not reinserted. 28 successful
sales worth NGN 497,000 are added. Larry Store's previously counted NGN 21,000
is absent from this workbook and is held, not deleted. The net increase is
27 sales / NGN 476,000. Non-SUCCESS payments and renewals are excluded.

## Dates and allocation

- Within September 1–14, use the latest source's recorded calendar date. No
  host-timezone or invented eight-hour adjustment is applied.
- 25 sales / NGN 662,000 formerly dated September 13 now fall on September 12.
  These are the same policies, not additional sales.
- Clinton enterprise NGN 9,000 remains dated September 13 despite its placement
  on the `14TH` worksheet. This sheet/timestamp conflict is in reconciliation.
- NGN 195,000 listed on `3RD` carries an August 28 timestamp. It remains
  provisionally included on September 3, visibly flagged for month eligibility.
- September 6 has no sheet; September 9 remains partial. No standalone September
  13 sheet establishes completeness. Missing observations are not zero sales.
- Latest source zone/state names are used; approved legacy/current cluster
  mappings resolve split clusters using agent/store context. Fct/FCT, Imo/Imo
  Cluster and Southwest 1/South West 1 are normalized. Ogbonna's source/roster
  cluster conflict is retained in reconciliation, using the source cluster.
- Targets and selling calendars are preserved; dependent totals, performance and
  forecasts are calculated from the refreshed transactions.

## Reconciliation tab

43 transaction-level cases, each counted once even when multiple issues apply:
38 INCLUDED cases / NGN 711,850 and five HELD cases / NGN 273,550.
The five holds comprise two renewals / NGN 239,400, one ACTIVE payment / NGN 6,000,
Larry Store / NGN 21,000 and a prior unattributed hold / NGN 7,150 still missing
from the replacement source. UNKNOWN-region holds are visible only to analysts.

The tab appears in the workspace header and hamburger sidebar and follows the
selected region. Search, issue/status/treatment filters, paginated records,
detail drawer, source location, old/new evidence and scoped CSV export are
available. Notes and review statuses persist with actor/time history and an
optimistic version check. Review status changes do not change sales inclusion,
value, dates or attribution; an actual sales correction requires a separate
audited correction. The drawer states this explicitly.

API: `GET /api/workspace/reconciliation?region=...` and
`PATCH /api/workspace/reconciliation/:id` (`status`, `note`, `version`).
Regional managers can only read/review their region; analysts can access all.

## Repeatable checks

Preview first; add `--apply` to commit an approved replacement:

```sh
node --env-file=.env server/scripts/refresh-daily-sales.js '/path/to/DEVPRO DAILY SALES SEPT 2026-7.xlsx'
```

The identical completed workbook is skipped. Duplicate source policy IDs,
ambiguous fingerprint matches, concurrent transaction changes or non-reconciling
regional totals prevent the refresh. Amount conflicts are held explicitly.

`npm test` covers source dates, duplicate prevention, exact identity migrations,
payment statuses and cluster conflicts alongside existing dashboard tests.
`server/scripts/verify-reconciliation.js` uses a disposable database to test
region isolation, review validation, history and concurrent-edit protection.
`.local/qa/reconciliation.mjs` verifies the live totals and rendered workflows.
Aggregate reconciliation receipt: `data/reports/daily-refresh-87286ba756ac.json`.
