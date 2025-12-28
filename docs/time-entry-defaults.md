# Entry Defaults (Basic & Advanced)

Save reusable time entry templates for instant application without retyping hours or punch ranges.

## Purpose
Entry Defaults are reusable templates that store commonly used hours (for manual entries) or punch ranges (for advanced entries), letting you apply consistent time patterns with one click instead of typing the same values repeatedly. Perfect for regular schedules where you work the same hours most days, entry defaults eliminate repetitive data entry. Each default can optionally pin a specific hour type, overriding your current selection when applied. Defaults work with both manual (basic) and advanced (punch-based) entry modes, and you can apply them from the Time Entry form or directly from the calendar via right-click context menu.

**Important:** Defaults are templates. Applying a default fills the form with the saved values, but you still need to save the entry manually (except when using calendar right-click, which saves automatically).

## Enabling Entry Defaults

**Requires:** *Enable default hours for time entries* feature flag

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Time Entries** group.
4. Enable *Enable default hours for time entries*.
5. Click **Save Settings**.
6. The **Create Default**, **Enter Default**, and **Edit Defaults** buttons appear on the Time Entry page.

## Understanding Defaults

Entry defaults come in two types corresponding to the two entry modes:

### Basic (Manual) Defaults

Store a single total hours value.

**Contains:**
- Name
- Total hours (e.g., 7.5)
- Optional pinned hour type

**Use case:** You work 7.5 hours most days. Create a "Standard Day" default with 7.5 hours, then apply it with one click instead of typing 7.5 every time.

### Advanced (Punch) Defaults

Store multiple punch ranges.

**Contains:**
- Name
- List of punch ranges (e.g., 09:00-12:00, 13:00-17:00)
- Optional pinned hour type

**Use case:** You work 09:00-12:00 and 13:00-17:00 most days. Create a "Typical Schedule" default with those punches, then apply it to instantly fill the punch list.

**Important:** Advanced defaults clone punch ranges when applied. Editing the applied entry does not change the saved default template.

## Creating a Default

### Creating a Basic (Manual) Default

1. Navigate to the **Time Entry** page.
2. Ensure the **Basic** tab is selected.
3. Enter your typical total hours in the "Total hours" field (e.g., 7.5).
4. Optionally select a **Hour type** if you want this default to always use that type.
5. Click **Create Default** (appears when default hours feature is enabled).
6. The Create Default modal opens.
7. Enter a **Name** for this default (e.g., "Full Day", "Standard Hours", "Short Day").
8. The **Hour type** dropdown shows if hour types are enabled:
   - Leave blank to use whatever hour type is currently selected when you apply the default
   - Select a specific hour type to pin it - the default will override your current selection with this type
9. Click **Save Default**.

The default is saved and appears in your defaults list.

### Creating an Advanced (Punch) Default

1. Navigate to the **Time Entry** page.
2. Ensure the **Advanced** tab is selected.
3. Enter your typical punch ranges in the punch list (e.g., 09:00-12:00, 13:00-17:00).
4. Optionally select a **Hour type** if you want this default to always use that type.
5. Click **Create Default** (appears when default hours feature is enabled).
6. The Create Default modal opens.
7. Enter a **Name** for this default (e.g., "Standard Workday", "Morning Shift", "Training Day").
8. The **Hour type** dropdown shows if hour types are enabled (same pinning behaviour as basic defaults).
9. Click **Save Default**.

The default is saved with all your punch ranges cloned into the template.

**Validation:**
- Basic defaults require total hours > 0
- Advanced defaults require at least one complete punch range (with both in and out times)

## Applying a Default

### Method 1: From the Time Entry Form

**Single default (auto-apply):**

1. Navigate to the Time Entry page.
2. Select the correct entry mode tab (Basic or Advanced) matching your default type.
3. Click **Enter Default**.
4. If you have only one default of that type, it applies immediately, filling the form.
5. Adjust the date, contract, or hours if needed.
6. Click **Add Entry** (or **Save Entry**) to save.

**Multiple defaults (selection modal):**

1. Navigate to the Time Entry page.
2. Select the correct entry mode tab matching your defaults.
3. Click **Enter Default**.
4. If you have multiple defaults of that type, a selection modal opens.
5. Click the default you want to apply.
6. The form fills with the default's values.
7. Adjust as needed, then save.

**Important:** Applying a default fills the form but does not create the entry. You must still select a contract (if not already selected) and click save.

### Method 2: From the Calendar (Right-Click Context Menu)

**Quick application with auto-save:**

