# Expense ledger

Personal/payroll deductions, salary sacrifice, and extra super remain under Deductions. Business costs use two separate records:

- Expense rules forecast future recurring costs.
- Expense transactions snapshot actual or scheduled occurrences. Payments and receipt references are child records.

Rules never rewrite recorded or reconciled history. `api_generateExpenseRuleOccurrences` can materialise source-aware scheduled occurrences for the next year (or a requested end date) without duplicating an existing rule/date tuple.

Transactions store vendor and optional ABN, dates, category, amount, GST code and snapshot, business-use decimal, claimability confirmation, reconciliation state, source identity, notes, and structured receipt references. Reconciled and void transactions are immutable. Payment totals cannot exceed the transaction amount.

Legacy company deductions migrate to inactive/active rules plus `legacy_unreconciled` transactions. Inactive rules without an end date use their last-updated date as a proposed cutoff and are flagged for review. Skip, move, and amount exceptions are applied during backfill. Legacy transactions appear in annual expense totals but contribute no BAS GST credit until reconciled with eligible evidence.
