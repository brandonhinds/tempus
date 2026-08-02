# Invoices and payments

Standard and assessment invoices share `invoices`, `invoice_line_items`, and `invoice_payments`.

Document state is independent from payment state:

- `draft`: editable and explicitly recalculable.
- `issued`: numbered and immutable.
- `sent`: immutable with a send timestamp.
- `void`: retained as audit history.

Payment state is derived as unpaid, part-paid, or paid. Server-side numbering occurs only under the script lock. Issuing snapshots line amount, GST, source metadata, and the relevant entry details. Reads do not recalculate or mutate invoices.

Corrections use void-and-revise. A revision copies the historical lines into a new draft and links back to the source invoice. Assessment sources are released only when their invoice is voided. Legacy `generated` invoices become issued with no inferred payment and remain outside cash-basis actuals until reconciled.
