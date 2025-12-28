# Recurring Time Entries

Automate time entry creation with weekly or monthly schedules that generate entries automatically within contract boundaries.

## Purpose
Recurring Time Entries eliminate repetitive manual entry for predictable work schedules by defining reusable patterns that automatically create time entries on specified days. Instead of logging the same hours every Monday and Thursday, create a weekly recurring schedule and Tempus generates entries automatically whilst you work. The system supports both weekly patterns (specific weekdays with interval control) and monthly patterns (specific day of month or nth weekday of month), respects contract date boundaries, handles income-generating vs non-income hour types differently, and provides a generation horizon to prevent creating entries too far into the future. Each recurring schedule tracks which dates have been generated, allowing safe editing and regeneration without creating duplicates.

**Important:** Recurring entries create basic (manual) time entries with midnight-based punches. Generated entries can be edited or deleted individually, but regenerating the schedule may recreate deleted entries.

## Enabling Recurring Time Entries

**Requires:** *Enable recurring time entries* feature flag

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Time Entries** group.
4. Enable *Enable recurring time entries*.
5. Click **Save Settings**.
6. The **Manage Recurring Entries** button appears on the Time Entry page.

## Accessing Recurring Entries

1. Navigate to the **Time Entry** page.
2. Click **Manage Recurring Entries** (appears in the toolbar when the flag is enabled).
3. The Manage Recurring Entries modal opens.

The modal has two panels:
- **Left panel:** List of existing recurring schedules
- **Right panel:** Form to create or edit a schedule

## Understanding Recurring Schedules

A **recurring schedule** is a template that generates time entries automatically:

**You define:**
- Name (e.g., "Standard Work Week", "Monthly Report Day")
- Recurrence type (weekly or monthly)
- Recurrence pattern (which days, which weeks)
- Duration (hours per entry)
- Contract
- Hour type (optional)
- Start and end dates (optional, defaults to contract dates)

**Tempus generates:**
- One basic time entry per matched day
- Entries only within the contract's valid date range
- Entries up to the generation horizon (365 days by default)
- No duplicates (tracks which dates have been generated)

**Important distinction from bulk entries:**
- **Bulk entries:** Fill a specific date range once, then stop
- **Recurring entries:** Continuously generate future entries as time passes

## Creating a Recurring Schedule

### Step-by-Step Workflow

1. Open the **Manage Recurring Entries** modal.
2. Click **New Schedule**.
3. Enter a **Name** (e.g., "Mon-Thu Work", "First Monday Admin").
4. Select **Recurrence Type**:
   - **Weekly:** Repeat on specific weekdays at weekly intervals
   - **Monthly:** Repeat on a specific day or weekday of each month
5. Configure the pattern:
   - **For Weekly:** Select weekdays and interval
   - **For Monthly:** Choose day mode and specify day/weekday/week
6. Enter **Duration** (hours per entry, e.g., 7.5).
7. Select a **Contract** from the dropdown.
8. Select a **Hour Type** if hour types are enabled.
9. Optionally set **Start Date** (defaults to contract start).
10. Optionally set **End Date** (defaults to contract end).
11. Review the **preview** showing the next 5 generated dates.
12. Click **Save Schedule**.

Tempus generates all pending entries immediately and updates the calendar.

## Recurrence Types

### Weekly Recurrence

Generate entries on specific weekdays with configurable weekly intervals.

**Configuration:**
- **Weekdays:** Select one or more days (Monday = 1, Sunday = 0)
- **Weekly Interval:** Every N weeks (1 = every week, 2 = every other week, etc.)

**Examples:**

**Every Monday and Thursday:**
- Recurrence type: Weekly
- Weekdays: Monday, Thursday
- Interval: 1

**Every other Friday:**
- Recurrence type: Weekly
- Weekdays: Friday
- Interval: 2

**Mon-Wed-Fri every week:**
- Recurrence type: Weekly
- Weekdays: Monday, Wednesday, Friday
- Interval: 1

**Pattern matching:** The system uses the schedule's start date (or contract start) as the anchor. For "every 2 weeks", it counts weeks from the anchor date to ensure consistent intervals.

### Monthly Recurrence

Generate entries on a specific day or weekday of each month.

**Two modes:**

### Day of Month Mode

Generate on a specific calendar day each month.

**Configuration:**
- Monthly mode: Day of month
- Day: 1-31

**Examples:**

**1st of every month:**
- Mode: Day of month
- Day: 1
- Interval: 1

