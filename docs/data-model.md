# Data Model & Sheets Overview

High-level view of the key sheets and what they store. Exact schemas live in `sheetSchemas.md`.

## Sheets
- `entries`: time entries (date, contract_id, hour_type_id, punches JSON, duration_minutes, entry_type).
- `contracts`: contracts with validity windows, rates, optional total_hours cap, weekend-average toggle.
- `feature_flags`: flag id and enabled state (docs in `featureFlags.md`).
- `user_settings`: per-user settings including entry defaults, super rate, themes, cache metadata.
- `hour_types`: configurable hour categories (flagged).
- `recurring_entries`: schedules for recurring time entries (flagged).
- `bulk_entries`: configs for bulk ranges (flagged).
- `deductions`: personal/company deductions and extra super; category metadata when enabled.
- `invoices` plus line items: invoice headers and details (flagged).
- `bas_periods`: BAS rows (flagged, company tracking dependent).
- `actual_income`: received income records (flagged).
- `public_holidays`: cached holidays (flagged).

## Backend Modules
- `backend/*.gs` expose `api_*` endpoints consumed by the UI; business logic stays modular and pure where possible.
- `backend/settings.gs` handles feature flag persistence.
- `backend/version.gs` tracks build metadata (maintained by hook/script).

## Frontend State
- `views/partials/scripts.html` owns most UI logic and state (entries, contracts, flags, cache).
- `views/partials/mobile-*.html` handle mobile entry shell and logic.

