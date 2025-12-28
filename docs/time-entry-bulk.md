# Bulk Time Entries

Fill a date range with identical time entries automatically, avoiding repetitive manual entry.

## Purpose
Bulk Time Entries let you create multiple identical time entries across a date range with a single configuration. Instead of manually entering the same hours for every day of a holiday, training course, or consistent work period, define the range once and Tempus generates all the individual entries automatically. The bulk entry system supports weekend exclusion, public holiday skipping, and two distribution modes: fixed hours per day or total hours spread across the month. Each generated entry is a standard manual (basic) entry that you can edit or delete individually.

**Important:** Bulk entries are templates that generate real time entries. Editing the bulk configuration updates all generated entries to match, keeping them in sync. Deleting the bulk range removes all its generated entries.

## Enabling Bulk Time Entries

**Requires:** *Enable bulk time entries* feature flag

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Time Entries** group.
4. Enable *Enable bulk time entries*.
5. Click **Save Settings**.
6. The **Manage Bulk Entries** button appears on the Time Entry page.

## Accessing Bulk Time Entries

1. Navigate to the **Time Entry** page (or **Dashboard & Calendar**).
2. Click **Manage Bulk Entries** (appears in the toolbar when the flag is enabled).
3. The Bulk Entries modal opens.

The modal has two panels:
- **Left panel:** List of existing bulk ranges
- **Right panel:** Form to create or edit a bulk range

## Understanding Bulk Ranges

A **bulk range** is a configuration that generates multiple time entries:

**You define:**
- Name (e.g., "Annual Leave", "Training Week")
- Distribution mode (hours each day OR hours over the month)
- Total hours (per day or for the whole period)
- Contract
- Hour type (optional)
- Start and end dates (or month for monthly distribution)
- Weekend exclusion (skip Saturdays and Sundays)
- Public holiday exclusion (skip configured public holidays)

**Tempus generates:**
- One manual time entry per included day
- Each entry uses the specified hours, contract, and hour type
- Entries appear on the calendar like any manual entry
- Entries update automatically when you edit the bulk range

## Creating a Bulk Range

### Step-by-Step Workflow

1. Open the **Manage Bulk Entries** modal.
2. Click **New Bulk Range**.
3. Enter a **Name** (e.g., "Christmas Break", "Summer Training").
4. Choose a **Distribution mode**:
   - **Hours each day:** Same hours for every included day (e.g., 7.5 hours/day)
   - **Hours over the month:** Total hours spread evenly across all included days in the month
5. Enter **Hours**:
   - For "Hours each day": Enter the hours per day (e.g., 7.5)
   - For "Hours over the month": Enter the total hours for the entire period (e.g., 160 hours)
6. Select a **Contract** from the dropdown.
7. Select a **Hour type** if hour types are enabled.
8. For **daily distribution**:
   - Set **Start date** and **End date** (inclusive range)
9. For **monthly distribution**:
   - Use the month picker to select a month
   - Start/end dates are automatically set to the full month
10. Toggle **Skip weekends** if you want to exclude Saturdays and Sundays.
11. Toggle **Skip public holidays** if you want to exclude configured public holidays.
12. Review the **generated summary** (e.g., "Will create 10 entries").
13. Click **Save Range**.

Tempus generates all the entries and updates the calendar immediately.

## Distribution Modes

### Hours Each Day (Daily Distribution)

**Use case:** Consistent daily hours across a date range.

**How it works:**
- You specify hours per day (e.g., 7.5)
- Every included day gets an entry with that exact duration
- Weekends and holidays are excluded if toggles are enabled

**Example:**
- **Configuration:** 7.5 hours/day, 1 Dec - 5 Dec, skip weekends
- **Generated entries:**
  - Mon 1 Dec: 7.5 hours
  - Tue 2 Dec: 7.5 hours
  - Wed 3 Dec: 7.5 hours
  - Thu 4 Dec: 7.5 hours
  - Fri 5 Dec: 7.5 hours
- **Total:** 5 entries, 37.5 hours

**Best for:** Holidays, training periods, consistent work schedules.

### Hours Over the Month (Monthly Distribution)

**Use case:** Total monthly hours spread evenly across all working days.

