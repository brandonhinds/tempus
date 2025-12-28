# Hour Types & Contracts in Time Entry

Understand how hour types and contracts work together to categorise time and enforce business rules.

## Purpose
Hour types and contracts are the two key organisational dimensions for time entries in Tempus. Contracts define where you work (which client, which engagement), while hour types define what kind of time you're logging (work, leave, training, overtime). Together, they enable sophisticated time tracking that distinguishes billable work from non-billable hours, separates different types of activities, and ensures entries are properly associated with valid contracts. Hour types can optionally require contracts and control whether time contributes to income calculations. Understanding how these interact is essential for accurate time tracking and reporting.

**Important:** Every time entry must have a contract. Hour types are optional (falls back to default hour type) unless the *Enable multiple hour types* feature flag is enabled, in which case hour type selection becomes required for all entries.

## Contracts in Time Entry

### Contract Requirement

**Every time entry requires a contract.** You cannot save an entry without selecting a valid contract for the entry's date.

**Why contracts are required:**
- Income calculations depend on contract rates
- Time tracking needs to know which engagement the hours apply to
- Contract date ranges enforce valid time periods
- Billing and invoicing require contract association

### Contract Filtering by Date

The contract dropdown only shows contracts valid for the selected entry date.

**Valid contract:** The entry date falls within the contract's start and end date range (inclusive).

**Example:**
- Contract A: 1 Jan 2024 - 31 Mar 2024
- Entry date: 15 Feb 2024 → Contract A appears in dropdown
- Entry date: 15 Apr 2024 → Contract A does NOT appear (outside range)

**Auto-selection:** If only one contract is valid for the selected date, Tempus auto-selects it.

### Changing Contracts

When you change the contract dropdown whilst editing:

1. Tempus checks if an entry already exists for the new contract on the selected date (with the same hour type).
2. If found, it loads that entry for editing.
3. If not found, the form clears and prepares for a new entry with the new contract.

**Use case:** Quickly switch between multiple entries on the same day for different contracts.

## Hour Types in Time Entry

**Requires:** *Enable multiple hour types* feature flag

Hour types let you categorise time into different buckets (work, leave, training, admin, etc.), each with its own properties.

### Hour Type Properties

Each hour type has:

**Name:** Display label (e.g., "Work", "Annual Leave", "Training")

**Colour:** Visual identifier on calendar and reports

**Contributes to income:** Boolean flag determining if this time counts towards income calculations
- `true` = income-generating (work, overtime, consulting)
- `false` = non-income (leave, training, admin)

**Requires contract:** Boolean flag determining if entries using this hour type must have a contract
- Most hour types require contracts (default: true)
- Some hour types (training, admin) might not require contracts if they're personal development unrelated to client work

**Is default:** Boolean flag marking this as the default hour type
- Only one hour type can be default
- Used when no hour type is selected (if hour types are optional)

### Hour Type Selection

**When hour types are enabled:**
- The hour type dropdown appears on both Basic and Advanced entry forms
- Hour type is required for all entries
- Changing hour type can change available contracts (if the new type has different contract requirements)

**When hour types are disabled:**
- No hour type dropdown appears
- All entries use an implicit default hour type
- Time tracking is simpler (single category)

### Default Hour Type Behaviour

If hour types are enabled but you don't select one (or the selection is invalid):

**Fallback:** Tempus uses the hour type marked as "Is default" in your hour types list.

**Use case:** Quick entry without selecting - defaults to "Work" or whatever you've configured as default.

## Hour Types and Contracts Interaction

### Hour Type Requires Contract

Some hour types can be configured to require a contract. This enforcement happens at save time.

**Example scenarios:**

**Work hour type** (requires contract: true):
- You select "Work" hour type
- Contract dropdown is mandatory
- Attempting to save without a contract shows error: "This hour type requires a contract"

**Training hour type** (requires contract: false):
- You select "Training" hour type
- Contract dropdown becomes optional
- You can save without selecting a contract (personal training)

**Mixed scenario:**
- You start with "Work" selected (contract required and selected)
- You switch to "Training" (contract not required)
- The contract field remains populated but is now optional
- You can clear it if the training isn't client-specific

### Hour Type Contributes to Income

