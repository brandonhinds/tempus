Specification: Capacity Planning, Contract Pace, and Cumulative Capacity

The system must model three complementary hour metrics across a 12-month contract:

Contract Pace – a constant, linear progression toward the total contracted hours.

Capacity – a variable, month-specific measure of the realistic billable hours available.

Cumulative Capacity – a running total of all capacity up to each month, showing total available billable opportunity to date.

These metrics serve different purposes:

Contract Pace → tracking progress against the contract total (performance KPI).

Capacity → planning and forecasting monthly workloads.

Cumulative Capacity → contextualising available time versus actual billed time.

1. Contract Pace

Inputs

contract_start (e.g. 2025-07-01)

contract_end (e.g. 2026-06-30)

contract_hours_total (e.g. 1725)

Derived values

```
monthly_pace = contract_hours_total / 12
daily_pace = contract_hours_total / total_days_in_contract
```

Outputs

For each month m:

```
pace_monthly[m] = monthly_pace
pace_cumulative[m] = daily_pace * days_elapsed_to_end_of_month(m)
```

These values represent a constant linear line toward the total contracted hours, used for cumulative progress tracking.

2. Capacity

Inputs per month

business_days[m] — total workdays in the month (e.g., Monday–Friday).

standard_contract_hours_per_day — the standard daily hours (e.g., 7.5 or 8).

non_income_generating_hours[m] — all hours recorded as leave, sick leave, training, or any other non-billable time within business days.

Derived values

```
capacity[m] = (business_days[m] * standard_contract_hours_per_day) - non_income_generating_hours[m]
```

This represents the realistic number of hours that could be billed in that month, after accounting for all normalised non-income-generating hours.

3. Cumulative Capacity

Definition
Cumulative capacity is the total available billable hours to date in the contract.

Derived values

```
cumulative_capacity[m] = sum(capacity[k] for k in range(1, m+1))
```

This provides a running total showing how many billable hours were realistically available up to the end of each month.

Use

Compare Actual Cumulative Hours against Cumulative Capacity to measure utilisation efficiency.

Compare Actual Cumulative Hours against Contract Pace Cumulative to measure progress toward the contract’s target total.

4. Data Presentation in the Timesheet App

For each month, display:

Field	Description
Capacity (capacity[m])	Hours realistically available for billable work this month.
Actual Hours (actual[m])	Sum of billable hours logged.
Contract Pace (pace_monthly[m])	Fixed monthly target (e.g., 143.75).
Cumulative Contract Pace (pace_cumulative[m])	Target cumulative total to date.
Cumulative Capacity (cumulative_capacity[m])	Total available billable opportunity to date.
Cumulative Actual (actual_cumulative[m])	Running total of all billable hours logged.
Variance (vs Pace)	actual_cumulative[m] - pace_cumulative[m].
Utilisation (vs Capacity)	actual_cumulative[m] / cumulative_capacity[m].

Charts

Monthly Bar Chart — Actual vs Capacity.

Cumulative Burn-Up Chart —

Line 1: Contract Pace (cumulative)

Line 2: Cumulative Actual

Line 3: Cumulative Capacity (optional overlay to show available hours trend)

5. Behavioural Rules

Cumulative tracking should always be done against the Contract Pace.

Capacity and Cumulative Capacity exist for context and planning, not for contractual compliance.

Updates to non-income-generating hours must automatically recalculate the capacity and cumulative capacity values.

Partial months should calculate Contract Pace proportionally using daily_pace * elapsed_days.

6. Practical Example (Optional for Testing)
Month	Business Days	Non-Income Hours	Capacity	Cumulative Capacity	Pace (Cumulative)
Jul	23	8	176	176	144
Aug	22	0	176	352	288
Sep	21	16	144	496	432
...	...	...	...	...	...

This allows easy comparison:

Cumulative Actual vs Pace → Contract performance.

Cumulative Actual vs Capacity → Efficiency of available hours.

Summary

The implementation must maintain three distinct but related datasets:

Contract Pace (constant progression) – defines the target path to 1,725 hours.

Capacity (variable) – adjusts monthly for non-income-generating hours.

Cumulative Capacity (running total) – tracks total available opportunity across the contract.

This model ensures accurate contract tracking while providing realistic monthly planning and utilisation analysis.