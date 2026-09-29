'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createAppsScriptContext } = require('./mock-apps-script');
const root = path.resolve(__dirname, '..');
const operationsScripts = fs.readFileSync(path.join(root, 'views/partials/operations-scripts.html'), 'utf8');

const TODAY = '2026-10-01';

function backend(today) {
  const env = createAppsScriptContext({}), c = env.context;
  for (const file of fs.readdirSync(path.join(root, 'backend')).filter(f => f.endsWith('.js'))) vm.runInNewContext(fs.readFileSync(path.join(root, 'backend', file), 'utf8'), c, { filename: file });
  c.assertMigrationsSettled_ = () => true;
  c.cacheGet = () => null; c.cacheSet = () => {}; c.cacheClearPrefix = () => {};
  c.Utilities.computeDigest = (algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map(b => b > 127 ? b - 256 : b);
  c.expenseToday_ = () => today || TODAY;
  return env;
}
function scheduled(c, ruleId) {
  return c.api_listExpenseTransactions({}).filter(t => t.source_rule_id === ruleId && t.status === 'scheduled').map(t => t.purchase_date).sort();
}
function rulePayload(overrides) {
  return Object.assign({ vendor: 'Insurer', description: 'Professional indemnity', category: 'Insurance', amount: 110, gst_code: 'taxable', frequency: 'monthly', start_date: '2026-09-15', end_date: '' }, overrides || {});
}

exports.run = test => {
  test('saving a new schedule creates its upcoming occurrences through the next 12 months', () => {
    const { context: c } = backend();
    const result = c.api_upsertExpenseRule(rulePayload());
    assert.equal(result.success, true);
    const dates = scheduled(c, result.rule.id);
    // Past dates (2026-09-15) are not forecasts; the first is the next due date on or after today.
    assert.equal(dates[0], '2026-10-15');
    assert.equal(dates[dates.length - 1], '2027-09-15');
    assert.equal(dates.length, 12);
    assert.equal(result.created_count, 12);
  });

  test('a schedule end date bounds its occurrences', () => {
    const { context: c } = backend();
    const result = c.api_upsertExpenseRule(rulePayload({ end_date: '2027-01-20' }));
    assert.deepStrictEqual(scheduled(c, result.rule.id), ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15']);
    assert.throws(() => c.api_upsertExpenseRule(rulePayload({ start_date: '2026-10-01', end_date: '2026-09-01' })), /End date must be on or after/);
  });

  test('editing a schedule regenerates future occurrences and leaves recorded and paid ones alone', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const first = c.api_listExpenseTransactions({}).find(t => t.source_rule_id === rule.id && t.purchase_date === '2026-10-15');
    // The user pays October's occurrence, so it becomes real history.
    assert.equal(c.api_upsertExpenseTransaction(Object.assign({}, first, { status: 'recorded', reconciliation_state: 'unreconciled' })).success, true);
    assert.equal(c.api_addExpensePayment({ expense_transaction_id: first.id, amount: 110, payment_date: '2026-10-15' }).success, true);

    const edited = c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 132, end_date: '2027-03-31' }), { id: rule.id }));
    assert.equal(edited.success, true);
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15', '2027-03-15'], 'future occurrences are rebuilt, not deleted');
    const all = c.api_listExpenseTransactions({}).filter(t => t.source_rule_id === rule.id);
    assert.ok(all.filter(t => t.status === 'scheduled').every(t => Number(t.amount) === 132), 'regenerated occurrences use the new amount');
    const recorded = all.find(t => t.id === first.id);
    assert.equal(recorded.status, 'recorded');
    assert.equal(Number(recorded.amount), 110, 'recorded occurrence keeps its original amount');
    assert.equal(recorded.paid_amount, 110);
    assert.equal(all.filter(t => t.purchase_date === '2026-10-15').length, 1, 'a paid date is not scheduled again');
  });

  test('saving an inactive schedule keeps it inactive and forecasts nothing', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const paused = c.api_upsertExpenseRule(Object.assign(rulePayload(), { id: rule.id, active: false }));
    assert.equal(paused.rule.active, 'FALSE');
    assert.deepStrictEqual(scheduled(c, rule.id), []);
    // Editing other fields while inactive does not reactivate it.
    const again = c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 99 }), { id: rule.id, active: false }));
    assert.equal(again.rule.active, 'FALSE');
    assert.deepStrictEqual(scheduled(c, rule.id), []);
    const resumed = c.api_upsertExpenseRule(Object.assign(rulePayload(), { id: rule.id, active: true }));
    assert.equal(resumed.rule.active, 'TRUE');
    assert.equal(scheduled(c, rule.id).length, 12);
  });

  test('rolling the horizon forward only adds dates that are not already scheduled', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    c.expenseToday_ = () => '2026-12-01';
    const rolled = c.api_generateExpenseRuleOccurrences({});
    assert.deepStrictEqual(Array.from(rolled.transactions.map(t => t.purchase_date)), ['2027-10-15', '2027-11-15']);
    assert.equal(scheduled(c, rule.id).length, 14);
  });

  test('the client schedule preview matches the backend occurrence dates', () => {
    const { context: c } = backend();
    const client = {};
    vm.runInNewContext(extract(operationsScripts, 'expenseScheduleDates'), client);
    [['2026-01-31', '2027-12-31', 'monthly'], ['2026-08-31', '', 'monthly'], ['2026-09-15', '', 'weekly'], ['2026-02-28', '2031-01-01', 'yearly'], ['2028-02-29', '', 'yearly'], ['2026-03-31', '', 'quarterly'], ['2026-10-10', '', 'fortnightly'], ['2026-11-01', '', 'once']].forEach(([start, end, frequency]) => {
      const horizon = end || '2033-01-01';
      const backendDates = Array.from(c.migrationOccurrenceDates_(start, horizon, frequency)).filter(d => d >= TODAY).slice(0, 5);
      assert.deepStrictEqual(Array.from(client.expenseScheduleDates(start, end, frequency, TODAY, 5)), backendDates, frequency + ' from ' + start);
    });
  });

  test('a schedule after a short month returns to its start day instead of drifting', () => {
    const { context: c } = backend();
    const dates = (start, end, frequency) => Array.from(c.migrationOccurrenceDates_(start, end, frequency));
    assert.deepStrictEqual(dates('2026-01-31', '2026-05-01', 'monthly'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    assert.deepStrictEqual(dates('2025-11-30', '2026-08-31', 'quarterly'), ['2025-11-30', '2026-02-28', '2026-05-30', '2026-08-30']);
    assert.deepStrictEqual(dates('2028-02-29', '2032-03-01', 'yearly'), ['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29']);
    assert.deepStrictEqual(dates('2026-09-01', '2026-09-29', 'weekly'), ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29']);
    assert.deepStrictEqual(dates('2026-09-01', '2027-09-01', 'once'), ['2026-09-01']);
    const rule = c.api_upsertExpenseRule(rulePayload({ start_date: '2026-08-31' })).rule;
    assert.deepStrictEqual(scheduled(c, rule.id).slice(0, 4), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31']);
  });

  function driftedLedger(today) {
    const env = backend(today), c = env.context;
    const rules = c.getOrCreateSheet('expense_rules'), transactions = c.getOrCreateSheet('expense_transactions');
    const ruleHeaders = rules.getDataRange().getValues()[0], txHeaders = transactions.getDataRange().getValues()[0];
    rules.appendRow(c.rowValuesFromObject_(ruleHeaders, { id: 'r31', vendor: 'Landlord', amount: 110, gst_code: 'taxable', gst_amount: 10, business_use_percentage: 1, frequency: 'monthly', start_date: '2026-01-31', end_date: '2027-03-29', active: 'TRUE' }));
    rules.appendRow(c.rowValuesFromObject_(ruleHeaders, { id: 'r15', vendor: 'Insurer', amount: 50, gst_code: 'taxable', gst_amount: 0, business_use_percentage: 1, frequency: 'monthly', start_date: '2026-01-15', end_date: '', active: 'TRUE' }));
    const row = (ruleId, key, status, overrides) => transactions.appendRow(c.rowValuesFromObject_(txHeaders, Object.assign({
      id: ruleId + '-' + key + '-' + status, vendor: 'Landlord', purchase_date: key, amount: 110, gst_code: 'taxable', gst_amount: 10, business_use_percentage: 1,
      status: status, reconciliation_state: status === 'scheduled' ? 'scheduled' : 'unreconciled', source_rule_id: ruleId, source_occurrence_key: key, attachments_json: '[]'
    }, overrides || {})));
    // What the drifting generator left behind: history on drifted dates, and drifted future schedule.
    row('r31', '2026-08-28', 'void');
    row('r31', '2026-09-28', 'recorded');
    ['2026-10-28', '2026-11-28', '2027-01-28', '2027-02-28', '2027-03-28'].forEach(key => row('r31', key, 'scheduled'));
    row('r31', '2026-12-28', 'scheduled', { purchase_date: '2026-12-20' });
    row('r15', '2026-10-15', 'scheduled');
    return env;
  }
  const byRule = (c, ruleId) => c.api_listExpenseTransactions({}).filter(t => t.source_rule_id === ruleId);

  test('drifted scheduled occurrences move to their anchored dates, and history stays put', () => {
    const { context: c } = driftedLedger('2026-09-29');
    const before = byRule(c, 'r15');
    c.migrationAnchorScheduledExpenseDates_();
    const rows = byRule(c, 'r31');
    const keys = status => rows.filter(t => t.status === status).map(t => t.source_occurrence_key).sort();
    assert.deepStrictEqual(keys('scheduled'), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28'], 'the occurrence past the end date is dropped');
    assert.deepStrictEqual(keys('recorded'), ['2026-09-28']);
    assert.deepStrictEqual(keys('void'), ['2026-08-28']);
    assert.equal(rows.find(t => t.status === 'recorded').purchase_date, '2026-09-28', 'a recorded date is not rescheduled');
    assert.equal(rows.find(t => t.source_occurrence_key === '2026-12-31').purchase_date, '2026-12-20', 'a hand-moved date is kept');
    assert.equal(rows.find(t => t.source_occurrence_key === '2026-10-31').purchase_date, '2026-10-31');
    assert.equal(new Set(rows.map(t => t.id)).size, rows.length, 'ids stay unique');
    assert.deepStrictEqual(byRule(c, 'r15'), before, 'a rule that never drifted is untouched');

    // Rolling forward neither re-adds September (the drifted recorded row still claims it) nor duplicates.
    assert.deepStrictEqual(Array.from(c.api_generateExpenseRuleOccurrences({}).transactions.filter(t => t.source_rule_id === 'r31')), []);
    const snapshot = JSON.stringify(byRule(c, 'r31'));
    c.migrationAnchorScheduledExpenseDates_();
    assert.equal(JSON.stringify(byRule(c, 'r31')), snapshot, 'idempotent');
  });

  test('an anchored date already taken absorbs its drifted scheduled duplicate', () => {
    const { context: c } = driftedLedger('2026-09-29');
    const transactions = c.getOrCreateSheet('expense_transactions');
    const txHeaders = transactions.getDataRange().getValues()[0];
    transactions.appendRow(c.rowValuesFromObject_(txHeaders, { id: 'paid-oct', vendor: 'Landlord', purchase_date: '2026-10-31', amount: 110, status: 'recorded', source_rule_id: 'r31', source_occurrence_key: '2026-10-31' }));
    c.migrationAnchorScheduledExpenseDates_();
    const october = byRule(c, 'r31').filter(t => t.source_occurrence_key.startsWith('2026-10'));
    assert.deepStrictEqual(october.map(t => t.id), ['paid-oct']);
  });

  function recordedExpense(c, overrides) {
    return c.api_upsertExpenseTransaction(Object.assign({ vendor: 'Officeworks', category: 'Supplies', purchase_date: '2026-09-20', amount: 220, gst_code: 'taxable' }, overrides || {})).transaction;
  }
  function paymentsFor(c, id) { return c.api_listExpenseTransactions({}).find(t => t.id === id); }

  test('payments accumulate against an expense and are listed with their reference', () => {
    const { context: c } = backend();
    const expense = recordedExpense(c);
    const first = c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 100, payment_date: '2026-09-21', reference: 'EFT 123', notes: 'Deposit' });
    assert.equal(first.success, true);
    assert.equal(c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 120, payment_date: '2026-09-28' }).success, true);
    const listed = paymentsFor(c, expense.id);
    assert.equal(listed.paid_amount, 220);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(listed.payments.map(p => [p.payment_date, p.amount, p.reference, p.notes]))), [['2026-09-21', 100, 'EFT 123', 'Deposit'], ['2026-09-28', 120, '', '']]);
  });

  test('a payment is rejected when it overpays, targets a scheduled or void expense, or is not positive', () => {
    const { context: c } = backend();
    const expense = recordedExpense(c);
    c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 200, payment_date: '2026-09-21' });
    const over = c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 20.01, payment_date: '2026-09-22' });
    assert.equal(over.success, false);
    assert.equal(over.error, 'overpayment');
    assert.equal(over.details.balance_due, 20);
    assert.equal(c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 0, payment_date: '2026-09-22' }).error, 'invalid_amount');

    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const upcoming = c.api_listExpenseTransactions({}).find(t => t.source_rule_id === rule.id);
    assert.equal(c.api_addExpensePayment({ expense_transaction_id: upcoming.id, amount: 10, payment_date: '2026-10-15' }).error, 'scheduled_transaction');

    const voided = recordedExpense(c, { vendor: 'Mistake' });
    c.api_voidExpenseTransaction({ id: voided.id, reason: 'duplicate' });
    assert.equal(c.api_addExpensePayment({ expense_transaction_id: voided.id, amount: 10, payment_date: '2026-09-22' }).error, 'void_transaction');
    assert.equal(c.api_addExpensePayment({ expense_transaction_id: 'missing', amount: 10, payment_date: '2026-09-22' }).error, 'not_found');
    assert.equal(paymentsFor(c, expense.id).paid_amount, 200, 'rejected payments write nothing');
  });

  test('a payment can be removed, except from a reconciled expense', () => {
    const { context: c } = backend();
    const expense = recordedExpense(c);
    const payment = c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 220, payment_date: '2026-09-21' }).payment;
    assert.equal(c.api_deleteExpensePayment(payment.id).success, true);
    assert.equal(paymentsFor(c, expense.id).paid_amount, 0);
    assert.equal(c.api_deleteExpensePayment(payment.id).error, 'not_found');

    const again = c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 220, payment_date: '2026-09-21' }).payment;
    assert.equal(c.api_reconcileExpenseTransaction({ id: expense.id, claimable_gst_confirmed: false }).success, true);
    assert.equal(c.api_deleteExpensePayment(again.id).error, 'immutable_transaction');
    assert.equal(paymentsFor(c, expense.id).paid_amount, 220);
  });

  test('recording an expense as paid now creates the expense and its full payment together', () => {
    const { context: c } = backend();
    const result = c.api_upsertExpenseTransaction({ vendor: 'Adobe', purchase_date: '2026-09-20', amount: 79.99, gst_code: 'taxable', payment: { payment_date: '2026-09-20', reference: 'Card 4421' } });
    assert.equal(result.success, true);
    assert.equal(result.payment.amount, 79.99);
    const listed = paymentsFor(c, result.transaction.id);
    assert.equal(listed.status, 'recorded');
    assert.equal(listed.paid_amount, 79.99);
    assert.equal(listed.payments[0].reference, 'Card 4421');
    // A bad payment date is refused before anything is written.
    assert.throws(() => c.api_upsertExpenseTransaction({ vendor: 'Nope', purchase_date: '2026-09-20', amount: 10, payment: { payment_date: '20/09/2026' } }), /Payment date/);
    assert.ok(!c.api_listExpenseTransactions({}).some(t => t.vendor === 'Nope'));
  });

  test('marking a scheduled occurrence paid records it and its payment in one step', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const upcoming = c.api_listExpenseTransactions({}).filter(t => t.source_rule_id === rule.id).sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))[0];
    // Paying needs a recorded expense, so an upcoming one can't be paid while it stays scheduled.
    assert.equal(c.api_upsertExpenseTransaction(Object.assign({}, upcoming, { payment: { payment_date: '2026-10-15' } })).error, 'scheduled_transaction');
    const marked = c.api_upsertExpenseTransaction(Object.assign({}, upcoming, { status: 'recorded', reconciliation_state: 'unreconciled', payment: { payment_date: '2026-10-14', reference: 'DD' } }));
    assert.equal(marked.success, true);
    const listed = paymentsFor(c, upcoming.id);
    assert.equal(listed.status, 'recorded');
    assert.equal(listed.paid_amount, 110);
    // The paid occurrence survives the next schedule save.
    c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 120 }), { id: rule.id }));
    assert.equal(paymentsFor(c, upcoming.id).paid_amount, 110);
    assert.equal(Number(paymentsFor(c, upcoming.id).amount), 110);
  });

  test('an expense cannot be edited below what has already been paid', () => {
    const { context: c } = backend();
    const expense = recordedExpense(c);
    c.api_addExpensePayment({ expense_transaction_id: expense.id, amount: 150, payment_date: '2026-09-21' });
    const result = c.api_upsertExpenseTransaction(Object.assign({}, expense, { amount: 100 }));
    assert.equal(result.error, 'below_paid');
    // Paying the rest through an edit only pays what's still owing.
    const settled = c.api_upsertExpenseTransaction(Object.assign({}, expense, { payment: { payment_date: '2026-09-30' } }));
    assert.equal(settled.payment.amount, 70);
  });

  test('every expense row reports paid, part-paid or unpaid with what is outstanding', () => {
    const client = { expenseToday: () => TODAY };
    vm.runInNewContext(extract(operationsScripts, 'expensePaymentStatus'), client);
    const status = (t) => { const s = client.expensePaymentStatus(t); return [s.label, s.outstanding]; };
    assert.deepStrictEqual(status({ status: 'recorded', amount: 100, paid_amount: 0 }), ['Unpaid', 100]);
    assert.deepStrictEqual(status({ status: 'recorded', amount: 100, paid_amount: 40 }), ['Part-paid', 60]);
    assert.deepStrictEqual(status({ status: 'recorded', amount: 100, paid_amount: 100 }), ['Paid', 0]);
    assert.equal(client.expensePaymentStatus({ status: 'scheduled', purchase_date: '2026-10-15', amount: 100, paid_amount: 0 }).label, 'Upcoming');
    assert.equal(client.expensePaymentStatus({ status: 'scheduled', purchase_date: '2026-09-15', amount: 100, paid_amount: 0 }).label, 'Due');
    assert.equal(client.expensePaymentStatus({ status: 'void', amount: 100, paid_amount: 0 }).label, 'Void');
    // Every row action is labelled and nothing is left disabled without a reason.
    const rows = extract(operationsScripts, 'renderExpenseTransactionRow');
    assert.ok(!/\.disabled\s*=/.test(rows), 'transaction rows never render disabled buttons');
    ['Mark paid', 'Record payment', 'Remove payment', 'Add receipt', 'Reconcile', 'Void'].forEach((label) => assert.ok(rows.includes("'" + label + "'"), label));
  });

  // A reconciled, GST-claimed expense paid across two months, plus an unpaid one: cash and accrual differ.
  function ledgerWithExpenses(c) {
    const paid = recordedExpense(c, { purchase_date: '2026-09-20', amount: 220 });
    c.api_attachExpenseReceipt({ expense_transaction_id: paid.id, url: 'https://example.com/receipt.pdf' });
    c.api_addExpensePayment({ expense_transaction_id: paid.id, amount: 110, payment_date: '2026-09-25' });
    c.api_addExpensePayment({ expense_transaction_id: paid.id, amount: 110, payment_date: '2026-10-02' });
    c.api_reconcileExpenseTransaction({ id: paid.id, claimable_gst_confirmed: true });
    recordedExpense(c, { vendor: 'Unpaid', purchase_date: '2026-10-10', amount: 55 });
  }

  test('monthly company expense totals are the backend BAS figures, on both bases', () => {
    const { context: c } = backend();
    ledgerWithExpenses(c);
    const totals = JSON.parse(JSON.stringify(c.api_getCompanyExpenseMonthlyTotals()));
    assert.deepStrictEqual(totals.months.cash, { '2026-09': { purchases: 110, gst: 10 }, '2026-10': { purchases: 110, gst: 10 } });
    assert.deepStrictEqual(totals.months.accrual, { '2026-09': { purchases: 220, gst: 20 }, '2026-10': { purchases: 55, gst: 0 } });
    ['cash', 'accrual'].forEach((basis) => [8, 9].forEach((month) => {
      const bas = c.api_calculateBasPeriod({ financial_year: 2026, period_type: 'monthly', month: month, accounting_basis: basis });
      const key = '2026-' + String(month + 1).padStart(2, '0');
      const ledger = totals.months[basis][key] || { purchases: 0, gst: 0 };
      assert.equal(ledger.gst, bas.actual.gst_on_purchases, basis + ' 1B for ' + key);
      assert.equal(ledger.purchases, bas.actual.purchases, basis + ' purchases for ' + key);
    }));
    assert.ok(totals.hash, 'a hash lets the client invalidate cached income summaries');
  });

  test('dashboard income and client BAS 1B read company expenses from the ledger, not deductions', () => {
    const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
    const client = {
      GST_RATE: 0.1, Math, Number, String,
      state: {
        companyExpenseLedger: { hash: 'h', months: { cash: { '2026-09': { purchases: 110, gst: 10 } }, accrual: { '2026-09': { purchases: 220, gst: 20 } } } },
        deductions: [
          { id: 'legacy', company_expense: true, active: true, deduction_type: 'standard', amount_type: 'flat', amount_value: 330, gst_inclusive: true },
          { id: 'sacrifice', company_expense: false, active: true, deduction_type: 'standard', amount_type: 'flat', amount_value: 50, gst_inclusive: false }
        ]
      },
      basis: 'cash',
      startOfDay: (d) => d,
      getDeductionOccurrencesWithExceptions: () => [{ amount: null }]
    };
    client.defaultAccountingBasis = () => client.basis;
    vm.runInNewContext(extract(operationsScripts, 'companyLedgerExpensesForMonth') + '\n' + extract(scripts, 'computeMonthlyDeductionTotals'), client);
    const cash = client.computeMonthlyDeductionTotals(2026, 8);
    assert.equal(cash.companyStandardTotal, 100, 'ledger spend less its claimable GST');
    assert.equal(cash.companyGstTotal, 10, 'BAS 1B is the claimable GST from the ledger');
    assert.equal(cash.personalStandardTotal, 50, 'the history-only company deduction counts for nothing');
    client.basis = 'accrual';
    assert.equal(client.computeMonthlyDeductionTotals(2026, 8).companyGstTotal, 20);
    assert.equal(client.computeMonthlyDeductionTotals(2026, 9).companyStandardTotal, 0);
    // BAS 1B in the detail modal is fed by this same total.
    assert.match(scripts, /const field1bGstOnPurchases = periodData\.companyExpensesGst;/);
    assert.match(extract(scripts, 'buildAnnualMonthSummary'), /companyLedgerExpensesForMonth\(year, month\)/);
  });

  test('the Deductions page can no longer create company expenses', () => {
    const deductions = fs.readFileSync(path.join(root, 'views/partials/deductions.html'), 'utf8');
    assert.ok(!deductions.includes('id="deduction-company-expense"'), 'no Company expense toggle');
    assert.match(deductions, /Record it on the Expenses page/);
  });
};

function extract(source, name) {
  const match = source.match(new RegExp('  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(match, 'Expected client function ' + name);
  return match[0];
}
exports.extract = extract;
exports.backend = backend;
