# BAS Reporting

Available when company tracking is enabled (`enable_company_tracking_features`). Quarterly view requires `enable_company_quarterly_bas`. Invoice reconciliation appears when `enable_invoices` is on.

## Purpose
- Summarize business income/expenses and payroll figures for BAS periods.

## Views
- Monthly (default): rows for each month in the financial year (Jul–Jun).
- Quarterly (flagged): switches to quarterly totals.

## Columns
- Invoice totals (with GST), company income, business expenses, gross income, super, deductions, tax, net income.
- When invoices are enabled, a companion table lists invoices for the selected financial year (lines, hours, GST totals).

## Layout
- Uses wide container to fit all columns comfortably on desktop.

## Tips
- Ensure invoices are up to date before reconciliation.
- Toggle sole trader/company flags to reflect correct PAYG handling (`is_sole_trader` when company tracking is on).

