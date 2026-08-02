# Acceptance checklist

Use a copied spreadsheet and a test Apps Script deployment. Do not use production for this checklist.

## Upgrade

- [ ] Open each fixture-equivalent workbook shape and confirm the upgrade screen appears.
- [ ] Confirm a Drive backup is created and its link opens.
- [ ] Interrupt an upgrade, reload, and confirm it resumes at the unfinished migration.
- [ ] Confirm malformed headers stop with an actionable error and no financial pages load.
- [ ] Re-run a completed upgrade and confirm row counts and source relationships do not change.

## Workflows

- [ ] Create separate same-day manual sessions and confirm neither is deduplicated.
- [ ] Sync weekly, fortnightly, monthly, bulk, assessment, holiday, and import-derived entries twice; the second sync makes no changes.
- [ ] Exercise Agenda, mobile entry, persisted open punch, theme, and keyboard quick actions.
- [ ] Record, pay, attach evidence to, and reconcile an expense; export the FY CSV.
- [ ] Confirm a legacy unreconciled expense is in the annual report but outside BAS GST credits.
- [ ] Create a draft invoice, recalculate, issue, part-pay, complete payment, void where permitted, and revise.
- [ ] Create configurable assessment fields and lines, generate an invoice, issue it, verify locks, then void and confirm release.
- [ ] Compare cash and accrual BAS periods, submit a snapshot, change source data, and confirm the change warning without snapshot mutation.

## Boundaries and safety

- [ ] Verify 30 June/1 July, leap day, month-end recurrence, and both Sydney DST transitions.
- [ ] Try spreadsheet formula prefixes and HTML payloads in every user-text field.
- [ ] Force browser storage quota failure and confirm a visible warning while server data remains intact.
- [ ] Confirm invoice numbering remains unique under two concurrent issue attempts.
- [ ] Print/export totals and confirm GST rounding against the test fixtures.
- [ ] Run `npm test`, then perform the test-deployment smoke run with no `clasp push` to production.
