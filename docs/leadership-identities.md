# Lagos leadership IDs

Allocated IDs are saved in data/masters/lagos-leadership-register.json and exported to artifacts/lagos-leadership-register.xlsx. There are 11 people with 12 scoped roles. LDR identifies the person; RL, ZL, and CS identify regional, zonal, and cluster assignments. These are internal app IDs.

| Assignment ID | Leader | Scope | Person ID |
| --- | --- | --- | --- |
| RL-LAG-0001 | Olajide Tinuoye | Lagos | LDR-LAG-0001 |
| ZL-LAG-0001 | Olajide Tinuoye | Lagos Central | LDR-LAG-0001 |
| ZL-LAG-0002 | Titi | Lagos East | LDR-LAG-0002 |
| ZL-LAG-0003 | TCD | Lagos Island | LDR-LAG-0003 |
| ZL-LAG-0004 | Chile Ubabekee | Lagos West | LDR-LAG-0004 |
| CS-LAG-0001 | Michael Ihejirika | Lagos Central 1 | LDR-LAG-0005 |
| CS-LAG-0002 | Timileyin Soneye | Lagos Central 2 | LDR-LAG-0006 |
| CS-LAG-0003 | Olalekan Isaiah | Lagos East 1 | LDR-LAG-0007 |
| CS-LAG-0004 | Gideon Oyewole | Lagos East 2 | LDR-LAG-0008 |
| CS-LAG-0005 | David Micheal Odunuga | Lagos Island | LDR-LAG-0009 |
| CS-LAG-0006 | Cynthia Onyekachi Okeka | Lagos West 1 | LDR-LAG-0010 |
| CS-LAG-0007 | Emmanuel Okoli | Lagos West 2 | LDR-LAG-0011 |

Olajide Tinuoye retains one person ID for both roles. Titi and TCD remain source display names until their full names are provided. No effective dates have been invented.

The saved lagos-leadership-links.json maps all 32 agents and 783 store records to their covering supervisor, zonal lead, and regional lead IDs. Existing agent and store IDs are unchanged. These are saved identity registers; no MongoDB import or authentication accounts were created.

Re-run node server/scripts/create-lagos-leadership.js to reproduce the workbook. The script reuses saved IDs and requires reconciliation for revised source versions. Preserve the register; do not renumber people after a name or role change. Future role changes require dated assignments retaining historical IDs.

Verified: unique person and assignment IDs, expected role counts, Olajide's shared person ID, all hierarchy references and scopes, exported row counts, and unchanged IDs after a rerun.
