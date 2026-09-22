# Lagos workbook update — current source

Current source: `THE UPDATED One.xlsx`, supplied from Downloads on 2026-09-12.
SHA-256: `5be31e2761e854b04328a34a39b9bdb583abadc4e5ee92bdf53e76e203e0f3c2`.
This supersedes the earlier workbook for current store mapping review. Prior source
snapshots remain archived; no database master records were changed.

## Confirmed address rule

The user explicitly states that `187` means no store address. An empty address or
an address whose entire trimmed value is `187` is normalized to null and will display
as “No store address”. An actual street address containing 187 is preserved.
There are 108 missing addresses: 88 empty cells and 20 remaining literal `187` values.

The original address and all other source fields remain available unchanged.
The name columns still contain 550 STEP-name and 102 retail-name `187` values;
these are excluded from matching as placeholders. Their presence does not erase
a valid address elsewhere in that row. No automatic name or address is invented.

## Changes versus the previous workbook

- All 166 previously `Review Required` cluster labels now have a cluster value.
- 88 address cells changed from `187` to blank.
- The Store Mapping “Mapping Note” column was removed.
- Agent Mapping, Cluster Guide, and Structure Summary cell contents are unchanged.
- The roster remains 32 agents in four zones and seven clusters; stores remain 783 rows.
- Olajide Tinuoye's dual regional/Central zonal role remains confirmed by the user.
- The ICM exception remains explicitly documented in the unchanged Cluster Guide
  and Structure Summary even though row-level Mapping Notes were removed.

| Current cluster label | Store rows |
| --- | ---: |
| Central 1 | 282 |
| Lagos Central 2 | 143 |
| East 1 | 78 |
| East 2 | 85 |
| West - Cynthia | 50 |
| West - Emmanuel | 36 |
| Lagos Island | 109 |
| Total | 783 |

These counts now also underpin the normalized hierarchy under the user's
cluster-authority instruction below.

## Resolved hierarchy inconsistencies

All 166 changed-cluster rows still contain `Review Required` in Cluster Supervisor.
Of these, 70 also have a zone inconsistent with the selected cluster: 44 rows retain
Lagos East and 26 retain Lagos West while their new cluster is Central 1 or Lagos
Central 2. Existing zonal lead labels also follow the retained zone. These describe
the original source values, which are preserved for traceability.

The user subsequently instructed: **use the assigned cluster to determine the
covering supervisor**. The assigned cluster is now authoritative in the normalized
store projection. Cluster Guide supplies the supervisor and its matching zone/zonal
lead. This resolves all 783 store rows: 166 supervisor corrections, 70 zone
corrections, and 70 zonal-lead corrections, with no unresolved cluster lookups.
Original hierarchy fields remain under `sourceHierarchy` and in the raw extraction.
Unknown future clusters remain flagged; this rule does not guess cluster membership.

Normalized store-zone counts are Central 425, East 163, West 86, and Island 109.
The agent roster and its zone counts remain unchanged. The 108 missing addresses
continue to normalize to null. No database master import has been performed.

Example: Store Mapping row 376, Badmus fatty link, has Lagos East / Central 1 /
Review Required supervisor. Its normalized hierarchy is now Lagos Central 1 /
Michael Ihejirika / Lagos Central / Olajide Tinuoye. The unchanged Structure Summary still describes
unresolved cluster labels; that note now lags the detailed Store Mapping revision.

The prior repeated-name and absent permanent ID/effective-date findings remain.
Missing addresses are a known optional-field condition, not grounds for rejecting
an otherwise valid store or sale.

## Evidence and implementation

`server/scripts/profile-lagos-workbook.js` now accepts the removed Mapping Note
column, preserves previous extraction versions, and produces a separate normalized
store projection with null missing addresses and placeholder-free matching names.
Raw records remain unchanged. This is source preparation, not a production import.

Current local evidence: `.local/source-data/lagos/profile.json`,
`normalized-stores.json`, `revision-diff.json`, and `raw-workbook.json`.
Previous extraction: `.local/source-data/lagos/versions/` under its source SHA-256.
The original review notebook is pinned to that original snapshot.

Verification: compared cell values across every worksheet; confirmed 166 cluster
edits and 88 address clears; checked hierarchy against the unchanged guide; verified
108 null normalized addresses and no `187` values in normalized matching fields.
