# Hour Types & Contracts in Time Entry

How hour types and contracts interact across manual and punch flows.

## Hour Types (flag: `hour_types`)
- Enables hour type selectors on both manual and punch forms.
- Each hour type can require a contract and contributes (or not) to income metrics.
- Default hour type is used when none is selected; defaults can pin a specific hour type.

## Contracts
- Every entry needs a valid contract for the selected date.
- Contract pickers filter to contracts active on that date; when only one valid, it auto-selects.
- Changing contract reloads any existing entry for that date/contract.

## Cross-Mode Rules
- If an advanced entry exists for a date/hour type, switching to manual is blocked (and vice versa).
- Hour-type contract requirement is enforced on save; missing contract triggers an error.

## Tips
- Use hour types to model income vs non-income hours; ensure contracts cover the working date range.
- When editing, the app pulls the entry matching date + contract (and hour type when present) to avoid duplicates.

