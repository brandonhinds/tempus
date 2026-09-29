# BAS and tax estimates

BAS reporting separates:

- Actuals: issued invoice sales and reconciled, eligible expense GST.
- Forecasts: timesheet income and recurring expense schedules.
- Reconciliation: uninvoiced time, unpaid invoices, unreconciled expenses, and missing receipts.

Cash basis attributes invoice and expense amounts proportionally to payments in the reporting period. Accrual basis uses the invoice/supplier-invoice event, including an earlier applicable payment event. The accounting basis is stored in settings.

Company expenses come from the expense ledger only (see [expenses.md](expenses.md)). The dashboard income figure, the client BAS table and field 1B, the monthly transfer split and the backend BAS calculation all sum them the same way. Company-expense deductions left on the Deductions page are read-only history and count for nothing.

Submitting a BAS stores its basis, source hash, full calculation snapshot, and submission state. Submitted snapshots are immutable; current calculations can report whether their source hash has changed.

PAYG estimates use bundled, versioned ATO Scale 2 coefficients. Tables are included through FY2026–27. Later periods continue with the newest bundled table but display a stale-table warning. Tempus provides calculations and evidence, not tax advice.
