# Required sales upload review

User-approved workflow (September 17, 2026): daily upload sheets are the source
for reporting. Keep unresolved sales in approved totals; flag inconsistencies,
show their impact, and obtain user approval before applying an upload.

Before any Atlas write:

1. Check workbook hash, policy duplicates, dates, payment status and amounts.
2. Resolve each sale's region, zone and cluster. Prefer supplied stable agent or
   store IDs. If absent, accept only unique, region-scoped roster/reference
   matches and record the matching basis. Do not merge ambiguous names.
3. Compare linked agent and store assignments with source cluster/zone fields.
   Check effective-dated assignments when available. A current-roster mismatch
   is a review finding, not automatic proof a historical sale is wrong.
4. Show per-zone/cluster counts and values, unresolved assignments, and conflicts.
   Do not call a source-only cluster label a verified identity assignment.
5. Record explicit approvals for reporting-date or payment-status exceptions.
   Preserve original timestamps and raw source fields in upload audit records.
6. Commit atomically with duplicate guards, then verify saved assignments and
   dashboard totals. Audit corrections with their before/after values.

Known approved correction: policy 48a287a0-a317-44f6-8977-f7159107d069,
Ogbonna Ifeoma Joy, September 14, NGN 9,000 belongs to Lagos Central 2 /
Lagos Central. Cross-cluster inactivity calculations do not correct sales mapping.
