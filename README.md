# Tempus

Tempus is a Google Apps Script time, invoice, expense, assessment, and BAS evidence application backed by Google Sheets.

This integration line uses the coworker fork as the application baseline and reconciles the original repository’s assessment and correctness work into a migration-safe ledger model. Existing spreadsheets must complete the verified in-app upgrade before financial pages are enabled.

## Local verification

```bash
npm test
```

The suite runs without Google credentials. It uses an in-memory Apps Script/Sheets harness and fixtures representing fork-only, original-only, hybrid, empty, malformed-header, and partially migrated workbooks.

Build metadata can be refreshed with `scripts/write-version.sh`. Deployment is intentionally manual; the integration work does not run `clasp push` or alter production spreadsheets.

## Guides

- [Upgrade and schema migration](docs/upgrade.md)
- [Expense ledger](docs/expenses.md)
- [Invoices and payments](docs/invoices.md)
- [Assessments](docs/assessments.md)
- [BAS and tax estimates](docs/bas-and-tax.md)
- [Migration report](MIGRATION_REPORT.md)
- [Acceptance checklist](ACCEPTANCE_CHECKLIST.md)

The same operational essentials are bundled into the in-app Help page so guidance stays aligned with the deployed build.