Hour types control whether logged time appears in income calculations.

**Income-generating hour types** (contributes to income: true):
- Hours are multiplied by contract rate
- Contribute to gross income, super, tax calculations
- Appear in invoices (if invoicing is enabled)
- Examples: Work, Overtime, Consulting

**Non-income hour types** (contributes to income: false):
- Hours are logged but don't contribute to income calculations
- Don't affect gross income or super/tax
- Tracked for reporting but financially neutral
- Examples: Annual Leave, Sick Leave, Training, Admin

**Use case:** Accurately track all time (work + leave + training) whilst only calculating income for billable hours.

## Cross-Mode Rules

### Mode Switching Restrictions

You cannot switch between Basic and Advanced entry modes if an entry already exists for the selected date/contract/hour type combination.

**Scenario:**
- You have an Advanced entry for 15 Jan, Contract A, "Work" hour type (with multiple punch ranges)
- You select 15 Jan, Contract A, "Work" on the Basic tab
- Tempus loads the Advanced entry and switches you to the Advanced tab automatically
- You cannot create a Basic entry for this combination - delete the Advanced entry first

**Why:** Prevents accidental data loss and ensures mode consistency. An entry is either punch-based or manual, not both.

**Workaround:** Use different hour types for the same day if you need both modes. Example: Advanced entry for "Work", Basic entry for "Training" on the same day.

### Duplicate Entry Prevention

Tempus prevents duplicate entries with the same date/contract/hour type combination.

**Key:** `date + contract + hour type = unique entry`

**Behaviour:**
- Selecting an existing combination loads that entry for editing
- You cannot create two separate entries with identical keys
- Update the existing entry or use a different hour type/contract

**Example:**
- Existing entry: 15 Jan, Contract A, "Work", 7.5 hours
- You select: 15 Jan, Contract A, "Work" → Loads existing entry for editing
- You cannot create a second "Work" entry for Contract A on 15 Jan
- You CAN create: 15 Jan, Contract A, "Training" (different hour type)
- You CAN create: 15 Jan, Contract B, "Work" (different contract)

## Practical Scenarios

### Scenario 1: Billable Work Day

**Setup:**
- Contract: "Client A Project"
- Hour type: "Work" (requires contract: true, contributes to income: true)
- Entry: Basic, 7.5 hours

**Result:**
- 7.5 hours logged to Client A
- Income calculated: 7.5 × contract rate
- Appears in invoices and income reports

### Scenario 2: Annual Leave