**15th of every month:**
- Mode: Day of month
- Day: 15
- Interval: 1

**Last day behaviour:** If you select day 31 but the month has fewer days (e.g., February), the entry generates on the last available day (28 or 29).

### Weekday of Month Mode

Generate on a specific weekday occurrence within each month (e.g., "first Monday", "third Friday", "last Tuesday").

**Configuration:**
- Monthly mode: Weekday of month
- Week: 1st, 2nd, 3rd, 4th, or Last
- Weekday: Sunday through Saturday

**Examples:**

**First Monday of every month:**
- Mode: Weekday of month
- Week: 1st
- Weekday: Monday
- Interval: 1

**Third Friday of every month:**
- Mode: Weekday of month
- Week: 3rd
- Weekday: Friday
- Interval: 1

**Last Tuesday of every month:**
- Mode: Weekday of month
- Week: Last
- Weekday: Tuesday
- Interval: 1

**Last week calculation:** "Last" matches the final occurrence of that weekday in the month, even if it falls in the 4th or 5th week.

### Monthly Interval

Both monthly modes support interval configuration:
- **Interval: 1** = every month
- **Interval: 2** = every other month (bi-monthly)
- **Interval: 3** = every third month (quarterly)

**Example:** "First Monday every 3 months" creates quarterly entries on the first Monday of January, April, July, October (assuming the schedule starts in January).

## Contract Boundaries and Validation

Recurring schedules respect contract date ranges strictly:

### Contract Requirement
**Every recurring schedule must have a contract.** The contract defines the valid date range for generated entries.

### Date Range Intersection
Generated entries only appear for dates that fall within BOTH:
- The recurring schedule's start/end dates (if specified)
- The contract's start/end dates (always required)

**Example:**
- Contract: 1 Jan 2024 - 31 Dec 2024
- Schedule start: 1 Mar 2024
- Schedule end: Not specified
- **Result:** Entries generate from 1 Mar 2024 to 31 Dec 2024

### Contract Duration Limit
**Maximum:** Contracts longer than 3 years (1095 days) are skipped with a warning.

**Reason:** Prevents accidental generation of thousands of entries for open-ended contracts.

**Workaround:** If you have a long-term contract, create separate recurring schedules for each year.

### Contract Validation
When creating or editing a schedule, Tempus validates:
- **Contract exists:** Selected contract must be valid
- **Contract has dates:** Both start_date and end_date must be set
- **Contract duration:** Must be ≤ 3 years
- **Date alignment:** Schedule dates must intersect with contract dates

**Warnings appear** in the schedule list if validation fails (e.g., "Contract exceeds 3-year limit. Skipping.").

## Income-Generating vs Non-Income Hour Types

Recurring schedules behave differently based on whether the hour type contributes to income:

### Income-Generating Hour Types

**Contributes to income: true** (e.g., Work, Overtime, Consulting)

**Behaviour:**
- **No backfilling:** Only generates entries from today onward
- **Future-only generation:** Past dates are never generated, even if the schedule starts in the past

**Why:** Prevents accidentally creating historical income entries that would affect past financial reports.

**Example:**
- Today: 15 Jan 2024
- Schedule start: 1 Jan 2024
- Hour type: "Work" (income-generating)
- **Result:** Entries generated from 15 Jan 2024 onward, not 1 Jan - 14 Jan

**Warning message:** If the schedule has income-generating entries in the past, a warning appears: "Income-generating schedules only create entries from [today's date] onward (no backfill)."

### Non-Income Hour Types

**Contributes to income: false** (e.g., Leave, Training, Admin)

**Behaviour:**
- **Backfilling allowed:** Generates entries for past dates within the contract and schedule range
- **Full range generation:** Respects start date regardless of today's date

**Why:** Historical tracking of leave or training is often needed for records and reporting.

**Example:**
- Today: 15 Jan 2024
- Schedule start: 1 Jan 2024
- Hour type: "Leave" (non-income)
- **Result:** Entries generated from 1 Jan 2024 onward (including past dates)

**Use case:** Logging annual leave patterns retroactively for recordkeeping.

## Generation Horizon

To prevent creating entries too far into the future, Tempus limits generation to a **365-day horizon** from today.

**How it works:**
- Each sync generates entries up to: MIN(schedule end date, contract end date, today + 365 days)
- As time passes and you sync again, more future entries are generated
- You never see entries more than 1 year ahead

