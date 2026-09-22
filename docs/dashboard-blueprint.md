# Dashboard visual and reporting blueprint

## Direction

Build a Looker Studio-style internal analytics dashboard: light neutral canvas,
white panels, restrained borders, consistent spacing, strong numeric typography,
and a compact filter bar. Prioritize useful charts and clear comparisons. This is
a custom React application, not a requirement to embed or integrate Looker Studio.

The user also referenced a STEP dashboard. No image, link, or source for that
dashboard has been provided; exact visual matching remains open. This blueprint
is the working direction until that reference is available.

## Fixed overview structure

```text
Sales Operations                         Reporting date | Last updated
Month | As-of date | Zone | Cluster | Supervisor | Agent | Reset | Export

Month Target | MTD Achieved | Achievement | Expected Achievement / Pace
Current Run Rate | Required Run Rate | Forecast

ZONE PERFORMANCE                CLUSTER PERFORMANCE
Actual vs target bars           Actual vs expected MTD bars

DAILY SALES TREND                CUMULATIVE MONTH PROGRESS
Actual + required reference     Actual vs expected trajectory

AGENT PERFORMANCE
Sortable, filterable table with drill-down

PLAN MIX                        BRAND / DEVICE PERFORMANCE
SLD | SAP | Essential | Other    Ranked sales/count comparisons

Data status: sales/attendance freshness, unresolved count and value
```

The template stays fixed when new files arrive. Month labels and values are dynamic;
September and ₦28.1m are examples, not hard-coded defaults.

## Visual-to-question mapping

| Section | Visual | Management question |
| --- | --- | --- |
| Executive KPIs | Numeric scorecards with units and supporting labels | Where are we against target and expected progress? |
| Zone performance | Horizontal actual-versus-target bars | Which of Central, East, West, Island contributes or trails? |
| Cluster performance | Horizontal bars with expected MTD reference | Which clusters are ahead or behind pace? |
| Daily trend | Daily sales columns with required-rate reference | Which days performed above or below the daily requirement? |
| Month progress | Cumulative actual and expected lines | Is the gap widening or closing? |
| Agent performance | Sortable detail table | Who needs attention, and what produced their result? |
| Plan mix | Labelled bars; optional 100% stacked comparisons by cluster | How do SAP, SLD, Essential, and unclassified contribute? |
| Brand/device mix | Ranked horizontal bars with count/value switch | Which brands and devices drive volume versus value? |
| Attendance productivity | Scatter plot plus detail table | How do attendance and sales achievement relate? |
| Zero sellers | Ranked table with active-day context | Who attended consistently without sales? |

Use Central 1/2, East 1/2, West 1/2, and Island as the requested cluster layout;
load official labels and membership from approved masters.

## Metric labels and table columns

- Achievement = valid MTD sales / monthly target.
- Expected achievement = elapsed eligible working days / total eligible working days.
- Pace = actual MTD / expected MTD. Do not label both percentages simply “Expected Pace”.
- Agent table: Agent, Cluster, Target, MTD, Achievement %, Transactions, Days Sold,
  SAP, SLD, Essential, Unclassified, Average Ticket. Make plan count/value units explicit.
- Attendance detail adds Active Days, Attendance %, Productive Attendance Days,
  Productive-Day %, Zero-Sale Active Days, Transactions/Active Day, and Value/Active Day.
- Days Sold includes every valid selling date; productive attendance days require attendance.
- Show compact ₦k/₦m on cards and full precision in tooltips/exports. Rates show `/day`.

## Interaction and visual quality

- Global filters drive all relevant cards, charts, tables, and exports. Show active scope.
- Zone/cluster selections allow drill-down while retaining reporting month/date.
- Keep series colours stable across pages; supplement colour with labels and symbols.
- Start bar axes at zero; show missing data as unknown rather than as zero performance.
- Use a shared time axis for daily charts; distinguish future dates from zero-sale past dates.
- Avoid decorative 3D charts, excessive pie charts, and unexplained dual axes.
- Provide precise tooltips, clear legends, visible units, and readable table totals.
- Show no-data, loading, failure, and stale/partial upload states deliberately.
- Allow horizontal scrolling for dense tables on small screens; keep primary labels visible.
- Keep admin actions within Upload Centre, Master Data, and Reconciliation; management
  views focus on reporting, with suitable read-only data-quality indicators.

## Reconciliation page

Queue columns: Transaction ID, Date, Value, Device/Store, System Agent, Issue,
Proposed Agent, and Action. Filters: issue type, batch, date, and review status.

Open a row to inspect source values, choose an agent or exclusion action, record
a reason, and approve. Show correction history and refresh affected reporting after
the committed change. Suggestions need evidence and human approval.

Known examples to cover in tests: blank-agent Fold transaction assigned to Towobola,
blank-agent Mayour Lee transaction assigned to Queen, and test-agent transaction
excluded. These are illustrative acceptance scenarios until source records confirm them.

## Visual acceptance

- Same scope yields the same totals in scorecards, chart tooltips, tables, and exports.
- A reconciliation updates every affected view and remains intact after reupload.
- Charts remain readable with no data, one day, a full month, long names, and many agents.
- Filters, sorting, drill-down, and keyboard navigation work in the rendered browser.
- Real reporting values are source-backed; development fixtures are clearly labelled.
