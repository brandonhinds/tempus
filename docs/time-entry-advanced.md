# Advanced Punch Entry

Track time with precision using multiple punch-in and punch-out ranges throughout the day.

## Purpose
Advanced Punch Entry (also called "punch-based entry") lets you record time as a series of punch ranges - clock in, clock out, clock in again, clock out again - mirroring how you actually work throughout the day. Unlike manual entry where you specify a single total duration, punch entry stores each discrete work period, automatically calculating the total duration from your closed punch ranges. This mode is ideal for jobs where you track exact start and stop times, take multiple breaks, or need precise time records for payroll or billing.

**Important:** Punch entry stores an ordered list of punch ranges. Only closed punches (with both in and out times) contribute to your total hours. Open punches (missing an out time) are preserved but excluded from duration calculations until you close them.

## Accessing Advanced Punch Entry

1. Navigate to the **Time Entry** page (or **Dashboard & Calendar**).
2. Select a date on the calendar.
3. Ensure the **Advanced** toggle is enabled (it's the default mode).
4. The punch entry form appears on the right side of the screen.

**Note:** If you've already created a manual entry for the selected date/contract/hour type combination, you cannot switch to advanced mode for that entry. Delete the manual entry first or create a new entry with a different hour type.

## Understanding Punch Ranges

A **punch range** is a single period of work with:
- **In time**: When you started (e.g., 09:15)
- **Out time**: When you stopped (e.g., 17:30)

A typical day might have multiple punch ranges:
- **Morning session**: 09:00 - 12:30 (3.5 hours)
- **Afternoon session**: 13:30 - 17:00 (3.5 hours)
- **Total**: 7 hours

Each punch range represents uninterrupted work. Breaks, lunch, meetings away from your desk - anything that stops the clock - requires ending the current punch and starting a new one when you resume.

### Closed vs Open Punches

**Closed punch:** Has both in and out times. Contributes to total duration.

**Open punch:** Has an in time but no out time yet. Excluded from duration until closed.

**Example:**
```
Punch 1: 08:00 - 12:00 (closed, 4 hours counted)
Punch 2: 13:00 - 17:00 (closed, 4 hours counted)
Punch 3: 18:00 - (open, 0 hours counted)
Total duration: 8 hours (punches 1 and 2 only)
```

The open punch warning appears when you have unclosed punches, reminding you to add an out time before saving.

## Entering Punch Ranges

### Method 1: Manual Punch Entry

1. Select your **Contract** from the dropdown (required).
2. Select your **Hour Type** if hour types are enabled (optional unless the hour type requires a contract).
3. In the punch list, enter your first punch range:
   - **In**: Start time (24-hour format, e.g., 09:00)
   - **Out**: End time (24-hour format, e.g., 17:30)
4. Click **Add Punch** to add another range if needed.
5. Repeat for each work period throughout the day.
6. Click **Save Entry** to save.

**Validation:**
- Out time must be later than in time for the same punch
- If out time is earlier than in time, Tempus clears the out time (assumes overnight work or error)
- Punches are automatically sorted by in time

**Tip:** Use the Tab key to move between fields quickly. Press Enter to save when all required fields are filled.

### Method 2: Quick Punch In/Out Toggle

1. Select your contract and hour type.
2. Click **Punch In** to start a new punch range.
   - Tempus adds a punch with the current time as the in time
   - The button changes to **Punch Out**
3. When you finish working, click **Punch Out**.
   - Tempus fills the out time for the latest open punch
   - The button changes back to **Punch In**
4. Repeat Punch In / Punch Out as needed throughout the day.
5. Click **Save Entry** when done.

**How it works:**
- **Punch In** creates a new punch range with the current time and no out time (open punch)
- **Punch Out** fills the out time for the most recent open punch (closes the punch)
- You can have multiple closed punches and at most one open punch
- Open punches don't contribute to duration until closed

**Use case:** Ideal for real-time tracking. Punch in when you start, punch out when you stop. Tempus records exact times without manual typing.

### Method 3: Using Entry Defaults

**Requires:** *Enable default hours for time entries* feature flag

If you have a consistent schedule, create an advanced entry default to prefill your punch ranges:

1. Set up your typical punch ranges (e.g., 09:00-12:00, 13:00-17:00).
2. Click **Create Default** and name it (e.g., "Standard Workday").
3. On future days, click **Enter Default** and select your saved default.
4. Tempus fills in the punch ranges automatically.
5. Adjust times if needed, then click **Save Entry**.

**Important:** Defaults clone punch ranges on apply. Editing the entry after applying a default does not change the saved default template.

See [Entry Defaults documentation](time-entry-defaults.md) for full details.

## The Punch Entry Form

### Contract Selector

Select the contract this time applies to. Only contracts valid for the selected date appear in the dropdown (based on contract start and end dates).

**Required:** You must select a contract before saving.

**Behaviour:** Changing the contract while editing reloads the form. If an entry already exists for the new contract on this date (with the same hour type), that entry loads for editing.

### Hour Type Selector

**Requires:** *Enable multiple hour types* feature flag

Choose the hour type for this entry (e.g., Work, Leave, Training). If the hour type requires a contract (flagged as "contributes to income"), the contract field becomes mandatory.

**Optional:** Unless the selected hour type requires a contract, you can save without selecting an hour type.

**Behaviour:** Hour type selection can change which contracts appear in the contract dropdown. Some hour types might filter contracts or enforce additional validation.

### Punch List

A dynamic list of punch ranges, each with:
- **In time** input field (HH:MM format)
- **Out time** input field (HH:MM format)
- **Remove** button (X icon) to delete this punch range

**Empty state:** The form starts with one empty punch range. Fill it in or use Punch In to create the first punch.

**Adding punches:** Click **Add Punch** to add a new blank punch range to the list.

**Removing punches:** Click the **X** button next to a punch to remove it. You cannot remove the last remaining punch - there must always be at least one punch range in the list.

**Automatic sorting:** Punches are sorted by in time automatically. If you enter punches out of order, they rearrange when you save or refocus.

### Punch Summary

Below the punch list, a summary shows:
- **Total duration** calculated from closed punches
- **Earliest in time** and **latest out time** from all punches
- **Open punch count** if any punches are unclosed

**Example:** "7.5 hours (09:00 - 17:30, 1 open punch)"

The summary updates dynamically as you type in and out times.

### Punch Open Warning

If you have open punches (in time but no out time), an orange warning appears:

**"X open punch(es). These will not count towards your total until you add end times."**

This reminds you to close all punches before saving. You can save with open punches, but they won't contribute to your total hours until you return and add out times.

### End Time Suggestion

**Requires:** *Suggest end times for punch entries* feature flag AND rounding interval > 0

When enabled, Tempus suggests an exact out time for your last open punch to achieve a "tidy" rounded total.

**How it works:**
1. You punch in and work for a while
2. Tempus calculates how much longer you need to work to hit the next rounding interval
3. A green suggestion appears: "Suggested end: 17:15 for 7.5 hours total"
4. Click the suggestion to fill the out time automatically

**Minimum end time setting:** The suggestion won't recommend an out time earlier than your configured minimum end time (default 17:00). If you punch in late, the suggestion uses the next day's minimum end time.

**Use case:** If you use 6-minute rounding (0.1 hours) and want to hit exactly 7.5 hours, the suggestion tells you the precise time to clock out rather than guessing.

See [Settings documentation](settings.md) for configuring minimum end time.

## Editing an Existing Advanced Entry

1. Navigate to the date with the entry you want to edit.
2. Select the same contract and hour type as the existing entry.
3. Tempus loads the entry automatically, showing all saved punch ranges.
4. Modify punch times, add new punches, or remove punches as needed.
5. Click **Update Entry** to save changes.
6. The **Delete** button appears when editing - click it to remove the entire entry.

**Important:** When you change the contract dropdown, Tempus checks if an entry exists for the new contract on this date. If found, it loads that entry instead. This lets you switch between multiple contracts on the same day quickly.

## Deleting an Advanced Entry

1. Load the entry by selecting its date, contract, and hour type.
2. Click **Delete** (appears when editing an existing entry).
3. Confirm the deletion.
4. The entry is removed from Google Sheets.
5. The form resets to a blank state.

**Note:** Deletion clears the entry and all associated metrics (duration, punch ranges). This action cannot be undone unless you manually recreate the entry.

## Advanced Punch Entry vs Manual Entry

| Feature | Advanced Punch Entry | Manual Entry |
|---------|---------------------|--------------|
| **Input method** | Multiple punch-in/punch-out times | Single total duration |
| **Precision** | Exact start/stop times for each period | Approximate total hours |
| **Data storage** | JSON array of punch ranges | Single duration value |
| **Breaks tracked** | Yes (gaps between punches) | No (manual adjustment) |
| **Open punches** | Supported (excluded from total until closed) | Not applicable |
| **Use case** | Real-time tracking, precise billing | Quick retrospective entry |
| **Switching modes** | Cannot switch to manual if advanced entry exists | Cannot switch to advanced if manual entry exists |

**When to use Advanced:**
- You track exact start/stop times for payroll or billing
- You take multiple breaks during the day
- You want a detailed audit trail of work periods
- You use real-time punch-in/punch-out workflow

**When to use Manual:**
- You're entering hours after the fact
- You only care about total duration, not exact times
- You have a consistent schedule (e.g., always 8 hours)
- You prefer simplicity over precision

## Punch Entry Validation Rules

Tempus validates punch entries before saving:

### Contract Requirement
- **Must have:** A valid contract selected
- **Error if:** No contract selected when saving
- **Note:** Contract must be valid for the selected date (within contract start/end date range)

### Punch Time Format
- **Must be:** 24-hour time format (HH:MM, e.g., 09:30, 17:00)
- **Auto-correction:** Tempus attempts to parse partial inputs (e.g., "9" becomes "09:00")
- **Invalid:** Out-of-range values (e.g., 25:00, 09:70) are rejected or cleared

### Out Time After In Time
- **Must be:** Out time later than in time for the same punch
- **Auto-correction:** If out time is earlier, Tempus clears the out time field (assumes error or overnight work that requires manual correction)

### Minimum Duration
- **Must have:** At least one closed punch with duration > 0 to save
- **Open punches:** Allowed but don't contribute to total
- **Zero duration:** Punches where in time equals out time are technically valid but contribute 0 hours

### No Duplicate Entries
- **Prevented:** Multiple entries for the same date/contract/hour type combination
- **Behaviour:** Selecting an existing combination loads the entry for editing rather than creating a new one

## Tips for Using Advanced Punch Entry

- **Close open punches before saving:** While you can save with open punches, they won't count towards your total until you add out times. Review the punch open warning before saving.
- **Use Punch In/Out for real-time tracking:** The quick toggle is perfect for tracking as you work. Punch in when you start, punch out when you break, punch in when you resume.
- **Manually enter times for retrospective entry:** If you're logging yesterday's hours, type the times directly rather than using the current-time Punch In/Out buttons.
- **Add Punch for each break:** Every time you stop working (lunch, meeting, break), end the current punch and start a new one when you return. This creates an accurate record of work periods.
- **Review the summary:** Check the total duration and time range in the punch summary before saving. It should match your expectations.
- **Use entry defaults for consistent schedules:** If you work the same hours every day (e.g., 09:00-12:00, 13:00-17:00), create an advanced default to save typing time.
- **Combine with rounding:** Set a rounding interval in Settings to automatically round total duration to payroll-friendly increments (e.g., 6-minute intervals for 0.1-hour precision).
- **Enable end time suggestions:** If you want to hit exact rounded totals, enable the suggest end times flag and let Tempus calculate the optimal clock-out time.
- **Tab through fields:** Use Tab to move between in/out time fields and Enter to save when ready. Keyboard navigation is faster than clicking.
- **Don't worry about punch order:** Enter punches in any order - Tempus sorts them by in time automatically.
- **Review open punches regularly:** If you frequently leave punches open, check the Time Entry page periodically to close any forgotten punches.

## Common Advanced Entry Questions

### Can I have multiple entries on the same day?
Yes, if they use different contracts or different hour types. You cannot have duplicate entries for the same date/contract/hour type combination.

### What happens if I don't close an open punch?
The open punch is saved but excluded from your total duration. It appears in the entry with an orange warning. When you return to close it, the duration updates to include the newly closed punch.

### Can I switch an advanced entry to manual mode?
No. Once you create an advanced entry, you must delete it before you can create a manual entry for the same date/contract/hour type. This prevents accidental data loss.

### How does rounding work with punch entries?
Rounding applies to the total duration calculated from closed punches. Each punch contributes its raw duration (out time minus in time), then the sum is rounded according to your rounding interval setting.

**Example:** Punch 1 = 3.42 hours, Punch 2 = 4.12 hours. Total = 7.54 hours. With 6-minute rounding, 7.5 hours rounds to 7.5 hours.

### Why does Tempus clear my out time when I enter it?
If the out time is earlier than the in time, Tempus assumes an error and clears the out time. This prevents negative duration. If you worked overnight (e.g., in at 22:00, out at 02:00), you need to split this across two entries (one for each date).

### Can I delete just one punch from an entry?
Yes. Click the **X** button next to the punch you want to remove. You must keep at least one punch in the list, so you cannot delete the last remaining punch.

### How do I enter overtime as separate punches?
If your hour types include "Standard Work" and "Overtime", create two entries for the same day:
1. Entry 1: Contract A, Hour Type "Standard Work", punches for regular hours
2. Entry 2: Contract A, Hour Type "Overtime", punches for overtime hours

Each entry tracks separately and appears on reports with its respective hour type.

### What's the earliest/latest time I can enter?
Times must be in 24-hour format (00:00 to 23:59). If you need to track work that spans midnight, create separate entries for each calendar day.

### Do punch times sync across devices?
Yes, if you're logged into the same Google account. Punch entries are saved to Google Sheets and synchronise across all devices accessing the same Tempus deployment.

## Summary

Advanced Punch Entry tracks time as multiple punch-in/punch-out ranges, automatically calculating duration from closed punches. Perfect for precise tracking, billing, or payroll, it supports real-time punch toggles, manual time entry, and entry defaults. Open punches are preserved but excluded from totals until closed.

For manual duration entry, see [Time Entry documentation](time-entry-manual.md). For saving reusable punch templates, see [Entry Defaults documentation](time-entry-defaults.md).