**Example:**
- Today: 1 Jan 2024
- Contract end: 31 Dec 2025
- **Generation window:** 1 Jan 2024 - 31 Dec 2024 (365 days)
- On 1 Jul 2024, sync again to generate entries for Jan-Jun 2025

**Manual sync:** Click the sync button in the Recurring Entries modal to generate new future entries up to the horizon.

## Duplicate Detection and Tracking

Tempus tracks which dates have been generated for each schedule to prevent duplicates:

### Generated Until Tracking
Each schedule stores a `generated_until` date representing the last date processed.

**Behaviour:**
- When syncing, Tempus generates entries from `generated_until + 1` to the horizon end
- After generation, `generated_until` updates to the new end date
- Editing a schedule without changing the pattern preserves `generated_until`
- Changing pattern fields (weekdays, interval, duration, contract, etc.) resets `generated_until` to force regeneration

### Duplicate Prevention
Before creating an entry, Tempus checks if an entry already exists for that `date + recurrence_id` combination.

**Existing entry:** Skip creation (no duplicate)

**No existing entry:** Create the entry

**Use case:** If you manually delete a generated entry, syncing the schedule will recreate it (because the tracking shows it should exist on that date).

## Editing a Recurring Schedule

1. Open the **Manage Recurring Entries** modal.
2. Click on an existing schedule in the left panel.
3. The form loads with the schedule's current configuration.
4. Modify any fields:
   - Change name, duration, contract, hour type
   - Change recurrence pattern (weekdays, interval, day/week)
   - Adjust start/end dates
5. Click **Save Schedule**.

**Regeneration behaviour:**
- **Pattern unchanged:** Entries continue from where generation left off
- **Pattern changed:** `generated_until` resets, all entries regenerate from schedule start

**Warning:** Changing the pattern may create duplicate entries if you've manually edited or customised generated entries. Tempus overwrites them with freshly generated entries.

## Deleting a Recurring Schedule

1. Open the **Manage Recurring Entries** modal.
2. Click on the schedule you want to delete.
3. Click **Delete Schedule**.
4. Confirm the deletion.
5. The schedule is removed.

**Generated entries:** Deleting a schedule does NOT delete the entries it created. Those entries remain as standard time entries and can be managed individually.

**Stopping future generation:** To stop generating future entries without deleting the schedule, set the schedule's end date to today.

## Syncing Recurring Schedules

Recurring schedules generate entries automatically during:
- **Initial save:** When you create or edit a schedule
- **Manual sync:** Click the sync button in the Recurring Entries modal
- **Periodic sync:** Tempus may sync automatically when loading the Time Entry page (implementation-dependent)

**Manual sync workflow:**
1. Open the **Manage Recurring Entries** modal.
2. Click **Sync All Schedules** (or equivalent sync button).
3. Tempus processes all active schedules and generates pending entries.
4. Summary shows how many entries were created per schedule.

**Use case:** If you haven't opened Tempus for a month, sync to generate all missing entries for the past month (for non-income hour types) or catch up to today (for income hour types).

## The Recurring Entries Interface

### Schedule List Panel

The left panel shows all your recurring schedules as cards:

**Each card displays:**
- **Name:** The schedule name
- **Description:** Human-readable summary (e.g., "Every week on Monday, Thursday")
- **Contract:** Which contract the entries apply to
- **Hour type:** The hour type used (if applicable)
- **Duration:** Hours per entry
- **Status/Warning:** Any validation warnings (e.g., contract issues)

**Interaction:**
- Click a card to load it in the form for editing
- The active schedule is highlighted
- Click **New Schedule** to clear the form and create a fresh schedule

**Empty state:** If no schedules exist, a message appears: "No recurring schedules yet. Create one to automate your time tracking."

### Schedule Form Panel

The right panel contains the creation/editing form:

#### Name Field
A descriptive label for this schedule.

**Examples:**
- "Mon-Fri Work Week"
- "First Monday - Team Meeting"
- "Bi-weekly Report Day"

**Required:** You must enter a name before saving.

#### Recurrence Type Selector
Choose between **Weekly** and **Monthly** recurrence.

**Weekly:** Repeat on specific weekdays at weekly intervals
**Monthly:** Repeat on a specific day or weekday of each month

Changing this toggles different pattern configuration fields.

#### Weekly Pattern Fields

**Appears when:** Recurrence type is "Weekly"

**Weekdays checkboxes:** Select one or more days (Mon, Tue, Wed, Thu, Fri, Sat, Sun).

