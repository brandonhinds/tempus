# Payroll Helpers

Available when `xero_payroll_helper` or `myob_payroll_helper` feature flags are enabled.

## Purpose
- Provide payroll-ready hour groupings for the active month.

## Helpers
- Xero Payroll Helper: slices the active month into Xero’s fixed weekly ranges with cumulative hour totals.
- MYOB Payroll Helper: groups the active month into weekly totals with a monthly cross-check.

## Usage
- Open the respective modal from the Time page when the flag is on.
- Review week ranges and totals; copy values into payroll systems.

## Tips
- Ensure time entries are complete and rounded as desired before exporting totals.
- Check hour types to confirm only income-contributing hours are included where expected.

