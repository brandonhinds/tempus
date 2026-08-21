# Tempus Update Testing

Run these checks from the root of `tempus-fork`. Do not test against the production Apps Script project or production spreadsheet. Use a test copy and back it up first.

## 1. Local automated tests

```bash
npm test
```

Expected result: all tests pass. This covers the unified desktop day editor's source wiring, release metadata generation, stable-release comparisons, updater safeguards, and the release workflow's test gate.

You can also check the shell scripts without running the updater:

```bash
bash -n scripts/write-version.sh
bash -n scripts/write-release-manifest.sh
bash -n scripts/update-tempus.sh
```

## 2. Release metadata in an isolated directory

This does not modify `backend/version.js` or create a release in GitHub.

```bash
test_dir="$(mktemp -d)"
test_sha="0123456789abcdef0123456789abcdef01234567"
test_time="2026-08-08T01:02:03Z"

scripts/write-version.sh \
  --commit "$test_sha" \
  --timestamp "$test_time" \
  --output "$test_dir/version.js"

scripts/write-release-manifest.sh \
  --commit "$test_sha" \
  --timestamp "$test_time" \
  --output "$test_dir/release-manifest.json"

sed -n '1,20p' "$test_dir/version.js"
sed -n '1,20p' "$test_dir/release-manifest.json"
```

Confirm:

- `version.js` contains the full test SHA, the exact UTC timestamp, and build date `2026-08-08`.
- The manifest has schema `1`, channel `stable`, the same full SHA and timestamp, display version `2026-08-08+0123456789ab`, and a release-branch ZIP URL.
- Invalid or abbreviated manifest SHAs are rejected. For example, this command should exit with status 2:

```bash
scripts/write-release-manifest.sh \
  --commit 0123456 \
  --timestamp "$test_time" \
  --output "$test_dir/invalid.json"
```

Remove the disposable directory when finished:

```bash
rm -r "$test_dir"
```

## 3. Updater offline dry run

This test never invokes `clasp`. It creates a small local package with a release manifest, replaces a stale test file, and verifies that the target's `.clasp.json` survives unchanged.

```bash
test_dir="$(mktemp -d)"
package_root="$test_dir/package/tempus-release"
target_dir="$test_dir/target"
mkdir -p "$package_root" "$target_dir"

printf '%s\n' '{"scriptId":"TEST_SCRIPT_ID"}' > "$target_dir/.clasp.json"
cp "$target_dir/.clasp.json" "$test_dir/clasp-before.json"
printf '%s\n' 'stale' > "$target_dir/stale-file.txt"
printf '%s\n' 'release payload' > "$package_root/example-release-file.txt"

scripts/write-release-manifest.sh \
  --commit 0123456789abcdef0123456789abcdef01234567 \
  --timestamp 2026-08-08T01:02:03Z \
  --output "$package_root/release-manifest.json"

tar -czf "$test_dir/release.tar.gz" -C "$test_dir/package" tempus-release

scripts/update-tempus.sh \
  --dry-run \
  --archive-file "$test_dir/release.tar.gz" \
  --clone-dir "$target_dir"

cmp "$test_dir/clasp-before.json" "$target_dir/.clasp.json"
test -f "$target_dir/example-release-file.txt"
test ! -e "$target_dir/stale-file.txt"
```

Expected result: the updater prints `Dry run complete`, `cmp` succeeds silently, the release file exists, and the stale file is gone.

Also verify that a package without `release-manifest.json` is rejected before any push. Use a fresh disposable target for that negative case because the updater intentionally replaces the target contents while preparing an update.

```bash
bad_target="$test_dir/bad-target"
mkdir -p "$test_dir/bad-package/not-a-release" "$bad_target"
printf '%s\n' '{"scriptId":"TEST_SCRIPT_ID"}' > "$bad_target/.clasp.json"
printf '%s\n' 'not a release' > "$test_dir/bad-package/not-a-release/file.txt"
tar -czf "$test_dir/bad-release.tar.gz" -C "$test_dir/bad-package" not-a-release

scripts/update-tempus.sh \
  --dry-run \
  --archive-file "$test_dir/bad-release.tar.gz" \
  --clone-dir "$bad_target"
```

Expected result: it exits non-zero with `manifest missing`. Then remove the disposable files:

```bash
rm -r "$test_dir"
```

## 4. Test-copy deployment

