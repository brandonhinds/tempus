'use strict';
// Stale-response guard (scripts.html syncSlice/beginSliceWrite/beginSliceFetch): a background GET that was
// sent before a local optimistic write must not revert that write when it lands late.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
function fn(name) {
  const match = source.match(new RegExp('\\n  (?:async )?function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(match, name); return match[0];
}
const GUARD = ['syncSlice', 'sliceSnapshot_', 'beginSliceWrite', 'beginSliceFetch', 'endSliceFetch', 'mergeSliceList',
  'mergeSliceFields', 'sliceKeyIsGuarded', 'confirmedSliceList', 'confirmedSliceFields'];

// google.script.run whose calls are queued so a test can answer them in any order.
function scriptRun(calls) {
  return new Proxy({}, { get(target, prop) {
    const call = { method: null, args: null, success: () => {}, failure: () => {} };
    const builder = new Proxy({}, { get(_, name) {
      if (name === 'withSuccessHandler') return (cb) => { call.success = cb; return builder; };
      if (name === 'withFailureHandler') return (cb) => { call.failure = cb; return builder; };
      return (...args) => { call.method = name; call.args = args; calls.push(call); };
    } });
    return builder[prop];
  } });
}
function take(calls, method) {
  const index = calls.findIndex((call) => call.method === method);
  assert.ok(index !== -1, 'expected a call to ' + method);
  return calls.splice(index, 1)[0];
}
function context(extra, names) {
  const calls = [];
  const noop = () => {};
  const c = {
    calls, syncSliceGuards: {}, console,
    google: { script: { get run() { return scriptRun(calls); } } },
    saveCache: noop, setStatus: noop, markIncomeDependencyReady: noop, markAllIncomeSummariesDirty: noop,
    renderIncomeSummary: noop, onCalendarMonthChange: noop, loadAnnualData: noop,
    ...extra
  };
  // The runner is synchronous, so an async handler runs with its confirm dialog answered inline.
  GUARD.concat(names || []).forEach((name) => vm.runInNewContext(fn(name).replace(/async function/, 'function').replace(/await /g, ''), c));
  return c;
}

exports.run = (test) => {
  test('slice guard keeps writes that a stale response predates and forgets them once settled', () => {
    const c = context();
    const early = c.beginSliceFetch('things');
    const write = c.beginSliceWrite('things', ['a'], [{ id: 'a', v: 1 }]);
    const during = c.beginSliceFetch('things');
    write.settle();
    const after = c.beginSliceFetch('things');
    const local = [{ id: 'a', v: 2 }];
    assert.deepEqual(c.mergeSliceList(after, [{ id: 'a', v: 3 }], local), [{ id: 'a', v: 3 }], 'a request sent after the write settled is truth');
    assert.deepEqual(c.mergeSliceList(during, [{ id: 'a', v: 1 }], local), [{ id: 'a', v: 2 }], 'sent before the write confirmed');
    assert.equal(c.sliceKeyIsGuarded('things', 'a'), true, 'the early request is still in flight');
    assert.deepEqual(c.mergeSliceList(early, [{ id: 'a', v: 1 }, { id: 'b' }], local), [{ id: 'a', v: 2 }, { id: 'b' }]);
    assert.equal(c.syncSliceGuards.things.touched.size, 0, 'nothing in flight predates the write any more');
    assert.equal(c.sliceKeyIsGuarded('things', 'a'), false);

    const whole = c.beginSliceWrite('flags', ['*'], { x: true });
    const stale = c.beginSliceFetch('flags');
    assert.deepEqual(c.confirmedSliceFields('flags', { x: false }), { x: true }, 'the cache keeps the confirmed object');
    assert.deepEqual(c.mergeSliceFields(stale, { x: true, y: 1 }, { x: false }), { x: false }, "'*' drops a stale response");
    whole.settle();
    const keyed = c.beginSliceWrite('flags', ['x'], { x: false, y: 1 });
    assert.deepEqual(c.mergeSliceFields(c.beginSliceFetch('flags'), { x: false, y: 2 }, { x: true, y: 1 }), { x: true, y: 2 });
    keyed.settle();
  });

  test('an in-flight deductions GET does not revert an optimistic add, edit or delete', () => {
    const sanitizeDeduction = (d) => ({ ...d });
    const c = context({
      state: { deductions: [{ id: 'd1', name: 'Old', amount: 10 }, { id: 'd2', name: 'Doomed', amount: 5 }], deductionExceptions: [], companyTrackingEnabled: true },
      sanitizeDeduction, buildOptimisticDeduction: (payload, existing) => ({ ...(existing || {}), ...payload }),
      monthKeyFromDateIso: () => null, markIncomeMonthsDirtyForDeductionChange: () => {},
      renderDeductionsList: () => {}, renderAnnualCategorySection: () => {}, customConfirm: () => true
    }, ['dedupeById', 'fetchDeductionsFromServer', 'saveDeductionDirectly', 'handleDeleteDeduction']);
    const byId = () => Object.fromEntries(c.state.deductions.map((d) => [d.id, d.name]));
    const oldServer = [{ id: 'd1', name: 'Old', amount: 10 }, { id: 'd2', name: 'Doomed', amount: 5 }, { id: 'd3', name: 'From another device', amount: 1 }];

    // Answer the stale GET while the writes are still unconfirmed.
    c.fetchDeductionsFromServer();
    c.saveDeductionDirectly({ id: 'd1', name: 'Edited', amount: 20 }, c.state.deductions[0]);
    c.saveDeductionDirectly({ name: 'Added', amount: 3 }, null);
    c.handleDeleteDeduction(c.state.deductions.find((d) => d.id === 'd2'));
    const tempId = c.state.deductions.find((d) => d.name === 'Added').id;
    assert.deepEqual(c.confirmedSliceList('deductions', c.state.deductions).map((d) => d.name).sort(), ['Doomed', 'Old'],
      'the browser cache stores confirmed rows, not unconfirmed writes');
    take(c.calls, 'api_getDeductions').success(oldServer);
    assert.deepEqual(byId(), { d1: 'Edited', [tempId]: 'Added', d3: 'From another device' });

    // Then a second stale GET, answered after every write has confirmed.
    c.fetchDeductionsFromServer();
    take(c.calls, 'api_upsertDeduction').success({ success: true, deduction: { id: 'd1', name: 'Edited', amount: 20 } });
    take(c.calls, 'api_upsertDeduction').success({ success: true, deduction: { id: 'real-1', name: 'Added', amount: 3 } });
    take(c.calls, 'api_deleteDeduction').success({ success: true });
    take(c.calls, 'api_getDeductions').success(oldServer);
    assert.deepEqual(byId(), { d1: 'Edited', 'real-1': 'Added', d3: 'From another device' });

    // A GET sent after the writes confirmed is truth again, including changes to rows edited earlier.
    c.fetchDeductionsFromServer();
    take(c.calls, 'api_getDeductions').success([{ id: 'd1', name: 'Renamed elsewhere' }, { id: 'real-1', name: 'Added' }]);
    assert.deepEqual(byId(), { d1: 'Renamed elsewhere', 'real-1': 'Added' });
    assert.equal(c.syncSliceGuards.deductions.pending.size, 0);
    assert.equal(c.syncSliceGuards.deductions.touched.size, 0);
  });

  test('a failed deduction write is not re-applied by a stale GET', () => {
    const c = context({
      state: { deductions: [{ id: 'd1', name: 'Old' }], deductionExceptions: [] },
      sanitizeDeduction: (d) => ({ ...d }), buildOptimisticDeduction: (payload, existing) => ({ ...(existing || {}), ...payload }),
      monthKeyFromDateIso: () => null, markIncomeMonthsDirtyForDeductionChange: () => {},
      renderDeductionsList: () => {}, renderAnnualCategorySection: () => {}
    }, ['dedupeById', 'fetchDeductionsFromServer', 'saveDeductionDirectly']);
    c.fetchDeductionsFromServer();
    c.saveDeductionDirectly({ id: 'd1', name: 'Edited' }, c.state.deductions[0]);
    take(c.calls, 'api_upsertDeduction').failure(new Error('offline'));
    take(c.calls, 'api_getDeductions').success([{ id: 'd1', name: 'Old' }]);
    assert.deepEqual(c.state.deductions.map((d) => d.name), ['Old']);
  });
};