**How it works:**
- You specify total hours for the month (e.g., 160)
- Tempus counts the included days (after weekend/holiday exclusion)
- Hours are divided evenly: total ÷ included days
- Each day gets a fraction of the total

**Example:**
- **Configuration:** 160 hours over January, skip weekends
- **Included days:** 23 weekdays in January
- **Hours per day:** 160 ÷ 23 = 6.96 hours/day
- **Generated entries:** 23 entries, each with 6.96 hours
- **Total:** 160 hours (exact)

**Rounding:** If division doesn't result in exact decimals, Tempus adjusts the last entry to ensure the total matches your specified hours precisely.

**Best for:** Monthly contracts with fixed total hours, part-time schedules with monthly caps.

## Configuring Weekend and Holiday Exclusions

### Skip Weekends Toggle

**Default:** Enabled

**When enabled:**
- Saturdays and Sundays are excluded from the date range
- No entries are created for weekend days
- The generated summary reflects the exclusion

**When disabled:**
- All days in the range are included (Monday through Sunday)
- Weekend days get entries with the same hours as weekdays

**Use case for disabling:** You work weekends, or the bulk range represents leave that covers weekends.

### Skip Public Holidays Toggle

**Requires:** *Enable public holidays* feature flag

**Default:** Enabled when public holidays are enabled

**When enabled:**
- Days marked as public holidays (based on your configured state) are excluded
- No entries are created for public holidays
- The generated summary reflects the exclusion

**When disabled:**
- Public holidays are treated like normal days and get entries

**Use case for disabling:** You work on public holidays, or the bulk range represents a period where holidays don't apply.

See [Settings documentation](docs/settings.md) for configuring your public holiday state.

## Editing a Bulk Range

1. Open the **Manage Bulk Entries** modal.
2. Click on an existing bulk range in the left panel.
3. The form loads with the bulk range's current configuration.
4. Modify any fields:
   - Change hours (all generated entries update to match)
   - Change date range (entries are added or removed to match the new range)
   - Toggle weekend/holiday exclusions (entries are added or removed accordingly)
   - Change contract or hour type (all generated entries update)
5. Click **Save Range**.

**Synchronisation:**
- **New days in range:** Tempus creates new entries
- **Removed days:** Tempus deletes entries that no longer fall in the range
- **Changed hours/contract/hour type:** Tempus updates all existing entries to match
- **Calendar updates:** Changes reflect immediately on the calendar

**Example:** You have a bulk range for 1 Dec - 5 Dec (5 entries). You edit it to 1 Dec - 10 Dec. Tempus creates 5 new entries for 6 Dec - 10 Dec (excluding weekends).

## Deleting a Bulk Range

1. Open the **Manage Bulk Entries** modal.
2. Click on the bulk range you want to delete.
3. Click **Delete Range**.
4. Confirm the deletion.
5. The bulk range is removed.
6. All generated entries are deleted from Google Sheets.
7. The calendar updates to remove the entries.

**Warning:** Deleting a bulk range permanently removes all its generated entries. This action cannot be undone unless you manually recreate the bulk range or entries.

**Important:** If you've manually edited individual generated entries, those edits are lost when you delete the bulk range. Save important customisations by converting individual entries to standalone entries first (by removing them from the bulk range).

## The Bulk Entries List

The left panel shows all your bulk ranges as cards:

**Each card displays:**
- **Name:** The bulk range name
- **Contract:** Which contract the entries apply to
- **Hour type:** The hour type used (if applicable)
- **Date range:** Start and end dates
- **Total entries:** Number of generated entries (e.g., "15 entries")
- **Total hours:** Sum of all generated hours (e.g., "112.5 hours")

**Interaction:**
- Click a card to load it in the form for editing
- The active bulk range is highlighted
- Click **New Bulk Range** to clear the form and create a fresh range

**Empty state:** If no bulk ranges exist, a message appears: "No bulk ranges yet. Create one to add consistent entries between two dates."

## The Bulk Entry Form

### Name Field

A descriptive label for this bulk range. Use names that clearly identify the period or purpose.

**Examples:**
- "Annual Leave - December"
- "Training Course - Week 1"
- "Client Project - January"
- "Part-time Schedule"

**Required:** You must enter a name before saving.

### Distribution Mode Selector

Choose how hours are distributed across the date range:

