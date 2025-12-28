# Payroll Helpers

Generate payroll-ready hour summaries formatted to match Xero or MYOB timesheet forms.

## Purpose
Payroll helpers convert your monthly time entries into weekly summaries formatted to match the timesheet forms used by Xero and MYOB payroll systems. Each helper is designed to closely replicate the layout and structure of its respective payroll application, making it easy to transfer hours from Tempus into your payroll software without manual reformatting.

**Important:** You only need to enable **one** payroll helper feature flag at a time - the one matching your payroll system. There's no benefit to enabling both.

## Available Helpers

### Xero Payroll Helper
**Requires:** *Enable Xero payroll helper* feature flag

Generates weekly hour breakdowns aligned to Xero's fixed weekly pay periods.

**Output format:**
- Divides the month into Xero-aligned weekly ranges (Monday-Sunday)
- Each week shows a grid with daily hours for all 7 days
- Includes cumulative totals for each week
- Displays month total at the bottom
- Layout mirrors Xero's timesheet entry form

**When to use:** If you use Xero Payroll for processing pay runs and need to enter weekly hours into Xero's timesheet interface.

### MYOB Payroll Helper
**Requires:** *Enable MYOB payroll helper* feature flag

Generates weekly hour totals with monthly cross-check formatted for MYOB.

**Output format:**
- Groups the month into weekly totals (Monday-Sunday)
- Each week shows daily breakdown
- Includes weekly total for each period
- Displays month total with cross-check
- Layout mirrors MYOB's timesheet entry form

**When to use:** If you use MYOB for payroll processing and need to enter weekly summaries into MYOB's timesheet interface.

## Enabling a Payroll Helper

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Time Entries** group.
4. Enable **either**:
   - *Enable Xero payroll helper* (if you use Xero)
   - *Enable MYOB payroll helper* (if you use MYOB)
5. The corresponding button appears on the Time Entry page.

**Remember:** Only enable the helper for your payroll system. Enabling both adds unnecessary buttons and doesn't provide additional functionality.

## Accessing Payroll Helpers

1. Navigate to the **Time Entry** page (or **Dashboard & Calendar**).
2. Select the month you want to process using the calendar navigation.
3. Scroll to the action buttons below the calendar.
4. Click **Xero Payroll Helper** or **MYOB Payroll Helper** (depending on which flag you enabled).
5. The payroll helper modal opens showing the formatted report.

## Using the Payroll Helpers

### Workflow

1. **Complete your time entries** for the month before opening the helper. Ensure all hours are logged and rounded as desired.
2. **Open the helper** by clicking the button on the Time Entry page.
3. **Review the weekly breakdown**:
   - Check that all days are accounted for
   - Verify weekly totals match your expectations
   - Confirm the month total is correct
4. **Transfer to payroll**:
   - Open your payroll system (Xero or MYOB)
   - Navigate to the timesheet entry screen
   - Manually enter the weekly hours from the helper into your payroll system
   - The layout matches, making transfer straightforward
5. **Close the modal** when finished.

### What Gets Included

Both helpers include only **income-contributing hours** from your time entries:
- Hours from hour types marked as "Contributes to income" (when hour types are enabled)
- All hours from entries (when hour types are disabled)
- Excludes non-billable hour types (leave, training, etc., when configured as non-income)

**Tip:** If hour types are enabled, review your hour type configuration to ensure only billable hours contribute to income. This keeps your payroll summaries accurate.

## Xero Payroll Helper Details

### Week Alignment
Xero uses fixed weekly pay periods (Monday-Sunday). The helper automatically:
- Divides the month into Xero-aligned weeks
- Shows days outside the current month (in muted styling) when weeks span multiple months
- Ensures weeks always run Monday to Sunday regardless of month boundaries

### Weekly Breakdown
Each week displays:
- **Week header**: Date range (e.g., "Mon 1 Jan – Sun 7 Jan")
- **Daily grid**: Shows hours for each day of the week
  - Days in the current month: Normal styling
  - Days outside the month: Muted/italic (for context)
- **Week total column**: Sum of hours for that week
- **Cumulative total column**: Running total from week 1 to current week

### Month Total
At the bottom of the report:
- **Total hours for the month**: Sum of all weeks
- Matches the total shown on the calendar

