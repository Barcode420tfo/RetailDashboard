# Agent IDs and store references

All 32 agents in the supplied Lagos roster have allocated IDs `AGT-LAG-0001`
through `AGT-LAG-0032`. The durable register is
`data/masters/lagos-identity-register.json`. These identifiers are internal app IDs,
not employer-issued employee IDs. They are allocated once and must not be renumbered
when names, clusters, supervisors, or row order change.

The 783 store inventory records also have IDs `STR-LAG-0001` through
`STR-LAG-0783`. This identifies source records; it does not resolve duplicate physical
stores. Any future merge must retain old IDs as aliases rather than silently reuse IDs.

## Linking results

`data/masters/lagos-agent-store-links.json` contains one result for every agent:

- 16 linked to a unique exact store-name match within the assigned cluster.
- 3 ambiguous exact matches (Cynthia Omodia, Grace Umoh Etukudo, Onyegbula Gift).
- 10 need review of naming differences or missing source stores.
- 3 have only an area/portfolio: Ogbonna Ifeoma Joy, Olayinka Afolabi, and
  Jolaoye Habibat Folashade. Their coverage text is preserved; no individual shop is invented.

Formatting-only matching ignores spaces/punctuation/case and the redundant `(ICM)`
label. Candidate lists are review suggestions, never established assignments.
No fuzzy candidate is automatically linked. An exact link identifies a source
inventory record and may need consolidation if duplicate store identities are later resolved.

Multiple agents may link to the same store: Adebayo Akinmuda (`AGT-LAG-0011`)
and Bello Mariam Kikelomo (`AGT-LAG-0013`) both reference SLOT Ikeja Mall
(`STR-LAG-0274`). This is a many-to-many business relationship, not exclusive ownership.

The user's request adds agent/store references to the build scope. These references
do not prove store attendance, create a store-coverage KPI, or auto-attribute transactions.
Assignment-effective dates remain unknown. This step creates the persistent identity
and link registers plus a review workbook; it does not import incomplete master
documents into MongoDB or claim an assignment API exists.

## Review workbook

`artifacts/lagos-agent-store-register.xlsx` contains:

- Agents: all IDs, names, designations, hierarchy, and source store/axis labels.
- Agent Store Links: linked store IDs, statuses, and candidate references.
- Stores: every inventory ID, name, address, and normalized hierarchy.
- Review Candidates: candidate names/addresses for unresolved links.
- Read Me: matching rules and interpretation.

Run `node server/scripts/create-lagos-identities.js` to reproduce the current export.
The script reuses the saved ID register and rejects a different source version until
identity reconciliation is performed. Preserve/back up `data/masters`; never delete
the register to refresh data. Link outputs are generated suggestions; future approved
link corrections must be stored separately and replayed before any regenerated output.

## Follow-through

Confirm the unresolved store identities, then add dated AgentStoreAssignment
relationships during master-data import. The relation must support multiple agents
per store and multiple stores per agent, auditable changes, and no invented dates.
Resolve absent employment dates before creating Agent documents under the current schema.
