# Contracts Management

How to add, edit, and interpret contracts.

## Creating/Editing
- Fields: name, start/end dates, hourly rate (total package), optional total_hours cap, weekend averaging toggle.
- Save validates date order and required fields; contracts can be retired by end date.

## Usage in Time Entry
- Entries must reference a contract valid on the entry date.
- Contract pickers filter by validity; single valid contract auto-selects.
- Changing contract reloads the matching entry for the selected date.

## Burndown & Summaries
- Detail panel shows capped contract burndown (expected vs actual remaining hours, projections).
- Unlimited contracts show total time logged.
- Weekend toggle controls whether weekends count toward expected averages (hours always count).

## Tips
- Keep rates current; Rate Preview can model future changes (flagged).
- Use total_hours to prevent overruns and watch projections.