1. Navigate to the **Dashboard & Calendar** or **Time Entry** page.
2. Right-click a date on the calendar.
3. The context menu appears with an **Enter Default** option (if defaults exist).
4. Hover over **Enter Default** to see a submenu listing all your defaults.
5. Click the default you want to apply.
6. Tempus applies the default and immediately saves the entry if all required fields are valid.
7. The calendar updates to show the new entry.

**Requirements for auto-save:**
- A valid contract must be available for the selected date
- If multiple contracts are valid and you have a default contract preference, it uses that
- If hour types are required and the default doesn't pin a type, auto-save may fail

**Use case:** Fast batch entry. Right-click multiple dates, apply your "Standard Day" default each time, and entries are created instantly without opening the full entry form.

## Managing Defaults

### Viewing Your Defaults

1. Navigate to the **Time Entry** page.
2. Click **Edit Defaults** (appears when default hours feature is enabled).
3. The Edit Defaults modal opens, listing all your defaults.

**Each default shows:**
- **Name**
- **Type badge:** "Basic" or "Advanced"
- **Details:** Total hours (for basic) or punch count (for advanced)
- **Hour type:** If pinned, shows the hour type name
- **Edit and Delete buttons**

### Editing a Default

1. Open the **Edit Defaults** modal.
2. Click on the default you want to edit.
3. The Edit Default Details modal opens.
4. Modify:
   - **Name:** Change the default's display name
   - **Hour type:** Change or remove the pinned hour type
   - **Hours or punches:** For basic defaults, change total hours; for advanced defaults, add/remove/modify punch ranges
5. Click **Save Changes**.
6. The default updates with optimistic UI (updates immediately, persists in background).

**Note:** Editing a default does not affect entries already created using that default. It only changes future applications of the template.

### Deleting a Default

1. Open the **Edit Defaults** modal.
2. Find the default you want to delete.
3. Click the **Delete** button (trash icon).
4. Confirm the deletion (inline confirmation within the modal).
5. The default is removed from your list.

**Note:** Deleting a default does not affect entries already created using it. It only removes the template from future use.

## Pinned Hour Types

Defaults can optionally pin a specific hour type, which changes how they apply:

### Unpinned Hour Type (Blank)

**Behaviour:** The default uses whatever hour type is currently selected in the entry form when you apply it.

**Example:**
- You have a default with 7.5 hours and no pinned hour type
- You select "Work" hour type in the form, then apply the default → entry gets 7.5 hours with "Work" type
- You select "Leave" hour type in the form, then apply the same default → entry gets 7.5 hours with "Leave" type

**Use case:** One default works for multiple hour types. Your "Standard Day" can apply to both work days and leave days.

### Pinned Hour Type

**Behaviour:** The default overrides the currently selected hour type in the form with its pinned type when applied.

**Example:**
- You have a default with 7.5 hours and "Leave" pinned
- You select "Work" hour type in the form, then apply this default → entry gets 7.5 hours with "Leave" type (overridden)
- The hour type dropdown changes to "Leave" when the default applies

**Use case:** Specific defaults for specific types. Your "Annual Leave" default always applies with "Leave" hour type, ensuring you never accidentally log leave as work.

## Defaults vs Bulk Entries vs Recurring Entries

| Feature | Defaults | Bulk Entries | Recurring Entries |
|---------|----------|--------------|-------------------|
| **Automatic creation** | No (manual apply) | Yes (generates entries) | Yes (generates future entries) |
| **Saves entries** | No (fills form only, except calendar right-click) | Yes | Yes |
| **Flexibility** | High (adjust before saving) | Medium (batch settings) | Low (automated schedule) |
| **Use case** | Varying dates with common hours | Consistent hours across a date range | Automated weekly/fortnightly entries |
| **Repetition** | Apply manually each time | One config creates all | Automated on schedule |
| **Contract requirement** | Can apply without contract, save requires it | Requires contract upfront | Requires contract upfront |

**When to use Defaults:**
- You work consistent hours but on varying dates (not every day)
- You want to review/adjust before saving
- You have multiple common patterns (morning shift, evening shift, etc.)
- You're catching up on time tracking in batches

**When to use Bulk Entries:**
- You need the same hours for consecutive days (holiday, training)
- You want automatic exclusion of weekends/holidays
- You're filling a large date range at once

**When to use Recurring Entries:**
- You work the same hours on the same day(s) every week/fortnight
- You want fully automated entry creation
- You have a predictable ongoing schedule

## Validation and Requirements

Tempus validates defaults before saving:

