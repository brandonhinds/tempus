# Repository Guidelines

## Project Structure & Module Organization
- `backend/` holds Google Apps Script server code (`*.gs`, `*.ts.gs`). Each file exposes API-style functions (e.g., `api_getEntries`) that Apps Script publishes to the web app. Keep new server logic modular and pure where possible.
- `views/` contains the HTML partials used by the deployed template (`views/index.html`). Client interactivity lives in `views/partials/scripts.html` and should remain framework-free vanilla JS.
- `index.html` is a standalone prototype kept for reference; do not wire new features there unless explicitly requested.
- `context.md`, `sheetSchemas.md`, and related markdowns document product expectations. Update these alongside functional changes.
- `claude.md` is Claude's version of this `AGENTS.md` file, and it should be updated whenever this file is updated.

## Build, Test, and Development Commands
- There is no local build step; deploy by syncing the workspace with Google Apps Script (e.g., via `clasp push`) after validating changes, then publish the web app.
- To exercise APIs, load the Apps Script web preview, trigger flows (e.g., add an entry), and monitor execution logs with `Logger.log` for server output. Manual smoke tests are required after each significant change.

## Coding Style & Naming Conventions
- Use two-space indentation for JS/HTML/CSS to match existing files.
- Functions in `backend/` follow `api_*` or verb-first names (`cacheSet`, `getOrCreateSheet`). Preserve this when adding endpoints so the public surface stays predictable.
- Prefer `const`/`let` on the client and stick to `var` on the server to maintain Apps Script compatibility.
- Keep inline comments short and intent-focused; explain non-obvious decisions rather than restating code.
- Configurable UI toggles must use the `.ts-toggle` switch styling; do not introduce plain checkboxes for binary settings.
- Layout containers: stick with the 1280px-capped `.ts-container`; reach for `.ts-container--fluid` only in rare cases where a page (e.g., BAS reporting) genuinely needs the extra width.
- When presenting destructive actions inside modals, confirmations must be handled inline within the modal content (e.g., swap the button row for confirm/cancel). Opening another modal on top of a modal is not allowed.

## Testing Guidelines
- No automated suite exists. Verify manually in the deployed preview: create, edit, and delete entries, and confirm cached UI state stays in sync after page reloads.
- When touching date or duration logic, test across different time zones and edge cases (empty start/end times, zero-duration submissions) to ensure ISO formatting remains stable.
- Record manual test notes in pull requests until automated coverage is introduced.

## Commit & Pull Request Guidelines
- Use imperative, scope-focused commit subjects (e.g., `Normalize entry timestamps`); avoid bundling unrelated changes.
- Pull requests should outline the user-visible impact, list touched sheets or scripts, and include manual test evidence. Attach screenshots or GIFs for UI updates.
- When behaviour or architecture shifts, update all affected docs (`context.md`, `sheetSchemas.md`, `AGENTS.md`, `featureFlags.md`, etc.) within the same PR so future contributors stay in sync.
- Reference relevant context or planning docs when applicable so reviewers can trace decisions quickly.

## Feature Flags
- Feature flags are documented in `featureFlags.md` and use snake_case identifiers.
- **IMPORTANT:** When adding a new feature flag, you must add it to THREE places:
  1. `featureFlags.md` - Documentation file with the flag description
  2. `DEFAULT_FEATURE_FLAGS` object in `views/partials/scripts.html` (around line 4028) - This makes it appear in the Settings page UI with name, description, and order
  3. The feature flag sheet schema in Google Sheets (handled by `api_setFeatureFlag` in `backend/settings.gs`)
- The UI toggle for feature flags is automatically generated from the `DEFAULT_FEATURE_FLAGS` object, so skipping step 2 will result in the flag not appearing in Settings.
