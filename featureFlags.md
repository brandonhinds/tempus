# Feature Flags

This document lists the feature flags supported by the Timesheet app. Each flag is also persisted in the `feature_flags` sheet, but this file provides an at-a-glance reference for repository contributors.

| Flag | Default | Description |
| --- | --- | --- |
| `remember_last_page` | Enabled (`FALSE` until toggled) | When enabled, the app reopens on the last viewed page after refresh. |
| `show_clear_cache` | Disabled | Shows a "Clear Local Cache" button on the Settings page. |
| `show_zero_hours` | Disabled | Displays `0` for days without logged time in the calendar instead of leaving them blank. |

## Usage Guidelines
- Update this file whenever a new feature flag is introduced or an existing one is retired.
- Keep the sheet schema (`sheetSchemas.md`) and this document in sync so backend and frontend expectations remain aligned.
- Prefer snake_case identifiers for flags; provide a clear human-readable name via the sheet to surface in the UI.
