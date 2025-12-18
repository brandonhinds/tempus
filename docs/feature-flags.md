# Feature Flags Reference

Each flag stores an enabled state in the `feature_flags` sheet and drives UI sections/settings. Defaults and descriptions also live in `DEFAULT_FEATURE_FLAGS` inside `views/partials/scripts.html`.

| Flag | Default | What It Enables |
| --- | --- | --- |
| remember_last_page | Disabled | Reopen the last viewed page on refresh. |
| show_clear_cache | Disabled | Show “Clear Local Cache” button in Settings. |
| show_zero_hours | Disabled | Display `0` for days without logged time in the calendar. |
| default_inputs | Disabled | Create/apply/manage basic/advanced entry defaults and calendar context menu. |
| hour_types | Disabled | Hour type selection on entries; settings for hour types; contract requirement per type. |
| recurring_time_entries | Disabled | Recurring entries modal to schedule weekly/monthly basic entries. |
| bulk_time_entries | Disabled | Bulk entries modal to apply hours across date ranges. |
| expected_monthly_hours | Disabled | Calendar badge showing projected hours and per-contract breakdown. |
| contract_rate_preview | Disabled | Rate Preview page for modeling contract rate changes. |
| enable_invoices | Disabled | Invoices page, defaults drawer, invoice settings, and generation workflow. |
| enable_contract_line_item_templates | Disabled | Contract-level line item templates (only visible when invoices are enabled). |
| xero_payroll_helper | Disabled | Xero payroll helper modal with fixed weekly ranges. |
| myob_payroll_helper | Disabled | MYOB payroll helper modal with weekly totals and cross-check. |
| enable_monthly_print_view | Disabled | Printable monthly calendar view. |
| enable_timesheet1_importer | Disabled | Timesheet 1.0 importer modal. |
| enable_company_tracking_features | Disabled | Company-specific fields (deductions, BAS), company income calculations. |
| enable_deduction_categories | Disabled | Deduction categories and category breakdowns (requires company tracking for company fields). |
| enable_company_quarterly_bas | Disabled | Quarterly BAS view (requires company tracking). |
| is_sole_trader | Disabled | Sole trader tax handling within company tracking context. |
| enable_public_holidays | Disabled | Show Australian public holidays on the calendar with API sync. |
| enable_colorblind_themes | Disabled | Colorblind-friendly theme options and warnings for poor hour type contrast. |
| custom_theme | Disabled | Custom theme palette editor with contrast checks. |
| suggest_end_time | Disabled | End-time suggestion in punch entry for rounded totals. |
| enable_actual_income | Disabled | Actual income modal and variance display on badges. |
| no_lost_super_to_deductions | Disabled | Restore super lost to salary sacrifice deductions (configurable method). |

## Notes
- When adding a new flag: document here, add to `DEFAULT_FEATURE_FLAGS`, and ensure backend schema supports it.
- Settings sections for non-core features must use the flag id as their `section` so they appear only when enabled.