### Example Output
```
Week 1: Thu 1 Feb – Wed 7 Feb
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬──────┬────────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │ Week │ Cumul. │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼──────┼────────┤
│  -  │  -  │  -  │ 7.5 │ 7.5 │  -  │  -  │ 15.0 │  15.0  │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴──────┴────────┘

Week 2: Thu 8 Feb – Wed 14 Feb
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬──────┬────────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │ Week │ Cumul. │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼──────┼────────┤
│ 7.5 │ 7.5 │ 7.5 │ 7.5 │ 7.5 │  -  │  -  │ 37.5 │  52.5  │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴──────┴────────┘

[Additional weeks...]

Total: 150.0 hours
```

## MYOB Payroll Helper Details

### Week Grouping
MYOB groups hours into weekly periods (Monday-Sunday). The helper:
- Divides the month into weekly ranges
- Shows complete weeks (Monday-Sunday)
- Includes partial weeks at month boundaries
- Displays days outside the month in muted styling

### Weekly Breakdown
Each week displays:
- **Week header**: Date range (e.g., "Mon 1 Jan – Sun 7 Jan")
- **Daily breakdown table**: Hours for each day
  - Days in the current month: Normal styling
  - Days outside the month: Muted/italic
- **Week total**: Sum of the 7 days

### Month Total with Cross-Check
At the bottom:
- **Total hours for the month**: Sum of all weekly totals
- **Cross-check**: Confirms the total matches the calendar view

### Example Output
```
Week 1: Mon 5 Feb – Sun 11 Feb
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬──────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │ Week │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼──────┤
│ 7.5 │ 7.5 │ 7.5 │ 7.5 │ 7.5 │  -  │  -  │ 37.5 │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴──────┘

Week 2: Mon 12 Feb – Sun 18 Feb
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬──────┐
│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │ Week │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼──────┤
│ 7.5 │ 7.5 │ 7.5 │ 7.5 │ 7.5 │  -  │  -  │ 37.5 │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴──────┘

[Additional weeks...]

Total: 150.0 hours (cross-check: ✓)
```

## Key Differences Between Helpers

### Xero vs MYOB

| Feature | Xero Helper | MYOB Helper |
|---------|-------------|-------------|
| **Week alignment** | Fixed Monday-Sunday | Fixed Monday-Sunday |
| **Daily grid** | 7 columns (one per day) | Table rows (one per day) |
| **Cumulative totals** | Yes (running total column) | No |
| **Cross-check** | No | Yes (month total verification) |
| **Layout** | Grid-based (matches Xero form) | Table-based (matches MYOB form) |

Both helpers produce the same weekly totals - they just format them differently to match each payroll system's interface.

## Tips for Using Payroll Helpers

- **Complete entries first**: Finish logging all hours for the month before generating the helper. Changes to entries won't update the helper modal automatically - you'll need to close and reopen it.
- **Check hour types**: If using hour types, ensure only income-contributing types are included. Non-billable hours (leave, training) won't appear in the helper.
- **Review before transferring**: Always verify the weekly totals match your expectations before entering them into your payroll system.
- **Month boundaries**: Weeks that span multiple months will show days from adjacent months in muted styling. Focus on the days within the current month.
- **Weekend work**: If you work weekends, those hours will appear in the Saturday and Sunday columns. The helpers don't filter out weekends.
- **Only one helper needed**: Don't enable both Xero and MYOB helpers unless you use both payroll systems (rare). Choose the one that matches your situation.
- **Manual transfer**: The helpers generate read-only reports. You'll need to manually type or copy the hours into your payroll system - there's no automated export.
- **Monthly workflow**: Generate the helper at month-end when finalising payroll. Regenerate if you make changes to time entries.
- **Reopen if needed**: The modal doesn't update dynamically. If you modify time entries, close the helper and reopen it to see updated totals.

## Summary

Payroll helpers bridge the gap between Tempus time tracking and external payroll systems. By formatting your monthly hours into weekly summaries that match Xero or MYOB's timesheet forms, they eliminate the need to manually calculate weekly totals or reformat data. Enable the helper for your payroll system, generate the report at month-end, and transfer the weekly totals into your payroll software with confidence.

For the full Tempus time tracking experience, see [Dashboard & Calendar documentation](docs/dashboard-calendar.md).