Deploy only to a separate Apps Script test project connected to a copied spreadsheet. Preserve that test project's `.clasp.json` when copying the new source. Check `.claspignore` before pushing: `release-manifest.json`, scripts, tests, docs, and repository-only files must not be uploaded as Apps Script source.

After you manually push the test copy, open its web app and use representative contracts and hour types, including:

- A Simple-compatible hour type, such as Annual Leave.
- A Detailed-compatible hour type, such as Work.
- One type with a required contract, one with an optional contract, and one with no contract.
- A historical entry whose hour type or contract is no longer active in the current configuration.

## 5. Unified desktop day editor

Test both Calendar and Agenda on a desktop-width browser.

### Mixed-day display and totals

1. Create a day with at least two timed Work sessions and at least two fixed-duration entries, including Annual Leave.
2. Open the day normally from Calendar, then from Agenda.
3. Confirm there are no Basic/Sessions tabs.
4. Confirm the complete day is visible in this order: Timed Sessions, Duration Entries, then day-level comment/copy actions.
5. Confirm the overall total equals timed duration plus fixed duration.
6. Confirm the Sessions heading separately reports timed duration and breaks.
7. Confirm the Duration Entries heading reports only fixed-duration total.
8. With an open punch, confirm the day remains usable and the running session is represented correctly.

### Exact duration-entry operations

1. On a day with multiple duration and session entries, expand the second duration row.
2. Confirm its hour type, contract/billable context, and duration are correct.
3. Edit hours, hour type, and contract; save; reopen the same row and confirm only that entry changed.
4. Edit again and choose Cancel; confirm the saved values return.
5. Delete one duration entry and confirm only it disappears and totals update.
6. Simulate or cause a server-side delete failure and confirm the optimistically removed row returns.
7. Add a duration entry and confirm only Simple-compatible choices are offered.
8. Open a historical entry with inactive configuration and confirm its existing hour type and contract remain selectable and editable.

### Timed-session operations

1. Add a session and confirm only Detailed-compatible choices are offered.
2. Edit start/end times inline and confirm chronological ordering and totals update.
3. Verify inferred and stored breaks remain visible and correct.
4. Exercise clock in, clock out, add, and delete with multiple sessions present.
5. Confirm a failed optimistic delete restores the session.

### Break invariants

1. Create two completed sessions with a gap and confirm one break appears strictly between them.
2. Start a third session after that break, then immediately delete the new session. Confirm no break remains hanging after the last surviving session.
3. Repeat while adding and deleting quickly, before the server response completes. Confirm a late response does not bring the break back.
4. Delete the last session on a day and confirm every break on that day disappears.
5. Delete the first or final session from a three-session day. Confirm only gaps still bounded by two surviving sessions remain.
6. Refresh with an existing orphan break in the test data. Confirm it is hidden immediately and removed during reconciliation.
7. Cause a session save/delete failure and confirm the restored sessions regenerate any valid between-session break without creating a leading or trailing break.

### Draft protection

1. Begin changing a duration entry, then attempt to add or edit a session.
2. Confirm you are prompted to save or discard before switching draft types.
3. Repeat in the opposite direction: dirty session to duration entry.
4. Choose Save and confirm valid changes persist.
5. Choose Discard and confirm original values return.
6. Attempt to close the modal with each kind of dirty draft and confirm discard confirmation appears.
7. Cancel the close confirmation and confirm the draft and focus remain in the modal.

### Day-level and targeted behavior

1. Edit the day comment and use copy-previous-day; confirm both affect the whole day and are outside the Sessions section.
2. Click an ordinary Calendar day and confirm every entry remains accessible.
3. Click a specific Calendar entry marker that uniquely identifies one entry; confirm the full day opens and only that matching entry is automatically expanded.
4. If a target is ambiguous, confirm the full day still opens without hiding records.
5. Confirm the purpose-built mobile entry flow has not changed.

### Accessibility and narrow layouts

1. Use only Tab, Shift+Tab, Enter, Space, and Escape to open, navigate, expand, edit, cancel, and close the modal.
2. Confirm focus enters the dialog, stays trapped while open, and returns to the control that opened it.
3. Confirm expanded rows expose the correct `aria-expanded` state to browser accessibility tools.
4. Test a narrow desktop window and browser zoom at 200%; confirm controls wrap without clipping and all actions remain reachable.

## 6. About and update status

On the test deployment, open About and confirm:

