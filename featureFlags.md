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
| `is_sole_trader` | Disabled | Indicates the business is a sole trader rather than a company. Affects PAYG income calculations in BAS reporting (only available when company tracking is enabled). |
| `enable_public_holidays` | Disabled | Displays Australian public holidays in the calendar view with automatic API sync. |
| `enable_colorblind_themes` | Disabled | Adds colorblind-friendly theme options to the settings dropdown and warns about problematic hour type colors. |
| `custom_theme` | Disabled | Enables a custom theme where you can configure your own colors. The theme dropdown will be locked to "Custom" when enabled, and a configure button allows setting background, primary, text, and success colors. The app automatically generates complementary shades for the entire interface. |
| `suggest_end_time` | Disabled | Shows a helpful suggestion for when to clock out to achieve nicely rounded daily hours. Uses the minimum_end_time setting to suggest a punch-out time that results in a total matching the rounding increment. |

## Usage Guidelines
- Update this file whenever a new feature flag is introduced or an existing one is retired.
- Keep the sheet schema (`sheetSchemas.md`) and this document in sync so backend and frontend expectations remain aligned.
- Prefer snake_case identifiers for flags; provide a clear human-readable name via the sheet to surface in the UI.
