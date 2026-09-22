# September 2026 target and cluster reference

Source: `data/sources/september-2026-targets.xlsx`, copied from the user-supplied
`LAGOS AND OTHER MARKET SEPT TARGETS.xlsx`. The source hash, worksheet names,
row numbers, 53 rep allocations and 19 supervisor/leadership rows are retained in
`data/masters/september-2026-target-clusters.json`.

The user supplied this workbook to recognize old and new cluster names in future
uploads. Workbook contents are reference data, not operational instructions.

User correction superseding the workbook's combined `Lagos Island/East` lead:
Titilayo Ojo is the Lagos East zonal lead only. Lagos Island's zonal lead is
**To be decided**, stored as unassigned with no person name. The original source
workbook is preserved; the saved reference records the correction and source scope.

| Former name | Current name |
| --- | --- |
| Lagos Mainland 1 / Mainland 1 | Lagos East 1 |
| Mainland 3 | Lagos East 2 |
| Mainland 4 | Lagos East 2 |
| Lagos Mainland 2 / Mainland 2 | Lagos West 1 or Lagos West 2; requires rep/store context |
| Computer Village | Lagos Central 1 |
| Surulere | Lagos Central 2 |
| Lagos Island | Lagos Island 1 |

Current names are also accepted. Case, whitespace and punctuation differences
are normalized. Aliases apply within region from September 2026 onward until
superseded by another confirmed mapping. Unknown or ambiguous labels remain
unresolved; they must not be guessed or counted in both clusters. Source labels
are preserved. No historical transaction or employment assignment was rewritten.

`server/services/cluster-aliases.js` implements this resolution and is connected
to the approved Lagos workbook importer when a `Cluster` column is present.
The existing importer still only accepts the approved September baseline;
a general future-upload interface has not yet been implemented. Future ingestion
must call this resolver with region, business month, source cluster and available
rep/store/zone context.

DevPro and DevFin allocations are stored separately as integer kobo.
These are rep allocations, not automatically assumed to be full regional targets.
Lagos DevPro allocations sum to NGN 24,218,182, compared with the existing
NGN 28,100,000 overall target. Replacing live targets awaits the user's decision.
The stored workbook is a target/alias reference; it does not activate, deactivate,
or merge rep accounts or alter sales values.

Regression coverage: `tests/cluster-aliases.test.js` verifies aliases, splits,
unknown labels, region scope and effective-date behavior.