- The deployed build's short SHA and timestamp appear.
- The stable release's short SHA and publication timestamp appear when the manifest is available.
- A newer stable release adds only the subtle **Update** badge beside About.
- No persistent header warning appears.
- A manifest or network failure causes no global warning and shows `Status unavailable` only on About.
- A matching full SHA or matching legacy abbreviated SHA is treated as current.
- A different release SHA with a later release timestamp is treated as an available update.
- A local build with a later timestamp is reported as locally newer, not outdated.
- Different SHAs with equal timestamps are treated as divergent, not automatically outdated.
- A legacy build with no usable SHA uses the temporary date comparison and labels the comparison as legacy.

The automated tests cover these comparison branches. To exercise network failure manually, temporarily point `RELEASE_MANIFEST_ENDPOINT` in the test copy only to a nonexistent URL, then restore it before any release.

## 7. GitHub Actions release channel

When you are ready to test the remote pipeline yourself:

1. Push the intended commit to `main`, or manually dispatch **Publish stable release**.
2. Confirm **Run complete test suite** succeeds before any publish step starts.
3. Confirm a successful run force-updates the rolling `release` branch from the exact source commit.
4. Inspect `release/release-manifest.json`: it must contain schema `1`, channel `stable`, the full source SHA, a UTC publication timestamp, a display version, and the release ZIP URL.
5. Inspect `release/backend/version.js`: its full SHA and timestamp must match the manifest.
6. Download the release ZIP and confirm it contains the built metadata and manifest.
7. Confirm the workflow contains no `clasp push`, Apps Script deployment, Google credentials, or deployment creation.
8. For the failure gate, use a temporary branch/workflow test or a deliberately failing test in a controlled commit. Confirm the job stops at the test step and the existing `release` branch SHA does not change. Do not merge the deliberate failure into `main`.

## 8. Calendar, refresh, quick-fill, and holiday follow-up

### Quieter weekends

1. Open Settings > General and find **De-emphasise weekends**. It defaults to on for users who have not saved a preference yet.
2. Save it on, then inspect both Calendar and the Agenda mini-calendars.
3. Confirm only the date numbers on empty Saturdays and Sundays are faded. Weekend cell backgrounds and borders should match weekdays.
4. Confirm a weekend with logged time, a public holiday, today, the selected day, and a hovered day remain clearly visible.
5. Turn the option off and save. Confirm weekends return to the same resting treatment as weekdays.
6. Refresh the test app and confirm the saved choice persists.

### Entries refresh resilience

1. Hard-refresh the test app several times with a normal connection.
2. Confirm a one-off Apps Script `NetworkError: Connection failure due to HTTP 0` is retried silently instead of immediately showing an Entries sync failure.
3. Confirm entries eventually populate and the Syncing status clears.
4. If all retry attempts genuinely fail, confirm the final failure is still reported rather than silently presenting cached data as current.

### Optional-contract quick fill

1. Configure a Simple duration hour type with quick fill enabled and no contract requirement.
2. Right-click a Calendar or Agenda day and select that duration.
3. Confirm it saves with **No contract** and does not show “Select a contract”.
4. Repeat after previously editing a contract-backed entry; confirm the optional quick fill does not inherit that parked contract.
5. Confirm a genuinely contract-required duration still asks for a contract.
6. Confirm attempting quick fill where the same hour type already has timed sessions reports the Sessions conflict, not a contract error.

### Rolling public-holiday window

1. Open Public Holidays and switch among at least two state filters.
2. Confirm every holiday in the current calendar year remains listed, including dates that have passed.
3. Confirm next-year holidays appear only when they are less than one calendar year from today.
4. With the current test date of 13 August 2026, the list should include applicable 2027 holidays before 13 August 2027 and exclude those on or after 13 August 2027.
5. Confirm the list remains chronological across the year boundary and the relative labels remain sensible.
6. Refresh and confirm both years repaint from cache, then reconcile without flicker or duplicate rows.

## 9. Final acceptance

The change is ready only when:

- `npm test` passes.
- The isolated metadata and offline updater tests pass.
- Calendar and Agenda pass the unified-editor checks in a test copy.
- The mobile flow is unchanged.
- About is the only place that shows release failures, and the only global update signal is the subtle About badge.
- A successful CI build publishes matching exact metadata to `release`.
- A failing CI build leaves the current release untouched.
- No production Apps Script project has been pushed or deployed during testing.
