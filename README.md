# Tempus

Tempus is a Google Apps Script time, invoice, expense, assessment, and BAS evidence application backed by Google Sheets.

This integration line uses the coworker fork as the application baseline and reconciles the original repository’s assessment and correctness work into a migration-safe ledger model. Existing spreadsheets must complete the verified in-app upgrade before financial pages are enabled.

## Local verification

```bash
npm test
```

The suite runs without Google credentials. It uses an in-memory Apps Script/Sheets harness and fixtures representing fork-only, original-only, hybrid, empty, malformed-header, and partially migrated workbooks.

Every successful `main` build is published to the rolling `release` branch with exact commit metadata and a `release-manifest.json`. Local metadata can still be refreshed with `scripts/write-version.sh`; CI passes the source SHA and UTC timestamp explicitly. Apps Script deployment remains manual: the release workflow never runs `clasp push` or stores Google credentials.

Stable downloads and the updater script are served from the `release` branch. `scripts/update-tempus.sh` preserves the target project's `.clasp.json` before replacing source files and running `clasp push`.

## Guides

- [Time Entry](docs/time-entry.md)
- [Updates](docs/updates.md)
- [Upgrade and schema migration](docs/upgrade.md)
- [Expense ledger](docs/expenses.md)
- [Invoices and payments](docs/invoices.md)
- [Assessments](docs/assessments.md)
- [BAS and tax estimates](docs/bas-and-tax.md)
- [Migration report](MIGRATION_REPORT.md)
- [Acceptance checklist](ACCEPTANCE_CHECKLIST.md)

The same operational essentials are bundled into the in-app Help page so guidance stays aligned with the deployed build.
