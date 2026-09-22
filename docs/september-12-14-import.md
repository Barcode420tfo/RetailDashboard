# September 12–14 sales update

Source: `12th to 14th .xlsx`, SHA256 recorded in
`data/reports/sales-update-2026-09-14-3af749390855.json`.
The full source is preserved under `.local/source-data/sales-updates/`.

Imported 110 SUCCESS sales / NGN 3,108,700 with recorded UTC business dates
September 12–14. Source workbook totals: 140 rows / NGN 3,618,850.
There were no duplicate policy IDs within the source or against existing sales.
Blank spreadsheet rows do not count as sales.

| Region | Added count | Added value | MTD count through 14 Sep | MTD value |
| --- | ---: | ---: | ---: | ---: |
| Lagos | 43 | 1,854,850 | 262 | 7,571,700 |
| North | 22 | 375,000 | 109 | 2,703,850 |
| South West / South East | 45 | 878,850 | 290 | 5,739,700 |
| Total | 110 | 3,108,700 | 661 | 16,015,250 |

Held in UploadRow staging: 26 September 15 rows / NGN 479,000 outside the
requested date range; four rows / NGN 31,150 without state, cluster, store or
agent, including one NGN 6,000 ACTIVE payment status needing confirmation.
No missing dates were shifted and no region was guessed.

Lagos mapping uses exact roster names or unambiguous store references.
Larry Store has conflicting zone/cluster references (old Central 1, latest East 2);
its NGN 21,000 is included in Lagos Unmapped. The source name
Towobola Adefowokan Nkiru is retained without an identity merge; its store maps
to Central 1. Missing agent names remain Unattributed.

The import, source-row staging and reporting-period metadata update committed
in one MongoDB transaction. Existing targets, working calendar, and September
1–11 sales were preserved. Available dates only gain observed imported dates.
Dashboard date limits now use reporting-period metadata instead of September 11.
Unmapped zones remain visible without discarding the known overall target.

Run a read-only preview:

```sh
node --env-file=.env server/scripts/import-sales-update.js '/path/to/12th to 14th .xlsx' --through=2026-09-14
```

`--apply` commits; the identical completed batch is skipped. `--through=2026-09-15`
and `--include-active` require the corresponding user decisions and do not resolve
missing state attribution. No such decisions were assumed for this import.

Read-only reconciliation:

```sh
node --env-file=.env server/scripts/verify-sales-update.js data/reports/sales-update-2026-09-14-3af749390855.json
```

Verified source amounts/dates, held-row exclusion, unchanged historical totals,
zone/state filters, region/cluster/agent/transaction totals, period metadata and
workspace totals. Browser checks also verified September 14 date bounds,
the custom September 12–14 range, and Central 1 drilldown (11 sales / NGN 504,850).

The Excel receipt `data/reports/September-12-14-Sales-Reconciliation.xlsx` contains
regional, state/zone and cluster totals plus held rows and attribution notes.