**Hours each day:**
- Fixed hours per included day
- Simple, predictable entries
- Best for consistent daily schedules

**Hours over the month:**
- Total hours divided evenly across all included days
- Useful for monthly caps or contracts with fixed monthly totals
- Ensures exact monthly totals

### Hours Field

**For "Hours each day" mode:**
- Enter the hours per day (e.g., 7.5)
- Label reads "Hours per day"

**For "Hours over the month" mode:**
- Enter the total hours for the entire period (e.g., 160)
- Label reads "Total hours for month"

**Validation:**
- Must be greater than 0
- Minimum 0.25 hours (15 minutes)
- Step increment: 0.25 (quarter-hour)

### Contract Selector

Select the contract these entries apply to. Only contracts with valid date ranges are shown.

**Required:** You must select a contract before saving.

**Behaviour:** If the contract's end date falls within the bulk range, only days up to the contract end date will have entries generated.

### Hour Type Selector

**Requires:** *Enable multiple hour types* feature flag

Choose the hour type for all generated entries (e.g., Work, Leave, Training).

**Optional:** If not selected, entries use the default hour type.

**Use case:** Use hour types to differentiate bulk leave entries from bulk work entries.

### Date Range Fields (Daily Distribution)

**Start date:**
- The first day to include in the range (inclusive)

**End date:**
- The last day to include in the range (inclusive)

**Validation:**
- End date must be equal to or after start date
- Both dates are required for daily distribution mode

**Example:** Start: 1 Dec, End: 5 Dec generates entries for all days from 1 Dec through 5 Dec (inclusive).

### Month Picker (Monthly Distribution)

**Appears when:** Distribution mode is "Hours over the month"

Use the month picker to select the month:
1. Use ◀ and ▶ to navigate years
2. Click a month button to select it
3. Start and end dates are automatically set to the first and last day of the selected month

**Example:** Select "January 2025" → Start: 1 Jan 2025, End: 31 Jan 2025.

### Generated Summary

Below the toggles, a summary shows the expected result:

**Example summaries:**
- "Will create 10 entries totalling 75.0 hours"
- "Will create 23 entries totalling 160.0 hours"

**Use this to:** Verify the bulk range will create the correct number of entries before saving.

**Updates dynamically:** The summary recalculates as you change fields, toggles, or date ranges.

## Bulk Entries vs Manual Entries

| Feature | Bulk Entries | Manual Entries |
|---------|--------------|----------------|
| **Creation speed** | One configuration creates many entries | One entry at a time |
| **Date range support** | Fills a range automatically | Must enter each day individually |
| **Synchronisation** | All generated entries update when bulk config changes | Independent entries, no sync |
| **Weekend/holiday exclusion** | Built-in toggles | Manual skip required |
| **Distribution modes** | Daily or monthly spread | Single duration per entry |
| **Use case** | Holidays, training, consistent periods | One-off days, variable hours |
| **Editability** | Edit bulk config updates all entries | Edit each entry independently |

**When to use Bulk Entries:**
- You need the same hours for many consecutive days
- You're logging a holiday or training period
- You have a monthly total to spread across working days
- You want to exclude weekends/holidays automatically

**When to use Manual Entries:**
- Hours vary day by day
- You're entering just a few days
- You need per-day customisation
- You prefer full control over each entry

## Validation and Error Handling

Tempus validates bulk ranges before saving:

### Name Requirement
- **Must have:** A non-empty name
- **Error if:** Name field is blank

### Hours Requirement
- **Must be:** Greater than 0
- **Minimum:** 0.25 hours
- **Error if:** Hours ≤ 0 or blank

### Contract Requirement
- **Must have:** A valid contract selected
- **Error if:** No contract selected

### Date Range Validity
- **Must have:** Start date ≤ end date
- **Error if:** End date is before start date

### Contract Date Alignment
- **Warning if:** Bulk range extends beyond the contract's valid dates
- **Behaviour:** Tempus only creates entries for days within the contract's date range

### No Included Days
- **Error if:** After applying weekend/holiday exclusions, no days remain
- **Example:** Range covers only a weekend with "Skip weekends" enabled

## Tips for Using Bulk Time Entries

