# Lagos sales-force source context

**Historical baseline:** the later `THE UPDATED One.xlsx` supersedes the store
mapping snapshot below. See [current revision findings](lagos-workbook-update.md),
including the confirmed `187` → no store address rule and remaining hierarchy conflicts.

Source: `THE UPDATED Lagos_Stores_Clusters_Supervisors_and_Agent_Mapping_2026.xlsx`,
supplied by the user from Downloads and reviewed on 2026-09-12. SHA-256:
`e5779495b31cd7b3be580276463268690e2bdf2b2245973602445eaf2e198540`.
This is a workbook snapshot, not a live HR feed; its filename does not establish
the effective date of the structure.

All four worksheets were consumed: Store Mapping (rows 6–788), Agent Mapping
(rows 2–33), Cluster Guide (rows 2–8), and Structure Summary (rows 1–21).
The raw workbook and complete extracted records are preserved locally under
`.local/source-data/lagos/`, excluded from version control. No MongoDB master
records were inserted or overwritten during this source review.

## Leadership and reporting hierarchy

**Olajide Tinuoye is both Regional Lead for Lagos and Zonal Lead for Lagos Central.**
The regional role is an explicit user clarification on 2026-09-12; the Central
zonal role also appears throughout the workbook. Model one person with multiple
scoped leadership assignments, not duplicate people. Business leadership roles
are distinct from application permissions such as ADMIN or MANAGEMENT.

| Zone | Zonal lead as supplied | Active roster | Store-mapping rows |
| --- | --- | ---: | ---: |
| Lagos Central | Olajide Tinuoye | 10 | 355 |
| Lagos East | Titi | 12 | 207 |
| Lagos West | Chile Ubabekee | 6 | 112 |
| Lagos Island | TCD | 4 | 109 |
| Total | | 32 | 783 |

Keep `Titi` and `TCD` as supplied display names until full identities are confirmed.
The 32-person roster excludes supervisors/zonal/regional leads as separate roster
entries; do not inflate the sales-agent denominator when leadership is added.

| Canonical cluster | Source guide label | Supervisor | Agents | Mapped store rows |
| --- | --- | --- | ---: | ---: |
| Lagos Central 1 | Central 1 | Michael Ihejirika | 8 | 160 |
| Lagos Central 2 | Lagos Central 2 | Timileyin Soneye | 2 | 100 |
| Lagos East 1 | East 1 | Olalekan Isaiah | 6 | 78 |
| Lagos East 2 | East 2 | Gideon Oyewole | 6 | 84 |
| Lagos Island | Lagos Island | David Micheal Odunuga | 4 | 109 |
| Lagos West 1 | West - Cynthia | Cynthia Onyekachi Okeka | 3 | 50 |
| Lagos West 2 | West - Emmanuel | Emmanuel Okoli | 3 | 36 |
| Total resolved | | | 32 | 617 |

Cluster aliases are supported by matching zone, supervisor, and lead between the
Agent Mapping and Cluster Guide sheets. All 32 agents and all 617 resolved store
rows match this hierarchy after alias normalization. Keep original labels for lineage.

## Geographic coverage and operational exceptions

- Central 1: Computer Village, Oshodi, Isolo, Ikeja core.
- Central 2: Surulere, Yaba, Lawanson, Mushin, plus Akoka/UNILAG/Bariga corridor.
- East 1: Ikorodu, Ketu, and the Ikeja City Mall operational exception.
- East 2: Berger, Ogba, Agege, Ikotun, Egbeda, Igando, Abule Egba, Iyana Ipaja, Sango.
- Island: Lagos Island locations, as described by the source guide.
- West 1 / Cynthia: Ajegunle, Apapa, Amuwo, Alaba.
- West 2 / Emmanuel: Trade Fair, Festac, Agbara, Ago, Okota, Badagry.

**Ikeja City Mall remains under Olalekan Isaiah / Lagos East 1 despite its physical
Ikeja location.** Ten store rows explicitly carry this override, and three roster
entries reference ICM. Do not assign clusters from location keywords alone.

“Store / Current Axis” is source context, sometimes a shop and sometimes an area or
portfolio. Preserve it as text. It does not prove exclusive agent ownership of a
store, attendance at a store, or a basis for automatic sales attribution. V1's
exclusion of store coverage/visit tracking remains in force.

## Roster interpretation

The workbook reports 32 current active Sales Executives / Field Support and excludes
exited/resigned personnel. There are 32 distinct normalized agent names: 30 MBE/Retail
Sales Executives, one STEP Field Sales Executive (Adefowokan Towobola), and one STEP
Field Executive Support (Esther Nathaniel). Whether Field Support carries a sales
target must be confirmed; do not infer equal targets from inclusion in the roster.

