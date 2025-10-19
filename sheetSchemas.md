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
- `theme` (string) - UI theme identifier (`dark`, `light`, `og`, `rose`, `sierra117`, `protanopia`, `deuteranopia`, `tritanopia`, `monochrome`).
- `superannuation_rate` (number) - Percentage used when deriving income + payroll summaries. Stored as a whole-number percent (e.g., `12` => 12%).
- `payg_instalment_rate` (number) - PAYG instalment rate used for BAS T2 calculations. Stored as a whole-number percent (e.g., `2` => 2%). Defaults to `2`.
- `public_holiday_state` (string) - Australian state/territory code for filtering public holidays (`ACT`, `NSW`, `NT`, `SA`, `TAS`, `WA`, `VIC`, `QLD`). Defaults to `ACT`.

### Suggested improvements
- Maintain a canonical enum of allowed keys in the client to prevent accidental misspellings (e.g., `round_to_nearest`, `theme`).
- When writing numeric settings, coerce to integers client-side and reject negative values before persisting. Clamp `superannuation_rate` to a sensible range (e.g., 0-30%) before saving.

## timesheet_entries
Every row represents a single time entry. Server APIs normalise dates to ISO-8601 strings (`yyyy-MM-dd`) and times to `HH:mm`. `created_at` is stored in UTC.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side (`Utilities.getUuid`). | `19f40595-b8a0-489f-8ad8-ea3348593068` |
| `date` | string (ISO) | Work date in `yyyy-MM-dd`. | `2025-09-30` |
| `duration_minutes` | number | Sum of all closed punch ranges in whole minutes. Derived server-side to prevent tampering. | `525` |
| `contract_id` | string (UUID) | References the contract active on the entry date. May be empty for hour types that don't require contracts. | `a5e42da1-7b66-4aa0-9df0-aeae6402fd5a` |
| `created_at` | string (ISO datetime, UTC) | Timestamp recorded when the entry was created server-side. | `2025-09-30T09:29:58Z` |
| `punches_json` | string (JSON) | JSON-encoded array of punch objects: `[{"in":"HH:mm","out":"HH:mm"}]`. `out` may be blank for an open punch. | `[{"in":"08:10","out":"12:05"},{"in":"12:40","out":"17:10"}]` |
| `entry_type` | string | Entry mode used: `basic` for total-hours entries, `advanced` for punch-based entries. | `basic` |
| `hour_type_id` | string (UUID) | References the hour type for this entry. Defaults to "work" hour type if empty or invalid. | `b3e42da1-7b66-4aa0-9df0-aeae6402fd5b` |

### Suggested improvements
- Enforce non-empty `date` client-side and ensure every punch range has both `in`/`out` set before submission (open punches are permitted but excluded from totals).
- Derive `duration_minutes` server-side from `punches_json` so edits through the UI remain authoritative even if cached data drifts.
- Validate that `contract_id` exists in the contracts sheet before persisting new rows.
- Consider adding a separate audit sheet for punch adjustments if regulatory requirements demand a full punch history.

### Manual entry compatibility
- Manual edits should serialise punches exactly as the punch workflow: one row per day/contract with `punches_json` holding an ordered array of `{ "in": "HH:mm", "out": "HH:mm" }` pairs.
- For single-block days the array contains one object (e.g., `[{"in":"08:30","out":"17:00"}]`). Multiple breaks become separate objects with separate punch ranges.
- Leave `out` empty (`""`) while a punch is in progress; the backend will exclude it from `duration_minutes` but surface a warning in the UI so the user can close the range.
- For basic (total-hours) entries, store a single punch from `00:00` to the total elapsed time.

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
| `include_weekends` | boolean/string | `TRUE`/`FALSE` indicating whether weekends should count toward expected averages and projections. | `FALSE` |
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

