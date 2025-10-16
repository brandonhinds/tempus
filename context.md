# Tempus

I am making a timesheet app called Tempus. This is going to use Google Sheets as the database, and serving it to a front end, all written in the sheet's app scripts.

Performance is my number one concern, and needs to be built into the app from the very beginning. I need the UI to feel extremely performant, even if the backend takes some time to sync. This means I need strong caching, optimisitic loading, etc.

The app is going to be highly customisable, and very feature rich. Most options will be hidden behind feature flags that a user will be off by default but the user can opt into.

I want it to look like a professional, enterprise ready application.

**Core Architecture & Performance**

1. Expected user scale: How many concurrent users do you anticipate? (This affects caching strategy)
    There will only ever be one user at a time. The sheet is designed so it can be shared to people as they want, and all their data is stored locally in their own drive.
2. Data volume: Roughly how many time entries per user per month? (Impacts pagination and caching needs)
    People will likely enter one or two values per day in a month (e.g. their clock in and clock out times).
3. Real-time requirements: Do multiple users need to see each other's entries in real-time, or is eventual consistency acceptable?
    Eventual consistency is fine, as long as the backend can sync and update the UI seamlessly.
4, Offline capability: Should the app work offline and sync when reconnected?
    Ideally yes, but it is ok if it cannot.

**Feature Scope & Customization**

5. Core time tracking features: What are the essential features? (start/stop timer, manual entry, project/task selection, etc.)
    The core flow is a punch system plus a basic "total hours" mode. Each entry stores an ordered list of punch ranges (serialized as JSON) so users can punch in/out throughout the day or type the ranges manually. The basic mode records a single punch from midnight to the total hours entered. Totals are derived from the closed punches; open punches are ignored until they are closed, with UI warnings prompting the user to finish them. Every entry must still be tied to a contract that is valid for the selected date. Contract management lives on its own page so agreements can be added, edited, or retired independently of the main time-entry flow.
6. Customization depth: How granular should the customization be? (UI themes, field visibility, workflow steps, etc.)
    All those things should be customisable. Theme options (dark, light, rose gold, The OG) should be controllable from Settings, and feature flags (e.g., `remember_last_page`) give us a safe way to roll out optional UX tweaks without disturbing the core flow.
7. User roles: Will there be different user types (employees, managers, admins) with different permissions?
    The one user should be considered a full admin of the system.
8. Integration needs: Any specific integrations needed? (payroll systems, project management tools, etc.)
    No integration is required for now.

**Google Sheets Specific**

9. Sheet structure: Do you have a preferred sheet structure, or should we design one? (separate sheets for users, projects, entries, etc.)
    You can design the sheet structure however you want. It should be maintainable / extendable. Assume anything you create will be scaled further by someone else. Contracts now live in their own sheet and entries reference them by id.
10. Data validation: What level of data validation do you need in the sheets?
    The sheets don't need data validation. The validation shoudl instead be in the front end before it sends it.
11. Backup/recovery: How important is data backup and version history?
    Not important. I will rely on Google Sheets for that.

**Technical Preferences**

12. Frontend framework: Any preference for the frontend? (Vanilla JS, React, Vue, etc.)
    Whatever the UI is currently written in.
13. Mobile support: Should this be mobile-first, desktop-first, or responsive?
    It should be desktop first, but the mobile view needs to be functional for timesheet updating even if the full feature set doesn't work there.
14. Browser support: Any specific browser requirements or limitations?
    Just the normal ones.

**Performance & UX**

15. Loading expectations: What's an acceptable initial load time? What about subsequent interactions?
    The very initial load, with no cache, can take as long as required, however the user should be able to input time immediately. Subsequent loads with a cache should take less than one second.
16. Caching strategy: Are you open to using browser storage, or do you prefer server-side caching only?
    Browser storage is fine as long as it improves performance and will be synced seamlessly with the backend.
17. Error handling: How should the app behave when Google Sheets API is slow or unavailable?
    When the Google Sheets API is unavailable it should report it clearly so the user knows their data is not being saved.

**Income Summary & Payroll Settings**

- The calendar header now includes a `Net income` badge beside `Total hours`; clicking the badge toggles the detailed breakdown. When company tracking is enabled the list begins with `Invoice total` and `Company income`, followed by Total package, Gross income, Superannuation guarantee, Extra super contributions, Pre-tax deductions, Taxable income, Tax, and Net income.
- Contracts now support an optional `total_hours` field that caps the engagement's allowance. Leaving it blank (or saving `0`) keeps the contract unlimited and is stored server-side as `0` for future burndown reporting.
- The Contracts page now surfaces a selector-driven detail panel with a monthly burndown chart for capped agreements (expected vs. actual remaining hours, plus an actual-average projection with overrun warnings) and an unlimited-hours summary that highlights total time logged to date.
- Monthly totals are derived from timesheet entry durations multiplied by the hourly rate of active contracts; when only one valid contract exists for the month we shortcut by applying that rate to the aggregated hours.
- Superannuation defaults to 12% and is configurable via Settings -> Superannuation rate (%). The value is stored per user in `user_settings.superannuation_rate` and is applied across the monthly breakdown.
- The Deductions page lets users configure personal salary sacrifice items, company deductions (when the `enable_company_tracking_features` flag is on), and extra super contributions. Deductions may be one-off or recurring, support GST-inclusive inputs for company expenses, and feed directly into the monthly income breakdown (including "Superannuation lost due to deductions" and extra super totals). A notes field is available now; file attachments will be added in a future iteration.
- Tax estimation uses the shared `estimateTax(grossIncome, currentDate)` helper (see `backend/tax.gs`) and runs asynchronously so the UI remains responsive; failures fall back to showing taxable income without a deduction and flag Tax as unavailable.
- BAS reporting lives on its own page once company tracking is enabled. It defaults to monthly rows across the financial year (Jul–Jun) and can switch to quarterly totals via the `enable_company_quarterly_bas` flag. Each period shows invoice totals (with GST), company income, business expenses, and the employee payroll figures (gross, super, deductions, tax, net). The page uses a widened layout on desktop (up to 1600px) so the BAS table can display all columns without feeling cramped. The supporting `ts-container--fluid` helper is reserved for rare extra-wide layouts; keep other pages on the standard 1280px container.
- A new feature flag, `expected_monthly_hours`, adds a calendar badge that surfaces the average daily hours recorded for the active month. When expanded it breaks the projection down per contract, showing the days included, expected hours remaining, and whether the user is trending ahead or behind their contracted target based on income-contributing hour types only.
- Contracts now expose an "Include weekends in averages" toggle so weekend days can optionally count toward the expected daily baselines used by the badge and related projections. Weekend entries always contribute to the total hours even when weekends are excluded from the day count.
