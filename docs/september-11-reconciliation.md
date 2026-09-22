# September 11 reconciliation result

Sources: user-supplied `11th sales perfomance report  .xlsx`,
`NEWW Lagos_MTD__10_Sep_vs_10 August.xlsx`, and the September 1–11 zone screenshot.
All four worksheets in the 11th workbook were read. No sales were imported.

The September 11 daily amounts reconcile internally across MBE Daily Detail,
CS Performance, and Management Summary: 17 transactions, NGN 423,000, and 12
selling executives out of 32. Central contributes 7 / 88,000; East 5 / 238,000;
Island 0 / 0; West 5 / 97,000. Every reported sale is labelled ESSENTIAL.

## Comparison using the supplied September 10 zone baseline

| Zone | MTD through 10th | 11th value | Calculated MTD | Screenshot MTD | Screenshot minus calculated |
| --- | ---: | ---: | ---: | ---: | ---: |
| Central | 2,049,900 | 88,000 | 2,137,900 | 2,138,350 | +450 |
| East | 2,209,800 | 238,000 | 2,447,800 | 2,488,800 | +41,000 |
| Island | 338,000 | 0 | 338,000 | 553,100 | +215,100 |
| West | 778,000 | 97,000 | 875,000 | 776,000 | -99,000 |
| Total | 5,375,700 | 423,000 | 5,798,700 | 5,956,250 | +157,550 |

All monetary figures are NGN. These signed differences are unresolved report
differences, not verified missing sales or authorized corrections.

The 11th workbook uses 2,050,000 as Central's opening value, 100 above the prior
workbook's 2,049,900. Consequently it displays 5,798,800 updated MTD, which is
157,450 below the screenshot. Neither opening balance has been silently substituted.

## Transaction counts

The prior zone rows sum to 205 transactions; adding 17 gives 222, versus screenshot
221. Per zone, calculated counts are Central 105 / East 59 / Island 9 / West 49;
screenshot counts are 101 / 64 / 10 / 46. The nearly matching grand total hides
material differences in zone allocation.

The prior workbook's total cell says 210 despite those rows summing to 205. Using
that displayed total instead would yield 227. This existing five-count discrepancy
remains unresolved by the new file.

## Evidence limits and source changes

This is a derived performance report with executive-level counts/values, not the
underlying 17 policy records. Its Reconciliation Notes claim successful payments,
unique Policy IDs, complete attribution, and five early September 12 UTC timestamps
assigned to the 11th batch. Those claims cannot be independently checked without
the referenced `DEVPRO sale 11th.xlsx` raw export. Date reassignment is a stated
source convention, not a new instruction to change business dates.

The report has no Island sales, so it does not explain the screenshot's 215,100
Island increment. West's 99,000 lower screenshot value likewise needs a historical
correction, differing coverage, or another explanation backed by records.

It supplies new store context for Oluebube Peace Ejiogu (Finet Otigba 1) and a
changed store label for Anyika Uchechukwu Lilian (Awolowo Way 2 versus earlier
Awolowo 1). Some roles also differ from the master roster. These are recorded
source differences, not approved updates to staff/store assignments.

## Conclusion

The daily report reconciles internally, but the two supplied workbooks combined
do not reproduce the screenshot. Preserve all three sources; do not force a match
by adding invented transactions or modifying the opening figures. Raw September
11 policy records and the screenshot's underlying calculation/reconciliation source
are the next evidence needed to explain the differences.

Local evidence: `.local/source-data/performance-sep11/reconciliation.json` records
the source SHA-256, per-zone comparisons, and verified daily totals; `workbook.json`
preserves all populated worksheet values including cached formula results.
