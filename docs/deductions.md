# Deductions

Manage personal/company deductions and extra super contributions.

## Availability
- Base deductions always available.
- Company-specific fields require `enable_company_tracking_features`.
- Categories require `enable_deduction_categories`.

## Creating/Editing
- Fields: name, amount, cadence (one-off/recurring), GST-inclusive toggle (for company expenses), notes.
- Extra super contributions treated separately but live on the same page.
- Categories (flagged): assign colour-coded categories; managed via dedicated modal.

## Effects on Income
- Salary sacrifice reduces taxable income and super base; “No lost super to deductions” flag can restore super.
- Company expenses reduce company income before gross derivation.
- Annual view shows category breakdown when categories are enabled.

## Tips
- Use notes for payroll references.
- Verify monthly income badge after deduction changes (especially with company tracking on).

