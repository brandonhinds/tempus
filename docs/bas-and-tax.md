# BAS and tax estimates

BAS reporting separates:

- Actuals: issued invoice sales, and expenses with their GST credits.
- Forecasts: timesheet income and recurring expense schedules.
- Variances: uninvoiced time, and unpaid expenses invoiced in the period (not counted on a cash basis until paid).

Every invoice is assumed to be paid, so invoice income counts in full on its invoice date under both bases; Tempus does not track invoice payments. For expenses, cash basis counts an expense on its paid date and accrual basis on the earlier of its invoice date and paid date. A taxable expense's GST credit, scaled by business use, counts in the same period as the expense. The accounting basis is stored in settings.

Company expenses come from the expense ledger only (see [expenses.md](expenses.md)). The dashboard income figure, the client BAS table and field 1B, the monthly transfer split and the backend BAS calculation all sum them the same way. Company-expense deductions left on the Deductions page are read-only history and count for nothing.

Submitting a BAS stores its basis, source hash, full calculation snapshot, and submission state. Submitted snapshots are immutable; current calculations can report whether their source hash has changed.

PAYG estimates use bundled, versioned ATO Scale 2 coefficients. Tables are included through FY2026–27. Later periods continue with the newest bundled table but display a stale-table warning. Tempus provides calculations and evidence, not tax advice.

## Report for your accountant

On the BAS page, choose the financial year and accounting basis, then **Export for accountant**. Tempus downloads `Bookkeeping 2026-27.xlsx`, laid out like a hand-kept bookkeeping workbook:

- **Income**: one line per invoice issued in the year, on its invoice date (every invoice is assumed paid). Columns: date, invoice number, description (the month the invoice bills, such as `August Invoice`), gross, GST, net and superannuation. Superannuation on each line is the super guarantee rate for that date times the net amount. Each BAS quarter ends with a subtotal row. A YTD Totals row ends the sheet.
- **Expenses**: one line per expense counted in the year: on its paid date (cash basis), or on the earlier of its invoice and paid dates (accrual basis). Columns: date, description (vendor and description), payment method, gross, GST credit, net, then one column per category holding the line's gross amount. Each quarter ends with a totals row, followed by YTD Totals.

Net, subtotals, super and totals are spreadsheet formulas, so changing a line updates the totals. The year totals match the BAS figures for the same basis. Draft invoices, upcoming schedule payments and, on a cash basis, unpaid expenses are left out. To build the file, Tempus briefly creates a Google Sheet in your Drive, exports it, then moves it to the bin.

Expense payment methods come from the **Paid by** choice when an expense is marked paid. Expenses paid before that choice existed show a blank method.
