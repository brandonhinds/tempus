# Bulk Time Entries

Available when `bulk_time_entries` is enabled.

## Purpose
- Apply identical entries across a date range without manual repeats.

## Creating a Bulk Range
- Open Bulk Entries modal (flagged) on the Time page.
- Configure: hours per day, contract, hour type, start/end dates.
- Options: include weekends toggle; skip public holidays when `enable_public_holidays` is on.

## Behavior
- Generates basic entries for each included day.
- Editing the bulk config keeps generated entries in sync (adds/updates/removes).
- Validates contract/date alignment; warns on invalid combinations.

## Tips
- Use hour types to control income contribution.
- Combine with public holiday flag to avoid over-counting.

