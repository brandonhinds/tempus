# Sheet Schemas

## user_settings
Google Apps Script persists user preferences as key/value pairs. Values are written exactly as provided by the client UI but normalised to strings or numbers before storage.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `key` | string | Setting identifier. Must be unique per sheet. | `round_to_nearest` |
| `value` | string/number | Stored value. Numbers (e.g., rounding increments) remain unquoted. | `5` |
| `type` | string | Primitive type recorded when the value was saved (`string`, `number`, `boolean`). | `number` |

### Suggested improvements
- Maintain a canonical enum of allowed keys in the client to prevent accidental misspellings.
- When writing numeric settings, coerce to integers client-side and reject negative values before persisting.

## timesheet_entries
Every row represents a single time entry. Server APIs normalise dates to ISO-8601 strings (`yyyy-MM-dd`) and times to `HH:mm`. `created_at` is stored in UTC.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side (`Utilities.getUuid`). | `19f40595-b8a0-489f-8ad8-ea3348593068` |
| `date` | string (ISO) | Work date in `yyyy-MM-dd`. | `2025-09-30` |
| `start_time` | string (HH:mm) | Local start time captured by the client. | `08:10` |
| `end_time` | string (HH:mm) | Local end time. | `17:10` |
| `duration_minutes` | number | Whole minutes of work after subtracting breaks, rounded by the client before submission. | `525` |
| `break_minutes` | number | Minutes withheld from the shift (e.g., lunch). Defaults to `0`. | `15` |
| `contract_id` | string (UUID) | References the contract active on the entry date. | `a5e42da1-7b66-4aa0-9df0-aeae6402fd5a` |
| `created_at` | string (ISO datetime, UTC) | Timestamp recorded when the entry was created server-side. | `2025-09-30T09:29:58Z` |

### Suggested improvements
- Enforce non-empty `date`, `start_time`, and `end_time` client-side with validation messages before submission.
- Derive `duration_minutes` server-side from `start_time`/`end_time` and the stored `break_minutes` to prevent tampering, while still letting the client show the optimistic value.
- Validate that `contract_id` exists in the contracts sheet before persisting new rows.

## contracts
Contracts describe a billable agreement and govern whether time can be logged for a given date. Dates are inclusive and stored in ISO `yyyy-MM-dd` format.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side. | `a5e42da1-7b66-4aa0-9df0-aeae6402fd5a` |
| `name` | string | Human-readable contract name. | `Acme Support Retainer` |
| `start_date` | string (ISO) | First day the contract is valid. | `2025-01-01` |
| `end_date` | string (ISO) | Last day the contract is valid. Blank indicates open-ended. | `2025-12-31` |
| `hourly_rate` | number | Billing rate in the sheet's currency units. | `125.00` |
| `created_at` | string (ISO datetime, UTC) | Timestamp recorded when the contract row was created server-side. | `2024-05-06T10:15:00Z` |

### Suggested improvements
- Add validation to ensure contracts do not overlap unintentionally.
- Track additional metadata such as client codes or billing notes when needed.
- Continue blocking deletions when contracts have associated time entries so historical data remains intact.

## feature_flags (future use)
The sheet exists but is currently empty and unsupported by the deployed code. If reintroduced, the expected columns are:

| Column | Type | Description |
| --- | --- | --- |
| `feature` | string | Unique flag identifier. |
| `enabled` | boolean/string | `TRUE`/`FALSE` or textual equivalent. |
| `description` | string | Human-readable explanation of the flag. |

### Suggested improvements
- Keep this sheet disabled until feature flags are required again to avoid stale state.
- When reactivated, normalise booleans to `TRUE`/`FALSE` and add client-side toggles that persist through the `api_updateSettings` flow.
