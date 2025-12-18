# Recurring Time Entries

Available when `recurring_time_entries` is enabled.

## Purpose
- Define weekly or monthly schedules that auto-create basic entries within contract validity windows.

## Creating a Schedule
- Open the Recurring Entries modal on the Time page (flagged).
- Configure: cadence (weekly/monthly), hours per occurrence, contract, hour type, start/end dates.
- Validation: ignores contracts longer than 3 years; clamps to active contract dates.

## Behavior
- Generates basic entries only; backfills within allowed windows.
- Warns when a contract is ignored or invalid for dates.
- Non-income hour types backfill without income impact.

## Editing & Removal
- Updating a schedule syncs generated entries to the new config.
- Deleting removes generated entries for that schedule.

## Testing Notes
- Check future-dated income schedules, contract boundary handling, and non-income hour types.

