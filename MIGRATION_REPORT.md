# Migration report

Prepared: 2 August 2026 (Australia/Sydney)

## Repository integration

- Canonical application: `tempus-fork`
- Integration branch: `integration/mainline`
- Upstream parent: `9b6f512`
- Fork baseline import: `f0c5379`
- Pre-integration archive: `../snapshots/tempus-fork-pre-integration-20260802.tar.gz`
- SHA-256: `ea427bd85e3fe00ceadf45badb5a0c7f135e4715448c8428f221847995ae473d`
- `tempus-og`: reference-only and unchanged by this integration

## Data changes

- Canonical header-driven sheets replace positional relabelling.
- A verified backup is mandatory and migration progress is resumable.
- Timesheet rows gain source identity and manual request idempotency.
- Company deductions move to immutable expense transactions/rules; personal deductions remain separate.
- Assessment invoices migrate into the canonical invoice/payment lifecycle.
- BAS submissions retain immutable basis, hash, and calculation snapshots.
- Public holidays use stable IDs and multi-region catalogue records.

No production deployment or spreadsheet mutation was performed. Migration behaviour was exercised only in the local mock harness; a copied real spreadsheet is still required for acceptance.

## Correction — assessment timesheet data loss

The `2026-08-source-aware-timesheet-entries` pass derived every non-manual row's
`source_occurrence_key` from its date and then **deleted** any row whose
`(source_type, source_id, occurrence)` triple collided. That triple is not unique for assessments:
`source_type = 'assessment'` covered two different kinds of row.

- The **billable** row — auto-managed, exactly one per assessment, carries the income the assessment invoices.
- **Actual-hours tracking** rows — user-created, legitimately many per assessment *and* per day.

Any tracking row sharing a date with the billable row, or with another tracking row, was destroyed. On the
production spreadsheet this deleted **13 of 36 rows — 5,790 of 8,817 minutes (96.5 tracked hours)**.

### Fixes

- The billable row now carries the constant occurrence key `billable`, so it is unique per assessment and
  stable when the assessment date moves. Tracking rows carry **no** occurrence key and are identified by
  their own row id, which is what keeps siblings distinct.
- `migrationTimesheetSources_` is non-destructive by contract. A collision now clears that row's derived
  key and records it as `derived_source_collision_retained`; no row is ever removed.
- New migration `2026-08-repair-assessment-entry-identity` restores the deleted rows from
  `migration_archive` and re-keys the survivors. Matching is by row id, so it is idempotent.
- `syncAssessmentEntry_` matches the billable row by identity rather than by the assessment date. The old
  date-scoped lookup would adopt whichever tracking row shared that date and overwrite it with billable
  values — a second, live loss path independent of the migration.
- `api_upsertAssessmentTimeEntry` no longer keys tracking rows on their date, so a second entry on a date
  is no longer rejected as `duplicate_entry`. `api_listAssessmentTimeEntries` excludes the billable row,
  and the upsert/delete APIs refuse to target it.

### Verifying on the live spreadsheet

`api_getTimesheetRecoveryReport()` is read-only and safe to run before the upgrade. It reports current row
and minute totals, how many rows the archive still holds, and which remain recoverable. Run it before and
after the upgrade: `recoverable` should fall to 0 and `entry_minutes` should rise by `recoverable_minutes`.

If `archived` is 0 on a spreadsheet that lost rows, `migration_archive` was cleared and the pre-upgrade
backup is the only source. Recovery was verified end-to-end against the production before/after data:
23 damaged rows plus 13 archived rows restore to all 36 original rows and 8,817 minutes, with no value
drift and a stable re-run.
