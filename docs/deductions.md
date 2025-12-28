# Deductions

Manage salary sacrifice items, company expenses, and extra superannuation contributions that affect your income calculations.

## Purpose
Deductions reduce your taxable income or company revenue, accurately reflecting your real financial position. This feature tracks both one-off and recurring deductions, allows categorisation for reporting, and provides individual occurrence adjustments when your deductions vary month-to-month. Company-specific deductions support GST tracking and business expense management.

## Accessing the Page
Navigate to Income Deductions from the main navigation menu. The page displays all active deductions grouped by category (when *Enable deduction categories* is enabled) or as a flat list.

## Deduction Types

### Standard Deductions
Personal salary sacrifice items that reduce your taxable income before tax is calculated. These deductions also reduce the superannuation base, meaning you receive less super unless you enable the "No lost super to deductions" setting.

**Common examples:**
- Novated lease payments
- Additional super contributions via salary sacrifice
- Work-related expense arrangements

### Company Expenses
Business costs that reduce company income before deriving your gross employee income. Only available when *Enable company tracking features* is enabled.

**Common examples:**
- Office supplies and equipment
- Professional services (accounting, legal)
- Software subscriptions
- Travel and accommodation

### Extra Super Contributions
Additional superannuation contributions beyond the employer guarantee. These can be flat amounts or percentage-based (calculated from gross income). Percentage-based contributions must recur monthly.

## Frequency Types

### One-Off Deductions
Single deductions that apply on a specific date. These do not recur and cannot have an end date.

**Use cases:**
- Annual professional membership renewal
- One-time equipment purchase
- Quarterly tax instalment
- Ad-hoc business expense

### Recurring Deductions
Deductions that repeat on a schedule. The system calculates future occurrences automatically and displays the next five scheduled dates for confirmation.

**Available frequencies:**
- **Weekly**: Every 7 days from start date
- **Fortnightly**: Every 14 days from start date
- **Monthly**: Same day each month
- **Quarterly**: Every 3 months
- **Yearly**: Same date each year

**Important:** Recurring deductions can have an optional end date. Leave blank for ongoing deductions.

## Creating a Deduction

### Workflow

1. Click the **Add deduction** button in the toolbar.
2. The deduction form modal appears.
3. Fill in the required fields (see below).
4. Review the occurrence preview to confirm the schedule.
5. Click **Save deduction** to create the entry.
6. The deduction appears in the list and affects income calculations immediately.

### Required Fields

- **Name**: Descriptive label for this deduction (e.g., "Novated lease", "Office supplies").
- **Type**: Choose between Standard deduction or Extra super contribution.
- **Amount**: Dollar value for the deduction. For extra super, you can choose between flat amount or percentage of gross income.
- **Frequency**: How often this deduction occurs (once, weekly, fortnightly, monthly, quarterly, yearly).
- **Start date**: When the deduction begins or occurred.

### Optional Fields

- **Category**: Organise deductions into categories (requires *Enable deduction categories* feature flag). Categories appear in BAS reporting and annual views.
- **End date**: When recurring deductions should stop. Leave blank for ongoing deductions. Not available for one-off deductions.
- **Amount includes GST**: For company expenses only. When enabled, the system separates the GST component for BAS reporting.
- **Company expense**: Marks this as a business cost (requires *Enable company tracking features*). Company expenses reduce company income before gross derivation.
- **Calculation**: For extra super only. Choose between flat amount or percentage of gross income. Percentage-based contributions must recur monthly.
- **Notes**: Optional context for this deduction (e.g., invoice numbers, payroll references, approval details).

### Occurrence Preview

As you configure the deduction, the form displays:
- For one-off: "Occurs on [date]."
- For recurring: "Next X deductions: [date list]."
- For ended schedules: "No future occurrences within the configured range."

This preview helps confirm your frequency and date range settings before saving.

## Editing Deductions