### Name Requirement
- **Must have:** A non-empty name
- **Error if:** Name field is blank

### Duration Requirement (Basic Defaults)
- **Must be:** Total hours > 0
- **Error if:** Hours ≤ 0 or blank

### Punch Requirement (Advanced Defaults)
- **Must have:** At least one complete punch range (with both in and out times)
- **Error if:** All punches are incomplete or punch list is empty

### Contract Requirement (When Applying)
- **Must have:** A valid contract selected before saving an applied default
- **Behaviour:** You can apply a default without a contract, fill the form, then select a contract before saving
- **Calendar right-click auto-save:** Requires a valid contract for the selected date; fails silently if no contract available

## Tips for Using Entry Defaults

- **Name descriptively:** Use names that clearly describe the pattern. "Full Day (7.5h)" is better than "Default 1".
- **Create multiple defaults:** Don't rely on one. Have "Full Day", "Half Day", "Short Day", "Morning Shift", etc.
- **Pin hour types strategically:** Pin types for leave/training defaults to avoid accidentally logging them as work. Leave work defaults unpinned for flexibility.
- **Use calendar right-click for speed:** If you're catching up on multiple days with the same hours, right-click each date and apply the default. Entries save automatically.
- **Edit defaults instead of deleting:** If your schedule changes (e.g., now 8 hours instead of 7.5), edit the existing default rather than creating a new one.
- **Combine with contracts:** Defaults don't include contracts. Select the contract first, then apply the default for fastest entry.
- **Advanced defaults for complex schedules:** If you take the same lunch break every day (09:00-12:00, 13:00-17:00), use an advanced default rather than manually entering those punches daily.
- **Check the form after applying:** Defaults fill the form, but you can still adjust hours, punches, or hour types before saving.
- **Delete unused defaults:** If a default becomes irrelevant (temporary project ended, schedule changed), delete it to keep your list clean.
- **Review pinned types before applying:** If a default has a pinned hour type, it will override your selection. Check the hour type dropdown after applying to ensure it's correct.

## Common Defaults Questions

### Can I create a default without entering a time entry first?
Sort of. Defaults are created from the entry form after you've filled in the hours or punches. The "Create Default" button captures whatever is currently in the form, so you don't need to submit the time entry, but you do have to populate it.

### How many defaults can I have?
There's no hard limit. You can create as many basic and advanced defaults as you need. However, too many defaults makes the selection modal unwieldy. Aim for 3-5 commonly used patterns.

### Do defaults work across devices?
Yes, if you're logged into the same Google account. Defaults are saved to Google Sheets and synchronise across all devices accessing the same Tempus deployment.

### Can I convert a basic default to an advanced default (or vice versa)?
No. Basic and advanced defaults are separate types. Create a new default of the desired type and delete the old one if needed.

### What happens if I delete a default I've used to create many entries?
Nothing. Deleting a default removes the template but does not affect entries already created using it. Those entries remain unchanged in your data.

### Can I apply a basic default whilst in advanced mode?
Yes. The "Enter Default" menu shows all defaults (both basic and advanced) regardless of which tab you're currently on. When you apply a default, Tempus automatically switches to the correct entry mode tab to match the default type.

### Why doesn't my default appear in the calendar right-click menu?
Check:
- **Default hours feature flag** is enabled
- You have created at least one default
- The default exists (check Edit Defaults to verify)

If defaults exist but the menu doesn't show them, it may be a caching issue. Refresh the page.

### Can I edit a default to change its type (basic to advanced)?
No. The default type is fixed when created. To change types, delete the default and create a new one in the desired mode with the new values.

### What happens if I apply a default with a pinned hour type but that hour type no longer exists?
The default applies but falls back to the default hour type. If the pinned hour type was deleted from your hour types list, the default effectively becomes unpinned.

### Can I apply multiple defaults to the same day?
Not directly. Each application overwrites the form. However, if you use different hour types, you can create multiple entries for the same day (one per hour type) by applying different defaults sequentially.

### Do defaults respect my rounding interval setting?
Yes. When you save an entry created from a default, the hours are rounded according to your configured rounding interval, just like any manual entry.

## Summary

Entry Defaults save reusable time patterns for instant application. Create basic defaults for common total hours or advanced defaults for typical punch schedules. Apply from the entry form or calendar right-click menu, optionally pinning hour types for automatic override. Defaults speed up repetitive entry without sacrificing flexibility.

For automated range filling, see [Bulk Time Entries documentation](time-entry-bulk.md). For scheduled recurring entries, see [Recurring Time Entries documentation](time-entry-recurring.md).