## deductions
Stores configured deductions that affect monthly income calculations. Deductions can be personal (salary sacrifice) or company expenses, and may be one-off or recurring. Extra super contributions are modelled as a special deduction type.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side. | `0d9f9c03-e9fb-4fb6-b8d7-46df2315bd1b` |
| `name` | string | Human-readable deduction name. | `Novated lease` |
| `category_id` | string | Optional reference to `deduction_categories.id`; blank entries are treated as Uncategorised. | `tools` |
| `company_expense` | boolean/string | `TRUE`/`FALSE` flag indicating whether the deduction is treated as a company expense (requires company tracking). | `TRUE` |
| `deduction_type` | string | `standard` or `extra_super`. | `extra_super` |
| `amount_type` | string | `flat` (currency) or `percent` (for extra super). | `percent` |
| `amount_value` | number | Flat amount in dollars or percentage (stored as decimal). | `0.02` |
| `gst_inclusive` | boolean/string | `TRUE`/`FALSE` to indicate whether the entered amount includes GST. Only used for company expenses. | `TRUE` |
| `gst_amount` | number | GST component recorded for company deductions when inclusive (per occurrence). | `45.45` |
| `frequency` | string | Recurrence cadence: `once`, `weekly`, `fortnightly`, `monthly`, `quarterly`, `yearly`. | `monthly` |
| `start_date` | string (ISO date) | First deduction date. | `2025-01-15` |
| `end_date` | string (ISO date) | Optional final deduction date; blank for indefinite. | `` |
| `notes` | string | Optional free-form notes. | `Lease finishing Dec 2026` |
| `active` | boolean/string | `TRUE`/`FALSE` flag controlling whether the deduction is in use. | `TRUE` |
| `created_at` | string (ISO datetime, UTC) | Timestamp when the deduction was created. | `2025-10-08T00:12:00Z` |
| `updated_at` | string (ISO datetime, UTC) | Timestamp of the most recent update. | `2025-10-08T00:12:00Z` |

### Suggested improvements
- Store an attachment reference once file uploads are supported for deductions.
- Track audit metadata (user, change reason) when collaborative workflows are introduced.

## deduction_categories
Catalog of reusable deduction categories. When the `enable_deduction_categories` feature flag is enabled, these categories become selectable on the deductions page and power the annual expense breakdown.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side. | `dae8e0c2-51f2-4b1c-9f1f-138f57c97ce0` |
| `name` | string | Category label shown in the UI. | `Tools & equipment` |
| `color` | string | Hex color used for badges and reports. | `#3b82f6` |
| `created_at` | string (ISO datetime, UTC) | Timestamp recorded when the category was created. | `2025-05-01T02:41:00Z` |
| `updated_at` | string (ISO datetime, UTC) | Timestamp of the most recent update. | `2025-05-10T19:24:00Z` |

## deduction_occurrence_exceptions
Stores adjustments to individual occurrences of recurring deductions. Allows users to skip, move, or adjust the amount of a specific occurrence without modifying the base deduction pattern. Exceptions are applied after calculating base occurrences.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side. | `3b9f9c03-e9fb-4fb6-b8d7-46df2315bd1c` |
| `deduction_id` | string (UUID) | References the parent deduction. | `0d9f9c03-e9fb-4fb6-b8d7-46df2315bd1b` |
| `original_date` | string (ISO date) | The calculated occurrence date being adjusted. | `2025-05-15` |
| `exception_type` | string | Type of adjustment: `skip`, `move`, or `adjust_amount`. | `move` |
| `new_date` | string (ISO date) | New date for `move` type exceptions. Blank for other types. | `2025-05-18` |
| `new_amount` | number | Override amount for `adjust_amount` type exceptions. Zero for other types. | `450.00` |
| `notes` | string | Optional explanation for the adjustment. | `Billing cycle adjustment` |
| `created_at` | string (ISO datetime, UTC) | Timestamp when the exception was created. | `2025-05-12T14:30:00Z` |
| `updated_at` | string (ISO datetime, UTC) | Timestamp of the most recent update. | `2025-05-12T14:30:00Z` |

