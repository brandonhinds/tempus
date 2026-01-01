# Time Entry Page & Calendar

The primary interface for logging time, viewing your calendar, and managing entries. This page combines time entry forms (Basic and Advanced modes), expandable income/hours badges, a monthly calendar, and action buttons for related features.

## Purpose
Provides a central hub for all time tracking activities. Add or edit daily entries, view monthly summaries at a glance, track income breakdowns, and access advanced features like recurring entries, bulk operations, and payroll helpers.

## Accessing the Page
Navigate to Time Entry from the main navigation menu (this is typically the default landing page). The calendar displays the current month by default.

## Page Layout

The Time Entry page is organised into four main areas from top to bottom:

1. **Time Entry Forms** (Basic/Advanced tabs)
2. **Summary Badges and Breakdowns** (hours, income, expected hours)
3. **Calendar Grid** (monthly view with daily hours)
4. **Action Buttons** (payroll helpers, bulk operations, recurring entries, etc.)

---

## Time Entry Forms

Two modes for logging time, selectable via tabs at the top of the card.

### Basic Mode

Simple hour total entry for straightforward time tracking. See [Basic Time Entry documentation](time-entry-basic.md) for complete details.

**Fields:**
- **Date**: The day you're logging time for
- **Hour Type**: Category of hours (only appears when *Enable hour types* is enabled)
- **Contract**: Which engagement this time applies to
- **Total Hours**: Decimal hours worked (e.g., 7.5)

**Buttons:**
- **Add Entry** / **Save Changes**: Saves the entry
- **Delete Entry**: Removes the entry (only when editing)
- **Cancel Edit**: Discards changes and returns to add mode
- **Create Default** / **Enter Default** / **Edit Defaults**: Manage reusable entry templates (when *Enable default inputs* is enabled)

### Advanced Mode

Punch-based tracking for precise in/out times. See [Advanced Punch Entry documentation](time-entry-advanced.md) for complete details.

**Fields:**
- **Date**: The day you're tracking
- **Hour Type**: Category of hours (when enabled)
- **Contract**: Which engagement to bill

**Punch Interface:**
- Displays all punch in/out pairs for the selected date
- **Punch In** / **Punch Out**: Toggle button to record times
- Shows total duration calculated from closed punches
- Warns about open punches (missing out time)
- Suggests auto-detected punch times based on entry patterns

**Buttons:**
- **Add Entry** / **Save Changes**: Commits punches to the sheet
- **Delete Entry**: Removes all punches for this date
- **Discard Changes**: Reverts unsaved punch modifications
- **Create Default** / **Enter Default** / **Edit Defaults**: Manage punch templates

---

## Summary Badges

Located in the calendar header, these badges provide at-a-glance monthly metrics and expand to show detailed breakdowns when clicked.

### Total Hours Badge

Always visible. Displays the sum of all hours logged for the currently displayed month.

**Expanded View:**
- Breakdown by hour type (when *Enable hour types* is enabled)
- Each type shows hours logged and whether it contributes to income
- Colour-coded indicators match hour type colours

### Income Badge

Shows estimated net income for the month (or "Net income: --" if no entries exist).

**Expanded View:**
When clicked, reveals the full income breakdown with two columns:

- **Left column**: "Actual" values (when [Actual Income](actual-income.md) has been recorded for this month)
- **Right column**: "Estimated" values calculated from time entries

**Income Waterfall:**
1. **Invoice total** (company tracking): Total billed to clients including GST
2. **Company income** (company tracking): Revenue excluding GST
3. **Company expenses** (company tracking): Business costs with GST separated
4. **Gross income**: Total employee income before deductions
5. **Superannuation guarantee**: Employer contribution (calculated from gross income)
6. **Extra super contributions**: Additional super from deductions
7. **Superannuation total**: Combined super
8. **Pre-tax deductions**: Salary sacrifice and other pre-tax deductions (click "Click for details" to see itemised list)
9. **Super lost due to deductions**: Super not received because deductions reduced gross income
10. **Taxable income**: Gross income minus pre-tax deductions
11. **Tax**: Tax withheld based on taxable income
12. **Net income**: Final take-home amount (highlighted)

**Projections Section** (when *Expected monthly hours* is enabled):
- **Net income if working standard hours every day**: Theoretical maximum
- **Estimated net income (standard hours)**: Projection based on working days remaining
- **Estimated net income (projected hours)**: Forecast using your current pace

**Hourly Rates:**
- Gross income hourly rate
- Net income hourly rate

### Expected Hours Badge

Only visible when *Enable expected monthly hours* feature flag is enabled.

Displays projected variance between expected and actual hours worked, helping you track whether you're on pace to meet monthly targets.

**Expanded View:**
- Per-contract breakdown of expected vs actual hours
- Projection based on remaining working days in the month
- Accounts for weekend counting settings on each contract

---

## Calendar Grid

Monthly view with weekday headers (Mon-Sun) and day cells showing hours logged.

