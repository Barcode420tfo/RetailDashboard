# People management

The People management tab replaces the executive register entry point. It lists
the existing registered executives by authorized region, with search, pagination,
status filters and a selected sales date range. Current team excludes RESIGNED
and EXITED records; Everyone and Resigned / exited retain access to their history.

Click a name or Performance to view sales count, value, days sold, average sale,
individual transactions and employment events. Performance uses accepted sales
in the selected period, including historical sales by people who have left.
Agent-ID links take precedence. A unique normalized source-name match within the
same region is labelled unverified; ambiguous names remain unassigned and cannot
duplicate sales between people. Unassigned sales remain in dashboard totals.

Add sales executive collects region, joining date and optional state, cluster and
store information. Lagos entries also create a linked Agent record for subsequent
sales imports. Existing people cannot be added again under an identical normalized
name in the same region; their original record can be reactivated instead.

Record resignation defaults the status form to RESIGNED. Effective date and reason
are required; a date cannot be in the future, precede joining, or precede the last
recorded employment change. Status changes and audit events commit atomically,
with optimistic concurrency protection. Linked Lagos Agent status is synchronized.
Sales and targets are not deleted or reallocated, and no login account is created
or disabled by employment status changes.

Analysts can manage all regions; RBMs can read and update only their assigned
region. The API independently enforces the same access boundaries.

Validation: unit tests in `tests/people.test.js`; isolated database lifecycle and
permission checks in `server/scripts/verify-people-management.js` (run with `.env`).
The integration script creates a uniquely named disposable test database and
removes only that database after testing. Desktop/mobile browser checks cover
navigation, search, performance drilldown, add/resignation forms and status filters.