### Exception types
- **skip**: Removes the occurrence entirely from calculations.
- **move**: Changes the occurrence to a different date (e.g., billing cycle mismatch).
- **adjust_amount**: Overrides the amount for this specific occurrence only.

### Processing rules
1. Base occurrences are calculated from the parent deduction's `start_date`, `frequency`, and `end_date`.
2. Exceptions are loaded and applied to the occurrence list.
3. Skipped occurrences are removed from the final list.
4. Moved occurrences appear on `new_date` instead of `original_date`.
5. Amount-adjusted occurrences use `new_amount` instead of the deduction's `amount_value`.

## BAS reporting (derived)
The BAS page renders a financial-year view composed from existing sheets. Data is not persisted; it is calculated on demand from contracts, entries, and deductions.

| Field | Description |
| --- | --- |
| Invoice total | Company income (hourly rate × hours) plus GST (10%). |
| Invoice GST | GST component of the invoice total. |
| Company income | Revenue before GST. |
| Business expenses total | Company deductions (GST-exclusive). |
| Business expenses GST | GST component from company deductions that were entered inclusive of GST. |
| Employee gross income | Company income minus business expenses. |
| Employee superannuation | Superannuation guarantee plus extra contributions. |
| Employee deductions | Salary sacrifice deductions. |
| Employee tax | Estimated PAYG tax for the period (0 when estimation is unavailable). |
| Employee net income | Net income after tax and deductions. |

## hour_types
Hour types define categories of time that can be tracked (work, annual leave, sick leave, training, etc.). Each type has configurable properties affecting contract requirements, income calculations, and visualization.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side. | `b3e42da1-7b66-4aa0-9df0-aeae6402fd5b` |
| `name` | string | Human-readable hour type name. | `Annual Leave` |
| `slug` | string | URL-safe identifier for the hour type. | `annual` |
| `color` | string | Hex color code for calendar visualization. | `#ff6b6b` |
| `contributes_to_income` | boolean/string | `TRUE`/`FALSE` indicating if this hour type should be included in income calculations. | `FALSE` |
| `requires_contract` | boolean/string | `TRUE`/`FALSE` indicating if entries of this type must have a contract selected. | `FALSE` |
| `is_default` | boolean/string | `TRUE`/`FALSE` indicating if this is the default hour type for new entries. Only one can be default. | `FALSE` |
| `use_for_rate_calculation` | boolean/string | `TRUE`/`FALSE` indicating if this hour type's hours should be used for hourly rate calculations in annual views and income breakdown. Only one can be marked for rate calculation. | `FALSE` |
| `auto_populate_public_holidays` | boolean/string | `TRUE`/`FALSE` flag enabling automatic entry creation on weekday public holidays. Requires public holiday feature. | `FALSE` |
| `auto_populate_hours` | number | Hours (decimal) to record when auto-populating a weekday public holiday. | `7.5` |
| `created_at` | string (ISO datetime, UTC) | Timestamp recorded when the hour type was created server-side. | `2025-10-06T10:15:00Z` |

### Built-in hour types
- The "Work" hour type (`slug: "work"`) is automatically created and cannot be deleted. It contributes to income, requires a contract, is the default when the hour_types feature is disabled, and is used for rate calculation if no other hour type has that flag set.

### Suggested improvements
- Validate that only one hour type is marked as default at any time.
- Ensure slug uniqueness within the sheet.
- Consider adding display order for consistent UI presentation.
- Auto-populated holidays skip hour types requiring a contract to avoid creating invalid entries.

