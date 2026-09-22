# September 10 workbook versus September 11 screenshot

Source workbook: `NEWW Lagos_MTD__10_Sep_vs_10 August.xlsx`, all seven worksheets
reviewed. Comparison source: user-supplied DEVPRO September zone/state screenshot
labelled 1st–11th September. Workbook explicitly ends September 10, 2026. No
September 11 transaction file was supplied at the time of review. No sales imported.

## Like-for-like zone comparison

| Zone | Monthly target in both | Workbook through 10th | Screenshot through 11th | Net difference | Count through 10th | Count through 11th |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Central | 10,800,000 | 2,049,900 | 2,138,350 | +88,450 | 98 | 101 |
| East | 7,200,000 | 2,209,800 | 2,488,800 | +279,000 | 54 | 64 |
| Island | 4,600,000 | 338,000 | 553,100 | +215,100 | 9 | 10 |
| West | 5,500,000 | 778,000 | 776,000 | -2,000 | 44 | 46 |
| Total value / sum of zone counts | 28,100,000 | 5,375,700 | 5,956,250 | +580,550 | 205 | 221 |

All money in NGN. The workbook total cell states 210 transactions, but its four
zone rows sum to 205. Screenshot rows and total both sum to 221. Thus +11 is the
difference between displayed total cells, whereas +16 is the difference between
summed zone counts. Neither is a verified September 11 transaction count.

Net differences may include September 11 sales and retrospective corrections.
West decreasing by 2,000 while its count increases by two proves these cannot all
be interpreted as purely additive positive sales under an unchanged baseline.

## Calendar and pace

Workbook: 9 of 26 selling days, 17 remaining. Expected MTD is 9,726,923.08,
actual 5,375,700, pace 55.27%, current run rate 597,300/day, required remaining
rate 1,336,723.53/day, and forecast 15,529,800.

Screenshot values correspond to 10 of 26 selling days: expected MTD 10,807,692.31,
actual 5,956,250, pace approximately 55.11%, forecast 15,486,250. Small one-naira
differences when summing displayed expected-target/gap rows are rounding effects.
The lower forecast is consistent with the extra selling day and nearly flat pace.
These percentages are versus expected MTD, not monthly target achievement.
The workbook also includes sales on September 6, labelled Sunday/non-selling day;
those sales remain included even though the pace calendar excludes that day.

## Workbook reconciliation findings

1. **Management count total:** Zone Performance E7 = 210, while E3:E6 = 205.
   Cluster Performance volume rows also sum to 205. Value totals do reconcile at 5,375,700.
2. **Agent-to-cluster differences:** Agent Performance rows 3–34 total 197 sales /
   5,272,000. Cluster rows total 205 / 5,375,700, leaving eight sales / 103,700.
   Central 1 agent value exceeds cluster value by 4,000; East 2 cluster exceeds
   agents by two sales / 23,700; West 1 cluster exceeds agents by six sales / 84,000.
   All other cluster aggregates agree with listed agents.
3. **Different reporting bases:** Daily Trend, SLD SAP Mix, and brand totals all
   reconcile to 199 system-clean transactions / 5,074,800. The management total
   5,375,700 is 300,900 higher. This is explicitly described as reconciliation in
   the workbook, but it is not a transaction-level audit of every adjustment.
4. **Agent-day bridge:** Listed agents' daily cells total 181 / 4,712,000. Their
   reconciliation columns add 16 / 560,000, yielding 197 / 5,272,000, matching the
   agent summary. The system-clean daily report includes 18 transactions / 362,800
   beyond those listed agent daily cells. Do not force daily/product charts to equal
   management totals without separately accounting for omitted records and adjustments.

## Targets and identities learned

Listed roster target amounts total 24,818,182. Four former target holders retain
3,281,818 (Saliu Abiodun Esther 981,818; Adeniyi Monsurat Funmi 500,000;
Amehinola Ayodele Thompson 700,000; Adefisoye Adebolanle Abigail 1,100,000).
Together these reconcile exactly to 28,100,000. Keep these target allocations
separate from active headcount rather than redistributing them silently.

Eniola Sarah has no target and is marked INCOMING here; Esan Ayobami Appolus also
has target TBC. The earlier roster calls all 32 active. Preserve this as a dated
source difference pending clarification rather than overwriting current HR status.
The former-holder note mentions 11,700 historical MTD for Adeniyi; this alone does
not fully explain East 2's 23,700/two-count difference.

The agent sheet explicitly labels Anyika Uchechukwu Lilian as “(Queen)”, supplying
the alias evidence previously missing. Her existing identity is AGT-LAG-0007.
Towobola's management MTD is 603,000 / five transactions; the agent-day bridge
contains 399,000 / three count adjustments over 204,000 / two system transactions.
These adjustment summaries must not be expanded into fabricated transactions.

## Import implications

This workbook contains aggregate performance snapshots and agent-day summaries,
not raw transaction IDs/store IDs. It is suitable as a reconciliation baseline,
target source, and report specification. It cannot safely be loaded as individual
sales into the current Transaction model. Never import overlapping agent, zone,
daily, device, and plan aggregates as separate sales.

Retain the 1st–10th baseline, then validate the separately supplied 11th file against
it. Resolve the inconsistent transaction total and cluster/agent residuals; compare
the resulting reconciled 1st–11th totals with the screenshot. Do not assign the net
580,550 difference to September 11 without the actual daily data.

Raw extracted worksheet values and source SHA-256 are saved locally in
`.local/source-data/performance-sep10/workbook.json`. Original source is unchanged.
