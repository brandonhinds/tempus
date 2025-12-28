# Contracts Management

How to create, manage, and track contracts representing your client engagements or employment agreements.

## Purpose
Contracts define the engagements you can log time against. Each contract specifies a date range, hourly rate, and optional hour cap. Tempus validates that time entries reference valid contracts and provides burndown tracking to monitor progress against capped contracts.

## Accessing the Page
Navigate to Contracts from the main navigation menu. The page displays all your contracts with a selector to view details for each one.

## Contract List and Selector

The **View contract** dropdown shows all contracts sorted by most recent first. Select a contract to view:

- Contract details (name, dates, rate, hours)
- Burndown chart (for capped contracts)
- Hours breakdown by type
- Edit and Delete buttons

When no contract is selected, you'll see a prompt to select one or add your first contract.

## Adding a New Contract

### Workflow

1. Click the **Add Contract** button in the toolbar.
2. The form appears with empty fields.
3. Fill in the required information (see fields below).
4. Click **Save** to create the contract.
5. The new contract appears in the dropdown and can be selected for time entries.

### Required Fields

- **Contract Name**: Descriptive name for the engagement (e.g., "Acme Corp Consulting", "Full-time Employment").
- **Start Date**: When the contract begins. Entries before this date cannot reference this contract.
- **Hourly Rate**: Total package rate in dollars per hour (not just base salary - include super, benefits, etc.).

### Optional Fields

- **End Date**: When the contract ends. Leave blank for ongoing contracts. Entries after this date cannot reference this contract.
- **Total Hours**: Maximum billable hours for this contract. Leave blank or set to 0 for unlimited contracts.
- **Standard Hours Per Day**: Used to calculate fractional business days for projections (default: 7.5 hours). For example, if you log 3.75 hours on a day, that counts as 0.5 business days.

### Weekend Counting Toggle

Only appears when a contract has a **Total Hours** cap.

- **Enabled**: Weekends count as business days when calculating expected daily burn rate.
- **Disabled (default)**: Only Monday-Friday count as business days for projections.

**Important**: Weekend entries always count toward total hours logged, regardless of this setting. This toggle only affects the expected average calculations for burndown projections.

## Contract Details View

When a contract is selected, the details panel shows:

- **Contract name**: The descriptive name you assigned.
- **Date range**: Start date → End date (or "Present" for ongoing contracts).
- **Hourly rate**: Displayed as "$XX.XX / hr".
- **Total hours**: Shows the cap or "Unlimited".
- **Weekends counted**: "Yes (all days)" or "No (Mon-Fri)" based on toggle setting.
- **Income hours logged**: Total billable hours logged so far that contribute to income.

### Edit and Delete Buttons

- **Edit**: Opens the contract form pre-filled with current values. Make changes and click Save.
- **Delete**: Removes the contract. **Important**: Contracts with existing time entries cannot be deleted (referential integrity protection).

## Burndown Chart

For contracts with a **Total Hours** cap, a burndown chart visualises progress:

### Chart Elements

- **Expected burndown (grey line)**: Linear projection assuming even distribution across contract months.
- **Actual burndown (blue line)**: Your actual hours consumed month-by-month.
- **Projection (dashed blue line)**: Forecasted completion based on your current burn rate.

### Burndown Table

Below the chart, a table shows monthly breakdown:

- **Month**: Each month in the contract period.
- **Hours Logged**: Billable hours you logged that month.
- **Expected Remaining**: Hours expected to remain if burning evenly.
- **Actual Remaining**: Hours actually remaining based on consumption.

### Interpreting the Chart

- **Below expected line**: You're burning hours slower than planned (ahead of schedule).
- **Above expected line**: You're burning hours faster than planned (risk of overrun).
- **Projection crosses zero**: Estimated completion date based on current burn rate.

## Unlimited Contracts

Contracts without a **Total Hours** cap show:

- A note explaining the contract is unlimited.
- Total income hours logged so far.
- Monthly breakdown table (no burndown chart).

Unlimited contracts are useful for ongoing employment or retainer arrangements where there's no hard cap.

## Hours Breakdown by Type

When the *Enable hour types* feature flag is enabled, the contract details show a breakdown of hours logged by type:

- Lists each hour type with hours logged.
- Shows which hour types contribute to income calculations.
- Helps understand how your time is distributed across billable, non-billable, leave, etc.

## Invoice Line Item Templates

Only visible when both *Enable invoices* and *Enable contract line item templates* feature flags are enabled.

Allows you to define reusable line items for this contract:

- **Label**: Short identifier (e.g., "Standard assessment").
- **Description**: Text that appears on the invoice.
- **Amount**: Pre-set dollar amount.

When creating invoices, you can quickly insert these templates instead of typing common line items repeatedly.

## Contract Validation Rules

### Date Range Validation
- End date must be after start date (if provided).
- Time entries must fall within the contract's date range.
- Contracts ending before today are considered "retired" but remain in the system.

### Contract Selection in Time Entry
- Only contracts valid on the selected date appear in dropdowns.
- If exactly one valid contract exists for a date, it auto-selects.
- Changing contracts reloads the entry for that date (if one exists).

### Deletion Protection
- Contracts with existing time entries cannot be deleted.
- Delete all associated entries first, or edit the contract instead.

## Workflow

1. Navigate to the Contracts page.
2. Click **Add Contract** to create a new engagement.
3. Fill in required fields (name, start date, hourly rate).
4. Optionally set an end date and/or total hours cap.
5. Adjust standard hours per day if needed (default 7.5 is suitable for most).
6. Enable weekend counting if weekends are normal working days for this contract.
7. Click **Save** to create the contract.
8. Select the contract from the dropdown to view burndown and details.
9. Use **Edit** to update rates, extend end dates, or modify caps.
10. Monitor the burndown chart regularly to track progress against capped contracts.

## Tips
- Set realistic **Total Hours** caps to enable burndown tracking and avoid overruns.
- Use the **Rate Preview** feature (when enabled) to model rate changes before updating contracts.
- For employment contracts, set the hourly rate to your total package value (gross income including super and benefits).
- For consulting work, the hourly rate should reflect your billable rate to the client.
- Weekend counting should typically be off for standard Mon-Fri work arrangements.
- Enable weekend counting for contracts where you work 7 days/week or have irregular schedules.
- Check burndown projections regularly; if you're burning too fast, you can adjust your logging or discuss contract extension.
- Keep contract names descriptive but concise (client name or engagement type works well).
- Retired contracts (past end date) remain visible in the selector but won't appear in time entry dropdowns.

## Summary

Contracts define your engagements, rates, and hour caps. Create contracts for each client or employment arrangement, track burndown against hour limits, and monitor monthly performance. Every time entry requires a valid contract.