- **Name descriptively:** Use names that clearly identify the period. "Annual Leave Dec 2024" is better than "Leave".
- **Review the summary:** Always check the generated summary before saving. It tells you exactly how many entries and total hours will be created.
- **Use monthly distribution for capped contracts:** If your contract specifies a fixed monthly total (e.g., 160 hours/month), use monthly distribution to hit that exact total.
- **Exclude weekends by default:** Most use cases (leave, training) don't include weekends. Leave the toggle enabled unless you specifically work weekends.
- **Combine with public holidays flag:** If you have public holidays enabled, the skip toggle ensures those days are excluded automatically.
- **Edit rather than delete/recreate:** If you made a small mistake (wrong end date, wrong hours), edit the bulk range. The entries update automatically.
- **Use hour types to categorise:** Create separate bulk ranges for different hour types (e.g., "Leave" bulk range with Leave hour type, "Training" bulk range with Training hour type).
- **Check the calendar after saving:** Verify the entries appear on the expected days with the correct hours.
- **Delete bulk ranges when done:** After a period ends, delete the bulk range to clean up your list. The generated entries remain in your data.
- **Overlap awareness:** Bulk ranges can overlap dates. If two bulk ranges create entries for the same day with the same contract/hour type, the second will overwrite the first. Avoid overlapping ranges with identical contract/hour type combinations.

## Common Bulk Entry Questions

### Can I have multiple bulk ranges for the same date range?
Yes, as long as they use different contracts or hour types. You cannot have two bulk ranges that would create duplicate entries (same date/contract/hour type).

### What happens if I manually edit a generated entry?
The entry updates to match the bulk configuration the next time you edit the bulk range. Manual edits to individual generated entries are overwritten by bulk sync. If you need persistent customisation, convert the entry to a standalone entry by deleting it from the bulk range.

### Can I delete just one generated entry without deleting the bulk range?
Not directly. Generated entries are tied to the bulk range. If you delete an individual entry, it will be regenerated the next time the bulk range syncs. To exclude a specific day, adjust the bulk range's start/end dates or create them using manual entries instead.

### How does monthly distribution handle months with different numbers of days?
Monthly distribution divides total hours by the number of included days (after weekend/holiday exclusions). February gets fewer days than January, so each day in February receives slightly more hours if the monthly total is the same.

**Example:**
- 160 hours over January (31 days, ~22 weekdays) = ~7.27 hours/day
- 160 hours over February (28 days, ~20 weekdays) = 8 hours/day

### Can I use bulk entries for punch-based (advanced) entries?
No. Bulk entries generate manual (basic) entries only. Each entry is a single duration value, not multiple punch ranges.

### What happens if the contract ends in the middle of the bulk range?
Tempus only creates entries for days within the contract's valid date range. Days after the contract end date are skipped.

**Example:** Contract ends 15 Dec. Bulk range is 1 Dec - 31 Dec. Only entries for 1 Dec - 15 Dec are created.

### Do bulk entries respect my rounding interval setting?
Yes. Each generated entry's hours are rounded according to your configured rounding interval, just like manual entries.

### Can I create bulk entries for future dates?
Yes. The date range accepts any dates, past or future. This is useful for planning or pre-logging expected leave periods.

### How do I convert a bulk range to individual entries?
Delete the bulk range after verifying the entries exist. The generated entries remain as standard manual entries. You can then edit them individually without bulk sync interference.

### Why does my bulk range create fewer entries than expected?
Check:
- **Skip weekends** toggle: Weekends are excluded by default
- **Skip public holidays** toggle: Public holidays are excluded if enabled
- **Contract date range:** Days outside the contract's validity are skipped
- **Generated summary:** It shows the exact count before saving

### Can bulk entries span multiple months?
Yes, for daily distribution mode. Monthly distribution is locked to a single month. If you need multiple months with monthly distribution, create separate bulk ranges for each month.

## Summary

Bulk Time Entries automate repetitive entry creation across date ranges. Choose daily or monthly hour distribution, exclude weekends and holidays, and let Tempus generate all entries from one configuration. Edit the bulk range to update all entries, or delete it to remove them entirely.

For individual time entry, see [Basic Time Entry documentation](docs/time-entry-basic.md) and [Advanced Punch Entry documentation](docs/time-entry-advanced.md). For automated recurring entries, see [Recurring Time Entries documentation](docs/time-entry-recurring.md).
