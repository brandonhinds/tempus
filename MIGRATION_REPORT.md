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