**Setup:**
- Contract: "Client A Project" (required even though it's leave)
- Hour type: "Annual Leave" (requires contract: true, contributes to income: false)
- Entry: Basic, 8 hours

**Result:**
- 8 hours logged as leave
- NO income calculated (non-billable time)
- Hours tracked for leave balance but don't affect pay calculations

**Note:** Some organisations require leave to be logged against a contract for tracking purposes, even though it's non-billable.

### Scenario 3: Training (No Contract)

**Setup:**
- Contract: None
- Hour type: "Training" (requires contract: false, contributes to income: false)
- Entry: Basic, 4 hours

**Result:**
- 4 hours logged as training
- No contract association (personal development)
- No income calculated
- Tracked for training hours reporting

### Scenario 4: Multiple Contracts Same Day

**Setup:**
- Morning: Contract A, "Work", 4 hours (Advanced mode with punch ranges)
- Afternoon: Contract B, "Consulting", 3.5 hours (Advanced mode with different punch ranges)

**Result:**
- Two separate entries for the same day
- Different contracts = allowed
- Both contribute to income (different rates per contract)
- Calendar shows combined 7.5 hours for the day

### Scenario 5: Work and Leave Same Day

**Setup:**
- Morning: Contract A, "Work", 4 hours
- Afternoon: Contract A, "Annual Leave", 4 hours

**Result:**
- Two separate entries for the same day with same contract
- Different hour types = allowed
- 4 hours counted as income (Work), 4 hours non-income (Leave)
- Calendar shows combined 8 hours for the day

## Validation Rules

Tempus enforces these rules when saving time entries:

### Contract Validation
- **Must have:** A contract selected (unless hour type explicitly doesn't require one)
- **Must be valid:** Contract date range includes the entry date
- **Error if:** No contract selected when hour type requires it

### Hour Type Validation
- **Must have:** A valid hour type (or falls back to default)
- **Must match mode:** Basic defaults work in Basic mode, Advanced defaults work in Advanced mode
- **Must be unique:** date + contract + hour type combination must be unique

### Date Validation
- **Must be:** Within contract's valid date range
- **Warning if:** Entry date is outside contract dates (contract won't appear in dropdown)

## Tips for Using Hour Types and Contracts

- **Configure hour types first:** Before tracking time with multiple categories, set up your hour types with correct "requires contract" and "contributes to income" settings.
- **Use income flag strategically:** Mark work/overtime as income-generating, leave/training as non-income to get accurate income reports.
- **Leverage contract requirement:** If training is client-specific, require a contract. If it's personal development, don't require a contract.
- **Check contract dates:** Ensure contracts cover your entire working period. If a contract ends, you won't be able to log time past the end date.
- **Use hour types for reporting:** Even if income contribution is the same, use different hour types (Work vs Overtime) to track hours separately for reporting.
- **Default hour type convenience:** Set your most common type (usually "Work") as default to avoid selecting it every time.
- **Calendar colour coding:** Use distinct colours for each hour type to visually identify leave, training, and work days on the calendar.
- **Test contract requirement:** If unsure whether an hour type requires a contract, try saving without one. The error message will clarify.
- **Bulk/recurring respect types:** Bulk and recurring entries use hour types too. Set them correctly to ensure generated entries have the right categorisation.
- **Invoice integration:** If using invoicing, only income-contributing hour types will flow into invoices automatically.

## Common Hour Types & Contracts Questions

### Why doesn't my contract appear in the dropdown?
The contract's date range doesn't include your selected entry date. Check the contract's start and end dates - the entry date must fall within that range (inclusive).

### Can I log time without a contract?
Only if the selected hour type has "requires contract" set to false. Most hour types require contracts, but training or admin types might not.

### What happens if I disable hour types after creating entries with them?
Existing entries keep their hour types, but new entries will use a single default hour type. The hour type dropdown disappears from entry forms.

### Can I have two entries for the same day and contract?
Yes, if they use different hour types. Example: 4 hours "Work" and 4 hours "Leave" on the same day for the same contract.

### What's the difference between "contributes to income" and "requires contract"?
- **Contributes to income:** Controls whether hours count towards income calculations
- **Requires contract:** Controls whether selecting a contract is mandatory when saving

They're independent settings. You can have training that requires a contract (client training) but doesn't contribute to income.

### Do entry defaults respect hour types?
Yes. Defaults can pin a specific hour type, which overrides your current selection when the default is applied.

### Can I change an entry's hour type after saving?
Yes. Load the entry (select the date/contract/hour type), change the hour type dropdown, and save. This updates the entry's categorisation.

### Why does changing hour type sometimes clear my selected contract?
If the new hour type doesn't require a contract but the old one did, Tempus might clear the contract field to reflect the optional status. The contract is still there if you want to keep it.

### How do hour types affect invoicing?
Only hour types with "contributes to income" enabled flow into invoice line items. Non-income hour types (leave, training) are excluded from invoices.

### Can I create a contract that covers all dates?
Yes. Leave the end date blank for ongoing contracts, or set a far-future end date. The contract will appear in dropdowns for all dates within its range.

### What if I select a date before a contract starts?
That contract won't appear in the dropdown for that date. Tempus only shows contracts valid for the selected date.

### Do hour types affect calendar display?
Yes. Each hour type has a colour that appears on calendar day cells, helping you visually distinguish work, leave, and other activities.

## Summary

Hour types categorise time (work, leave, training) with configurable income contribution and contract requirements. Contracts define where time applies and must be valid for the entry date. Together they enable sophisticated tracking: multiple entries per day with different types or contracts, income vs non-income separation, and mode-specific entry restrictions.

For hour type configuration, see [Hour Types documentation](docs/hour-types.md). For contract management, see [Contracts documentation](docs/contracts.md). For time entry workflows, see [Basic Time Entry](docs/time-entry-basic.md) and [Advanced Punch Entry](docs/time-entry-advanced.md).
