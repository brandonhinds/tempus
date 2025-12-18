# Basic Time Entry (Manual)

Guide to the manual “total hours” flow.

## Overview
- Captures a single duration for a date, stored as one punch from 00:00 to duration.
- Requires a valid contract for the selected date; hour types can require contracts (flagged).

## Fields
- Date (defaults to today or selected calendar date).
- Contract (required; auto-selected when only one valid).
- Hour type (when `hour_types` enabled; falls back to default hour type).
- Total hours (numeric, > 0, <= 24).
- Rounding interval applied on save.

## Interactions
- Save adds/updates entry; Cancel reverts in-progress edits; Delete removes entry when editing.
- Validation: blocks missing contract when required, invalid hours, or duration beyond 24h.
- Tab switching: prevents switching to punch if an advanced entry already exists for same date/hour type.

## Editing Existing Entries
- Selecting a calendar day loads entry for that date/hour type; Update Entry saves changes.
- Deleting clears the entry and related income summaries.

## Tips
- Use hour types to toggle contract requirement; manual contract options filter by contract validity on the chosen date.
- Defaults (basic) can auto-fill hours and hour type when enabled; see `time-entry-defaults.md`.

