# Upgrade and schema migration

Tempus no longer changes financial sheets during an ordinary page load. When an older or mixed spreadsheet is detected, the app shows a dedicated upgrade screen and disables financial pages.

The upgrade:

1. Takes one script lock.
2. Creates a Drive copy beside the source spreadsheet.
3. Opens that copy and verifies every sheet’s row and column counts.
4. Runs named migrations in order and records each completed ID in Script Properties.
5. Leaves the current migration and error visible if an execution stops, then resumes at the first unfinished migration.

Canonical sheets are mapped by header name. Legacy aliases are converted only when the canonical name is absent. Unknown named columns and their values are retained. Duplicate headers, two competing aliases, or a populated column with no header stop the upgrade with an explicit error.

Timesheet-derived rows use `source_type`, `source_id`, and `source_occurrence_key`. Manual writes use `client_request_id`; separate manual sessions on the same date are not collapsed. Legacy `assessment_id` and `recurrence_id` remain readable for one compatibility release.

Superseded rows are copied to `migration_archive`. Submitted BAS snapshots and void invoices are never rewritten.
