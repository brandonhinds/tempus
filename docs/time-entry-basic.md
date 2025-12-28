# Basic Time Entry (Manual)

Enter time as a simple total duration without tracking specific start and stop times.

## Purpose
Basic Time Entry (also called "manual entry") lets you log time by specifying a single total duration for a day - just the hours worked, no punch-in or punch-out times required. This straightforward approach is ideal for retrospective entry (logging yesterday's or last week's hours), consistent schedules where you work the same duration daily, or situations where you only care about the total time, not the precise periods. Unlike advanced punch entry which stores multiple time ranges, manual entry records one duration value and represents it internally as a single punch from midnight to the specified duration.

**Important:** Manual entry stores duration as a single punch range from 00:00 to the calculated end time. This representation is transparent to you - you only see and work with the total hours field.

## Accessing Basic Time Entry

1. Navigate to the **Time Entry** page (or **Dashboard & Calendar**).
2. Select a date on the calendar.
3. Ensure the **Basic** tab is selected (it's the default mode).
4. The manual entry form appears on the right side of the screen.

**Note:** If you've already created an advanced (punch-based) entry for the selected date/contract/hour type combination, you cannot switch to basic mode for that entry. Delete the advanced entry first or create a new entry with a different hour type.

## Understanding Manual Entry

Manual entry simplifies time tracking to its essence: **how many hours did you work?**

**You specify:**
- Date
- Contract
- Hour type (optional)
- Total hours (e.g., 7.5)

**Tempus handles:**
- Storing the duration
- Applying rounding intervals
- Calculating income
- Updating calendar views

Behind the scenes, Tempus stores manual entries as a single punch range from 00:00 to the end time corresponding to your duration. If you enter 7.5 hours, it's stored as 00:00-07:30. This internal representation allows manual and advanced entries to coexist in the same data structure, but you never see or interact with the midnight-based punch - you only work with the total hours field.

## Entering a Manual Time Entry

### Step-by-Step Workflow

1. **Select a date** using the calendar or the date input field.
2. **Select your contract** from the dropdown (required).
   - Only contracts valid for the selected date appear in the dropdown
   - If only one valid contract exists, it's auto-selected
3. **Select your hour type** if hour types are enabled (optional unless the hour type requires a contract).
4. **Enter total hours** in the "Total hours" field (e.g., 7.5, 8, 3.25).
   - Decimal values are supported (e.g., 7.5 = 7 hours 30 minutes)
   - Must be greater than 0 and less than or equal to 24
5. Click **Add Entry** to save.

**Validation:**
- Contract is required before saving
- Total hours must be > 0 and ≤ 24
- If rounding is enabled, duration is automatically rounded on save

**Tip:** Use the Tab key to move between fields quickly. Press Enter to save when all required fields are filled.

### Using the Date Field

The date field defaults to:
- Today's date when you first open the page
- The selected calendar date if you clicked a day on the calendar

**Change the date:**
1. Click the date input field.
2. Use the browser's date picker to select a different date.
3. Or type a date in your browser's expected format (varies by locale).

**Behaviour:** Changing the date reloads the form. If an entry already exists for the new date (with the selected contract and hour type), that entry loads for editing.

### Using the Contract Selector

Select the contract this time applies to. The dropdown only shows contracts valid for the selected date based on their start and end dates.

**Auto-selection:** If only one contract is valid for the selected date, Tempus selects it automatically.

**No valid contracts:** If no contracts exist or none are valid for the date, a warning appears: "No valid contract for this date. Add one on the Contracts page before logging time."

**Required:** You must select a contract before saving. The Add Entry button is disabled until a contract is selected.

**Behaviour:** Changing the contract while editing reloads the form. If an entry already exists for the new contract on this date (with the same hour type), that entry loads for editing.

### Using the Hour Type Selector

**Requires:** *Enable multiple hour types* feature flag

Choose the hour type for this entry (e.g., Work, Leave, Training). If the hour type is flagged as "contributes to income", the contract field becomes mandatory.

**Optional:** Unless the selected hour type requires a contract, you can save without selecting an hour type. Entries without hour types use the default hour type.

**Behaviour:** Hour type selection can change which contracts appear in the contract dropdown. Some hour types might filter contracts or enforce additional validation.

**Fallback:** If no hour type is selected, Tempus uses your default hour type (configured in hour type settings).

### Entering Total Hours

The total hours field accepts decimal values representing the duration worked.

**Examples:**
- `7.5` = 7 hours 30 minutes
- `8` = 8 hours
- `3.25` = 3 hours 15 minutes
- `0.5` = 30 minutes

**Limits:**
- **Minimum:** Must be greater than 0 (you cannot save a 0-hour entry)
- **Maximum:** 24 hours (one full day)

**Decimal precision:** You can enter values to two decimal places (e.g., 7.33). Tempus stores the exact value, then applies rounding if configured.

**Rounding:** If you have a rounding interval set in Settings (e.g., 6 minutes for 0.1-hour increments), Tempus automatically rounds the entered duration on save.

**Example with rounding:**
- You enter: 7.42 hours
- Rounding interval: 6 minutes (0.1 hours)
- Saved as: 7.4 hours (rounded to nearest 0.1)

See [Settings documentation](docs/settings.md) for configuring rounding intervals.

## Editing an Existing Manual Entry

1. Navigate to the date with the entry you want to edit.
2. Select the same contract and hour type as the existing entry.
3. Tempus loads the entry automatically, populating the total hours field.
4. Modify the total hours as needed.
5. The **Add Entry** button changes to **Update Entry**.
6. Click **Update Entry** to save changes.
7. The **Delete Entry** and **Cancel Edit** buttons appear when editing.

**Important:** When you change the contract or hour type dropdown while editing, Tempus checks if an entry exists for the new combination on this date. If found, it loads that entry instead. This lets you switch between multiple entries on the same day quickly.

### Cancelling an Edit

1. While editing an entry, click **Cancel Edit**.
2. The form resets to the state before you started editing.
3. Unsaved changes are discarded.

**Use case:** You started editing an entry but changed your mind. Cancel Edit reverts to the saved state without affecting the stored entry.

## Deleting a Manual Entry

1. Load the entry by selecting its date, contract, and hour type.
2. Click **Delete Entry** (appears when editing an existing entry).
3. Confirm the deletion.
4. The entry is removed from Google Sheets.
5. The form resets to a blank state.
6. Calendar views and income summaries update to exclude the deleted entry.

**Note:** Deletion clears the entry and all associated metrics. This action cannot be undone unless you manually recreate the entry.

## Using Entry Defaults

**Requires:** *Enable default hours for time entries* feature flag

If you have a consistent schedule (e.g., always 7.5 hours, always 8 hours), create a manual entry default to prefill your total hours:

1. Enter your typical duration (e.g., 7.5) in the total hours field.
2. Click **Create Default** and name it (e.g., "Standard Day").
3. On future days, click **Enter Default** and select your saved default.
4. Tempus fills in the total hours automatically.
5. Adjust if needed, then click **Add Entry**.

**Multiple defaults:** You can create multiple defaults for different scenarios (e.g., "Full Day" = 8 hours, "Half Day" = 4 hours, "Short Day" = 6 hours).

**With hour types:** Defaults can include a pinned hour type. If set, applying the default also selects that hour type, overriding your current selection.

See [Entry Defaults documentation](docs/time-entry-defaults.md) for full details.

## Basic Entry vs Advanced Entry

| Feature | Basic Entry | Advanced Entry |
|---------|-------------|----------------|
| **Input method** | Single total duration | Multiple punch-in/punch-out times |
| **Precision** | Total hours only | Exact start/stop times for each period |
| **Data storage** | One punch from 00:00 to duration | JSON array of punch ranges |
| **Breaks tracked** | No (just total duration) | Yes (gaps between punches) |
| **Use case** | Retrospective entry, consistent schedules | Real-time tracking, precise billing |
| **Complexity** | Simple, fast | More detailed |
| **Switching modes** | Cannot switch to advanced if manual entry exists | Cannot switch to manual if advanced entry exists |

**When to use Basic:**
- You're entering hours after the fact (e.g., logging yesterday)
- You work consistent hours every day
- You only care about total duration, not exact times
- You prefer speed and simplicity

**When to use Advanced:**
- You track exact start/stop times for payroll or billing
- You take multiple breaks during the day
- You want a detailed audit trail of work periods
- You use real-time punch-in/punch-out workflow

## Manual Entry Validation Rules

Tempus validates manual entries before saving:

### Contract Requirement
- **Must have:** A valid contract selected
- **Error if:** No contract selected when saving
- **Note:** Contract must be valid for the selected date (within contract start/end date range)

### Total Hours Range
- **Must be:** Greater than 0 and less than or equal to 24
- **Error if:** Hours ≤ 0 or hours > 24
- **Accepts:** Decimal values (e.g., 7.5, 3.25, 0.5)

### No Duplicate Entries
- **Prevented:** Multiple entries for the same date/contract/hour type combination
- **Behaviour:** Selecting an existing combination loads the entry for editing rather than creating a new one

### Rounding Application
- **Applied automatically:** If rounding interval is set in Settings, duration is rounded on save
- **No validation error:** Rounding never blocks saving - it just adjusts the stored duration

## Tips for Using Basic Time Entry

- **Use for retrospective logging:** Manual entry is perfect when you're catching up on time tracking at the end of the day or week.
- **Combine with rounding:** Set a rounding interval in Settings to automatically round to payroll-friendly increments (e.g., 6 minutes = 0.1 hours).
- **Create entry defaults for common durations:** If you work 7.5 hours most days, create a default and apply it with one click instead of typing every time.
- **Use hour types to categorise:** Even with manual entry, hour types let you distinguish work, leave, training, etc., for better reporting.
- **Quick navigation with Tab/Enter:** Tab between fields, Enter to save. Keyboard shortcuts save time when logging multiple days.
- **Check the calendar after saving:** The calendar updates immediately to show the saved entry. Verify it appears on the correct date with the expected duration.
- **Edit rather than delete/recreate:** If you made a mistake, load the entry and update it rather than deleting and starting over.
- **Batch entry workflow:** Navigate through dates using the calendar, enter hours for each day, save, move to the next. Repeat until caught up.
- **Use consistent decimal formatting:** 7.5 is clearer than 7.50. Both work, but fewer digits are easier to type.
- **Review monthly totals:** After batch entry, check the monthly total on the calendar to ensure you've logged all expected days.

## Common Basic Entry Questions

### Can I enter more than 24 hours for a day?
No. Manual entry limits total hours to 24 per day. If you worked overnight across two calendar days, create separate entries for each day (e.g., 3 hours on Day 1, 5 hours on Day 2).

### Can I have multiple manual entries on the same day?
Yes, if they use different contracts or different hour types. You cannot have duplicate entries for the same date/contract/hour type combination.

### What happens if I enter 0 hours?
Tempus prevents saving entries with 0 hours. The Add Entry button remains disabled until you enter a value greater than 0.

### Can I switch a manual entry to advanced mode?
No. Once you create a manual entry, you must delete it before you can create an advanced entry for the same date/contract/hour type. This prevents accidental data loss.

### How does rounding work with manual entry?
Rounding applies to the total hours you enter. If you enter 7.42 hours and rounding is set to 6 minutes (0.1 hours), it rounds to 7.4 hours. The rounding happens when you save, so the stored duration may differ from what you typed.

**Example:** Enter 7.33 hours with 15-minute rounding → rounds to 7.25 hours (7 hours 15 minutes).

### Why doesn't my entry appear after saving?
Check that:
- You selected the correct date (manual entry saves to the date shown in the date field, not necessarily today)
- The calendar is showing the correct month
- The entry saved successfully (look for a success message in the status bar)
- The contract is valid for the selected date

### Can I use half-hour or quarter-hour increments?
Yes. Enter decimals:
- 0.25 = 15 minutes
- 0.5 = 30 minutes
- 0.75 = 45 minutes
- 1.0 = 1 hour

Or combine with whole hours: 7.5 = 7 hours 30 minutes.

### What's the difference between cancelling and deleting?
- **Cancel Edit:** Discards unsaved changes and reverts to the last saved state. The entry still exists.
- **Delete Entry:** Removes the entry entirely from Google Sheets. It's gone (unless you recreate it).

### Do manual entries sync across devices?
Yes, if you're logged into the same Google account. Manual entries are saved to Google Sheets and synchronise across all devices accessing the same Tempus deployment.

### Can I enter time for future dates?
Yes. The date field accepts any date, past or future. This is useful for planning or pre-logging expected hours.

### Why does the contract dropdown only show some contracts?
The dropdown filters contracts by date validity. Only contracts whose start/end date range includes the selected date appear. If a contract ended last month, it won't appear when entering time for today.

### Can I create entries without selecting an hour type?
No, and hour type is always required for a time entry.

## Summary

Basic Time Entry logs time as a simple total duration without tracking start/stop times. Perfect for retrospective entry or consistent schedules, it requires only a date, contract, and total hours. Rounding applies automatically, and entry defaults speed up repetitive logging.

For precise punch-based tracking with multiple time ranges, see [Advanced Punch Entry documentation](docs/time-entry-advanced.md). For saving reusable hour templates, see [Entry Defaults documentation](docs/time-entry-defaults.md).
