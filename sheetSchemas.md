# Sheet Schemas

## user_settings
Google Apps Script persists user preferences as key/value pairs. Values are written exactly as provided by the client UI but normalised to strings or numbers before storage.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `key` | string | Setting identifier. Must be unique per sheet. | `round_to_nearest` |
| `value` | string/number | Stored value. Numbers (e.g., rounding increments) remain unquoted. | `5` |
| `type` | string | Primitive type recorded when the value was saved (`string`, `number`, `boolean`). | `number` |

### Known keys
- `round_to_nearest` (number) - Minute increment used when rounding manual or timer entries client-side.
- `theme` (string) - UI theme identifier (`dark`, `light`, `rose`, `og`).
- `superannuation_rate` (number) - Percentage used when deriving income + payroll summaries. Stored as a whole-number percent (e.g., `12` => 12%).

### Suggested improvements
- Maintain a canonical enum of allowed keys in the client to prevent accidental misspellings (e.g., `round_to_nearest`, `theme`).
- When writing numeric settings, coerce to integers client-side and reject negative values before persisting. Clamp `superannuation_rate` to a sensible range (e.g., 0-30%) before saving.

## timesheet_entries
Every row represents a single time entry. Server APIs normalise dates to ISO-8601 strings (`yyyy-MM-dd`) and times to `HH:mm`. `created_at` is stored in UTC.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side (`Utilities.getUuid`). | `19f40595-b8a0-489f-8ad8-ea3348593068` |
| `date` | string (ISO) | Work date in `yyyy-MM-dd`. | `2025-09-30` |
| `start_time` | string (HH:mm) | Earliest punch-in time for the entry (basic total-hours rows intentionally leave this blank). | `08:10` |
| `end_time` | string (HH:mm) | Latest punch-out time for the entry (basic total-hours rows intentionally leave this blank). | `17:10` |
| `duration_minutes` | number | Sum of all closed punch ranges in whole minutes. Derived server-side to prevent tampering. | `525` |
| `break_minutes` | number | Legacy break tracking retained for backward compatibility. New punch-based entries persist `0`. | `0` |
| `contract_id` | string (UUID) | References the contract active on the entry date. | `a5e42da1-7b66-4aa0-9df0-aeae6402fd5a` |
| `created_at` | string (ISO datetime, UTC) | Timestamp recorded when the entry was created server-side. | `2025-09-30T09:29:58Z` |
| `punches_json` | string (JSON) | JSON-encoded array of punch objects: `[{"in":"HH:mm","out":"HH:mm"}]`. `out` may be blank for an open punch. | `[{"in":"08:10","out":"12:05"},{"in":"12:40","out":"17:10"}]` |
| `entry_type` | string | Entry mode used: `basic` for total-hours entries, `advanced` for punch-based entries. | `basic` |

### Suggested improvements
- Enforce non-empty `date` client-side and ensure every punch range has both `in`/`out` set before submission (open punches are permitted but excluded from totals).
- Derive `duration_minutes` server-side from `punches_json` so edits through the UI remain authoritative even if cached data drifts.
- Validate that `contract_id` exists in the contracts sheet before persisting new rows.
- Consider adding a separate audit sheet for punch adjustments if regulatory requirements demand a full punch history.

### Manual entry compatibility
- Manual edits should serialise punches exactly as the punch workflow: one row per day/contract with `punches_json` holding an ordered array of `{ "in": "HH:mm", "out": "HH:mm" }` pairs.
- For single-block days the array contains one object (e.g., `[{"in":"08:30","out":"17:00"}]`). Multiple breaks become separate objects to avoid relying on `break_minutes`.
- Leave `out` empty (`""`) while a punch is in progress; the backend will exclude it from `duration_minutes` but surface a warning in the UI so the user can close the range.
- For basic (total-hours) entries, store a single punch from `00:00` to the total elapsed time and set `break_minutes` to the user-specified break so reports can continue to deduct it.

## contracts
Contracts describe a billable agreement and govern whether time can be logged for a given date. Dates are inclusive and stored in ISO `yyyy-MM-dd` format.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side. | `a5e42da1-7b66-4aa0-9df0-aeae6402fd5a` |
| `name` | string | Human-readable contract name. | `Acme Support Retainer` |
| `start_date` | string (ISO) | First day the contract is valid. | `2025-01-01` |
| `end_date` | string (ISO) | Last day the contract is valid. Blank indicates open-ended. | `2025-12-31` |
| `hourly_rate` | number | Billing rate in the sheet's currency units. | `125.00` |
| `total_hours` | number | Optional cap on total hours allowed for the engagement. `0` means unlimited. | `160.0` |
| `created_at` | string (ISO datetime, UTC) | Timestamp recorded when the contract row was created server-side. | `2024-05-06T10:15:00Z` |

### Suggested improvements
- Add validation to ensure contracts do not overlap unintentionally.
- Track additional metadata such as client codes or billing notes when needed.
- Continue blocking deletions when contracts have associated time entries so historical data remains intact.

## feature_flags
Feature flags gate optional behaviours. Each row records a single flag and its current state. The backend normalises booleans to `TRUE` / `FALSE` strings for Apps Script compatibility while the client treats them as JavaScript booleans.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `feature` | string | Unique flag identifier. | `remember_last_page` |
| `enabled` | boolean/string | `TRUE`/`FALSE` indicating whether the flag is active. | `TRUE` |
| `name` | string | Human-friendly title displayed in the UI. | `Remember last page on refresh` |
| `description` | string | Additional context rendered under the title. | `When enabled, the app reopens on the most recently viewed page.` |

### Suggested improvements
- Add created/updated timestamps if we need historical auditing of flag changes.
- Keep feature identifiers kebab- or snake-cased so the client can map them safely to object keys.
- Expand the sheet with owner and rollout metadata once multiple flags are in play.
