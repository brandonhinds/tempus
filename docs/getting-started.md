# Getting Started with Tempus

- Purpose: quick primer on what Tempus is, where data lives, and how to navigate.
- Audience: new users or teammates previewing the app.

## What Tempus Is
- Desktop-first timesheet app backed by Google Sheets; Apps Script serves data to a vanilla JS UI.
- Single-user by design; every copy runs on the user’s own Drive.
- Performance-first: heavy use of local cache and optimistic updates.

## Where Things Live
- Data: Google Sheets (entries, contracts, settings, feature flags, deductions, invoices, BAS, etc.).
- Backend: `backend/*.gs` Apps Script functions.
- Frontend: `views/partials/*.html` rendered into the main template.
- Cache: browser local storage; status badge shows current state.

## Core Pages
- Time Entry: manual (basic) and punch (advanced) entry, defaults, calendar context menu.
- Contracts: manage engagements that entries attach to.
- Dashboard/Calendar: month view with hours, income badges, context menu.
- Annual Views: yearly summaries.
- Settings: feature flags, themes, hour types, cache controls, etc.
- (Flagged) Invoices, BAS, Payroll helpers, Recurring/Bulk/Import tools.

## Navigation Basics
- Header menu toggles to show page links; use Time Entry for day-to-day logging.
- Calendar right-click opens defaults when `default_inputs` is enabled.
- Status badge reflects cache state; use clear-cache (flagged) if UI is stale.

## Dependencies & Flags
- Many capabilities are gated behind feature flags; see `docs/feature-flags.md` for details before expecting a control to appear.

