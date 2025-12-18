# Dashboard & Calendar

How to read and use the calendar view and badges.

## Calendar Basics
- Month grid with per-day hours; right-click opens defaults menu when `default_inputs` is enabled.
- Clicking a day selects it for entry; context menu shows available defaults by type.
- Public holidays (flag `enable_public_holidays`) display on the calendar when synced.

## Badges
- Total hours badge always present.
- Income badge shows net income; toggle reveals detailed breakdown (company vs personal when company tracking is on).
- Expected hours badge (flag `expected_monthly_hours`) projects capacity vs actual, per contract breakdown when expanded.

## Actions
- Navigate months; lazy-load income summaries.
- Calendar context respects feature flag gating for defaults.

## Tips
- For defaults insertion, ensure contract is selected/valid; warnings show if not.
- Use badges to sanity-check deductions, super, and projections after edits.