### Day Cells

Each day displays:
- **Day number**: The date
- **Hours total**: Sum of hours logged for that day
- **Colour coding**: Background colour indicates hour type (when enabled and filtering is active)
- **Public holidays**: Displayed when *Enable public holidays* is enabled

**Interactions:**
- **Left-click**: Selects the day and loads its entry into the form above
- **Right-click**: Opens the context menu for defaults and day-level actions (when *Enable default inputs* is enabled)

### Calendar Navigation

- **Previous Month** (◀): Navigate backwards
- **Next Month** (▶): Navigate forwards
- **Month Label**: Click to open month picker for jumping to any month/year

### Hour Type Filter

Filter button (funnel icon) appears when *Enable hour types* is enabled. Click to show/hide the filter panel.

**Filter Panel:**
- Checkboxes for each hour type
- Quick actions: "All", "None", "Income Only"
- Filtered hour types are hidden from the calendar and summary calculations

### Context Menu (Right-Click)

Right-click any day to insert a default entry quickly (requires *Enable default inputs* feature flag).

**Menu Sections:**
- **Basic defaults**: Pre-configured hour totals
- **Advanced defaults**: Pre-configured punch patterns
- **Actions**: Calendar-wide shortcuts

Select a default to instantly apply it to the selected date. If you haven't created any defaults, the menu prompts you to create one first.

**Clear day:** Choose **Clear day** to remove every entry for the selected date. Tempus shows a confirmation prompt before deleting, and the action cannot be undone.

---

## Action Buttons (Below Calendar)

A row of buttons providing access to advanced features and utilities. Buttons appear based on enabled feature flags.

### Payroll Helpers

- **Xero Payroll Helper**: Generates payroll import data for Xero (when *Enable payroll helpers* is enabled)
- **MYOB Payroll Helper**: Generates payroll import data for MYOB (when *Enable payroll helpers* is enabled)

See [Payroll Helpers documentation](payroll-helpers.md) for details.

### Actual Income

- **Add Actual Income**: Opens modal to record actual income received (when *Enable actual income tracking* is enabled)

See [Actual Income documentation](actual-income.md) for details.

### Bulk Operations

- **Reoccurring Entries**: Manage schedules that automatically generate future entries (when *Enable recurring entries* is enabled)
- **Bulk Entries**: Fill date ranges with consistent entries (when *Enable bulk entries* is enabled)

See [Recurring Time Entries](time-entry-recurring.md) and [Bulk Time Entries](time-entry-bulk.md) documentation.

### Print View

- **Print Monthly Hours**: Generate a printer-friendly summary of the month (when *Enable monthly print view* is enabled)

See [Print View documentation](print-view.md) for details.

### Import

- **Import Timesheet 1.0**: Migrate data from legacy Timesheet 1.0 spreadsheets (when *Enable Timesheet 1.0 importer* is enabled)

See [Timesheet 1.0 Importer documentation](time-entry-importer.md) for details.

---

## Workflow

### Adding a Single Entry

1. Select the date (click a day on the calendar or use the date picker).
2. Choose Basic or Advanced mode depending on your tracking preference.
3. Select a contract (must be valid for the chosen date).
4. Enter hours (Basic) or punch times (Advanced).
5. Click **Add Entry** to save.
6. The calendar updates to show the new entry.
7. Summary badges recalculate automatically.

### Editing an Existing Entry

1. Click the day on the calendar that has an entry.
2. The form loads with existing data.
3. Modify fields as needed.
4. Click **Save Changes** to update, or **Delete Entry** to remove.

### Viewing Monthly Summary

1. Click any summary badge (Total Hours, Income, or Expected Hours) to expand.
2. Review the detailed breakdown.
3. Click the badge again to collapse.
4. Use month navigation to view different months.

### Using Defaults for Quick Entry

1. Create a default entry first (click **Create Default** when viewing an entry you want to save as a template).
2. Right-click any day on the calendar.
3. Select the default from the context menu.
4. The entry is instantly applied.

---

## Tips

- **Keyboard workflow**: Use the date picker in the form to quickly navigate dates without clicking the calendar.
- **Contract warnings**: If you see a contract warning, visit the [Contracts page](contracts.md) to add or extend a valid contract.
- **Default entries**: Create defaults for your most common entry patterns (e.g., "Standard Day", "Half Day", "Split Shift") to speed up data entry.
- **Filter hour types**: When tracking multiple categories of time, filter the calendar to focus on specific hour types.
- **Income variance**: If actual vs estimated income consistently differs, check your contract rates and deduction settings.
- **Public holidays**: Enable public holiday syncing (via the *Enable public holidays* feature flag) to automatically mark non-working days on your calendar.
- **Cache usage**: The calendar caches data for fast loads; if something seems stale after a manual sheet edit, use the clear cache button in Settings.
- **Mobile view**: For quick entries on mobile, use the dedicated [Mobile Entry view](mobile-entry.md) instead of this full interface.
