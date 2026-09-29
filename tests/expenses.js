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
    [['2026-01-31', '2027-12-31', 'monthly'], ['2026-09-15', '', 'weekly'], ['2026-02-28', '2031-01-01', 'yearly'], ['2026-03-31', '', 'quarterly'], ['2026-10-10', '', 'fortnightly'], ['2026-11-01', '', 'once']].forEach(([start, end, frequency]) => {
      const horizon = end || '2028-10-01';
      const backendDates = Array.from(c.migrationOccurrenceDates_(start, horizon, frequency)).filter(d => d >= TODAY).slice(0, 5);
      assert.deepStrictEqual(Array.from(client.expenseScheduleDates(start, end, frequency, TODAY, 5)), backendDates, frequency + ' from ' + start);
    });
  });
};

function extract(source, name) {
  const match = source.match(new RegExp('  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(match, 'Expected client function ' + name);
  return match[0];
}
exports.extract = extract;
exports.backend = backend;
