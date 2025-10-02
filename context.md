# Timesheet App

I am making a timesheet app. This is going to use Google Sheets as the database, and serving it to a front end, all written in the sheet's app scripts.

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
    Start stop timers and manual entry are essential. Entries capture start and stop times plus an optional break duration that gets subtracted from total work time.
6. Customization depth: How granular should the customization be? (UI themes, field visibility, workflow steps, etc.)
    All those things should be customisable.
7. User roles: Will there be different user types (employees, managers, admins) with different permissions?
    The one user should be considered a full admin of the system.
8. Integration needs: Any specific integrations needed? (payroll systems, project management tools, etc.)
    No integration is required for now.

**Google Sheets Specific**

9. Sheet structure: Do you have a preferred sheet structure, or should we design one? (separate sheets for users, projects, entries, etc.)
    You can design the sheet structure however you want. It should be maintainable / extendable. Assume anything you create will be scaled further by someone else.
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