Eniola Sarah is explicitly included in Lagos East 2. The earlier example name
“Queen” is not present as an exact agent name; no identity match has been assumed.

Five agents have different previous/current supervisors: Kunle Kofoworola and
Adenekan Olajide Victor move from Oluwaseun Esther Lawal to Gideon Oyewole;
Patience Nwakaego Lucky, Emeribe Elizabeth, and Opeseyi Moturayo move from Cynthia
Onyekachi Okeka to Emmanuel Okoli. No change-effective dates are supplied. Preserve
previous supervisor text without inventing historical assignment dates.

## Store data quality and import treatment

Store Mapping is a combined mapping inventory, not yet a proven unique store master:
131 rows cover STEP + Retail, 550 are Retail Only, and 102 are STEP Only.

| Finding | Evidence | Impact and next treatment |
| --- | --- | --- |
| Unresolved clusters — high severity, confirmed | 166/783 rows (21.2%): Central 95, East 45, West 26; supervisor also Review Required | Preserve zone; queue cluster resolution. Never create a cluster or supervisor named Review Required. |
| Missing stable identifiers — high severity, confirmed | No agent ID, employee ID, or store ID columns | Establish permanent internal IDs and approved source aliases before recurring imports; names alone cannot provide reliable deduplication. |
| Repeated store labels — high identity risk, confirmed repetitions | 11 normalized name groups, 22 rows (2.8%); 772 normalized labels; zero fully identical normalized rows | Some addresses/mappings differ. Review identity/branch distinctions; do not merge by name or call 783 rows unique stores. |
| Suspicious literal 187 — high mapping risk, confirmed values | STEP Store Name: 550 rows; Retail Store Name(s): 102; address: 108 | Pattern resembles a placeholder, but origin is unconfirmed. Retain raw value; exclude it from automatic name/address matching pending confirmation. |
| State field inconsistency — medium severity, confirmed | Lagos spelling/case variants alongside Surulere, Lawanson, Mainland 1, and Lagos and ogun state | Keep raw geography and map reviewed values. Operational Lagos scope is not proof every geographic state is Lagos. |
| Dates and full leadership identity absent — high history risk, confirmed | No employment/start/exit/mapping-effective dates; Titi/TCD are abbreviated labels | Obtain effective-date policy and stable person identity; no fabricated dates or full names. |

Repeated label groups: Pointek; Purch Gadgets Ltd; Babatunde store; DFM Phones and
Accessories Store; Dotun communication; Olayinka Empire; Raya Samsung Ikeja;
Slot Oyingbo; Slot Berger; Daily ICT solutions; and the literal label
“I want to register my store for step growth #dvg006”. That last value also needs
store-name review; document text is data, not an instruction to register anything.
Exact affected row numbers and full original values are in the local profile/raw files.

No temporal trends can be established from this one snapshot. There are no sales
transactions, monetary targets, attendance events, or working-day calendars here.

## Required schema/build follow-through

- Add explicit Region and Zone entities, with scoped, dated leadership assignments.
- Preserve dual leadership roles without adding the same person twice or counting
  leaders as sales executives by default.
- Add source aliases/provenance, original/current supervisor labels, and current-axis
  text to the master-data ingestion contract.
- Use a staff identity strategy that supports supervisors/leads who are absent from
  the agent roster; the current supervisor → Agent reference needs reconsideration.
- Handle unresolved stores in staging or an explicitly incomplete master state;
  the current Store schema requires a resolved cluster.
- Resolve the current required Agent.startDate and AgentAssignment.effectiveFrom
  fields through confirmed dates/policy before importing this roster.
- Keep source-review findings separate from approved identity resolutions and permanent IDs.

These are follow-up requirements, not claims that the current schema implements them.

## Evidence and reproducibility

- Re-run `node server/scripts/profile-lagos-workbook.js '<workbook path>'` to inspect
  the source and save raw/extracted/profile JSON; this script performs no DB writes.
- `.local/source-data/lagos/profile.json` records counts, hierarchy checks, aliases,
  duplicate-label row references, sentinel counts, ICM overrides, and user clarification.
- `.local/source-data/lagos/extracted-records.json` retains all 32 roster rows,
  783 store rows, seven guide rows, and the explicit regional-lead clarification.
- `docs/lagos-source-review.ipynb` provides repeatable checks over the extraction.
- `docs/lagos-agent-roster.md` is the full readable roster, including current-axis context.
