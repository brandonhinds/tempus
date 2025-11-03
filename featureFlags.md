# Feature Flags

This document lists the feature flags supported by the Tempus app. Each flag is persisted in the `feature_flags` sheet (storing only the identifier and enabled state), but this file provides an at-a-glance reference for repository contributors.

| Flag | Default | Description |
| --- | --- | --- |
| `remember_last_page` | Disabled | When enabled, the app reopens on the last viewed page after refresh. |
| `show_clear_cache` | Disabled | Shows a "Clear Local Cache" button on the Settings page. |
| `show_zero_hours` | Disabled | Displays `0` for days without logged time in the calendar instead of leaving them blank. |
| `default_inputs` | Disabled | Enables creating, using, and managing default time entry templates for faster data entry. |
| `hour_types` | Disabled | Enables tracking different types of hours (work, annual, sick, training, etc.) with configurable income contribution and visualization. |
| `expected_monthly_hours` | Disabled | Shows a calendar badge that projects contract hours for the active month and highlights whether you are ahead or behind the target. |
| `contract_rate_preview` | Disabled | Enables the dedicated rate preview page for modeling hourly rate changes against historical contract hours. |
| `enable_invoices` | Disabled | Enables invoice management, default line items, and document generation from a Google Docs template. |
| `xero_payroll_helper` | Disabled | Adds a modal that slices the active month into Xero's fixed weekly ranges with cumulative hour totals. |
| `myob_payroll_helper` | Disabled | Adds a modal that groups the active month into weekly MYOB-ready totals with a monthly cross-check. |
| `enable_monthly_print_view` | Disabled | Adds a printable calendar showing hour breakdowns by type that fits on one A4 page for timesheets or records. |
| `enable_company_tracking_features` | Disabled | Unlocks company-focused fields, including company deduction categories. |
| `enable_deduction_categories` | Disabled | Adds category management for deductions with colour-coded grouping and annual category breakdowns. |
| `enable_company_quarterly_bas` | Disabled | Switches BAS reporting to quarterly totals (only available when company tracking is enabled). |
| `is_sole_trader` | Disabled | Indicates the business is a sole trader rather than a company. Affects PAYG income calculations in BAS reporting (only available when company tracking is enabled). |
| `enable_public_holidays` | Disabled | Displays Australian public holidays in the calendar view with automatic API sync. |
| `enable_colorblind_themes` | Disabled | Adds colorblind-friendly theme options to the settings dropdown and warns about problematic hour type colors. |
| `custom_theme` | Disabled | Enables a custom theme with an eight-color palette (background, surface, text, muted, primary, success, warning, danger). The theme dropdown locks to "Custom", a configure button opens a live preview, and Tempus checks contrast before allowing saves while generating complementary shades across the interface. |
| `suggest_end_time` | Disabled | Shows a helpful suggestion for when to clock out to achieve nicely rounded daily hours. Uses the minimum_end_time setting to suggest a punch-out time that results in a total matching the rounding increment. |
| `enable_actual_income` | Disabled | Enables tracking of actual income received, allowing comparison between estimated and actual earnings. Adds a button to input gross income, superannuation, tax, and net income for each month. The income badge displays both estimated and actual values with a variance indicator. |
| `no_lost_super_to_deductions` | Disabled | Recovers the superannuation guarantee amount that would normally be lost when pre-tax salary sacrifice deductions reduce the super base. Configure the recovery method in Settings (either as extra super contribution or added back to the super base, which increases super, taxable income, tax, and net income). |

## Usage Guidelines
- Update this file whenever a new feature flag is introduced or an existing one is retired.
- Keep the sheet schema (`sheetSchemas.md`) and this document in sync so backend and frontend expectations remain aligned.
- Prefer snake_case identifiers for flags; human-readable names and descriptions live in `DEFAULT_FEATURE_FLAGS` inside `views/partials/scripts.html`, so keep that map updated when adding or editing flags.