**Weekly interval:** Enter a number (1 = every week, 2 = every other week, etc.).

**Required:** At least one weekday must be selected.

#### Monthly Pattern Fields

**Appears when:** Recurrence type is "Monthly"

**Monthly mode selector:**
- **Day of month:** Specific calendar day (1-31)
- **Weekday of month:** Nth weekday (e.g., first Monday, last Friday)

**For "Day of month":**
- **Day field:** Enter 1-31

**For "Weekday of month":**
- **Week dropdown:** 1st, 2nd, 3rd, 4th, Last
- **Weekday dropdown:** Sunday through Saturday

**Monthly interval:** Enter a number (1 = every month, 2 = every other month, etc.).

#### Duration Field
Enter the hours per entry (e.g., 7.5, 8, 4).

**Validation:**
- Must be greater than 0
- Minimum 0.25 hours (15 minutes)
- Maximum 24 hours
- Step increment: 0.25 (quarter-hour)

**Required:** You must enter a duration before saving.

#### Contract Selector
Select the contract these entries apply to.

**Required:** You must select a contract before saving.

**Validation:** Contract must have start and end dates and must be ≤ 3 years duration.

#### Hour Type Selector

**Requires:** *Enable multiple hour types* feature flag

Choose the hour type for all generated entries (e.g., Work, Leave, Training).

**Optional:** If not selected, entries use the default hour type.

**Income flag impact:** If the hour type is income-generating, past dates will not generate (see Income-Generating vs Non-Income section).

#### Start Date Field
The first date to include in the generation range.

**Default:** Contract start date

**Optional:** Leave blank to use contract start date

**Use case:** Start a recurring schedule mid-contract without generating entries for earlier dates.

#### End Date Field
The last date to include in the generation range.

**Default:** Contract end date

**Optional:** Leave blank to use contract end date (or horizon limit)

**Use case:** Stop a recurring schedule before the contract ends.

#### Generated Preview

Below the form, a preview shows the next 5 dates that would be generated.

**Example:**
```
Next occurrences:
- 2024-01-15 (Monday)
- 2024-01-18 (Thursday)
- 2024-01-22 (Monday)
- 2024-01-25 (Thursday)
- 2024-01-29 (Monday)
```

**Use this to:** Verify the pattern matches your expectations before saving.

**Updates dynamically:** The preview recalculates as you change pattern fields.

## Recurring Entries vs Bulk Entries vs Defaults

| Feature | Recurring Entries | Bulk Entries | Entry Defaults |
|---------|-------------------|--------------|----------------|
| **Automatic creation** | Yes (ongoing) | Yes (one-time fill) | No (manual apply) |
| **Future entries** | Continuously generates | Fills specific range once | N/A |
| **Backfilling** | Conditional (non-income only) | Always (within range) | N/A |
| **Pattern definition** | Weekly/monthly recurrence | Date range | N/A |
| **Sync required** | Yes (to generate future entries) | No (creates all immediately) | N/A |
| **Use case** | Ongoing predictable schedule | Holiday, training block, consistent period | Varying dates with common hours |

**When to use Recurring Entries:**
- You work the same days every week or month indefinitely
- You want automatic future entry creation as time passes
- You have a predictable ongoing schedule tied to a contract

**When to use Bulk Entries:**
- You need the same hours for consecutive days (holiday, training)
- You want automatic exclusion of weekends/holidays
- You're filling a one-time date range, not an ongoing pattern

**When to use Entry Defaults:**
- You work varying dates but consistent hours
- You prefer reviewing before saving each entry
- You have multiple common patterns for different scenarios

## Validation and Error Handling

Tempus validates recurring schedules before saving:

### Name Requirement
- **Must have:** A non-empty name
- **Error if:** Name field is blank

### Duration Requirement
- **Must be:** Greater than 0 and ≤ 24 hours
- **Error if:** Duration ≤ 0 or blank

### Contract Requirement
- **Must have:** A valid contract selected
- **Error if:** No contract selected

### Contract Date Range
- **Must have:** Contract with both start_date and end_date
- **Error if:** Contract missing dates

### Contract Duration Limit
- **Must be:** Contract duration ≤ 3 years (1095 days)
- **Warning if:** Contract exceeds limit (schedule skipped during sync)

### Weekly Weekday Requirement
- **Must have:** At least one weekday selected
- **Error if:** Recurrence type is "Weekly" and no weekdays selected

