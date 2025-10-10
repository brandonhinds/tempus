# Feature Flags

This document lists the feature flags supported by the Timesheet app. Each flag is also persisted in the `feature_flags` sheet, but this file provides an at-a-glance reference for repository contributors.

| Flag | Default | Description |
| --- | --- | --- |
| `remember_last_page` | Disabled | When enabled, the app reopens on the last viewed page after refresh. |
| `show_clear_cache` | Disabled | Shows a "Clear Local Cache" button on the Settings page. |
| `show_zero_hours` | Disabled | Displays `0` for days without logged time in the calendar instead of leaving them blank. |
| `default_inputs` | Disabled | Enables creating, using, and managing default time entry templates for faster data entry. |
| `hour_types` | Disabled | Enables tracking different types of hours (work, annual, sick, training, etc.) with configurable income contribution and visualization. |
| `expected_monthly_hours` | Disabled | Shows a calendar badge that projects contract hours for the active month and highlights whether you are ahead or behind the target. |
| `xero_payroll_helper` | Disabled | Adds a modal that slices the active month into Xero's fixed weekly ranges with cumulative hour totals. |
| `myob_payroll_helper` | Disabled | Adds a modal that groups the active month into weekly MYOB-ready totals with a monthly cross-check. |
| `enable_company_tracking_features` | Disabled | Unlocks company-focused fields, including company deduction categories. |
| `enable_company_quarterly_bas` | Disabled | Switches BAS reporting to quarterly totals (only available when company tracking is enabled). |
| `enable_public_holidays` | Disabled | Displays Australian public holidays in the calendar view with automatic API sync. |

## Usage Guidelines
- Update this file whenever a new feature flag is introduced or an existing one is retired.
- Keep the sheet schema (`sheetSchemas.md`) and this document in sync so backend and frontend expectations remain aligned.
- Prefer snake_case identifiers for flags; provide a clear human-readable name via the sheet to surface in the UI.
