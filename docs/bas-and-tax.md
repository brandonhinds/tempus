# BAS and tax estimates

BAS reporting separates:

- Actuals: issued invoice sales and reconciled, eligible expense GST.
- Forecasts: timesheet income and recurring expense rules.
- Reconciliation: uninvoiced time, unpaid invoices, unreconciled expenses, and missing receipts.

Cash basis attributes invoice and expense amounts proportionally to payments in the reporting period. Accrual basis uses the invoice/supplier-invoice event, including an earlier applicable payment event. The accounting basis is stored in settings.

Submitting a BAS stores its basis, source hash, full calculation snapshot, and submission state. Submitted snapshots are immutable; current calculations can report whether their source hash has changed.

PAYG estimates use bundled, versioned ATO Scale 2 coefficients. Tables are included through FY2026–27. Later periods continue with the newest bundled table but display a stale-table warning. Tempus provides calculations and evidence, not tax advice.
