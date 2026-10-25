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

// `creation` is the Expense creation setting; most tests use 'financial_year' so a schedule lists several payments.
function backend(today, creation) {
  const env = createAppsScriptContext({}), c = env.context;
  for (const file of fs.readdirSync(path.join(root, 'backend')).filter(f => f.endsWith('.js'))) vm.runInNewContext(fs.readFileSync(path.join(root, 'backend', file), 'utf8'), c, { filename: file });
  c.assertMigrationsSettled_ = () => true;
  c.cacheGet = () => null; c.cacheSet = () => {}; c.cacheClearPrefix = () => {};
  c.Utilities.computeDigest = (algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()).map(b => b > 127 ? b - 256 : b);
  c.expenseToday_ = () => today || TODAY;
  c.api_updateSettings({ expense_creation: creation || 'financial_year' });
  return env;
}
function scheduled(c, ruleId) {
  return c.api_listExpenseTransactions({}).filter(t => t.source_rule_id === ruleId && t.status === 'scheduled').map(t => t.supplier_invoice_date).sort();
}
function rulePayload(overrides) {
  return Object.assign({ vendor: 'Insurer', description: 'Professional indemnity', category: 'Insurance', amount: 110, gst_code: 'taxable', frequency: 'monthly', start_date: '2026-09-15', end_date: '' }, overrides || {});
}

function splitClient(today) {
  const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
  const constant = (name) => {
    const match = scripts.match(new RegExp('  const ' + name + ' = [\\s\\S]*?\\n  \\};'));
    assert.ok(match, 'Expected client helper ' + name);
    return match[0];
  };
  // `today` is the [year, monthIndex, day, hour] a bare `new Date()` returns on the client.
  const RealDate = Date;
  class FixedDate extends RealDate { constructor(...args) { if (args.length) super(...args); else super(...today); } }
  const calls = [];
  const run = new Proxy({}, { get(_, prop) {
    const call = { success: () => {}, failure: () => {} };
    const builder = new Proxy({}, { get(__, name) {
      if (name === 'withSuccessHandler') return (cb) => { call.success = cb; return builder; };
      if (name === 'withFailureHandler') return (cb) => { call.failure = cb; return builder; };
      return (...args) => { call.method = name; call.args = args; calls.push(call); };
    } });
    return builder[prop];
  } });
  const noop = () => {};
  const client = {
    Date: FixedDate, state: { deductions: [], deductionExceptions: [] }, google: { script: { run } },
    saveCache: noop, setStatus: noop, renderDeductionsList: noop, renderIncomeSummary: noop, renderAnnualCategorySection: noop, loadAnnualData: noop,
    monthKeyFromDateIso: () => null, markIncomeMonthsDirtyForDeductionChange: noop, saveDeductionDirectly: () => assert.fail('a split was needed'),
    dedupeById: (list) => list, beginSliceFetch: () => ({}), endSliceFetch: noop, mergeSliceList: (t, server) => server,
    beginSliceWrite: () => ({ settle: noop, rollback: (list) => list, touch() { return this; } }),
    fetchDeductionsFromServer: noop, fetchDeductionExceptionsFromServer: noop
  };
  vm.runInNewContext([
    'const ISO_DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;',
    extract(scripts, 'normalizeDateInput'),
    'const isoDate = (value) => normalizeDateInput(value);',
    constant('parseIsoDate'),
    scripts.match(/  const startOfDay = .*\n/)[0],
    constant('addDays'),
    constant('addMonthsClamped'),
    scripts.match(/  const DEDUCTION_FREQUENCIES = .*\n/)[0],
    constant('sanitizeDeduction'),
    constant('sanitizeDeductionException'),
    scripts.match(/  const DEDUCTION_OCCURRENCE_LIMIT = .*\n/)[0],
    ...['deductionOccurrenceDate', 'sanitizeDeductionAnchorDay', 'getDeductionOccurrencesBetween', 'deductionDriftedOccurrenceDates',
      'deductionAnchorDay', 'findLastPastOccurrence', 'findNextFutureOccurrence', 'anchorDeductionExceptions', 'splitDeductionExceptionMoves',
      'getDeductionExceptions', 'applyExceptionsToOccurrences', 'getDeductionOccurrencesWithExceptions', 'performSplitDeduction'].map((name) => extract(scripts, name)),
    'this.api = { getDeductionOccurrencesBetween, getDeductionOccurrencesWithExceptions, sanitizeDeduction, performSplitDeduction, isoDate };'
  ].join('\n'), client);
  return { client, calls, RealDate };
}

