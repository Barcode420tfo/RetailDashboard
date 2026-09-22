# Access profiles and previews

Babatunde (`liltomsky@gmail.com`) is the sole access administrator. Only this
account sees Manage access and can create profiles, assign roles, change login
passwords, enable/disable accounts, and preview profiles. Other Analysts view
all regions but manage people only in their assigned region. The CCO views all
regions without people editing or access management. RBMs, Zonal Leads and
Cluster Supervisors have regional, zonal and cluster visibility respectively.

Olajide (`olajide@sapphirevirtual.com`) is prepared as a disabled CCO profile with
Lagos RBM and Lagos Central Zonal Lead titles. Set a password and enable login
when ready. No password was dispatched or exposed in a report.

## Test before dispatch

1. Sign in as Babatunde and open Manage access.
2. Use Create profile to select a role, region and (where needed) zone/cluster.
3. Save with login disabled to prepare a profile; Preview profile works while disabled.
4. Preview this assignment also works without creating an account. Unsaved form
   details are not retained through a preview reload.
5. The banner identifies the preview. All writes are blocked by the server.
   Exit preview returns to Babatunde. The real administrator session is retained.
6. Set the password you intend to share, enable login and save. Passwords are
   hashed and cannot be retrieved. They can be reset through Edit profile.

Preview is session-specific, not a global identity change. Data requests, directory,
people, reconciliation, sales analytics and operations use the effective profile
scope. Hidden editing controls are backed by server checks.

Regional pages start with the operational hierarchy. Sales analytics opens the
existing charts. People management shows the permitted people; only eligible
analysts receive Add/exit controls. Lagos Island's zonal lead displays To be decided.

Inactivity is evaluated as of the selected reporting date using confirmed selling
days. Three consecutive selling days without a sale flags an MBE without altering
employment status or historical sales. Missing uploads and the known partial
September 9 source stop the confirmed streak. Last sale is retained from available
history through the selected date. Missing targets/store assignments are disclosed.

Validation: `npm test`, `npm run build`, and the temporary-account browser/API
matrix in `server/scripts/verify-role-views.js`. Owner preview flow is checked in
`.local/qa/owner-preview.mjs`. Test accounts and temporary sessions are removed.