Click any deduction in the list to open the edit form. The form is pre-filled with current values.

### Editing Recurring Deductions with Past Occurrences

When you edit a recurring deduction that has already occurred in the past, the system presents two options:

#### Split into Past and Future (Recommended)
- Creates two deductions: one for historical occurrences (preserving data integrity) and one for future occurrences with your new settings.
- The original deduction's end date is set to the last past occurrence.
- A new deduction is created starting from the next future occurrence with your updated settings.
- All occurrence adjustments (exceptions) are preserved.
- **Use this when**: You're changing rates or amounts mid-contract and want to maintain accurate historical records.

#### Override All Occurrences (Advanced)
- Applies your new settings to all occurrences, including historical ones.
- Deletes all occurrence adjustments (exceptions).
- Changes past income calculations and reports.
- **Warning**: This affects historical data. Only use if you need to correct an error in the original deduction setup.

### Category-Only Changes
If you only change the category (and nothing else), the system applies the change directly without prompting for split/override decisions. Category changes don't affect income calculations.

## Deleting Deductions

Click a deduction to edit it, then use the **Delete** button within the deduction form modal. The deduction is removed immediately and income calculations are recalculated.

**Important:** When company tracking is enabled, deleting a company expense deduction will also clear the category reference from any other deductions that used it.

## Categories

Categories group related deductions for easier management and reporting. Only available when *Enable deduction categories* is enabled.

### Managing Categories

1. Click the **Manage categories** button in the toolbar.
2. The categories modal appears showing all existing categories.
3. Click **Add category** to create a new one.
4. Fill in the name and choose a colour.
5. Click **Save category** to create it.

**Colours:** Categories use the same colour palette as hour types to maintain visual consistency across the application.

### Using Categories

When creating or editing a deduction, select a category from the dropdown. Deductions without a category are marked "Uncategorised".

**Category grouping:**
- When categories are enabled, deductions are grouped by category on the main page.
- Each category can be expanded or collapsed using the expand/collapse controls in the toolbar.
- Uncategorised deductions appear in their own group at the bottom.

### Deleting Categories

1. Open the **Manage categories** modal.
2. Click the delete button next to the category you want to remove.
3. Confirm the deletion.
4. Any deductions using this category are automatically moved to "Uncategorised".

## Occurrence Adjustments (Exceptions)

Recurring deductions don't always occur at the exact scheduled amount or date. The exceptions system lets you adjust individual occurrences without changing the entire deduction schedule.

### Accessing Occurrence Adjustments

1. Navigate to the Time Entry page and select a month.
2. Expand the **Income** badge to view the income breakdown.
3. Click the **Click for details** button in the Pre-tax deductions row.
4. The Monthly Deductions modal appears showing all deductions for that month.
5. Click any deduction to expand it and view individual occurrences.
6. Click the **Adjust** button next to the occurrence you want to modify.
7. The Adjust Occurrence modal appears.

### Adjustment Types

The system supports four types of occurrence adjustments:

#### Skip This Occurrence
Check the "Skip this occurrence" box to prevent this deduction from applying on its scheduled date. Useful when:
- You didn't work a particular pay period
- A deduction was waived or cancelled for one occurrence
- A payment was delayed to a different period

#### Move to Different Date
Enter a new date to move the occurrence. The deduction still applies but on a different date. Useful when:
- Pay dates shift due to public holidays or weekends
- Invoice dates change
- Scheduled payments are rearranged

#### Adjust Amount
Enter a new amount to override the default deduction value for this occurrence only. Useful when:
- One-off rate changes or discounts
- Partial payments
- Pro-rata adjustments
- Variable expenses that differ from the standard amount

#### Move and Adjust
Combine both date and amount changes for maximum flexibility. Change both the date and the amount for a single occurrence.

### Saving and Removing Adjustments

- Click **Save Adjustment** to apply the exception. The occurrence is updated immediately in the breakdown.
- To remove an adjustment: re-open the adjustment modal for that occurrence and click **Remove Adjustment**. The occurrence reverts to its scheduled date and default amount.

