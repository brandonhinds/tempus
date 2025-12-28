# BAS Reporting

Available when the *Enable company tracking features* feature flag is enabled. Uses a wide container layout to accommodate all financial columns.

## Purpose
Provides a comprehensive view of business activity statement (BAS) data across a financial year, consolidating invoice income, business expenses, and employee payroll figures. Designed for Australian businesses preparing quarterly or monthly BAS submissions to the ATO.

## Accessing the Page
- Enable the *Enable company tracking features* feature flag in Settings.
- Navigate to BAS Reporting from the main navigation menu.
- Select the desired financial year from the dropdown.

## Page Controls

### Financial Year Selector
- Dropdown showing all financial years where you have data.
- Displays in "FY 2024/2025" format.
- Defaults to the most recent financial year.
- All data recalculates when switching years.

### Monthly vs Quarterly View
Controlled by the *Enable company quarterly BAS* feature flag:

- **Monthly View (default)**: Shows 12 rows, one for each month from July through June.
- **Quarterly View (flag enabled)**: Shows 4 rows representing Q1–Q4 (Q1 = Jul–Sep, Q2 = Oct–Dec, Q3 = Jan–Mar, Q4 = Apr–Jun).

A note appears above the table when quarterly view is active.

## BAS Summary Table

The main table contains the following columns:

### Period
The month (e.g., "July 2024") or quarter (e.g., "Q1 (Jul–Sep)") label.

### Submitted
- Shows a green checkmark (✓) when the BAS for this period has been marked as submitted.
- Click the row to open the BAS detail modal where you can toggle submission status.
- Only clickable for rows with activity.

### Invoice total
Total value of all invoices issued during the period, including GST. This is the gross revenue from client billing.

### Invoice GST
The GST component extracted from invoice totals. Calculated as the difference between invoice total and company income.

### Company income
Company revenue excluding GST. This is the subtotal amount before GST is added to invoices.

### Business expenses
Total deductions marked as company expenses during the period, excluding GST. Represents tax-deductible business costs.

### Business GST
GST component of business expenses. Tracks GST paid on company purchases and services, which can be claimed back.

### Employee gross income
Total gross income earned by the employee (you) before any deductions or tax.

### Employee super
Combined superannuation guarantee and extra super contributions for the period.

### Employee deductions
All employee deductions (excluding super) that reduce taxable income.

### Employee tax
Total tax withheld from employee income during the period.

### Employee net income
Employee take-home pay after super, deductions, and tax.

## BAS Detail Modal

Click any row with activity to open a detailed modal showing:

- Period summary with all financial figures.
- Toggle to mark the period as submitted to the ATO.
- Breakdown of how values were calculated.
- List of entries and deductions contributing to the totals.

The submission status persists and is indicated by the checkmark in the main table.

## Financial Year Invoices Table

Only visible when the *Enable invoices* feature flag is enabled.

Appears below the main BAS table, showing all invoices issued during the selected financial year:

- **Invoice**: Invoice number or identifier.
- **Date**: Issue date of the invoice.
- **Status**: Current status (Draft, Sent, Paid, etc.).
- **Lines**: Number of line items on the invoice.
- **Hours**: Total billable hours included across all line items.
- **Subtotal**: Invoice amount excluding GST.
- **GST**: GST amount charged.
- **Total**: Final invoice value including GST.

This table helps reconcile invoice activity against the BAS summary totals.

## Workflow

1. Enable company tracking and optionally quarterly BAS in Settings.
2. Navigate to BAS Reporting.
3. Select the financial year you want to review.
4. Review the summary table to see period-by-period breakdown.
5. (Optional) Click a period row to view details and mark as submitted.
6. (Optional) Review the invoices table to verify all client billing is accounted for.
7. Use the data to complete your BAS lodgement with the ATO.

## Company-Specific Details

### Australian BAS System
- Financial year runs July 1 - June 30, aligning with Australian tax year.
- Quarterly periods follow ATO standard definitions (Q1 = Jul–Sep, Q2 = Oct–Dec, Q3 = Jan–Mar, Q4 = Apr–Jun).
- GST calculations assume the standard 10% GST rate.
- Employee payroll figures support PAYG withholding reporting.

### Sole Trader vs Company\

*TODO - Need to update when the sole trader mode is properly fleshed out.*

The *Is sole trader* feature flag affects how income is treated:

- **Company mode**: Separates company income from employee income, reflecting salary/wage arrangements. This is the default setting.
- **Sole trader mode**: Income is personal, affecting PAYG calculations and BAS treatment.

### GST Treatment
- Invoice GST is calculated automatically based on company income.
- Business expenses show GST separately so you can claim input tax credits.
- All expense amounts displayed are GST-exclusive for accurate deduction tracking.

## Tips
- Keep invoices up to date throughout the quarter to ensure accurate BAS data.
- Use the submission checkbox to track which periods you've already lodged with the ATO.
- Enable quarterly view if your business is registered for quarterly BAS reporting.
- Cross-reference the invoices table totals against the main table to catch any discrepancies.
- Review business expenses regularly to ensure all deductions are categorised correctly.
- If using sole trader mode, ensure the flag is set before preparing your BAS to get correct PAYG treatment.
- The wide container layout works best on desktop; scroll horizontally on smaller screens to see all columns.

## Summary

BAS Reporting consolidates your GST, PAYG, and company income figures for Australian Business Activity Statement preparation. Track quarterly or monthly periods, review invoice summaries, and mark submissions to streamline your ATO lodgements.
