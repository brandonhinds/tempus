# Annual Views

Comprehensive financial breakdown across the year with income, hours, and tax insights. This screen can be configured to display either financial year (July 1 - June 30) or calendar year (January 1 - December 31) data.

## Purpose
Provides a complete overview of your financial performance across a 12-month period, including income distribution, tax analysis, hours worked, and expense categorisation. Useful for tax preparation, financial planning, and performance analysis.

## Accessing the Page
- Navigate to the Annual Views section from the main navigation menu.
- The page loads showing the most recent financial year by default.

## Page Controls

### Year Type Toggle
- Located in the toolbar at the top right.
- Toggle between **Financial Year** (July 1 - June 30) and **Calendar Year** (January 1 - December 31).
- Label updates to show the current mode.
- All data recalculates when switching year types.

### Year Selection Dropdown
- Select which year to view from the dropdown menu.
- For Financial Years, displays as "FY 2024/2025" format.
- For Calendar Years, displays as "2024" format.
- Only shows years where you have time entries.
- **All time** appears at the bottom of the list and aggregates every month between your first and last non-public-holiday entries.
- Months that only contain public holiday entries are excluded from the all-time view, while empty months between the first and last entry remain in the timeline.
- When All time is selected, the Financial/Calendar toggle is hidden and the average monthly income uses the full month span shown in the charts.

### Contract Filter (appears when multiple contracts exist)
- Filter icon button appears when you have more than one contract active in the selected year.
- Click the filter button to expand a panel showing all relevant contracts.
- Click individual contracts to include/exclude them from calculations.
- Click "Select All" to quickly include all contracts.
- Filters affect all sections of the page including charts and totals.

## Summary Statistics

Eight key metrics displayed in a grid at the top of the page:

- **Gross Income**: Total income earned before any deductions or tax.
- **Total Superannuation**: Combined superannuation guarantee (employer contribution) and any extra super contributions.
- **Total Tax**: Sum of all tax withheld throughout the year.
- **Net Income**: Your take-home income after super, deductions, and tax.
- **Total Billable Hours**: All hours that contribute to income calculations (excludes non-billable hour types).
- **Avg Monthly Income**: Gross income divided by 12, representing your average monthly earnings.
- **Effective Tax Rate**: Percentage of gross income paid as tax.
- **Effective Hourly Rate**: Gross income divided by billable hours worked.

## Income Breakdown Table

Shows the waterfall of income distribution with visual percentage bars:

- **Gross Income**: Starting point (always 100%).
- **Superannuation (Guarantee + Extra)**: Employer super guarantee plus any additional super contributions.
- **Superannuation Lost (Deductions)**: Only appears when you have deductions that reduce super (shown in grey). This represents the super you didn't receive due to pre-tax deductions.
- **Deductions**: All other work-related deductions (excluding super).
- **Tax**: Total tax withheld.
- **Net Income**: Final take-home amount (bold row with border).

## Monthly Income Breakdown Chart

Stacked bar chart showing monthly income composition:

- X-axis: Months of the selected year.
- Y-axis: Income in dollars.
- Each bar is segmented by:
  - Gross income
  - Superannuation
  - Deductions
  - Tax
- Months with actual income data are highlighted with a border (when actual income tracking is enabled).
- Hover over bars to see exact values for each component.

## Expense Categories

Only visible when the *Enable deduction categories* feature flag is enabled under the *Deductions* section.

### Category Filters
- Chip-style filters with coloured dots matching each category.
- Click categories to show/hide them from the table.
- "Select all" and "Clear" buttons for bulk operations.
- Categories are sorted alphabetically with "Uncategorised" appearing last.

### Category Breakdown Table

Monthly expense breakdown by category:

- **Column Headers**: Click category name to expand/collapse details (arrow indicator shows state).
- **Collapsed View**: Shows category total for each month.
- **Expanded View**: Shows category total plus individual deduction line items that contributed to that total.
- **Monthly Rows**: One row per month showing expenses in each category.
- **Empty cells**: Shown as "—" when no expenses in that category for the month.

**Note**: All company expenses are shown excluding GST. The GST component is separated for accurate expense tracking.

## Charts

### Income Distribution
Circular chart showing the proportion of:
- Gross income
- Superannuation
- Tax
- Net income
- Deductions

Provides a quick visual understanding of where your income goes.

### Income by Contract
Only appears when you have multiple contracts in the selected year.

Shows the percentage of total income earned from each contract, useful for:
- Understanding client/contract diversification
- Identifying primary income sources
- Planning contract renewals

### Hours by Contract
Shows the distribution of billable hours across contracts:
- Highlights which contracts consume the most time
- Helps balance workload across clients
- Each contract uses its configured colour in the legend (when available)

### Hours by Type
Breaks down total hours by hour type category:
- Shows proportion of billable vs non-billable work
- Only includes hour types tracked during the year
- Each hour type uses its configured colour

## Tax Analysis

Financial year-specific tax insights:

- **Estimated Tax Paid**: Total tax withheld from paychecks throughout the year.
- **Expected Tax**: Calculated tax liability based on Australian tax brackets (FY 2025/2026) and Medicare levy.
- **Difference**: Gap between tax paid and expected tax.
  - Positive = you've overpaid (likely refund)
  - Negative = you've underpaid (may owe tax)

**Important Caveat**: This analysis is most accurate toward the end of the financial year. The tax withheld each pay period assumes that amount is your average for the entire year, while the expected tax assumes your taxable income is complete. Early in the year, these assumptions create large discrepancies.

**Note**: Tax estimates do not account for tax offsets (low income, seniors, etc.) or other adjustments. Actual tax liability may vary. Always consult the ATO or a tax professional for final calculations.

**All time**: Tax analysis is hidden when viewing All time because the calculation is only meaningful for a single financial year.

## Workflow
1. Navigate to Annual Views from the menu.
2. Select your preferred year type (Financial or Calendar).
3. Choose the year you want to analyze.
4. (Optional) Apply contract filters if working with multiple contracts.
5. Review summary statistics for high-level insights.
6. Examine the income breakdown table to understand the composition.
7. Analyze monthly trends using the bar chart.
8. (Optional) Filter and review expense categories if enabled.
9. Check the various pie/donut charts for distribution insights.
10. Review tax analysis if using financial year view.

## Company-Specific Details

### Australian Tax System
- Tax calculations use Australian tax brackets including the Medicare levy (2%).
- Superannuation guarantee rate is historically accurate based on the date (e.g., 11.5% for FY 2024/2025).
- Financial year runs July 1 - June 30 to align with Australian financial year.

### GST Treatment
- Company expenses automatically exclude GST from displayed totals.
- GST component is tracked separately for accurate expense reporting.
- Relevant for GST-registered businesses tracking deductible expenses.

### Superannuation Lost
- Unique Australian concept: pre-tax salary sacrifices reduce your gross income, which reduces the super guarantee calculated on that income.
- Displayed separately to show the "hidden cost" of pre-tax deductions.
- Only appears when you have deductions that create super loss.

## Tips
- Switch between Financial Year and Calendar Year views to align with your tax planning or personal preferences.
- Use contract filtering when working with multiple clients to analyze individual contract performance.
- Enable actual income tracking (separate feature flag) to see variance between estimated and actual earnings on the monthly chart.
- Expense category breakdown is most useful after consistently categorising deductions throughout the year.
- Tax analysis becomes reliable in Q3-Q4 of the financial year; ignore large discrepancies early in the year.
- Use the effective hourly rate metric to identify if you're meeting your target billable rate across all contracts.
- Compare year-over-year data by switching between different years to track income growth and expense trends.