## public_holidays
Stores fetched public holiday data from the Nager.Date API. This sheet caches holiday information to minimize API calls and allows offline access to previously fetched holidays.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `date` | string (ISO) | Holiday date in `yyyy-MM-dd` format. | `2025-01-27` |
| `name` | string | Human-readable holiday name. | `Australia Day` |
| `local_name` | string | Localized holiday name (same as name for AU). | `Australia Day` |
| `counties` | string (JSON) | JSON-encoded array of state/territory codes where the holiday applies. `null` or `[]` means nationwide. | `["AU-WA"]` |
| `types` | string (JSON) | JSON-encoded array of holiday types (e.g., `["Public"]`). | `["Public"]` |
| `year` | number | Year of the holiday for efficient querying. | `2025` |
| `fetched_at` | string (ISO datetime, UTC) | Timestamp when this holiday data was fetched from the API. | `2025-10-10T12:00:00Z` |

### Filtering logic
- Holidays with `counties = null` or `counties = []` apply to all Australian states/territories
- Holidays with specific counties (e.g., `["AU-WA"]`) only apply to users with matching state settings
- Users see holidays where: `counties == null || counties == [] || counties.includes('AU-{userState}')`

### Suggested improvements
- Add an index on `year` column if query performance becomes an issue
- Consider adding a `global` boolean flag for faster filtering of nationwide holidays
- Track API response metadata (rate limits, response time) for monitoring

## bas_submissions
Stores Business Activity Statement (BAS) submission data for each period (monthly or quarterly). Records calculated GST and PAYG values along with submission status.

| Column | Type | Description | Example |
| --- | --- | --- | --- |
| `id` | string (UUID) | Unique identifier generated server-side. | `c5e42da1-7b66-4aa0-9df0-aeae6402fd5c` |
| `financial_year` | number | Starting year of the financial year. | `2024` |
| `period_type` | string | Period type: `monthly` or `quarterly`. | `quarterly` |
| `quarter` | number | Quarter number (1-4) for quarterly periods. Null for monthly. | `2` |
| `month` | number | Month number (0-11) for monthly periods. Null for quarterly. | `6` |
| `g1_total_sales` | number | Total sales including GST (G1 field). | `55000.00` |
| `g1_includes_gst` | boolean/string | Always `TRUE` - indicates G1 includes GST. | `TRUE` |
| `field_1a_gst_on_sales` | number | GST collected on sales (1A field). | `5000.00` |
| `field_1b_gst_on_purchases` | number | GST paid on purchases (1B field). | `500.00` |
| `t1_payg_income` | number | PAYG instalment income (T1 field). | `50000.00` |
| `t2_instalment_rate` | number | PAYG instalment rate as decimal (T2 field). | `0.02` |
| `submitted` | boolean/string | `TRUE`/`FALSE` indicating if BAS has been lodged with ATO. | `FALSE` |
| `submitted_at` | string (ISO datetime, UTC) | Timestamp when the BAS was marked as submitted. Empty if not submitted. | `2025-01-28T10:15:00Z` |
| `created_at` | string (ISO datetime, UTC) | Timestamp when this record was first created. | `2025-01-28T09:00:00Z` |
| `updated_at` | string (ISO datetime, UTC) | Timestamp of the most recent update. | `2025-01-28T10:15:00Z` |

### Field calculations
- **G1 (Total Sales)**: Sum of invoice totals (including 10% GST) for all income-contributing entries in the quarter
- **1A (GST on Sales)**: GST component of G1 (calculated as invoice total ÷ 11)
- **1B (GST on Purchases)**: Sum of GST amounts from company deductions in the quarter
- **T1 (PAYG Income)**:
  - For sole traders: Gross income minus business expenses for the quarter
  - For companies: Gross income for the quarter
- **T2 (Instalment Rate)**: User-configured rate (stored in user_settings as `payg_instalment_rate`)

### Suggested improvements
- Add validation to prevent duplicate submissions for the same financial year, period_type, and quarter/month combination
- Track who submitted the BAS when multi-user support is added
- Consider adding fields for other BAS sections (W1, W2, etc.) as needed
