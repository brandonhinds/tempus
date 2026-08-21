# Updates

## Purpose

Tempus distributes tested source through a rolling stable `release` branch. Each release is built from the exact commit that passed the complete automated test suite.

## Checking Status

Tempus reads the stable release manifest in the background. When a newer stable build exists, a subtle **Update** badge appears beside About. Network or manifest failures do not interrupt normal work; About reports **Status unavailable** instead.

The About page shows the deployed short commit SHA and build time, together with the stable release SHA and publication time. Older deployments without commit metadata temporarily use a legacy date comparison and label it as such.

## Installing an Update

Back up the spreadsheet first. The automated command shown on About downloads `scripts/update-tempus.sh` from the stable `release` branch. The updater downloads the built release package, preserves the target project's `.clasp.json`, replaces the local source tree and runs `clasp push`.

For manual installation, download `tempus-release.zip` from the `release` branch and copy it into the local Apps Script project while preserving `.clasp.json`, then run `clasp push`.

## Release Safety

GitHub Actions publishes the release branch only after tests pass. The workflow does not run `clasp push`, create Apps Script deployments or store Google credentials. Apps Script deployment remains a deliberate local operation.

## Tips

- Use `--dry-run` to inspect an updater package without pushing it.
- Use `--keep` or `--clone-dir` when you need to retain the prepared workspace.
- A locally newer or divergent build is not labelled outdated solely because its SHA differs.
