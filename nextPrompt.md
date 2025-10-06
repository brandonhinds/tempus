The next things we want to include:

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

- Add the ability to add salary sacrifice options, as well as a novated lease.

- Have a configurable number of hours that can be tracked, with the default one being work. Have the ability to have multiple "work" hours. If there is more than one type of hours then have a dropdown that displays all the choices, defaulting to work.
    * Have this behind a feature flag

- Add the invoice requirements (all behind feature flags)

- Add a thinkStack employee feature flag, which will do things like include the lost super in the expected pay

- Add BAS tracking
    * Enable both monthly and quarterly payments

- Add ability to switch months using a date picker (with just months and years)

- Add ability to add actual pay for comparison

- Update some settings to force a cache flush when enabled or updated (e.g the superannuation percentage)

- Remove the New Entry button from the entries list at the bottom of the sheet.

- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.

- Add Xero reporting mode

- Make it clear that the "Save Settings" button needs to be clicked when settings are updated. The theme, for example switches immediately, even though it has not be saved.

- It looks like defaults_hours are not being saved in the backend, so moving to a new browser or clearing your cache likely removes them.


---

Hour Types Feature - Phase 2 Implementation

  I'm continuing work on an advanced hour types feature for a Google Apps Script timesheet application. The core hour types functionality has been fully implemented and is working, but there are three specific issues that need to be addressed:

  Current State Summary

  - ✅ Hour types feature is fully implemented with CRUD operations, calendar visualization, and income calculations
  - ✅ Feature flag hour_types controls the functionality
  - ✅ Calendar shows default hour type as large number, other types as small colored indicators
  - ✅ Income calculations only include hour types that contribute to income
  - ✅ Entry forms have hour type dropdowns between date and contract fields
  - ✅ Built-in "Work" hour type that cannot be deleted
  - ✅ Hour types have configurable colors, income contribution, and default status

  Three Issues to Fix:

  1. Multiple Entries Per Day Support

  Problem: Currently only one time entry per day is allowed. When clicking a calendar cell with existing data, it pre-loads the edit screen. With multiple hour types, users should be able to add multiple entries per day (one per hour type).

  Requirements:
  - Allow multiple entries per day as long as they use different hour types
  - Prevent duplicate entries for the same hour type on the same day
  - Update calendar click handler to show a selection/creation interface when multiple entries exist
  - Maintain backward compatibility for single-entry days

  2. Contract UI Logic Issue

  Problem: Hour type dropdown shows "Not required" for non-income hour types, but the contract dropdown later shows as "the only valid contract" instead of remaining optional.

  Root Cause: Likely the backend data is blank/null, causing the UI to fall back to default contract selection logic.

  Requirements:
  - Fix contract dropdown to remain truly optional when hour type doesn't contribute to income
  - Ensure backend properly handles null/empty contract_id for non-income hour types
  - Verify form validation allows submission without contract for non-income types

  3. Calendar Hour Type Filtering

  Problem: Calendar always shows all hour types. Users need ability to filter/toggle visibility.

  Requirements:
  - Add toggle/filter controls to calendar interface
  - Allow showing/hiding specific hour types on calendar
  - Possibly implement "billable only" vs "all time" toggle
  - Maintain filter state across calendar navigation
  - Update month totals to reflect active filters

  Technical Context:

  - Files involved: views/partials/scripts.html, views/partials/dashboard.html, backend/entries.gs
  - Hour types stored in state.hourTypes and state.hourTypeMap
  - Calendar rendering in renderCalendar() function
  - Entry forms use getManualPayload() and validation logic
  - Feature flag: hour_types controls all functionality

  Please analyze the current implementation and fix these three issues, maintaining the existing functionality while adding the requested enhancements.