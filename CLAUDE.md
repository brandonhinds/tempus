# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Apps Script timesheet application that uses Google Sheets as its database. The app features sophisticated time tracking with punch-in/out functionality, contract management, and income/payroll calculations. Performance is the top priority with strong caching and optimistic UI updates.

## Development Commands

### Deployment
- `clasp push` - Sync local files to Google Apps Script
- **IMPORTANT: Never run `clasp push` automatically. The user will run deployment commands themselves.**
- Deploy through Apps Script console after pushing changes
- Test via the web app preview URL

### Manual Testing
No automated test suite exists. After significant changes:
1. Load the Apps Script web preview
2. Test core flows: add/edit/delete entries, contract management
3. Verify cached UI state persists after page reloads
4. Test date/time edge cases across different timezones
5. Monitor execution with `Logger.log` for server debugging

## Architecture

### Project Structure
- `backend/` - Google Apps Script server code (`.gs`, `.ts.gs` files)
  - `webapp.gs` - Main web app entry point and HTML templating
  - `entries.gs` - Time entry API endpoints and data normalization
  - `contracts.gs` - Contract management APIs
  - `cache.gs` - Caching utilities for performance
  - `settings.gs` - User settings persistence
  - `tax.gs` - Tax calculation utilities
  - `sheets.ts.gs` - Sheet manipulation helpers
- `views/` - HTML templates and client-side code
  - `index.html` - Main web app template
  - `partials/` - Modular HTML components (head, navbar, dashboard, contracts, settings, scripts)
- `index.html` - Standalone prototype (reference only, don't modify)

### Data Architecture
The app uses Google Sheets with these main sheets:
- `timesheet_entries` - Time tracking data with punch-based JSON storage
- `contracts` - Billable agreements with date ranges and rates
- `user_settings` - Key-value user preferences
- `feature_flags` - Toggle optional behaviors

### API Design
Backend functions follow the `api_*` naming convention (e.g., `api_getEntries`, `api_addContract`). All APIs use normalized data objects and handle caching automatically.

### Time Entry System
The core system supports two modes:
- **Advanced mode**: Punch-based tracking with JSON-serialized punch ranges `[{"in":"08:10","out":"17:10"}]`
- **Basic mode**: Total hours entry with single midnight-based punch
- Duration is always server-calculated from closed punches
- Open punches (missing `out` time) are excluded from totals but trigger UI warnings

### Caching Strategy
- Server-side caching via `cacheSet`/`cacheGet` with prefixed keys
- Client-side browser storage for UI responsiveness
- Cache invalidation on data mutations via `cacheClearPrefix`
- Optimistic UI updates with background sync

## Coding Conventions

### Style Guidelines
- Use 2-space indentation for JS/HTML/CSS
- Client code: prefer `const`/`let`
- Server code: use `var` for Apps Script compatibility
- Function naming: `api_*` for endpoints, verb-first for utilities (e.g., `cacheSet`, `getOrCreateSheet`)
- Binary configuration controls must use the shared `.ts-toggle` styling; avoid introducing checkbox UI for toggles.
- Layout containers: default to the 1280px `.ts-container`; apply `.ts-container--fluid` only when content truly needs to be extra wide (currently just BAS reporting).
- Deletion confirmations inside modals must be implemented inline within that modal's content; never spawn a secondary modal on top of an existing modal for confirmation.

### Data Handling
- Dates: ISO format `yyyy-MM-dd`
- Times: 24-hour format `HH:mm`
- Timestamps: UTC ISO format `yyyy-MM-ddTHH:mm:ssZ`
- All user input is normalized server-side before persistence

### Feature Flags
Reference `featureFlags.md` for current flags. Use snake_case identifiers and update both the sheet schema and documentation when adding new flags.

**IMPORTANT:** When adding a new feature flag, you must add it to THREE places:
1. `featureFlags.md` - Documentation file with the flag description
2. `DEFAULT_FEATURE_FLAGS` object in `views/partials/scripts.html` (around line 4028) - This makes it appear in the Settings page UI with name, description, and order
3. The feature flag sheet schema in Google Sheets (handled by `api_setFeatureFlag` in `backend/settings.gs`)

## Important Documentation

- `context.md` - Product requirements and feature specifications
- `sheetSchemas.md` - Complete database schema with column definitions
- `AGENTS.md` - Codex's version of this `CLAUDE.md` file, and needs to be updated whenever this file is updated.
- `featureFlags.md` - Current feature flag definitions

Keep these docs synchronized when making architectural changes.

## Contract & Time Entry Validation

- Every time entry must reference a valid contract via `contract_id`
- Contract date ranges are inclusive and enforce entry date boundaries
- Contracts with existing entries cannot be deleted (referential integrity)
- Punch times are validated to prevent negative durations

## Performance Considerations

- Initial load can take time but subsequent cached loads must be <1 second
- UI should allow immediate input even during backend sync
- Use background API calls with loading states for better UX
- Clear error messaging when Google Sheets API is unavailable

## Testing Focus Areas

When modifying time/date logic, always test:
- Different timezone scenarios
- Empty/null start/end times
- Zero-duration submissions
- ISO formatting consistency
- Contract date boundary validation