### Exception Indicators

Occurrences with adjustments display:
- A **badge** showing the number of adjustments in the deduction header (e.g., "2 adjustments").
- Visual indicators next to adjusted occurrences in the expanded list.
- The original date (if moved) alongside the actual date.

## How Deductions Affect Income

### Standard Deductions (Personal)
1. Reduce taxable income before tax calculation.
2. Reduce superannuation base (unless "No lost super to deductions" is enabled).
3. The "Super lost due to deductions" row in the income breakdown shows the super reduction.
4. Do not affect gross income or company calculations.

### Company Expenses
1. Reduce company income before gross derivation.
2. GST component is separated and tracked when "Amount includes GST" is enabled.
3. Appear in the company expenses row of the income breakdown.
4. Affect BAS reporting when *Enable BAS reporting* is enabled.

### Extra Super Contributions
1. Flat amounts: Deducted from net income and added to total super.
2. Percentage-based: Calculated from gross income, deducted from net income, added to total super.
3. Appear in the "Extra super contributions" row of the income breakdown.
4. Increase total superannuation received.

## Where Deductions Appear

### Time Entry Page (Income Badge)
When you expand the Income badge on the Time Entry page, the full income waterfall displays:
- **Company expenses** (when company tracking is enabled): Total business costs for the month.
- **Pre-tax deductions**: Total salary sacrifice for the month. Click "Click for details" to see the breakdown.
- **Extra super contributions**: Additional super beyond the guarantee.
- **Super lost due to deductions**: Reduction in super caused by salary sacrifice (when applicable).

### Monthly Deductions Modal
Click "Click for details" in the Pre-tax deductions row to see:
- List of all deductions that occurred in the selected month.
- Breakdown by category (when categories are enabled).
- Individual occurrence dates and amounts.
- Exception indicators showing adjustments.
- **Adjust** buttons for creating occurrence exceptions.

### Annual Views
The [Annual Views page](docs/annual-views.md) displays:
- Expense categories breakdown (when categories are enabled).
- Total deductions across all months.
- Category-based charts and summaries.

### BAS Reporting
The [BAS Reporting page](docs/bas-reporting.md) includes:
- Company expenses with GST separated.
- Categorised breakdowns for business expenses.
- Quarterly and annual totals.

## Tips
- **Use notes for payroll references**: Add invoice numbers, approval dates, or payroll run identifiers to help reconcile deductions later.
- **Verify income badge after changes**: After adding or modifying deductions (especially with company tracking enabled), check the monthly income badge to confirm calculations are correct.
- **Create categories before deductions**: If using categories, set them up first so you can assign them as you create deductions.
- **Use occurrence adjustments for variations**: Don't edit the entire deduction schedule for one-off changes. Use the exceptions system to adjust individual occurrences.
- **Review upcoming deductions**: Recurring deductions display the next scheduled occurrence on the main page. Review this regularly to ensure schedules are correct.
- **Split when changing rates**: When your deduction amount changes mid-year, use the split option (not override) to maintain accurate historical records.
- **GST tracking**: For company expenses, enable "Amount includes GST" if the amount you enter is GST-inclusive. The system automatically calculates the GST component for BAS reporting.
- **Percentage-based super**: Only use percentage-based extra super contributions if they truly vary with your gross income. Most fixed-amount contributions should use the flat amount option.
- **Category colours**: Choose distinct colours for categories to make charts and reports easier to read at a glance.
- **End dates for temporary deductions**: Use the end date field for deductions you know will stop (e.g., 12-month novated lease term, fixed-term salary sacrifice arrangement).

## Summary

Deductions manage salary sacrifice, business expenses, and extra super contributions. Create one-off or recurring deductions, use occurrence adjustments for individual variations, and organise with categories to track pre-tax and company expenses accurately.