exports.run = test => {
  test('saving a schedule creates its payments for the Expense creation window', () => {
    // Past dates (2026-09-15) are never created on save; the first is the next due date on or after today.
    const fy = backend(TODAY, 'financial_year').context;
    const result = fy.api_upsertExpenseRule(rulePayload());
    assert.equal(result.success, true);
    const dates = scheduled(fy, result.rule.id);
    assert.deepStrictEqual([dates[0], dates[dates.length - 1], dates.length, result.created_count, result.through_date], ['2026-10-15', '2027-06-15', 9, 9, '2027-06-30']);
    const month = backend(TODAY, 'month').context;
    assert.deepStrictEqual(scheduled(month, month.api_upsertExpenseRule(rulePayload()).rule.id), ['2026-10-15'], 'current month (the default)');
    const onDate = backend(TODAY, 'on_date').context;
    assert.deepStrictEqual(scheduled(onDate, onDate.api_upsertExpenseRule(rulePayload()).rule.id), [], 'nothing until a payment is due');
    const dueToday = backend('2026-10-15', 'on_date').context;
    assert.deepStrictEqual(scheduled(dueToday, dueToday.api_upsertExpenseRule(rulePayload()).rule.id), ['2026-10-15'], 'on its due date');
    assert.equal(month.expenseCreationWindowEnd_('month', '2026-02-10'), '2026-02-28');
    assert.equal(month.expenseCreationWindowEnd_('financial_year', '2027-03-01'), '2027-06-30');
    assert.throws(() => month.api_updateSettings({ expense_creation: 'yearly' }), /List scheduled expenses must be/);
    month.getOrCreateSheet('user_settings').appendRow(['expense_creation', '', 'string']);
  });

  test('a schedule end date bounds its occurrences', () => {
    const { context: c } = backend();
    const result = c.api_upsertExpenseRule(rulePayload({ end_date: '2027-01-20' }));
    assert.deepStrictEqual(scheduled(c, result.rule.id), ['2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15']);
    // Ending before the first payment is allowed and simply lists nothing (Ends today on a schedule not yet started).
    const never = c.api_upsertExpenseRule(rulePayload({ start_date: '2026-11-01', end_date: '2026-10-01' }));
    assert.deepStrictEqual([never.success, scheduled(c, never.rule.id)], [true, []]);
  });

  test('editing a schedule regenerates future occurrences and leaves paid ones alone', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const first = c.api_listExpenseTransactions({}).find(t => t.source_rule_id === rule.id && t.supplier_invoice_date === '2026-10-15');
    // The user pays October's occurrence, so it becomes real history.
    assert.equal(c.api_markExpensePaid({ id: first.id, paid_date: '2026-10-15' }).success, true);

    const edited = c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 132, end_date: '2027-03-31' }), { id: rule.id, confirm_changes: true }));
    assert.equal(edited.success, true);
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15', '2027-03-15'], 'future occurrences are rebuilt, not deleted');
    const all = c.api_listExpenseTransactions({}).filter(t => t.source_rule_id === rule.id);
    assert.ok(all.filter(t => t.status === 'scheduled').every(t => Number(t.amount) === 132), 'regenerated occurrences use the new amount');
    const recorded = all.find(t => t.id === first.id);
    assert.equal(recorded.status, 'recorded');
    assert.equal(Number(recorded.amount), 110, 'recorded occurrence keeps its original amount');
    assert.equal(recorded.paid_date, '2026-10-15');
    assert.equal(all.filter(t => t.supplier_invoice_date === '2026-10-15').length, 1, 'a paid date is not scheduled again');
  });

  test('the Active flag no longer pauses a schedule: the end date is the only control', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const saved = c.api_upsertExpenseRule(Object.assign(rulePayload(), { id: rule.id, active: false }));
    assert.deepStrictEqual([saved.rule.active, scheduled(c, rule.id).length], ['TRUE', 9]);
    // A row still flagged inactive in the sheet keeps listing and generating.
    const sheet = c.getOrCreateSheet('expense_rules');
    const headers = sheet.getDataRange().getValues()[0];
    sheet.getRange(2, headers.indexOf('active') + 1).setValue('FALSE');
    assert.equal(c.api_listExpenseRules({}).length, 1);
  });

  test('setting an end date before a Due payment removes it once confirmed (the reported case)', () => {
    // Created on 1 Oct for the month; by 25 Oct the 15 Oct payment is Due and unpaid.
    const { context: c } = backend('2026-10-01', 'month');
    const rule = c.api_upsertExpenseRule(rulePayload({ vendor: 'Gym', amount: 50 })).rule;
    c.expenseToday_ = () => '2026-10-25';
    const asked = c.api_upsertExpenseRule(Object.assign({}, rule, { end_date: '2026-10-10' }));
    assert.equal(asked.error, 'schedule_changes');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(asked.details.removed)).map((p) => [p.date, p.due]), [['2026-10-15', true]]);
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-10-15'], 'nothing changes until confirmed');
    const done = c.api_upsertExpenseRule(Object.assign({}, rule, { end_date: '2026-10-10', confirm_changes: true }));
    assert.deepStrictEqual([done.success, done.removed_count, scheduled(c, rule.id)], [true, 1, []]);
  });

  test('an end date removes edited payments after it too, and Ends today keeps Due ones up to today', () => {
    const { context: c } = backend('2026-10-01', 'financial_year');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const january = c.api_listExpenseTransactions({ status: 'scheduled' }).find((t) => t.supplier_invoice_date === '2027-01-15');
    c.api_upsertExpenseTransaction(Object.assign({}, january, { amount: 99 }));
    c.expenseToday_ = () => '2026-10-20';
    assert.equal(c.api_archiveExpenseRule(rule.id).success, true, 'Ends today (the old Stop schedule call)');
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-10-15'], 'the Due 15 Oct payment stays to be paid or skipped');
    assert.equal(c.api_listExpenseRules({})[0].end_date, '2026-10-20');
    // Clearing the end date restarts creation from today; nothing before today is back-filled.
    c.api_upsertExpenseRule(Object.assign({}, c.api_listExpenseRules({})[0], { end_date: '' }));
    assert.deepStrictEqual(scheduled(c, rule.id).slice(0, 3), ['2026-10-15', '2026-11-15', '2026-12-15']);
    assert.equal(scheduled(c, rule.id).length, 9);
  });

  test('opening Tempus removes unpaid payments past an end date set in the sheet', () => {
    const { context: c } = backend('2026-10-01', 'financial_year');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const sheet = c.getOrCreateSheet('expense_rules');
    const headers = sheet.getDataRange().getValues()[0];
    sheet.getRange(2, headers.indexOf('end_date') + 1).setValue('2026-11-30');
    c.expenseToday_ = () => '2026-12-20';
    c.api_ensureExpenseOccurrences();
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-10-15', '2026-11-15']);
  });

  test('the upgrade gives a paused schedule an end date so it stays stopped', () => {
    const { context: c } = backend('2026-10-25', 'financial_year');
    c.api_listExpenseRules({});
    const sheet = c.getOrCreateSheet('expense_rules');
    const headers = sheet.getDataRange().getValues()[0];
    const add = (rule) => sheet.appendRow(c.rowValuesFromObject_(headers, Object.assign({ vendor: 'V', amount: 10, gst_code: 'taxable', gst_amount: 0.91, frequency: 'monthly', start_date: '2026-01-15', end_date: '', notes: '' }, rule)));
    add({ id: 'paused', active: 'FALSE', updated_at: '2026-08-20T03:00:00Z' });
    add({ id: 'ended-sooner', active: 'FALSE', end_date: '2026-05-31', updated_at: '2026-08-20T03:00:00Z' });
    add({ id: 'future', active: 'FALSE', start_date: '2027-01-01', updated_at: '2026-08-20T03:00:00Z' });
    add({ id: 'running', active: 'TRUE', updated_at: '2026-08-20T03:00:00Z' });
    c.migrationScheduleEndDates_();
    const rules = Object.fromEntries(c.api_listExpenseRules({}).map((r) => [r.id, r]));
    assert.deepStrictEqual(['paused', 'ended-sooner', 'future', 'running'].map((id) => [String(rules[id].end_date), String(rules[id].active)]),
      [['2026-08-19', 'TRUE'], ['2026-05-31', 'TRUE'], ['2026-08-19', 'TRUE'], ['', 'TRUE']]);
    assert.match(rules.paused.notes, /Was paused; given an end date of 2026-08-19/);
    c.api_ensureExpenseOccurrences();
    assert.deepStrictEqual(['paused', 'ended-sooner', 'future'].map((id) => scheduled(c, id).length), [0, 0, 0], 'none restart');
    assert.equal(scheduled(c, 'running').length, 8);
    assert.ok(c.listMigrations().some((m) => m.id === '2026-10-schedule-end-dates'));
  });

  test('a skipped payment can be restored as it was, but not past the schedule end date', () => {
    const { context: c } = backend('2026-10-01', 'financial_year');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const byDate = (d) => c.api_listExpenseTransactions({}).find((t) => t.source_rule_id === rule.id && t.supplier_invoice_date === d);
    c.api_skipExpenseOccurrence({ id: byDate('2026-11-15').id });
    assert.equal(byDate('2026-11-15').status, 'skipped', 'still listed so it can be found again');
    assert.equal(c.api_restoreExpenseTransaction({ id: byDate('2026-11-15').id }).status, 'scheduled');
    assert.equal(byDate('2026-11-15').status, 'scheduled');
    // A paid payment that was deleted comes back paid.
    c.api_markExpensePaid({ id: byDate('2026-10-15').id, paid_date: '2026-10-15' });
    c.api_deleteExpenseTransaction({ id: byDate('2026-10-15').id });
    assert.equal(byDate('2026-10-15').status, 'skipped');
    assert.equal(c.api_restoreExpenseTransaction({ id: byDate('2026-10-15').id }).status, 'recorded');
    assert.equal(byDate('2026-10-15').paid_date, '2026-10-15');
    // Skipped payments are history: ending the schedule leaves them, and they can't be restored past the end.
    c.api_skipExpenseOccurrence({ id: byDate('2027-02-15').id });
    c.api_upsertExpenseRule(Object.assign(rulePayload({ end_date: '2026-12-31' }), { id: rule.id, confirm_changes: true }));
    const refused = c.api_restoreExpenseTransaction({ id: byDate('2027-02-15').id });
    assert.deepStrictEqual([refused.error, byDate('2027-02-15').status], ['after_end_date', 'skipped']);
    assert.equal(c.api_restoreExpenseTransaction({ id: byDate('2026-11-15').id }).error, 'not_skipped');
  });

  test('the ledger lists skipped payments in a folded Skipped group with Restore', () => {
    assert.match(operationsScripts, /if \(transaction\.status === 'skipped'\) return \{ key:'skipped', label:'Skipped'/);
    assert.match(operationsScripts, /if \(skipped\.length && expenseLedgerGroupHead\(list, 'skipped', 'Skipped', skipped\)\) skipped\.forEach/);
    assert.match(operationsScripts, /folded:Object\.assign\(\{ upcoming:false, recorded:false, skipped:true \}/, 'Skipped starts folded');
    assert.match(operationsScripts, /expenseConfirmButton\('Restore', 'Confirm restore', \(\) => expenseCall\('api_restoreExpenseTransaction'/);
  });

  test('a change that leaves unpaid payments as they are saves without asking', () => {
    const { context: c } = backend('2026-10-01', 'financial_year');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const saved = c.api_upsertExpenseRule(Object.assign(rulePayload({ notes: 'Renewed for 2027' }), { id: rule.id }));
    assert.deepStrictEqual([saved.success, saved.updated_count, saved.removed_count, scheduled(c, rule.id).length], [true, 0, 0, 9]);
    // Extending the end date only adds payments.
    c.api_upsertExpenseRule(Object.assign(rulePayload({ end_date: '2026-12-31' }), { id: rule.id, confirm_changes: true }));
    assert.equal(c.api_upsertExpenseRule(Object.assign(rulePayload({ end_date: '2027-02-28' }), { id: rule.id })).success, true);
    assert.equal(scheduled(c, rule.id).length, 5);
  });

  test('changing the amount asks first, updates upcoming payments, and holds Due and edited ones unless chosen', () => {
    const { context: c } = backend('2026-10-01', 'financial_year');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const december = c.api_listExpenseTransactions({ status: 'scheduled' }).find((t) => t.supplier_invoice_date === '2026-12-15');
    c.api_upsertExpenseTransaction(Object.assign({}, december, { amount: 99 }));
    c.expenseToday_ = () => '2026-10-20';
    const asked = c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 120 }), { id: rule.id }));
    assert.equal(asked.error, 'schedule_changes');
    const details = JSON.parse(JSON.stringify(asked.details));
    assert.deepStrictEqual([details.removed.length, details.updated.length, details.held.map((p) => [p.date, p.due, p.edited])],
      [0, 7, [['2026-10-15', true, false], ['2026-12-15', false, true]]]);
    const amounts = () => Object.fromEntries(c.api_listExpenseTransactions({ status: 'scheduled' }).map((t) => [t.supplier_invoice_date, Number(t.amount)]));
    const kept = c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 120 }), { id: rule.id, confirm_changes: true }));
    assert.deepStrictEqual([kept.updated_count, kept.kept_count], [7, 2]);
    assert.deepStrictEqual([amounts()['2026-10-15'], amounts()['2026-11-15'], amounts()['2026-12-15']], [110, 120, 99]);
    const all = c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 130 }), { id: rule.id, confirm_changes: true, apply_to_held: true }));
    assert.deepStrictEqual([all.updated_count, all.kept_count], [9, 0]);
    assert.ok(Object.values(amounts()).every((a) => a === 130));
    assert.equal(scheduled(c, rule.id).length, 9, 'nothing duplicated');
    assert.ok(c.api_listExpenseTransactions({ status: 'scheduled' }).every((t) => t.occurrence_edited !== 'TRUE'));
  });

  test('opening Tempus creates payments up to the window, including any missed since last time', () => {
    const { context: c } = backend(TODAY, 'month');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-10-15']);
    assert.equal(c.api_ensureExpenseOccurrences().created_count, 0, 'nothing new within the same month');
    // Not opened again until December: November's payment was missed, so it appears too (as Due).
    c.expenseToday_ = () => '2026-12-05';
    const caught = c.api_ensureExpenseOccurrences();
    assert.deepStrictEqual([caught.created_count, caught.through_date], [2, '2026-12-31']);
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-10-15', '2026-11-15', '2026-12-15']);
    assert.equal(c.api_listExpenseRules({}).find((r) => r.id === rule.id).generated_through, '2026-12-31');
    assert.equal(c.api_ensureExpenseOccurrences().created_count, 0, 'running again adds nothing');
  });

  test('switching Expense creation to a shorter window removes upcoming payments past it, except edited ones', () => {
    const { context: c } = backend(TODAY, 'financial_year');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const march = c.api_listExpenseTransactions({ status: 'scheduled' }).find((t) => t.supplier_invoice_date === '2027-03-15');
    c.api_upsertExpenseTransaction(Object.assign({}, march, { amount: 150 }));
    c.api_updateSettings({ expense_creation: 'month' });
    const result = c.api_ensureExpenseOccurrences();
    assert.equal(result.removed_count, 7);
    assert.deepStrictEqual(scheduled(c, rule.id), ['2026-10-15', '2027-03-15'], 'this month, plus the payment edited by hand');
    // Back to the financial year: the rest are created again, alongside the edited one.
    c.api_updateSettings({ expense_creation: 'financial_year' });
    c.api_ensureExpenseOccurrences();
    assert.equal(scheduled(c, rule.id).length, 9);
    assert.equal(Number(c.api_listExpenseTransactions({}).find((t) => t.id === march.id).amount), 150);
  });

  test('editing a schedule keeps an upcoming payment that was changed by hand', () => {
    const { context: c } = backend(TODAY, 'financial_year');
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const december = c.api_listExpenseTransactions({ status: 'scheduled' }).find((t) => t.supplier_invoice_date === '2026-12-15');
    assert.equal(c.api_upsertExpenseTransaction(Object.assign({}, december, { amount: 99 })).transaction.occurrence_edited, 'TRUE');
    const saved = c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 120 }), { id: rule.id, confirm_changes: true }));
    assert.deepStrictEqual([saved.kept_edited_count, saved.removed_count, saved.updated_count, saved.created_count], [1, 0, 8, 8]);
    const all = c.api_listExpenseTransactions({ status: 'scheduled' });
    assert.deepStrictEqual(all.filter((t) => t.supplier_invoice_date === '2026-12-15').map((t) => [t.id, Number(t.amount)]), [[december.id, 99]], 'kept, not duplicated');
    assert.ok(all.filter((t) => t.id !== december.id).every((t) => Number(t.amount) === 120));
    // Ending the schedule before its next payment removes everything upcoming, edited or not.
    c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 120, end_date: '2026-10-01' }), { id: rule.id, confirm_changes: true }));
    assert.deepStrictEqual(scheduled(c, rule.id), []);
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
    const r31Count = byRule(c, 'r31').length;
    c.api_ensureExpenseOccurrences();
    assert.equal(byRule(c, 'r31').length, r31Count);
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

  function paidExpense(c, overrides) {
    return c.api_upsertExpenseTransaction(Object.assign({ vendor: 'Officeworks', category: 'Supplies', paid_date: '2026-09-20', amount: 220, gst_code: 'taxable' }, overrides || {})).transaction;
  }
  const find = (c, id) => c.api_listExpenseTransactions({}).find(t => t.id === id);
  const monthTotals = (c) => JSON.parse(JSON.stringify(c.api_getCompanyExpenseMonthlyTotals())).months;

  test('a paid expense stores its paid date and how it was paid, and refuses unknown methods', () => {
    const { context: c } = backend();
    const result = c.api_upsertExpenseTransaction({ vendor: 'Adobe', paid_date: '2026-09-20', amount: 79.99, gst_code: 'taxable', payment_method: 'credit CARD', payment_reference: 'Card 4421' });
    assert.equal(result.success, true);
    const listed = find(c, result.transaction.id);
    assert.deepStrictEqual([listed.status, listed.paid_date, listed.payment_method, listed.payment_reference, listed.supplier_invoice_date], ['recorded', '2026-09-20', 'Credit card', 'Card 4421', '']);
    assert.equal(Number(listed.gst_amount), 7.27, 'taxable GST defaults to one-eleventh');
    assert.throws(() => c.api_upsertExpenseTransaction({ vendor: 'Refused', paid_date: '2026-09-20', amount: 10, payment_method: 'IOU' }), /Payment method must be one of/);
    assert.throws(() => c.api_upsertExpenseTransaction({ vendor: 'Nope', paid_date: '20/09/2026', amount: 10 }), /Paid date/);
    assert.ok(!c.api_listExpenseTransactions({}).some(t => t.vendor === 'Refused' || t.vendor === 'Nope'), 'a refused save writes nothing');
    assert.ok(!('payments' in listed) && !('paid_amount' in listed), 'no payment records');
  });

  test('an unpaid expense needs an invoice date, counts on accrual only, and Mark paid moves it to cash', () => {
    const { context: c } = backend();
    assert.throws(() => c.api_upsertExpenseTransaction({ vendor: 'Bill', amount: 110, gst_code: 'taxable' }), /needs an invoice date/);
    const bill = c.api_upsertExpenseTransaction({ vendor: 'Bill', amount: 110, gst_code: 'taxable', supplier_invoice_date: '2026-09-10' }).transaction;
    assert.equal(bill.paid_date, '');
    assert.deepStrictEqual(monthTotals(c), { cash: {}, accrual: { '2026-09': { purchases: 110, gst: 10 } } });
    assert.equal(c.api_listExpenseTransactions({ status: 'unpaid' }).length, 1);
    const paid = c.api_markExpensePaid({ id: bill.id, paid_date: '2026-10-02', payment_method: 'EFT' });
    assert.equal(paid.success, true);
    assert.deepStrictEqual(monthTotals(c), { cash: { '2026-10': { purchases: 110, gst: 10 } }, accrual: { '2026-09': { purchases: 110, gst: 10 } } }, 'accrual stays on the earlier invoice date');
    assert.equal(c.api_listExpenseTransactions({ status: 'paid' })[0].payment_method, 'EFT');
    // Paid again on the same expense simply corrects the date.
    c.api_markExpensePaid({ id: bill.id, paid_date: '2026-10-03' });
    assert.equal(find(c, bill.id).paid_date, '2026-10-03');
  });

  test('accrual counts an expense on the earlier of its invoice and paid dates', () => {
    const { context: c } = backend();
    paidExpense(c, { vendor: 'Prepaid', paid_date: '2026-08-28', supplier_invoice_date: '2026-09-03', amount: 22 });
    paidExpense(c, { vendor: 'Invoiced first', paid_date: '2026-10-05', supplier_invoice_date: '2026-09-25', amount: 33 });
    paidExpense(c, { vendor: 'No invoice date', paid_date: '2026-09-12', amount: 11 });
    const months = monthTotals(c);
    assert.deepStrictEqual(months.cash, { '2026-08': { purchases: 22, gst: 2 }, '2026-09': { purchases: 11, gst: 1 }, '2026-10': { purchases: 33, gst: 3 } });
    assert.deepStrictEqual(months.accrual, { '2026-08': { purchases: 22, gst: 2 }, '2026-09': { purchases: 44, gst: 4 } });
  });

  test('the GST credit follows the GST treatment and business use, with no receipt or reconciliation', () => {
    const { context: c } = backend();
    const ids = {
      taxable: paidExpense(c, { vendor: 'Taxable', amount: 110 }).id,
      gstFree: paidExpense(c, { vendor: 'GST-free', amount: 50, gst_code: 'gst_free' }).id,
      inputTaxed: paidExpense(c, { vendor: 'Input taxed', amount: 20, gst_code: 'input_taxed' }).id,
      outOfScope: paidExpense(c, { vendor: 'Out of scope', amount: 30, gst_code: 'out_of_scope', gst_amount: 3 }).id,
      half: paidExpense(c, { vendor: 'Half business', amount: 220, business_use_percentage: 50 }).id,
      corrected: paidExpense(c, { vendor: 'Invoice says 9', amount: 110, gst_amount: 9 }).id
    };
    c.api_upsertExpenseRule(rulePayload({ start_date: '2026-10-15' }));
    const gstOf = (id) => c.expenseClaimableGst_(find(c, id));
    assert.deepStrictEqual(Object.keys(ids).map((key) => [key, gstOf(ids[key])]), [['taxable', 10], ['gstFree', 0], ['inputTaxed', 0], ['outOfScope', 0], ['half', 10], ['corrected', 9]]);
    assert.ok(c.api_listExpenseTransactions({}).filter(t => t.status === 'scheduled').every(t => c.expenseClaimableGst_(t) === 0), 'forecasts carry no credit');
    assert.equal(find(c, ids.outOfScope).gst_amount, 0, 'a non-taxable expense holds no GST');
    const bas = c.api_calculateBasPeriod({ financial_year: 2026, period_type: 'monthly', month: 8, accounting_basis: 'cash' }).actual;
    assert.deepStrictEqual([bas.purchases, bas.gst_on_purchases], [540, 29], 'business use scales only the credit: the full amount still counts');
    const split = c.api_getMonthlyTransferSplit({ financial_year: 2026 }).months.find((m) => m.expenses_paid > 0);
    assert.equal(split.expenses_ex_gst, 511, 'the pay split takes expenses off ex-GST: 540 paid less 29 GST');
    // Always editable.
    const edited = c.api_upsertExpenseTransaction(Object.assign({}, find(c, ids.taxable), { amount: 121, gst_amount: 11 }));
    assert.equal(edited.success, true);
    assert.equal(gstOf(ids.taxable), 11);
  });

  test('marking a scheduled payment paid makes it an expense, and it survives the next schedule save', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const upcoming = c.api_listExpenseTransactions({ status: 'scheduled' }).sort((a, b) => a.supplier_invoice_date.localeCompare(b.supplier_invoice_date))[0];
    assert.equal(upcoming.supplier_invoice_date, '2026-10-15');
    const marked = c.api_markExpensePaid({ id: upcoming.id, paid_date: '2026-10-14', payment_method: 'Direct debit', payment_reference: 'DD' });
    assert.equal(marked.success, true);
    const listed = find(c, upcoming.id);
    assert.deepStrictEqual([listed.status, listed.paid_date, listed.supplier_invoice_date, listed.payment_method], ['recorded', '2026-10-14', '2026-10-15', 'Direct debit']);
    c.api_upsertExpenseRule(Object.assign(rulePayload({ amount: 120 }), { id: rule.id }));
    assert.equal(find(c, upcoming.id).paid_date, '2026-10-14');
    assert.equal(Number(find(c, upcoming.id).amount), 110);
    // Editing an upcoming payment with a paid date pays it too.
    const next = c.api_listExpenseTransactions({ status: 'scheduled' }).find(t => t.supplier_invoice_date === '2026-11-15');
    assert.equal(c.api_upsertExpenseTransaction(Object.assign({}, next, { amount: 99, paid_date: '2026-11-15' })).transaction.status, 'recorded');
    const later = c.api_listExpenseTransactions({ status: 'scheduled' }).find(t => t.supplier_invoice_date === '2026-12-15');
    assert.equal(c.api_upsertExpenseTransaction(Object.assign({}, later, { amount: 99 })).transaction.status, 'scheduled', 'editing just this payment keeps it upcoming');
    assert.throws(() => c.api_upsertExpenseTransaction(Object.assign({}, later, { supplier_invoice_date: '' })), /needs a due date/);
  });

  test('skip and delete keep a schedule payment claimed, and delete removes a one-off', () => {
    const { context: c } = backend();
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    const oct = c.api_listExpenseTransactions({ status: 'scheduled' }).find(t => t.supplier_invoice_date === '2026-10-15');
    const nov = c.api_listExpenseTransactions({ status: 'scheduled' }).find(t => t.supplier_invoice_date === '2026-11-15');
    assert.equal(c.api_skipExpenseOccurrence({ id: oct.id }).success, true);
    c.api_markExpensePaid({ id: nov.id, paid_date: '2026-11-15' });
    assert.equal(c.api_deleteExpenseTransaction({ id: nov.id }).success, true);
    assert.deepStrictEqual([find(c, oct.id).status, find(c, nov.id).status], ['skipped', 'skipped']);
    c.api_upsertExpenseRule(Object.assign(rulePayload(), { id: rule.id }));
    c.api_generateExpenseRuleOccurrences({});
    assert.ok(!scheduled(c, rule.id).includes('2026-10-15') && !scheduled(c, rule.id).includes('2026-11-15'), 'neither comes back');
    assert.equal(monthTotals(c).cash['2026-11'], undefined, 'a deleted payment no longer counts');
    assert.equal(c.api_skipExpenseOccurrence({ id: oct.id }).error, 'not_scheduled');

    const oneOff = paidExpense(c, { vendor: 'Mistake' });
    assert.equal(c.api_deleteExpenseTransaction({ id: oneOff.id }).success, true);
    assert.equal(find(c, oneOff.id), undefined);
    assert.equal(c.api_deleteExpenseTransaction({ id: oneOff.id }).error, 'not_found');
  });

  test('a change to a submitted BAS period warns first and saves once confirmed', () => {
    const { context: c } = backend();
    const basSheet = c.getOrCreateSheet('bas_submissions');
    basSheet.appendRow(c.rowValuesFromObject_(basSheet.getDataRange().getValues()[0], { id: 'bas-sep', financial_year: 2026, period_type: 'monthly', month: 8, submitted: 'TRUE', submission_state: 'submitted', accounting_basis: 'cash' }));
    basSheet.appendRow(c.rowValuesFromObject_(basSheet.getDataRange().getValues()[0], { id: 'bas-q1-draft', financial_year: 2026, period_type: 'quarterly', quarter: 1, submitted: 'FALSE', accounting_basis: 'cash' }));
    const warned = c.api_upsertExpenseTransaction({ vendor: 'Late', paid_date: '2026-09-20', amount: 110, gst_code: 'taxable' });
    assert.equal(warned.error, 'submitted_bas_period');
    assert.deepStrictEqual(Array.from(warned.details.periods), ['September 2026']);
    assert.match(warned.message, /September 2026, which is marked as submitted/);
    assert.ok(!c.api_listExpenseTransactions({}).length, 'nothing is saved until confirmed');
    const saved = c.api_upsertExpenseTransaction({ vendor: 'Late', paid_date: '2026-09-20', amount: 110, gst_code: 'taxable', confirm_submitted_bas: true });
    assert.equal(saved.success, true);
    const expense = find(c, saved.transaction.id);
    assert.equal(c.api_upsertExpenseTransaction(Object.assign({}, expense, { notes: 'just a note' })).success, true, 'a change that leaves the figures alone needs no warning');
    assert.equal(c.api_upsertExpenseTransaction(Object.assign({}, expense, { paid_date: '2026-10-01' })).error, 'submitted_bas_period', 'moving it out of the period changes it');
    assert.equal(c.api_deleteExpenseTransaction({ id: expense.id }).error, 'submitted_bas_period');
    assert.equal(c.api_deleteExpenseTransaction({ id: expense.id, confirm_submitted_bas: true }).success, true);
    // An unpaid expense invoiced in September doesn't touch a cash-basis BAS until it's paid there.
    const bill = c.api_upsertExpenseTransaction({ vendor: 'Bill', amount: 55, supplier_invoice_date: '2026-09-05' });
    assert.equal(bill.success, true);
    assert.equal(c.api_markExpensePaid({ id: bill.transaction.id, paid_date: '2026-09-30' }).error, 'submitted_bas_period');
    assert.equal(c.api_markExpensePaid({ id: bill.transaction.id, paid_date: '2026-10-30' }).success, true);
  });

  test('the payment method defaults to the vendor\'s last method, then the last used, then EFT', () => {
    const client = { operationsState: { transactions: [] }, Option: function(text, value) { this.text = text; this.value = value; } };
    vm.runInNewContext(operationsScripts.slice(operationsScripts.indexOf('  const PAYMENT_METHOD_OPTIONS'), operationsScripts.indexOf('  function operationsApi(')), client);
    vm.runInNewContext('this.pick = expenseDefaultPaymentMethod;', client);
    assert.equal(client.pick('Adobe'), 'EFT');
    client.operationsState.transactions = [
      { vendor: 'Adobe', paid_date: '2026-07-01', payment_method: 'Credit card' },
      { vendor: 'Adobe', paid_date: '2026-08-01', payment_method: '' },
      { vendor: 'Landlord', paid_date: '2026-09-01', payment_method: 'Direct debit' },
      { vendor: 'Unpaid', paid_date: '', payment_method: 'Cash' }
    ];
    assert.equal(client.pick(' adobe '), 'Credit card', 'same vendor wins, ignoring case and spacing');
    assert.equal(client.pick('Officeworks'), 'Direct debit', 'otherwise the most recent method');
    const backendList = fs.readFileSync(path.join(root, 'backend/integrity.js'), 'utf8').match(/var PAYMENT_METHODS = (\[[^\]]*\]);/)[1];
    const clientList = operationsScripts.match(/const PAYMENT_METHOD_OPTIONS = (\[[^\]]*\]);/)[1];
    assert.equal(clientList, backendList, 'client and backend offer the same methods');
  });

  test('every expense row is paid, unpaid, due or upcoming, with no reconcile, void or part payments', () => {
    const client = { expenseToday: () => TODAY };
    vm.runInNewContext(extract(operationsScripts, 'expensePaymentStatus') + '\n' + extract(operationsScripts, 'expenseDefaultPaidDate'), client);
    const label = (t) => client.expensePaymentStatus(t).label;
    assert.equal(label({ status: 'recorded', paid_date: '2026-09-01', amount: 100 }), 'Paid');
    assert.equal(label({ status: 'recorded', paid_date: '', supplier_invoice_date: '2026-09-01', amount: 100 }), 'Unpaid');
    assert.equal(label({ status: 'scheduled', supplier_invoice_date: '2026-10-15' }), 'Upcoming');
    assert.equal(label({ status: 'scheduled', supplier_invoice_date: '2026-09-15' }), 'Due');
    assert.equal(client.expenseDefaultPaidDate({ status: 'scheduled', supplier_invoice_date: '2026-09-15' }), '2026-09-15', 'a due payment defaults to its due date');
    assert.equal(client.expenseDefaultPaidDate({ status: 'scheduled', supplier_invoice_date: '2026-10-15' }), TODAY, 'paying early defaults to today');
    const rows = extract(operationsScripts, 'renderExpenseTransactionRow');
    assert.ok(!/\.disabled\s*=/.test(rows), 'transaction rows never render disabled buttons');
    ['Mark paid', 'Edit', 'Skip', 'Delete', 'Restore'].forEach((text) => assert.ok(rows.includes("'" + text + "'"), text));
    assert.ok(extract(operationsScripts, 'renderExpenseReceiptLinks').includes("'Remove receipt'"), 'receipts are removed from the link list');
    ['Reconcile', 'Void', 'Record payment', 'Remove payment', 'Record as unpaid bill'].forEach((text) => assert.ok(!operationsScripts.includes("'" + text + "'"), 'no ' + text));
    ['api_addExpensePayment', 'api_deleteExpensePayment', 'api_voidExpenseTransaction', 'api_reconcileExpenseTransaction'].forEach((name) => assert.ok(!operationsScripts.includes(name), name + ' is gone'));
    // Saving goes through the submitted-BAS confirmation.
    assert.match(operationsScripts, /async function expenseCall\(api, payload\) \{[\s\S]*?result\.error !== 'submitted_bas_period'[\s\S]*?confirm_submitted_bas:true/);
    assert.match(operationsScripts, /expenseCall\('api_upsertExpenseTransaction', payload\)/);
  });

  // One expense paid in September and invoiced in August, and an unpaid one invoiced in October.
  function ledgerWithExpenses(c) {
    paidExpense(c, { supplier_invoice_date: '2026-08-25', paid_date: '2026-09-25', amount: 220 });
    c.api_upsertExpenseTransaction({ vendor: 'Unpaid', supplier_invoice_date: '2026-10-10', amount: 55, gst_code: 'gst_free' });
  }

  test('monthly company expense totals are the backend BAS figures, on both bases', () => {
    const { context: c } = backend();
    ledgerWithExpenses(c);
    const totals = JSON.parse(JSON.stringify(c.api_getCompanyExpenseMonthlyTotals()));
    assert.deepStrictEqual(totals.months.cash, { '2026-09': { purchases: 220, gst: 20 } });
    assert.deepStrictEqual(totals.months.accrual, { '2026-08': { purchases: 220, gst: 20 }, '2026-10': { purchases: 55, gst: 0 } });
    ['cash', 'accrual'].forEach((basis) => [7, 8, 9].forEach((month) => {
      const bas = c.api_calculateBasPeriod({ financial_year: 2026, period_type: 'monthly', month: month, accounting_basis: basis });
      const key = '2026-' + String(month + 1).padStart(2, '0');
      const ledger = totals.months[basis][key] || { purchases: 0, gst: 0 };
      assert.equal(ledger.gst, bas.actual.gst_on_purchases, basis + ' 1B for ' + key);
      assert.equal(ledger.purchases, bas.actual.purchases, basis + ' purchases for ' + key);
    }));
    const october = c.api_calculateBasPeriod({ financial_year: 2026, period_type: 'monthly', month: 9, accounting_basis: 'cash' });
    assert.equal(october.variance.unpaid_expenses, 55);
    assert.ok(october.warnings.some((w) => /unpaid/.test(w)));
    assert.ok(totals.hash, 'a hash lets the client invalidate cached income summaries');
  });

  test('the FY report and CSV use paid and invoice dates, with GST credits and business use', () => {
    const { context: c } = backend();
    ledgerWithExpenses(c);
    paidExpense(c, { vendor: 'Half', paid_date: '2026-11-02', amount: 110, business_use_percentage: 50, payment_method: 'EFT', payment_reference: 'r1' });
    c.api_upsertExpenseRule(rulePayload({ start_date: '2027-01-15', end_date: '2027-03-15' }));
    const cash = JSON.parse(JSON.stringify(c.api_getExpenseReport({ financial_year: 2026 })));
    assert.equal(cash.accounting_basis, 'cash');
    assert.deepStrictEqual(cash.totals, { counted: 330, gst_credits: 25, unpaid: 55, scheduled: 330 });
    const accrual = JSON.parse(JSON.stringify(c.api_getExpenseReport({ financial_year: 2026, accounting_basis: 'accrual' })));
    assert.deepStrictEqual(accrual.totals, { counted: 385, gst_credits: 25, unpaid: 55, scheduled: 330 });
    const csv = c.api_exportExpenseReportCsv({ financial_year: 2026 }).csv.split('\r\n').map((line) => line.replace(/"/g, ''));
    assert.equal(csv[0], 'Paid date,Invoice date,Vendor,ABN,Description,Category,Amount inc GST,Amount ex GST,GST code,GST amount,Business use,Claimable GST,Paid by,Reference,Status');
    assert.ok(csv.includes('2026-11-02,,Half,,,Supplies,110,100,taxable,10,50%,5,EFT,r1,Paid'));
    assert.ok(csv.includes(',2026-10-10,Unpaid,,,,55,55,gst_free,0,100%,0,,,Unpaid'));
    assert.ok(csv.some((line) => line.endsWith(',Scheduled')));
  });

  test('date cells Sheets has turned into Dates read back as ISO text, so the page and period totals still see them', () => {
    const { context: c, spreadsheet } = backend();
    const expense = paidExpense(c, { paid_date: '2026-09-09', supplier_invoice_date: '2026-09-01', amount: 110 });
    const rule = c.api_upsertExpenseRule(rulePayload()).rule;
    // What Sheets does to a yyyy-mm-dd typed or pasted in, or appended below the plain-text-formatted range.
    const toDates = (sheetName, columns) => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      columns.forEach((column) => {
        const index = headers.indexOf(column) + 1;
        assert.ok(index, sheetName + ' has ' + column);
        for (let row = 2; row <= sheet.getLastRow(); row++) {
          const value = String(sheet.getRange(row, index).getValues()[0][0] || '');
          if (value) sheet.getRange(row, index).setValue(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
        }
      });
    };
    toDates('expense_transactions', ['paid_date', 'supplier_invoice_date', 'source_occurrence_key', 'created_at', 'updated_at']);
    toDates('expense_rules', ['start_date', 'created_at']);

    const datesIn = (value, where, found) => {
      if (Object.prototype.toString.call(value) === '[object Date]') found.push(where);
      else if (value && typeof value === 'object') Object.keys(value).forEach((key) => datesIn(value[key], where + '.' + key, found));
      return found;
    };
    const transactions = c.api_listExpenseTransactions({});
    const rules = c.api_listExpenseRules({ include_inactive: true });
    // google.script.run delivers null for a whole payload that holds a Date, which blanked the Expenses page.
    assert.deepStrictEqual(datesIn(transactions, 'transactions', []), []);
    assert.deepStrictEqual(datesIn(rules, 'rules', []), []);

    const listed = transactions.find((t) => t.id === expense.id);
    assert.equal(listed.paid_date, '2026-09-09');
    assert.equal(listed.supplier_invoice_date, '2026-09-01');
    assert.match(listed.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    assert.equal(rules.find((r) => r.id === rule.id).start_date, '2026-09-15');
    assert.ok(c.api_listExpenseTransactions({ from: '2026-09-01', to: '2026-09-30' }).some((t) => t.id === expense.id), 'period filters compare dates as text');
    assert.equal(monthTotals(c).cash['2026-09'].purchases, 110, 'the paid expense still counts toward September');
  });

  test('the automatic GST credit setting is gone, because every taxable expense now claims its credit', () => {
    const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
    assert.ok(!scripts.includes('expense_auto_gst_credits'));
    assert.ok(!operationsScripts.includes('expense_auto_gst_credits'));
  });

  // The old model's rows, written straight to the sheets as a spreadsheet from before this upgrade has them.
  function legacyLedger() {
    const env = backend(), c = env.context;
    const tx = c.getOrCreateSheet('expense_transactions'), pay = c.getOrCreateSheet('expense_payments');
    const txHeaders = tx.getDataRange().getValues()[0], payHeaders = pay.getDataRange().getValues()[0];
    const row = (values) => tx.appendRow(c.rowValuesFromObject_(txHeaders, Object.assign({ vendor: values.id, amount: 110, gst_code: 'taxable', gst_amount: 10, business_use_percentage: 1, status: 'recorded', reconciliation_state: 'unreconciled', claimable_gst_confirmed: 'FALSE', attachments_json: '[]', notes: '' }, values)));
    const payment = (values) => pay.appendRow(c.rowValuesFromObject_(payHeaders, Object.assign({ id: c.Utilities.getUuid() }, values)));
    row({ id: 'paid', purchase_date: '2026-08-01', supplier_invoice_date: '' });
    payment({ expense_transaction_id: 'paid', payment_date: '2026-08-03', amount: 110, payment_method: 'EFT', reference: 'abc', notes: 'paid online' });
    row({ id: 'instalments', purchase_date: '2026-08-01', supplier_invoice_date: '2026-07-30', amount: 220 });
    payment({ expense_transaction_id: 'instalments', payment_date: '2026-08-05', amount: 100, payment_method: 'EFT' });
    payment({ expense_transaction_id: 'instalments', payment_date: '2026-09-05', amount: 120, payment_method: 'Credit card', reference: 'cc9' });
    row({ id: 'part', purchase_date: '2026-08-10', amount: 1000, notes: 'Laptop' });
    payment({ expense_transaction_id: 'part', payment_date: '2026-08-01', amount: 250, payment_method: 'EFT', reference: '12345' });
    payment({ expense_transaction_id: 'part', payment_date: '2026-09-01', amount: 150, payment_method: 'Credit card' });
    row({ id: 'unpaid', purchase_date: '2026-09-12' });
    row({ id: 'void', status: 'void', purchase_date: '2026-09-13' });
    row({ id: 'skipped', status: 'void', purchase_date: '2026-10-15', source_rule_id: 'rule-1', source_occurrence_key: '2026-10-15' });
    row({ id: 'scheduled', status: 'scheduled', reconciliation_state: 'scheduled', purchase_date: '2026-11-15', source_rule_id: 'rule-1', source_occurrence_key: '2026-11-15' });
    row({ id: 'override', purchase_date: '2026-08-20', reconciliation_state: 'reconciled', claimable_gst_confirmed: 'TRUE', gst_override_amount: 9 });
    payment({ expense_transaction_id: 'override', payment_date: '2026-08-20', amount: 110 });
    row({ id: 'declined', purchase_date: '2026-08-21', reconciliation_state: 'reconciled', claimable_gst_confirmed: 'FALSE', business_use_percentage: 0.5 });
    payment({ expense_transaction_id: 'declined', payment_date: '2026-08-21', amount: 110 });
    row({ id: 'legacy', purchase_date: '2026-06-30', supplier_invoice_date: '2026-06-30', reconciliation_state: 'legacy_unreconciled', gst_code: 'out_of_scope', gst_amount: 0 });
    payment({ id: 'legacy-payment-legacy', expense_transaction_id: 'legacy', payment_date: '2026-06-30', amount: 110, reference: 'Legacy deduction occurrence', notes: 'Created by migration: the legacy deduction recorded this amount as paid on this date.' });
    // A deduction occurrence adjusted from its usual $72.05 to $79.00: the company-expense move kept the usual GST.
    row({ id: 'adjusted', purchase_date: '2026-06-01', amount: 79, gst_amount: 6.55, reconciliation_state: 'legacy_unreconciled', notes: 'Legacy exception applied: adjust_amount.' });
    payment({ id: 'legacy-payment-adjusted', expense_transaction_id: 'adjusted', payment_date: '2026-06-01', amount: 79, reference: 'Legacy deduction occurrence' });
    row({ id: 'gst-free-stale', purchase_date: '2026-06-02', amount: 50, gst_code: 'gst_free', gst_amount: 0 });
    payment({ expense_transaction_id: 'gst-free-stale', payment_date: '2026-06-02', amount: 50 });
    return env;
  }
  const rowsById = (c) => Object.fromEntries(c.api_listExpenseTransactions({}).map((t) => [t.id, t]));

  test('upgrade preview lists part-paid expenses, instalments and declined GST credits without changing anything', () => {
    const { context: c, spreadsheet } = legacyLedger();
    const before = JSON.stringify(spreadsheet.getSheetByName('expense_transactions').getDataRange().getValues());
    const preview = JSON.parse(JSON.stringify(c.migrationSimplifiedExpensePreview_()));
    assert.deepStrictEqual(preview.part_paid.map((p) => [p.id, p.amount, p.paid, p.payments.length]), [['part', 1000, 400, 2]]);
    assert.deepStrictEqual(preview.instalments.map((p) => p.id), ['instalments']);
    assert.deepStrictEqual(preview.unclaimed_gst.map((p) => [p.id, p.gst_credit]), [['declined', 5]]);
    assert.equal(JSON.stringify(spreadsheet.getSheetByName('expense_transactions').getDataRange().getValues()), before);
  });

  test('the upgrade turns payments into a paid date, keeps unpaid, notes part-paid, and removes void', () => {
    const { context: c } = legacyLedger();
    c.migrationSimplifyExpenseLedger_();
    const rows = rowsById(c);
    const pick = (id, keys) => keys.map((key) => rows[id][key]);
    const fields = ['status', 'paid_date', 'supplier_invoice_date', 'payment_method', 'payment_reference', 'purchase_date', 'reconciliation_state'];
    assert.deepStrictEqual(pick('paid', fields), ['recorded', '2026-08-03', '2026-08-01', 'EFT', 'abc', '', '']);
    assert.match(rows.paid.notes, /^Payment note: paid online$/);
    assert.deepStrictEqual(pick('instalments', fields), ['recorded', '2026-09-05', '2026-07-30', 'Credit card', 'cc9', '', '']);
    assert.match(rows.instalments.notes, /was paid in instalments[\s\S]*\$100\.00 on 2026-08-05 \(EFT\); \$120\.00 on 2026-09-05 \(Credit card, ref cc9\)/);
    assert.deepStrictEqual(pick('part', ['status', 'paid_date', 'amount', 'supplier_invoice_date']), ['recorded', '', 1000, '2026-08-10']);
    assert.equal(rows.part.notes, 'Laptop\nUpgrade: was part-paid, so it is now unpaid. Paid $400.00 of $1,000.00 in 2 payments: $250.00 on 2026-08-01 (EFT, ref 12345); $150.00 on 2026-09-01 (Credit card). Set the paid date or adjust the amount to resolve.');
    assert.deepStrictEqual(pick('unpaid', ['status', 'paid_date', 'supplier_invoice_date']), ['recorded', '', '2026-09-12']);
    assert.equal(rows.void, undefined, 'a void one-off is removed');
    assert.deepStrictEqual(pick('skipped', ['status', 'supplier_invoice_date']), ['skipped', '2026-10-15'], 'a skipped schedule payment stays skipped');
    assert.deepStrictEqual(pick('scheduled', ['status', 'paid_date', 'supplier_invoice_date']), ['scheduled', '', '2026-11-15'], 'the due date moves to the invoice date');
    assert.deepStrictEqual(pick('override', ['gst_amount', 'gst_override_amount', 'claimable_gst_confirmed']), [9, '', ''], 'the corrected GST becomes the GST amount');
    assert.match(rows.declined.notes, /reconciled without claiming its GST credit[\s\S]*\$5\.00/);
    assert.deepStrictEqual(pick('legacy', ['status', 'paid_date', 'payment_reference']), ['recorded', '2026-06-30', ''], 'the legacy placeholder reference is dropped');
    assert.equal(rows.legacy.notes, '', 'and so is its boilerplate note');
    const archive = c.getOrCreateSheet('migration_archive').getDataRange().getValues();
    assert.ok(archive.some((r) => String(r.join('|')).includes('void_expense_removed')), 'the removed void row is archived');

    // Cash figures now follow paid dates; the part-paid laptop counts nowhere on cash and on accrual from its invoice date.
    const months = monthTotals(c);
    assert.deepStrictEqual(months.cash['2026-08'], { purchases: 330, gst: 24 }, 'paid (10), override (9) and declined (GST now claimed at 50%: 5)');
    assert.deepStrictEqual(months.cash['2026-09'], { purchases: 220, gst: 20 }, 'instalments on the last payment date, with GST of one-eleventh of 220');
    assert.equal(months.accrual['2026-08'].purchases, 1330, 'the laptop counts on accrual from its invoice date');
    assert.equal(months.accrual['2026-07'].purchases, 220, 'instalments on accrual from their invoice date');

    // Re-running changes nothing and adds no second note.
    const snapshot = JSON.stringify(c.api_listExpenseTransactions({}));
    c.migrationSimplifyExpenseLedger_();
    assert.equal(JSON.stringify(c.api_listExpenseTransactions({})), snapshot);
  });

  test('the upgrade gives every taxable expense one-eleventh of its amount as GST, except a GST corrected from the invoice', () => {
    const { context: c } = legacyLedger();
    c.migrationSimplifyExpenseLedger_();
    const rows = rowsById(c);
    const gst = (id) => Number(rows[id].gst_amount);
    assert.equal(gst('adjusted'), 7.18, 'an adjusted occurrence no longer carries its usual amount\'s GST');
    assert.equal(gst('instalments'), 20);
    assert.equal(gst('part'), 90.91);
    assert.equal(gst('paid'), 10, 'a GST that was already right is unchanged');
    assert.equal(gst('override'), 9, 'a GST corrected from the tax invoice is kept');
    assert.equal(gst('legacy'), 0, 'a non-taxable expense keeps no GST');
    assert.equal(gst('gst-free-stale'), 0);
    // June on cash: the out-of-scope legacy expense (no credit), the GST-free one, and $79 less its $7.18 credit.
    assert.deepStrictEqual(monthTotals(c).cash['2026-06'], { purchases: 239, gst: 7.18 });
    const client = { state: { companyExpenseLedger: { months: monthTotals(c) } }, Math, Number, String, defaultAccountingBasis: () => 'cash' };
    vm.runInNewContext(extract(operationsScripts, 'companyLedgerExpensesForMonth'), client);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(client.companyLedgerExpensesForMonth(2026, 5))), { exGst: 231.82, gst: 7.18 }, 'Time Entry takes off 79 / 1.1 = 71.82 for it, as the old deduction did');
  });

  test('the upgrade stores every expense\'s and schedule\'s amount excluding GST', () => {
    const { context: c } = legacyLedger();
    const rules = c.getOrCreateSheet('expense_rules');
    rules.appendRow(c.rowValuesFromObject_(rules.getDataRange().getValues()[0], { id: 'rule-1', vendor: 'Insurer', amount: 145.75, gst_code: 'taxable', gst_amount: 13, frequency: 'monthly', start_date: '2026-01-15', active: 'TRUE' }));
    rules.appendRow(c.rowValuesFromObject_(rules.getDataRange().getValues()[0], { id: 'rule-2', vendor: 'Bank', amount: 10, gst_code: 'input_taxed', gst_amount: 0, frequency: 'monthly', start_date: '2026-01-15', active: 'TRUE' }));
    c.migrationSimplifyExpenseLedger_();
    const rows = rowsById(c);
    const ex = (id) => Number(rows[id].amount_ex_gst);
    assert.deepStrictEqual(['adjusted', 'override', 'gst-free-stale', 'legacy', 'scheduled', 'part'].map(ex), [71.82, 101, 50, 110, 100, 909.09]);
    const listed = Object.fromEntries(c.api_listExpenseRules({ include_inactive: true }).map((r) => [r.id, r]));
    assert.deepStrictEqual([Number(listed['rule-1'].gst_amount), Number(listed['rule-1'].amount_ex_gst)], [13.25, 132.5]);
    assert.deepStrictEqual([Number(listed['rule-2'].gst_amount), Number(listed['rule-2'].amount_ex_gst)], [0, 10]);
  });

  test('expenses and schedules store both amounts, and take either', () => {
    const { context: c } = backend();
    const inc = paidExpense(c, { amount: 2086.79 });
    assert.deepStrictEqual([inc.amount, inc.gst_amount, inc.amount_ex_gst], [2086.79, 189.71, 1897.08]);
    const fromEx = paidExpense(c, { amount: undefined, amount_ex_gst: 100 });
    assert.deepStrictEqual([fromEx.amount, fromEx.gst_amount, fromEx.amount_ex_gst], [110, 10, 100]);
    const invoiceGst = paidExpense(c, { amount: 110, gst_amount: 9 });
    assert.equal(invoiceGst.amount_ex_gst, 101, 'a GST figure from the invoice is kept');
    const free = paidExpense(c, { amount: 50, gst_code: 'gst_free', gst_amount: 5 });
    assert.deepStrictEqual([free.gst_amount, free.amount_ex_gst], [0, 50]);
    assert.equal(Number(find(c, inc.id).amount_ex_gst), 1897.08, 'stored in the sheet');
    const rule = c.api_upsertExpenseRule(rulePayload({ amount: 145.75 })).rule;
    assert.equal(rule.amount_ex_gst, 132.5);
    assert.ok(c.api_listExpenseTransactions({ status: 'scheduled' }).every((t) => Number(t.amount_ex_gst) === 132.5), 'upcoming payments carry it too');
  });

  test('the company expenses breakdown for a month adds up to the Time Entry line', () => {
    const { context: c } = backend();
    // The five June payments from the old deductions, paid on cash basis.
    [['Novated lease', 2086.79, '2026-06-24'], ['Insurance', 596.20, '2026-06-05'], ['Insurance', 145.75, '2026-06-01'], ['Software', 79, '2026-06-01'], ['Software', 4.95, '2026-06-01']]
      .forEach(([vendor, amount, date]) => paidExpense(c, { vendor, amount, paid_date: date }));
    paidExpense(c, { vendor: 'Phone', amount: 110, paid_date: '2026-06-10', business_use_percentage: 60 });
    paidExpense(c, { vendor: 'Next month', amount: 50, paid_date: '2026-07-01', supplier_invoice_date: '2026-06-28' });
    c.api_upsertExpenseTransaction({ vendor: 'Unpaid', amount: 33, supplier_invoice_date: '2026-06-15' });
    const june = JSON.parse(JSON.stringify(c.api_getCompanyExpensesForMonth({ year: 2026, month: 5, accounting_basis: 'cash' })));
    assert.deepStrictEqual(june.expenses.map((e) => [e.vendor, e.counted_date]), [['Insurance', '2026-06-01'], ['Software', '2026-06-01'], ['Software', '2026-06-01'], ['Insurance', '2026-06-05'], ['Phone', '2026-06-10'], ['Novated lease', '2026-06-24']]);
    assert.deepStrictEqual(june.totals, { amount: 3022.69, amount_ex_gst: 2747.9, gst_credit: 270.79, counted: 2751.9 });
    const phone = june.expenses.find((e) => e.vendor === 'Phone');
    assert.deepStrictEqual([phone.amount_ex_gst, phone.gst_credit, phone.counted], [100, 6, 104], '60% business use claims 60% of the GST');
    const client = { state: { companyExpenseLedger: JSON.parse(JSON.stringify(c.api_getCompanyExpenseMonthlyTotals())) }, Math, Number, String, defaultAccountingBasis: () => 'cash' };
    vm.runInNewContext(extract(operationsScripts, 'companyLedgerExpensesForMonth'), client);
    assert.equal(client.companyLedgerExpensesForMonth(2026, 5).exGst, june.totals.counted, 'the modal total is the Time Entry line');
    const accrual = c.api_getCompanyExpensesForMonth({ year: 2026, month: 5, accounting_basis: 'accrual' });
    assert.ok(accrual.expenses.some((e) => e.vendor === 'Unpaid') && accrual.expenses.some((e) => e.vendor === 'Next month'), 'accrual: invoiced in June');
    // Payments not counted yet are listed apart and left out of the totals.
    assert.deepStrictEqual([june.pending.map((e) => e.vendor), june.pending_totals], [['Unpaid'], { amount: 33, amount_ex_gst: 30 }], 'cash: the unpaid bill waits');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(accrual.pending)), [], 'accrual: the unpaid bill already counts');
  });

  test('the monthly totals bring each month\'s breakdown, so the Time Entry popup opens from memory', () => {
    const { context: c } = backend('2026-10-01', 'financial_year');
    paidExpense(c, { vendor: 'Phone', description: 'Mobile plan', amount: 110, paid_date: '2026-10-10', business_use_percentage: 60, notes: 'Work phone' });
    c.api_upsertExpenseTransaction({ vendor: 'Unpaid', amount: 33, supplier_invoice_date: '2026-10-15' });
    c.api_upsertExpenseRule(rulePayload({ start_date: '2026-12-20' }));
    const ledger = JSON.parse(JSON.stringify(c.api_getCompanyExpenseMonthlyTotals()));
    ['cash', 'accrual'].forEach((basis) => {
      const direct = JSON.parse(JSON.stringify(c.api_getCompanyExpensesForMonth({ year: 2026, month: 9, accounting_basis: basis })));
      const cached = ledger.breakdowns[basis]['2026-10'];
      assert.deepStrictEqual([cached.totals, cached.pending_totals], [direct.totals, direct.pending_totals], basis + ': same figures as the popup\'s own call');
      assert.deepStrictEqual(cached.expenses.map((e) => e.id), direct.expenses.map((e) => e.id), basis);
      assert.deepStrictEqual(cached.pending.map((e) => e.id), direct.pending.map((e) => e.id), basis);
    });
    const phone = ledger.breakdowns.cash['2026-10'].expenses[0];
    assert.deepStrictEqual([phone.description, phone.notes, phone.counted, phone.attachments_json], ['Mobile plan', 'Work phone', 104, undefined], 'keeps what the popup and the expense form use, not attachments');
    assert.ok(ledger.breakdowns.accrual['2026-12'].pending.length, 'a month with only schedule payments still has a breakdown');
    // The popup renders from the ledger with no server call.
    const client = { state: { companyExpenseLedger: ledger }, defaultAccountingBasis: () => 'cash', String };
    vm.runInNewContext(extract(operationsScripts, 'companyLedgerBreakdownForMonth'), client);
    assert.equal(client.companyLedgerBreakdownForMonth(2026, 9).totals.counted, ledger.breakdowns.cash['2026-10'].totals.counted);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(client.companyLedgerBreakdownForMonth(2026, 1))).expenses, [], 'an empty month is empty, not a server call');
    assert.match(operationsScripts, /async function showCompanyExpensesModal\(year, month\) \{[\s\S]*?const cached = companyLedgerBreakdownForMonth\(year, month\);\s*if \(cached\) \{[\s\S]*?return;\s*\}/);
  });

  test('the expense form is a popup that asks for the description first, and says when an expense is from a schedule', () => {
    const markup = fs.readFileSync(path.join(root, 'views/partials/operations.html'), 'utf8');
    assert.match(markup, /<div class="ts-modal" id="modal-expense-form"[^>]*>\s*<form id="expense-form" class="ts-modal-content ts-expense-form"/);
    assert.match(markup, /<input id="expense-description" required[\s\S]*<input id="expense-vendor" required/, 'Description comes first and is required');
    assert.match(markup, /<input id="expense-rule-description" required/, 'schedules need a description too');
    assert.match(markup, /id="expense-form-schedule" hidden>From a schedule\. Changes apply to this expense only\./);
    assert.match(markup, /<div class="ts-modal-footer"><button type="button" class="ghost" id="expense-form-cancel">Cancel<\/button><button type="submit">Save expense<\/button><\/div>/);
    const open = extract(operationsScripts, 'openExpenseForm');
    assert.match(open, /item\?\.description \|\| item\?\.vendor/, 'an expense without a description starts with its vendor');
    assert.match(open, /showExpenseFormModal\(\)/);
    assert.ok(!/getElementById\('expense-form'\)\.style\.display/.test(operationsScripts), 'the form is shown and hidden as a popup');
    // Outside the Expenses page, so Edit in the Time Entry popup opens it there and comes back to the popup.
    assert.ok(markup.indexOf('id="modal-expense-form"') > markup.indexOf('</section>'), 'the popup is not inside the Expenses page');
    const companyModal = extract(operationsScripts, 'renderCompanyExpensesModal');
    assert.match(companyModal, /if \(item\) \{\s*await ensureExpenseFormLists\(\);\s*operationsState\.expenseFormReturn = shownMonth;\s*openExpenseForm\(item\);\s*return;\s*\}/);
    assert.match(extract(operationsScripts, 'hideExpenseFormModal'), /if \(back\) showCompanyExpensesModal\(back\.year, back\.month\);/);
  });

  test('the ledger filters by month on the accounting basis, by status as the badges name them, and by category', () => {
    let basis = 'cash';
    const client = { defaultAccountingBasis: () => basis, expenseToday: () => '2026-10-25', operationsState: { ledgerFilter: null }, String, Number, Date };
    vm.runInNewContext(['  const EXPENSE_UNCATEGORISED = \'__none__\';', ...['expensePaymentStatus', 'expenseLedgerFilter', 'expenseLedgerDate', 'expenseLedgerStatus', 'expenseFinancialYearMonths', 'expenseLedgerMatches'].map((name) => extract(operationsScripts, name))].join('\n'), client);
    const paid = { status: 'recorded', paid_date: '2026-11-02', supplier_invoice_date: '2026-10-28', category_id: 'c1' };
    const unpaid = { status: 'recorded', paid_date: '', supplier_invoice_date: '2026-10-05', category_id: '' };
    const due = { status: 'scheduled', supplier_invoice_date: '2026-10-09', category_id: 'c1' };
    const upcoming = { status: 'scheduled', supplier_invoice_date: '2026-12-09', category_id: 'c1' };
    const skipped = { status: 'skipped', supplier_invoice_date: '2026-09-15', category_id: 'c1' };
    const match = (item, filter) => client.expenseLedgerMatches(item, Object.assign({ month: '', status: '', category: '' }, filter));
    assert.deepStrictEqual([match(paid, { month: '2026-11' }), match(paid, { month: '2026-10' })], [true, false], 'cash: the paid date');
    basis = 'accrual';
    assert.deepStrictEqual([match(paid, { month: '2026-11' }), match(paid, { month: '2026-10' })], [false, true], 'accrual: the earlier of invoice and paid date');
    assert.ok(match(unpaid, { month: '2026-10' }) && match(due, { month: '2026-10' }), 'unpaid and schedule payments sit under their invoice or due date');
    assert.deepStrictEqual([paid, unpaid, due, upcoming, skipped].map((item) => client.expenseLedgerStatus(item)), ['paid', 'unpaid', 'due', 'upcoming', 'skipped']);
    assert.deepStrictEqual([paid, unpaid, due, upcoming, skipped].filter((item) => match(item, { status: 'due' })), [due]);
    assert.deepStrictEqual([match(unpaid, { category: '__none__' }), match(paid, { category: '__none__' }), match(paid, { category: 'c1' })], [true, false, true]);
    assert.deepStrictEqual([match(upcoming, { month: 'fy' }), match(skipped, { month: 'fy' }), match({ status: 'scheduled', supplier_invoice_date: '2027-07-01' }, { month: 'fy' })], [true, true, false], 'this financial year runs July to June');
    const markup = fs.readFileSync(path.join(root, 'views/partials/operations.html'), 'utf8');
    assert.doesNotMatch(markup, /expense-filter-from|expense-filter-to|expense-filter-apply/, 'no date range or Apply button');
    assert.match(markup, /<select id="expense-filter-state"[^>]*><option value="">All statuses<\/option><option value="due">Due<\/option><option value="upcoming">Upcoming<\/option><option value="unpaid">Unpaid<\/option><option value="paid">Paid<\/option><option value="skipped">Skipped<\/option><\/select>/);
    assert.match(markup, /data-expense-view="grouped"[\s\S]*data-expense-view="date"/);
    const byDate = extract(operationsScripts, 'renderExpenseLedgerByDate');
    assert.ok(/items\.forEach\(\(transaction\) =>/.test(byDate) && /item\.status !== 'skipped'\);/.test(byDate), 'By date lists skipped payments but leaves them out of month totals');
    assert.match(extract(operationsScripts, 'renderCompanyExpensesModal'), /showExpenseLedgerMonth\(shownMonth\.year, shownMonth\.month\)/, 'the Time Entry popup opens the ledger on its month');
  });

  test('the company expenses breakdown lists the month\'s schedule payments as not counted yet', () => {
    const { context: c } = backend('2026-10-01', 'financial_year');
    c.api_upsertExpenseRule(rulePayload({ start_date: '2026-10-20' }));
    const october = JSON.parse(JSON.stringify(c.api_getCompanyExpensesForMonth({ year: 2026, month: 9, accounting_basis: 'accrual' })));
    assert.deepStrictEqual([october.expenses.length, october.totals.amount], [0, 0], 'a schedule payment never counts');
    assert.deepStrictEqual(october.pending.map((e) => [e.vendor, e.status, e.supplier_invoice_date]), [['Insurer', 'scheduled', '2026-10-20']]);
    assert.deepStrictEqual(october.pending_totals, { amount: 110, amount_ex_gst: 100 });
  });

  test('the form links its two amounts, and a change of GST treatment keeps the inc-GST amount', () => {
    const elements = {};
    const element = (id, value) => {
      const listeners = {};
      elements[id] = { id, value, addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }, dispatchEvent: (event) => (listeners[event.type] || []).forEach((fn) => fn(event)), fire: (type) => (listeners[type] || []).forEach((fn) => fn({ type })) };
      return elements[id];
    };
    element('inc', ''); element('ex', ''); element('code', 'taxable');
    const client = { document: { getElementById: (id) => elements[id] }, Event: function(type) { this.type = type; }, Math, Number };
    vm.runInNewContext(['  const expenseRound = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;',
      ...['expenseExFromInc', 'expenseIncFromEx', 'wireExpenseAmountPair', 'readExpenseAmountPair', 'setExpenseAmountPair'].map((name) => extract(operationsScripts, name)),
      'wireExpenseAmountPair("inc", "ex", "code");'].join('\n'), client);
    const { inc, ex, code } = elements;
    inc.value = '110'; inc.fire('input');
    assert.equal(ex.value, '100.00');
    code.value = 'gst_free'; code.fire('change');
    assert.deepStrictEqual([inc.value, ex.value], ['110', '110.00'], 'switching to GST-free keeps what was paid');
    code.value = 'taxable'; code.fire('change');
    assert.equal(ex.value, '100.00');
    ex.value = '1897.08'; ex.fire('input');
    assert.equal(inc.value, '2086.79');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(client.readExpenseAmountPair('inc', 'ex', 'taxable'))), { amount: 2086.79, amount_ex_gst: 1897.08, gst_amount: 189.71 });
    client.setExpenseAmountPair('inc', 'ex', { amount: 110, amount_ex_gst: 101, gst_code: 'taxable' });
    assert.deepStrictEqual([inc.value, ex.value], ['110.00', '101.00'], 'an invoice GST figure shows as saved');
    assert.equal(client.readExpenseAmountPair('inc', 'ex', 'taxable').gst_amount, 9, 'and is kept when saved untouched');
    // The backend and the form agree on every amount.
    const { context: c } = backend();
    [0.01, 4.95, 79, 145.75, 596.2, 2086.79, 999.99].forEach((amount) => assert.equal(client.expenseExFromInc(amount, 'taxable'), c.expenseAmounts_({ amount }, 'taxable').amount_ex_gst, String(amount)));
  });

  test('the Company expenses (i) on Time Entry shows the ledger, not the old deductions', () => {
    const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
    assert.match(extract(scripts, 'showMonthlyDeductionsModal'), /if \(type === 'company' && typeof showCompanyExpensesModal === 'function'\) \{\s*showCompanyExpensesModal\(year, month\);\s*return;/);
    assert.match(operationsScripts, /operationsApi\('api_getCompanyExpensesForMonth', \{ year, month, accounting_basis:basis \}\)/);
    const modal = extract(operationsScripts, 'renderCompanyExpensesModal');
    ["'Inc GST'", "'Ex GST'", "'Counts'", "'Edit'", 'openExpenseForm(item)'].forEach((text) => assert.ok(modal.includes(text), text));
    const dashboard = fs.readFileSync(path.join(root, 'views/partials/dashboard.html'), 'utf8');
    assert.ok(!/company expenses[^"]*one-off adjustments/i.test(dashboard), 'no more one-off adjustments for company expenses');
  });

  test('expenses and schedules use the shared category list, by id, and show its current name', () => {
    const { context: c } = backend();
    const insurance = c.api_upsertDeductionCategory({ name: 'Insurance', color: '#6b7280' }).category;
    const expense = paidExpense(c, { category_id: insurance.id });
    assert.deepStrictEqual([expense.category_id, expense.category], [insurance.id, ''], 'the id is stored, not the name');
    assert.deepStrictEqual(['category', 'category_id', 'category_color'].map((key) => find(c, expense.id)[key]), ['Insurance', insurance.id, '#6b7280']);
    // Renaming the category renames it on every expense.
    c.api_upsertDeductionCategory({ id: insurance.id, name: 'Business insurance', color: '#3b82f6' });
    assert.equal(find(c, expense.id).category, 'Business insurance');
    assert.ok(c.api_exportExpenseReportCsv({ financial_year: 2026 }).csv.includes('Business insurance'), 'reports use the name');
    // A name matches an existing category regardless of case, or adds one.
    assert.equal(paidExpense(c, { category: 'business INSURANCE' }).category_id, insurance.id);
    const software = paidExpense(c, { category: 'Software' });
    assert.ok(c.api_getDeductionCategories().some((item) => item.id === software.category_id && item.name === 'Software'));
    assert.equal(paidExpense(c, { category_id: '' }).category_id, '', 'Uncategorised');
    assert.throws(() => paidExpense(c, { category_id: 'no-such-category' }), /Unknown category/);
    // Schedules pass their category to every upcoming payment.
    const rule = c.api_upsertExpenseRule(rulePayload({ category: undefined, category_id: insurance.id })).rule;
    assert.equal(rule.category_id, insurance.id);
    assert.ok(c.api_listExpenseTransactions({ status: 'scheduled' }).every((t) => t.category_id === insurance.id && t.category === 'Business insurance'));
    assert.equal(c.api_listExpenseRules({}).find((r) => r.id === rule.id).category, 'Business insurance');
    // Deleting a category makes its expenses and schedules Uncategorised.
    c.api_deleteDeductionCategory(insurance.id);
    assert.deepStrictEqual([find(c, expense.id).category_id, find(c, expense.id).category], ['', '']);
    assert.equal(c.api_listExpenseRules({}).find((r) => r.id === rule.id).category_id, '');
  });

  test('the upgrade files every expense and schedule under the shared category list', () => {
    const { context: c } = backend();
    const novated = c.api_upsertDeductionCategory({ name: 'Novated Lease', color: '#f97316' }).category;
    const software = c.api_upsertDeductionCategory({ name: 'Software and Subscriptions', color: '#3b82f6' }).category;
    const tx = c.getOrCreateSheet('expense_transactions'), rules = c.getOrCreateSheet('expense_rules');
    const txHeaders = tx.getDataRange().getValues()[0], ruleHeaders = rules.getDataRange().getValues()[0];
    const row = (id, category) => tx.appendRow(c.rowValuesFromObject_(txHeaders, { id, vendor: id, category, amount: 110, gst_code: 'taxable', gst_amount: 10, business_use_percentage: 1, status: 'recorded', purchase_date: '2026-06-01', reconciliation_state: 'unreconciled', attachments_json: '[]', notes: '' }));
    row('moved-from-deductions', novated.id);
    row('typed-name', 'software and subscriptions');
    row('new-name', 'Phone');
    row('none', '');
    rules.appendRow(c.rowValuesFromObject_(ruleHeaders, { id: 'rule', vendor: 'Adobe', category: software.id, amount: 79, gst_code: 'taxable', gst_amount: 7.18, frequency: 'monthly', start_date: '2026-01-01', active: 'TRUE' }));
    c.migrationSimplifyExpenseLedger_();
    const phone = c.api_getDeductionCategories().find((item) => item.name === 'Phone');
    assert.ok(phone, 'a typed category that is not on the list is added to it');
    const rows = rowsById(c);
    assert.deepStrictEqual(['moved-from-deductions', 'typed-name', 'new-name', 'none'].map((id) => [rows[id].category_id, rows[id].category]),
      [[novated.id, 'Novated Lease'], [software.id, 'Software and Subscriptions'], [phone.id, 'Phone'], ['', '']]);
    const raw = c.getOrCreateSheet('expense_transactions').getDataRange().getValues();
    const categoryColumn = raw[0].indexOf('category');
    assert.ok(raw.slice(1).every((r) => r[categoryColumn] === ''), 'the old text column is cleared');
    assert.equal(c.api_listExpenseRules({ include_inactive: true })[0].category_id, software.id);
    // Re-running adds no duplicate categories.
    const count = c.api_getDeductionCategories().length;
    c.migrationSimplifyExpenseLedger_();
    assert.equal(c.api_getDeductionCategories().length, count);
  });

  test('the expense forms pick a category from the shared list, and can add or manage categories', () => {
    const markup = fs.readFileSync(path.join(root, 'views/partials/operations.html'), 'utf8');
    assert.match(markup, /<select id="expense-category" data-expense-category><\/select>/);
    assert.match(markup, /<select id="expense-rule-category" data-expense-category><\/select>/);
    assert.match(markup, /id="expense-manage-categories"/);
    assert.match(operationsScripts, /category_id:expenseCategoryValue\('expense-category'\)/);
    assert.match(operationsScripts, /category_id:expenseCategoryValue\('expense-rule-category'\)/);
    assert.match(operationsScripts, /operationsApi\('api_getDeductionCategories'\)/);
    assert.match(operationsScripts, /operationsApi\('api_upsertDeductionCategory', \{ name, color:/);
    const client = { operationsState: { categories: [] }, Option: function(text, value) { this.text = text; this.value = value; }, document: { querySelectorAll: () => [] }, String };
    vm.runInNewContext(["  const EXPENSE_NEW_CATEGORY = '__new__';", extract(operationsScripts, 'setExpenseCategories'), extract(operationsScripts, 'renderExpenseCategoryOptions')].join('\n'), client);
    client.setExpenseCategories([{ id: 'b', name: 'Software' }, { id: 'a', name: 'Insurance' }]);
    const select = { value: '', replaceChildren(...options) { this.options = options; } };
    client.renderExpenseCategoryOptions(select, 'b');
    assert.deepStrictEqual(select.options.map((o) => o.text), ['Uncategorised', 'Insurance', 'Software', 'New category…']);
    assert.equal(select.value, 'b');
    client.renderExpenseCategoryOptions(select, 'gone');
    assert.equal(select.value, '', 'a deleted category shows as Uncategorised');
    const deductions = fs.readFileSync(path.join(root, 'views/partials/deductions.html'), 'utf8');
    assert.match(deductions, /Deductions and expenses share these categories/);
  });

  // A tiny DOM for rendering cards outside a browser.
  function fakeDocument() {
    const make = (tag) => {
      const el = { tagName: tag.toUpperCase(), children: [], attributes: {}, className: '', textContent: '', innerHTML: '', title: '', listeners: {},
        style: {}, classList: { add(name) { el.className = (el.className + ' ' + name).trim(); } },
        appendChild(child) { el.children.push(child); return child; }, append(...kids) { kids.forEach((kid) => el.children.push(kid)); },
        setAttribute(name, value) { el.attributes[name] = String(value); }, addEventListener(type, fn) { el.listeners[type] = fn; } };
      return el;
    };
    return { createElement: make };
  }
  const textOf = (el) => [el.textContent].concat((el.children || []).map(textOf)).join(' ').replace(/\s+/g, ' ').trim();
  function sharedComponents() {
    const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
    const client = { document: fakeDocument(), dataColor: (c) => c };
    vm.runInNewContext(['scheduleListShowsSearch', 'scheduleListIsAccordion', 'groupScheduleItems', 'createScheduleCard'].map((name) => extract(scripts, name)).join('\n'), client);
    return { client, scripts };
  }

  test('the Deductions page and Expense schedules share one card, grouping, search and collapse rules', () => {
    const { client, scripts } = sharedComponents();
    // One rule for both pages.
    assert.deepStrictEqual([5, 6].map(client.scheduleListShowsSearch), [false, true]);
    assert.deepStrictEqual([[2, 6], [3, 1], [2, 7]].map(([g, n]) => client.scheduleListIsAccordion(g, n)), [false, true, true]);
    assert.match(extract(scripts, 'renderDeductionMasterList'), /renderScheduleGroupedList\(deductionMasterListEl, \{/);
    assert.match(extract(scripts, 'createDeductionCard'), /return createScheduleCard\(\{/);
    assert.match(scripts, /const showSearch = showSplit && scheduleListShowsSearch\(list\.length\);/);
    assert.match(extract(operationsScripts, 'renderExpenseRules'), /renderScheduleGroupedList\(list, \{/);
    assert.match(extract(operationsScripts, 'renderExpenseRules'), /scheduleListShowsSearch\(rules\.length\)/);
    assert.match(extract(operationsScripts, 'createExpenseRuleCard'), /return createScheduleCard\(\{/);
    // Grouping: categories alphabetically, Uncategorised last, active before inactive, then by name.
    const groups = client.groupScheduleItems([
      { id: 1, cat: 'b', name: 'Zed', active: true }, { id: 2, cat: 'b', name: 'Alpha', active: false }, { id: 3, cat: 'b', name: 'Mid', active: true },
      { id: 4, cat: '', name: 'Loose', active: true }, { id: 5, cat: 'a', name: 'Only', active: true }
    ], { categories: [{ id: 'b', name: 'Beta' }, { id: 'a', name: 'Alpha cat' }, { id: 'c', name: 'Empty' }], categoryIdOf: (i) => i.cat, metaOf: (c) => ({ id: c.id, name: c.name }), isActive: (i) => i.active, nameOf: (i) => i.name });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(groups.map((g) => [g.meta.name, g.items.map((i) => i.id)]))), [['Alpha cat', [5]], ['Beta', [3, 1, 2]], ['Uncategorised', [4]]]);
    // A card shows only what it is given.
    const bare = client.createScheduleCard({ title: 'Plain', meta: [{ text: 'A$5.00' }], readOnly: false, editTitle: 'Edit Plain', onOpen: () => {} });
    const details = bare.children[0];
    assert.deepStrictEqual(JSON.parse(JSON.stringify(details.children.map((c) => c.className))), ['ts-deduction-header', 'ts-deduction-meta'], 'no occurrence or note element when not given');
    assert.equal(details.children[0].children.length, 1, 'no badges');
    assert.deepStrictEqual([bare.attributes.role, bare.title], ['button', 'Edit Plain']);
    let opened = 0;
    const full = client.createScheduleCard({ title: 'Full', badges: [{ text: 'Paused' }, null], meta: [{ text: 'x', title: 'Including GST' }, null], occurrence: 'Next payment on Nov 15, 2026', note: 'n', selected: true, readOnly: false, onOpen: () => opened++ });
    assert.equal(full.className, 'ts-deduction-card is-selected');
    assert.match(textOf(full), /Full Paused x Next payment on Nov 15, 2026 n/);
    full.listeners.click({ target: { closest: () => null } });
    assert.equal(opened, 1);
    const locked = client.createScheduleCard({ title: 'Old', readOnly: true, readOnlyTitle: 'History', onOpen: () => {} });
    assert.deepStrictEqual([locked.className, locked.title, locked.attributes.role, !!locked.listeners.click], ['ts-deduction-card ts-deduction-readonly', 'History', undefined, false]);
  });

  test('an expense schedule card shows ex-GST, GST treatment, business use and Ended only when they apply', () => {
    const { client } = sharedComponents();
    Object.assign(client, { operationsState: { expenseRuleEditId: 'r2' }, Math, Number, String, Object });
    vm.runInNewContext(["  const EXPENSE_GST_LABELS = { gst_free:'GST-free', input_taxed:'Input taxed', out_of_scope:'Out of scope' };",
      "  const EXPENSE_FREQUENCY_LABELS = { monthly:'Monthly', yearly:'Yearly' };",
      '  const expenseRound = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;',
      "  function expenseToday() { return '2026-10-25'; }",
      "  function expenseCardDate(iso) { return iso; }", "  function expenseCardMoney(v) { return '$' + Number(v).toFixed(2); }",
      ...['expenseIsActive', 'expenseScheduleDates', 'expenseExFromInc', 'expenseRuleNextText', 'createExpenseRuleCard'].map((name) => extract(operationsScripts, name)),
      '  function selectExpenseRule() {}'].join('\n'), client);
    const card = (rule) => textOf(client.createExpenseRuleCard(Object.assign({ id: 'r1', vendor: 'Insurer', amount: 110, amount_ex_gst: 100, gst_code: 'taxable', business_use_percentage: 1, frequency: 'monthly', start_date: '2026-01-15', end_date: '', active: 'TRUE', notes: '' }, rule)));
    assert.equal(card({}), 'Insurer $110.00 $100.00 ex GST Monthly Starts 2026-01-15 Next payment on 2026-11-15');
    assert.equal(card({ gst_code: 'gst_free', amount_ex_gst: 110 }), 'Insurer GST-free $110.00 Monthly Starts 2026-01-15 Next payment on 2026-11-15', 'no ex-GST line when there is no GST');
    assert.match(card({ business_use_percentage: 0.6 }), /^Insurer 60% business use/);
    assert.equal(card({ end_date: '2026-03-01' }), 'Insurer Ended $110.00 $100.00 ex GST Monthly Starts 2026-01-15 Ends 2026-03-01 Ended. No more payments are listed.');
    assert.equal(card({ active: 'FALSE' }), 'Insurer $110.00 $100.00 ex GST Monthly Starts 2026-01-15 Next payment on 2026-11-15', 'the old Active flag is ignored');
    assert.match(card({ end_date: '2026-10-25' }), /^Insurer \$110/, 'a schedule ending today has not ended yet');
    assert.match(card({ description: 'Indemnity', notes: 'Policy 42' }), /Indemnity — Policy 42$/);
    assert.equal(client.createExpenseRuleCard({ id: 'r2', vendor: 'X', amount: 1, gst_code: 'taxable', frequency: 'monthly', start_date: '2026-01-01', active: 'TRUE' }).className, 'ts-deduction-card is-selected');
  });

  test('the schedule form has no Active switch or Stop button; Ends today fills the end date and Save lists the changes', () => {
    const markup = fs.readFileSync(path.join(root, 'views/partials/operations.html'), 'utf8');
    assert.doesNotMatch(markup, /expense-rule-active|expense-rule-stop|Stop schedule/);
    assert.match(markup, /id="expense-rule-end-today"[^>]*>Ends today</);
    assert.match(markup, /id="expense-rule-confirm"[\s\S]*Paid payments are unchanged\./);
    assert.doesNotMatch(operationsScripts, /api_archiveExpenseRule|expense-rule-active/);
    assert.match(operationsScripts, /async function saveExpenseRule\(payload\) \{[\s\S]*?result\.error === 'schedule_changes'\) \{ showExpenseRuleConfirm/);
    assert.match(operationsScripts, /saveExpenseRule\(\{ \.\.\.pending, confirm_changes:true, apply_to_held:/);
    const client = { Math, Number, String, Object, Intl };
    vm.runInNewContext([extract(operationsScripts, 'expenseDateLabel'), extract(operationsScripts, 'operationsMoney'), extract(operationsScripts, 'expensePaymentCount'),
      extract(operationsScripts, 'expensePaymentDates'), extract(operationsScripts, 'expenseRuleChangeLines'), extract(operationsScripts, 'expenseRuleSavedMessage')].join('\n'), client);
    const ended = client.expenseRuleChangeLines({ end_date: '2026-10-10', amount: 50, removed: [{ date: '2026-10-15', amount: 50, due: true, edited: false }], updated: [], held: [] });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ended)), { lines: ['Removes 1 unpaid payment after 10 Oct 2026 (15 Oct 2026): one is Due.'], heldText: '' });
    const amount = client.expenseRuleChangeLines({ end_date: '', amount: 120, removed: [],
      updated: ['2026-11-15', '2026-12-15', '2027-01-15', '2027-02-15', '2027-03-15'].map((date) => ({ date, amount: 110 })),
      held: [{ date: '2026-10-15', amount: 110, due: true, edited: false }] });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(amount.lines)), ['Updates 5 upcoming payments (15 Nov 2026, 15 Dec 2026, 15 Jan 2027 and 2 more) to $120.00.']);
    assert.equal(amount.heldText, 'Also update the Due payment (15 Oct 2026, $110.00). Otherwise it stays as it is.');
    assert.equal(client.expenseRuleSavedMessage({ updated_count: 5, removed_count: 0, kept_count: 1, created_count: 0 }), 'Schedule saved · 5 payments updated · 1 payment kept as it was');
  });

  test('Expense creation is a setting, payments are created when Tempus and the Expenses page open, and Extend is gone', () => {
    const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
    const settings = fs.readFileSync(path.join(root, 'views/partials/settings.html'), 'utf8');
    const markup = fs.readFileSync(path.join(root, 'views/partials/operations.html'), 'utf8');
    assert.match(scripts, /expense_creation: \{\s*section: 'enable_expenses',[\s\S]*?defaultValue: 'month'/);
    assert.match(settings, /List scheduled expenses\s*<\/label>/);
    assert.match(settings, /<select id="set-expense-creation">\s*<option value="on_date">On the day they're due<\/option>\s*<option value="month">For the current month<\/option>\s*<option value="financial_year">For the whole financial year<\/option>/);
    assert.match(extract(operationsScripts, 'loadCompanyExpenseLedgerTotals'), /ensureExpenseOccurrences\(\);/);
    assert.match(operationsScripts, /await ensureExpenseOccurrences\(\);\s*\/\/ Everything, once[^\n]*\n\s*const \[transactions, rules, categories\] = await Promise\.all\(\[operationsApi\('api_listExpenseTransactions', \{\}\)/);
    assert.ok(!markup.includes('expense-rule-generate') && !operationsScripts.includes('expense-rule-generate'), 'no Extend button');
    assert.ok(!/12 months/.test(markup), 'no mention of 12 months');
  });

  test('the upgrade records how far each schedule already has payments, so creation carries on from there', () => {
    const { context: c } = backend('2026-10-01', 'month');
    const rules = c.getOrCreateSheet('expense_rules'), tx = c.getOrCreateSheet('expense_transactions');
    rules.appendRow(c.rowValuesFromObject_(rules.getDataRange().getValues()[0], { id: 'old', vendor: 'Insurer', amount: 110, gst_code: 'taxable', gst_amount: 10, frequency: 'monthly', start_date: '2026-01-15', active: 'TRUE' }));
    ['2026-09-15', '2027-09-15'].forEach((key) => tx.appendRow(c.rowValuesFromObject_(tx.getDataRange().getValues()[0], { id: 'old-' + key, vendor: 'Insurer', amount: 110, gst_code: 'taxable', gst_amount: 10, status: 'scheduled', purchase_date: key, source_rule_id: 'old', source_occurrence_key: key, attachments_json: '[]' })));
    c.migrationSimplifyExpenseLedger_();
    assert.equal(c.api_listExpenseRules({}).find((r) => r.id === 'old').generated_through, '2027-09-15');
    // Old schedules listed a year ahead; on the current-month setting the far-off payment is removed.
    const result = c.api_ensureExpenseOccurrences();
    assert.equal(result.removed_count, 1);
    assert.deepStrictEqual(scheduled(c, 'old'), ['2026-09-15']);
    assert.equal(c.api_listExpenseRules({}).find((r) => r.id === 'old').generated_through, '2026-10-31');
  });

  test('the upgrade waits for confirmation when part-paid expenses exist, and changes nothing until then', () => {
    const { context: c, properties, spreadsheet } = legacyLedger();
    const others = c.listMigrations().map((m) => m.id).filter((id) => id !== c.SIMPLIFIED_EXPENSE_LEDGER_MIGRATION_ID);
    properties.setProperty('tempus_migrations_applied', JSON.stringify(others));
    properties.setProperty('tempus_migration_backup_v3', JSON.stringify({ verified: true, spreadsheet_id: spreadsheet.getId(), url: 'https://drive.google.com/backup', name: 'Backup' }));
    const preview = c.api_getUpgradePreview();
    assert.equal(preview.requires_confirmation, true);
    const before = JSON.stringify(spreadsheet.getSheetByName('expense_transactions').getDataRange().getValues());
    const refused = c.api_runUpgrade();
    assert.equal(refused.error, 'confirmation_required');
    assert.match(refused.message, /1 part-paid expense\(s\) will become unpaid/);
    assert.equal(JSON.stringify(spreadsheet.getSheetByName('expense_transactions').getDataRange().getValues()), before, 'nothing changed');
    assert.ok(c.api_getMigrationStatus().required, 'the upgrade is still pending');
    const done = c.api_runUpgrade({ confirm_part_paid: true });
    assert.equal(done.state, 'complete');
    assert.equal(rowsById(c).part.paid_date, '');
    assert.equal(c.api_getUpgradePreview().requires_confirmation, false);
  });

  test('the upgrade page lists part-paid expenses and can be cancelled before anything changes', () => {
    const page = fs.readFileSync(path.join(root, 'views/upgrade.html'), 'utf8');
    assert.match(page, /api_getUpgradePreview\(\)/);
    assert.match(page, /api_runUpgrade\(\{ confirm_part_paid: confirmPartPaid \}\)/);
    assert.match(page, /result\.error === 'confirmation_required'/);
    assert.match(page, /id="cancel"/);
    assert.match(page, /Nothing was changed/);
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

  test('Deductions page occurrences anchor to the start date like the backend, and drifted exceptions still apply', () => {
    const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
    const constant = (name) => {
      const match = scripts.match(new RegExp('  const ' + name + ' = [\\s\\S]*?\\n  \\};'));
      assert.ok(match, 'Expected client helper ' + name);
      return match[0];
    };
    const client = { state: { deductionExceptions: [] } };
    vm.runInNewContext([
      'const ISO_DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;',
      extract(scripts, 'normalizeDateInput'),
      'const isoDate = (value) => normalizeDateInput(value);',
      constant('parseIsoDate'),
      scripts.match(/  const startOfDay = .*\n/)[0],
      constant('addDays'),
      constant('addMonthsClamped'),
      scripts.match(/  const DEDUCTION_OCCURRENCE_LIMIT = .*\n/)[0],
      ...['deductionOccurrenceDate', 'getDeductionOccurrencesBetween', 'deductionDriftedOccurrenceDates', 'anchorDeductionExceptions',
        'findDeductionOccurrenceException', 'getDeductionExceptions', 'applyExceptionsToOccurrences', 'getDeductionOccurrencesWithExceptions',
        'findLastPastOccurrence', 'findNextFutureOccurrence'].map((name) => extract(scripts, name)),
      'this.api = { getDeductionOccurrencesBetween, getDeductionOccurrencesWithExceptions, findDeductionOccurrenceException, findNextFutureOccurrence, isoDate };'
    ].join('\n'), client);
    const { context: c } = backend();
    const utc = (iso) => new Date(iso + 'T12:00:00Z');
    const deduction = { id: 'sacrifice', frequency: 'monthly', start_date: '2026-01-31', end_date: '' };

    // Client and backend agree on every occurrence for a 31st start, across short months.
    [['monthly', '2026-01-31'], ['quarterly', '2025-11-30'], ['yearly', '2028-02-29'], ['weekly', '2026-01-31']].forEach(([frequency, start]) => {
      const ded = Object.assign({}, deduction, { frequency, start_date: start });
      const clientDates = Array.from(client.api.getDeductionOccurrencesBetween(ded, null, new Date(2032, 11, 31)).map(client.api.isoDate));
      const backendDates = Array.from(c.generateDeductionOccurrenceDates(frequency, utc(start), null, utc(start), utc('2032-12-31')));
      assert.deepStrictEqual(clientDates, backendDates, frequency + ' from ' + start);
    });
    assert.deepStrictEqual(Array.from(client.api.getDeductionOccurrencesBetween(deduction, new Date(2026, 1, 1), new Date(2026, 4, 31)).map(client.api.isoDate)),
      ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'], 'the day returns to the 31st after February');

    // The page used to drift (31 Jan, 28 Feb, 28 Mar, 28 Apr, ...) and keyed its exceptions to those dates.
    const drifted = [
      { deduction_id: 'sacrifice', original_date: '2026-03-28', exception_type: 'adjust_amount', new_amount: 5 },
      { deduction_id: 'sacrifice', original_date: '2026-05-28', exception_type: 'skip' },
      { deduction_id: 'sacrifice', original_date: '2026-06-28', exception_type: 'move', new_date: '2026-07-02' },
      { deduction_id: 'other', original_date: '2026-04-28', exception_type: 'skip' }
    ];
    drifted.forEach((ex) => assert.equal(c.api_upsertDeductionException(ex).success, true));
    client.state.deductionExceptions = drifted.map((ex, i) => Object.assign({ id: 'ex' + i, notes: '', new_date: '', new_amount: 0 }, ex));

    const month = (y, m) => [new Date(y, m, 1), new Date(y, m + 1, 0)];
    const clientMonth = (y, m, override) => client.api.getDeductionOccurrencesWithExceptions(deduction, ...month(y, m), undefined, override)
      .map((o) => [o.date, o.amount, o.exceptionType]);
    // Whole UTC days, because the harness formats dates in UTC while the stepping keeps local time across DST.
    const backendMonth = (y, m) => Array.from(c.getDeductionOccurrencesWithExceptions('sacrifice', 'monthly', utc('2026-01-31'), null, new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 0, 23, 59, 59))))
      .map((o) => [o.date, o.amount, o.exceptionType]);
    [[2, [['2026-03-31', 5, 'adjust_amount']]], [3, [['2026-04-30', null, null]]], [4, []], [5, []], [6, [['2026-07-02', null, 'move'], ['2026-07-31', null, null]]]].forEach(([m, expected]) => {
      assert.deepStrictEqual(JSON.parse(JSON.stringify(clientMonth(2026, m))), expected, 'client month ' + (m + 1));
      assert.deepStrictEqual(JSON.parse(JSON.stringify(backendMonth(2026, m))), expected, 'backend month ' + (m + 1));
    });
    // A snapshot of every deduction's exceptions applies only this deduction's.
    assert.deepStrictEqual(JSON.parse(JSON.stringify(clientMonth(2026, 3, client.state.deductionExceptions))), [['2026-04-30', null, null]]);

    // Adjusting the anchored occurrence finds the exception recorded against its drifted date.
    assert.equal(client.api.findDeductionOccurrenceException(deduction, '2026-03-31').id, 'ex0');
    assert.equal(client.api.findDeductionOccurrenceException(deduction, '2026-04-30'), null);
    // An exception already keyed to the anchored date wins over a drifted one.
    client.state.deductionExceptions.push({ id: 'anchored', deduction_id: 'sacrifice', original_date: '2026-03-31', exception_type: 'adjust_amount', new_amount: 7, notes: '', new_date: '' });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(clientMonth(2026, 2))), [['2026-03-31', 7, 'adjust_amount']]);
    assert.equal(client.api.findDeductionOccurrenceException(deduction, '2026-03-31').id, 'anchored');
  });

  test('splitting a month-end deduction keeps the new half on the original day, client and backend', () => {
    // "Today" is 10 February 2026: the 31 January occurrence is past and the next one is clamped to 28 February.
    const { client, calls, RealDate } = splitClient([2026, 1, 10, 9]);
    const { context: c } = backend();
    const utc = (iso) => new Date(iso + 'T12:00:00Z');
    const dates = (ded, through) => Array.from(client.api.getDeductionOccurrencesBetween(ded, null, new RealDate(2026, 11, 31)).map(client.api.isoDate))
      .filter((iso) => !through || iso <= through);

    const original = c.api_upsertDeduction({ name: 'Rent', amount_value: 100, frequency: 'monthly', start_date: '2026-01-31' }).deduction;
    assert.equal(original.anchor_day, null, 'an ordinary deduction has no anchor day');
    client.state.deductions = [client.api.sanitizeDeduction(original)];
    client.api.performSplitDeduction(client.state.deductions[0], { id: original.id, name: 'Rent', amount_value: 120, frequency: 'monthly', start_date: '2026-01-31' });
    const split = calls.shift();
    assert.equal(split.method, 'api_splitDeduction');
    const request = split.args[0];
    assert.equal(request.end_date, '2026-01-31', 'the first half ends on its last past occurrence');
    assert.equal(request.deduction.start_date, '2026-02-28');
    assert.equal(request.deduction.anchor_day, 31, 'the new half is anchored to the 31st');
    const optimisticNew = client.state.deductions.find((d) => d.id !== original.id);
    const expected = ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31'];
    assert.deepStrictEqual(dates(optimisticNew), expected, 'the optimistic new half recurs on the month end');
    assert.deepStrictEqual(dates(client.state.deductions[0]), ['2026-01-31']);
    // Together the halves reproduce the original schedule exactly, with no gap or overlap.
    assert.deepStrictEqual(dates(client.state.deductions[0]).concat(dates(optimisticNew)), dates(client.api.sanitizeDeduction(original)));

    // The backend stores the anchor and generates the same dates.
    const result = c.api_splitDeduction(JSON.parse(JSON.stringify(request)));
    assert.equal(result.success, true);
    assert.equal(result.original.end_date, '2026-01-31');
    const created = result.deduction;
    assert.equal(created.anchor_day, 31);
    assert.equal(created.start_date, '2026-02-28');
    assert.deepStrictEqual(dates(client.api.sanitizeDeduction(created)), expected, 'the reloaded row recurs the same way');
    assert.deepStrictEqual(Array.from(c.generateDeductionOccurrenceDates('monthly', utc('2026-02-28'), null, utc('2026-02-28'), utc('2026-12-31'), created.anchor_day)), expected);
    // An exception on an anchored date of the new half applies on the backend.
    assert.equal(c.api_upsertDeductionException({ deduction_id: created.id, original_date: '2026-03-31', exception_type: 'adjust_amount', new_amount: 5 }).success, true);
    const march = Array.from(c.getDeductionOccurrencesWithExceptions(created.id, 'monthly', utc('2026-02-28'), null, new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 2, 31, 23, 59, 59)), created.anchor_day));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(march.map((o) => [o.date, o.amount]))), [['2026-03-31', 5]]);

    // Editing it without moving the start date keeps the anchor; moving the start date drops it.
    assert.equal(c.api_upsertDeduction({ id: created.id, name: 'Rent', amount_value: 130, frequency: 'monthly', start_date: '2026-02-28' }).deduction.anchor_day, 31);
    assert.equal(c.api_upsertDeduction({ id: created.id, name: 'Rent', amount_value: 130, frequency: 'monthly', start_date: '2026-02-15' }).deduction.anchor_day, null);
    // An anchor only means something on a clamped month-end start of a month-based schedule.
    assert.equal(c.normalizeDeductionAnchorDay_(31, '2026-03-31', 'monthly'), null);
    assert.equal(c.normalizeDeductionAnchorDay_(31, '2026-04-30', 'weekly'), null);
    assert.equal(c.normalizeDeductionAnchorDay_(29, '2026-02-28', 'yearly'), 29);
    assert.equal(client.api.sanitizeDeduction({ frequency: 'quarterly', start_date: '2026-04-30', anchor_day: '31' }).anchor_day, 31);
    assert.deepStrictEqual(dates(client.api.sanitizeDeduction({ frequency: 'yearly', start_date: '2025-02-28', anchor_day: 29 })).slice(0, 1), ['2025-02-28']);
    assert.deepStrictEqual(Array.from(client.api.getDeductionOccurrencesBetween(client.api.sanitizeDeduction({ frequency: 'yearly', start_date: '2025-02-28', anchor_day: 29 }), null, new RealDate(2028, 11, 31)).map(client.api.isoDate)),
      ['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  test('a split carries later exceptions to the new half in one atomic, idempotent write', () => {
    // "Today" is 10 June 2026: January to May are past and the next occurrence is 30 June.
    const { client, calls } = splitClient([2026, 5, 10, 9]);
    const { context: c } = backend();
    const plain = (value) => JSON.parse(JSON.stringify(value));
    const original = c.api_upsertDeduction({ name: 'Rent', amount_value: 100, frequency: 'monthly', start_date: '2026-01-31' }).deduction;
    const other = c.api_upsertDeduction({ name: 'Gym', amount_value: 10, frequency: 'monthly', start_date: '2026-01-15' }).deduction;
    const ex = (fields) => c.api_upsertDeductionException(Object.assign({ deduction_id: original.id }, fields)).exception;
    const pastSkip = ex({ original_date: '2026-03-31', exception_type: 'skip' });
    const juneAdjust = ex({ original_date: '2026-06-30', exception_type: 'adjust_amount', new_amount: 5 });
    // The legacy page drifted (31 Jan, 28 Feb, 28 Mar, ...) and keyed this skip of 31 July to 28 July.
    const julySkip = ex({ original_date: '2026-07-28', exception_type: 'skip' });
    const augustMove = ex({ original_date: '2026-08-31', exception_type: 'move', new_date: '2026-09-02' });
    const otherSkip = c.api_upsertDeductionException({ deduction_id: other.id, original_date: '2026-07-15', exception_type: 'skip' }).exception;
    const storedExceptions = () => plain(c.api_getDeductionExceptions()).map((x) => [x.id, x.deduction_id, x.original_date]).sort();
    const storedDeductions = () => plain(c.api_getDeductions()).map((d) => [d.id, d.end_date, d.amount_value]);
    const beforeExceptions = storedExceptions(), beforeDeductions = storedDeductions();

    client.state.deductions = [client.api.sanitizeDeduction(original), client.api.sanitizeDeduction(other)];
    client.state.deductionExceptions = plain(c.api_getDeductionExceptions());
    client.api.performSplitDeduction(client.state.deductions[0], { id: original.id, name: 'Rent', amount_value: 120, frequency: 'monthly', start_date: '2026-01-31' });
    const split = calls.shift();
    assert.equal(split.method, 'api_splitDeduction');
    const request = plain(split.args[0]);
    assert.equal(request.end_date, '2026-05-31');
    const tempId = client.state.deductions.find((d) => String(d.id).startsWith('temp_split_')).id;
    const clientKeys = () => client.state.deductionExceptions.map((x) => [x.id, x.deduction_id, x.original_date]).sort();
    const optimistic = clientKeys();

    // A write that fails part-way leaves both sheets exactly as they were, then rethrows.
    const realUpsert = c.upsertDeductionUnlocked_;
    c.upsertDeductionUnlocked_ = (payload) => {
      if (payload.id === original.id) throw new Error('Service Spreadsheets failed');
      return realUpsert(payload);
    };
    assert.throws(() => c.api_splitDeduction(request), /Service Spreadsheets failed/);
    c.upsertDeductionUnlocked_ = realUpsert;
    assert.deepStrictEqual(storedDeductions(), beforeDeductions, 'the new half is removed and the original still runs');
    assert.deepStrictEqual(storedExceptions(), beforeExceptions, 'every exception is back on the original, on its old date');
    const realExceptionsSheet = c.getDeductionExceptionsSheet;
    c.getDeductionExceptionsSheet = () => { throw new Error('Exceptions sheet unavailable'); };
    assert.throws(() => c.api_splitDeduction(request), /Exceptions sheet unavailable/);
    c.getDeductionExceptionsSheet = realExceptionsSheet;
    assert.deepStrictEqual(storedDeductions(), beforeDeductions);

    // A split computed from an out-of-date copy is refused before anything is written.
    const stale = c.api_splitDeduction(Object.assign({}, request, { expected: Object.assign({}, request.expected, { end_date: '2026-12-31' }) }));
    assert.equal(stale.success, false);
    assert.equal(stale.error, 'stale');
    assert.deepStrictEqual(storedDeductions(), beforeDeductions);

    const result = c.api_splitDeduction(request);
    assert.equal(result.success, true);
    const newId = result.deduction.id;
    assert.equal(newId, request.client_request_id, "the request id is the new half's id");
    assert.equal(result.original.end_date, '2026-05-31');
    assert.equal(result.deduction.start_date, '2026-06-30');
    assert.equal(result.deduction.anchor_day, 31);
    const expectedKeys = [
      [augustMove.id, newId, '2026-08-31'], [juneAdjust.id, newId, '2026-06-30'], [julySkip.id, newId, '2026-07-31'],
      [otherSkip.id, other.id, '2026-07-15'], [pastSkip.id, original.id, '2026-03-31']
    ].sort();
    assert.deepStrictEqual(storedExceptions(), expectedKeys, "later exceptions move to the new half, re-keyed to its dates; the past one and other deductions' stay");
    assert.deepStrictEqual(plain(result.moved_exception_ids).sort(), [juneAdjust.id, julySkip.id, augustMove.id].sort());
    // The client's optimistic re-key already matched what the server did.
    assert.deepStrictEqual(optimistic, expectedKeys.map(([id, ded, date]) => [id, ded === newId ? tempId : ded, date]).sort());

    // A retry after a lost response returns the saved split without splitting again.
    const retry = c.api_splitDeduction(request);
    assert.equal(retry.success, true);
    assert.equal(retry.replayed, true);
    assert.equal(retry.deduction.id, newId);
    assert.equal(storedDeductions().length, 3, 'no second new half');
    assert.deepStrictEqual(storedExceptions(), expectedKeys);

    // The client takes the server's rows, and both views agree on every month.
    split.success(plain(result));
    assert.deepStrictEqual(clientKeys(), expectedKeys);
    const newHalf = client.state.deductions.find((d) => d.id === newId);
    const oldHalf = client.state.deductions.find((d) => d.id === original.id);
    assert.equal(oldHalf.end_date, '2026-05-31');
    const utc = (iso) => new Date(iso + 'T12:00:00Z');
    const clientMonth = (ded, m) => plain(client.api.getDeductionOccurrencesWithExceptions(ded, new Date(2026, m, 1), new Date(2026, m + 1, 0))
      .map((o) => [o.date, o.amount, o.exceptionType]));
    const backendMonth = (ded, m) => plain(c.getDeductionOccurrencesWithExceptions(ded.id, 'monthly', utc(ded.start_date), ded.end_date ? utc(ded.end_date) : null,
      new Date(Date.UTC(2026, m, 1)), new Date(Date.UTC(2026, m + 1, 0, 23, 59, 59)), ded.anchor_day).map((o) => [o.date, o.amount, o.exceptionType]));
    [[newHalf, 5, [['2026-06-30', 5, 'adjust_amount']]], [newHalf, 6, []], [newHalf, 7, []], [newHalf, 8, [['2026-09-02', null, 'move'], ['2026-09-30', null, null]]],
      [oldHalf, 2, []], [oldHalf, 3, [['2026-04-30', null, null]]], [oldHalf, 6, []]].forEach(([ded, m, expected]) => {
      const label = (ded === newHalf ? 'new' : 'old') + ' half, month ' + (m + 1);
      assert.deepStrictEqual(clientMonth(ded, m), expected, 'client ' + label);
      assert.deepStrictEqual(backendMonth(ded, m), expected, 'backend ' + label);
    });
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