### Monthly Day/Week Requirement
- **Must have:** Valid day (1-31) for "Day of month" mode, or valid week (1-5) for "Weekday of month" mode
- **Error if:** Values are missing or out of range

### Date Range Validity
- **Must have:** End date ≥ start date (if both specified)
- **Error if:** End date is before start date

## Tips for Using Recurring Entries

- **Name descriptively:** Use names that clearly identify the pattern. "Mon-Thu Standard Work" is better than "Schedule 1".
- **Start with weekly patterns:** Weekly recurrence is simpler and covers most use cases (regular work days).
- **Use monthly for exception days:** First Monday meetings, last Friday reviews, etc.
- **Set end dates for temporary patterns:** If a schedule only applies for a few months, set an end date to stop generation automatically.
- **Sync regularly:** Open the Recurring Entries modal and sync to generate future entries up to the horizon.
- **Check contract dates:** Ensure contracts cover your intended recurring period. Short contracts require frequent schedule updates.
- **Use non-income hour types for backfilling:** If you need to generate historical entries (e.g., logging past leave), use a non-income hour type.
- **Review generated entries:** After saving a schedule, check the calendar to verify entries appear on expected dates.
- **Edit carefully:** Changing pattern fields resets generation tracking and may create duplicate entries if you've customised generated entries.
- **Leverage hour types:** Create separate schedules for different hour types (e.g., "Work Mon-Fri" and "Training Fridays") to categorise time automatically.
- **Delete schedules when contracts end:** Clean up inactive schedules to keep the list manageable.

## Common Recurring Entry Questions

### Can I have multiple recurring schedules for the same contract?
Yes. Create separate schedules for different patterns (e.g., "Mon-Thu Work" and "Friday Half Day") using the same contract but different weekdays/durations.

### What happens if I manually edit a generated entry?
The entry remains as you edited it. Recurring schedules don't overwrite existing entries - they only create missing entries.

### Can I delete individual generated entries without affecting the schedule?
Yes, but syncing the schedule will recreate the deleted entry (because the schedule pattern says it should exist). To permanently stop an entry, adjust the schedule's end date or pattern to exclude that date.

### How do I stop a recurring schedule temporarily?
Set the end date to yesterday. This prevents future generation whilst preserving the schedule for later reactivation (change the end date back when ready).

### What happens if a recurring schedule spans multiple contracts?
Each schedule applies to only one contract. If your work changes contracts, create a new recurring schedule for the new contract period.

### Why doesn't my schedule generate past entries?
If the hour type is income-generating, past entries are never created (backfill prevention). Use a non-income hour type if you need historical entries.

### Can I use recurring entries with punch-based (advanced) mode?
No. Recurring entries always create basic (manual) entries with a single duration. If you need punch-based entries, manually create them or use advanced entry mode directly.

### How does the generation horizon work with long contracts?
The horizon limits how far future entries are generated (365 days by default). Sync periodically to generate entries for the next 365 days as time progresses.

### What if my contract ends but I extend it later?
Edit the contract to update the end date, then sync recurring schedules to generate entries for the extended period.

### Why does my schedule show a warning?
Warnings appear when validation fails (e.g., contract missing, contract too long, date conflicts). Fix the issue described in the warning message.

### Can I copy a recurring schedule?
Not directly. Load the schedule you want to copy, change the name, and save. This creates a new schedule with the same pattern.

### Do recurring entries respect rounding intervals?
Yes. Each generated entry's duration is rounded according to your configured rounding interval setting, just like manual entries.

### Can I create recurring entries for future dates before the contract starts?
No. Entries are only generated for dates within the contract's start/end range. If the contract starts in the future, entries appear when the contract period begins.

### How do I know which entries were generated by a recurring schedule?
Check the entry's `recurrence_id` field (visible in advanced views or exports). Entries with a `recurrence_id` were auto-generated.

### What happens if I delete the contract associated with a recurring schedule?
The schedule becomes invalid and shows a warning: "Contract not found." No entries are generated until you select a valid contract.

## Summary

Recurring Time Entries automate entry creation for weekly or monthly schedules. Configure recurrence patterns, contract boundaries, and hour types, then let Tempus generate entries automatically with income-aware backfill handling and duplicate prevention via generation tracking.

For one-time range filling, see [Bulk Time Entries documentation](docs/time-entry-bulk.md). For manual entry with reusable templates, see [Entry Defaults documentation](docs/time-entry-defaults.md). For contract configuration, see [Contracts documentation](docs/contracts.md).
