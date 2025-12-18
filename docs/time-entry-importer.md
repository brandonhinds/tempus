# Timesheet 1.0 Importer

Available when `enable_timesheet1_importer` is enabled.

## Purpose
- Import legacy Timesheet 1.0 spreadsheets into Tempus with mapping and duplicate checks.

## Flow
- Open the Importer modal on the Time page (flagged).
- Select the legacy sheet from Drive.
- Map hour types and contracts as prompted.
- Run duplicate detection; resolve conflicts before confirming import.

## Constraints
- Validates contracts and date ranges; entries outside active contracts are skipped with warnings.
- Requires hour types to be enabled for mapping when present in source.

## Tips
- Run after configuring contracts/hour types to minimize remapping.
- Review summary before applying to avoid double-counting.

