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
const GUARD = ['syncSlice', 'sliceSnapshot_', 'sliceKeyIsPending', 'beginSliceWrite', 'beginSliceFetch', 'endSliceFetch', 'mergeSliceList',
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
function take(calls, method, match) {
  const index = calls.findIndex((call) => call.method === method && (!match || match(...call.args)));
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

  test('settings arrival keeps typed inputs and per-field saves, and updates untouched fields', () => {
    const input = (value) => ({ value });
    const inputs = { round_to_nearest: input('0'), target_hours_per_day: input('8'), theme: input('dark') };
    const savebar = { style: {} };
    const plain = (key, event) => ({ element: () => inputs[key], getValue: (el) => el.value, setValue: (el, v) => { el.value = String(v); }, defaultValue: '', event });
    const c = context({
      state: { settings: { round_to_nearest: '0', target_hours_per_day: '8', theme: 'dark', display_name: 'Old', default_time_view: 'calendar' } },
      SETTINGS_CONFIG: {
        round_to_nearest: plain('round_to_nearest', 'input'),
        target_hours_per_day: plain('target_hours_per_day', 'input'),
        theme: { element: () => inputs.theme, getValue: (el) => c.state.settings.theme || el.value, setValue: (el, v) => { el.value = v; }, defaultValue: 'dark' }
      },
      settingsInitialState: { round_to_nearest: '0', target_hours_per_day: '8', theme: 'dark' },
      settingsServerSynced: false, saveSettingsBtn: {}, discardSettingsBtn: { style: {} },
      document: { getElementById: (id) => (id === 'settings-savebar' ? savebar : null) },
      migrateCustomThemes: () => {}, applyTheme: (theme) => { c.state.settings = { ...c.state.settings, theme: theme || 'dark' }; },
      renderThemeGallery: () => {}, applyStatusDisplay: () => {}, applyDisplayName: () => {}, renderCalendar: () => {},
      setTimeout: () => {}
    }, ['readSettingsInput', 'editedSettingsKeys', 'applyServerSettingsToForm', 'rebaseSettingsBaseline', 'beginSettingsWrite',
      'persistSettingsFields', 'checkSettingsDirty', 'fetchSettingsWithRetry']);

    c.fetchSettingsWithRetry();
    inputs.round_to_nearest.value = '15';                         // typed while the GET is in flight
    const write = c.beginSettingsWrite(['display_name']);           // saveDisplayName
    c.state.settings.display_name = 'New';
    c.persistSettingsFields({ display_name: 'New' }, write);
    c.persistSettingsFields({ default_time_view: 'agenda' });      // setTimeViewPreference
    c.state.settings.default_time_view = 'agenda';
    take(c.calls, 'api_updateSettings', (fields) => 'default_time_view' in fields).success({ success: true });
    assert.equal(c.confirmedSliceFields('settings', c.state.settings).display_name, 'Old', 'the cache keeps the confirmed name while pending');

    take(c.calls, 'api_getSettings').success({ round_to_nearest: '0', target_hours_per_day: '7.5', theme: 'dark', display_name: 'Old', default_time_view: 'calendar' });
    assert.equal(inputs.round_to_nearest.value, '15', 'the typed value remains');
    assert.equal(c.settingsInitialState.round_to_nearest, '0');
    assert.equal(savebar.style.display, 'flex', 'and the save bar offers it');
    assert.equal(inputs.target_hours_per_day.value, '7.5', 'untouched fields take the server value');
    assert.equal(c.settingsInitialState.target_hours_per_day, '7.5');
    assert.equal(c.state.settings.display_name, 'New', 'a pending per-field save is not reverted');
    assert.equal(c.state.settings.default_time_view, 'agenda', 'nor one that confirmed after the GET was sent');
    assert.equal(c.settingsServerSynced, true);
    take(c.calls, 'api_updateSettings').success({ success: true });
    assert.equal(c.syncSliceGuards.settings.pending.size, 0);
  });

  test('a feature flag toggled while a flags GET is in flight stays toggled', () => {
    const normalizeFeatureFlags = (raw) => Object.fromEntries(Object.entries(raw || {})
      .map(([key, value]) => [key, { enabled: !!(value && typeof value === 'object' ? value.enabled : value), name: key, description: '' }]));
    const rendered = [];
    const c = context({
      state: { featureFlags: normalizeFeatureFlags({ a: false, b: true }), settings: {} },
      normalizeFeatureFlags, DEFAULT_FEATURE_FLAGS: {}, featureFlagsListEl: null, document: { querySelector: () => null },
      renderFeatureFlags: () => rendered.push(Object.fromEntries(Object.entries(c.state.featureFlags).map(([k, v]) => [k, v.enabled]))),
      applyFeatureFlagsLazy: () => {}, syncMobileViewToolVisibility: () => {}, handleFeatureFlagDataLoad: () => {},
      isUpgradeInProgressError: () => false, UPGRADE_RETRY_DELAYS_MS: []
    }, ['fetchFeatureFlagsFromServer', 'updateFeatureFlag']);
    const enabled = () => Object.fromEntries(Object.entries(c.state.featureFlags).map(([k, v]) => [k, v.enabled]));

    c.fetchFeatureFlagsFromServer();
    c.updateFeatureFlag('a', true);
    assert.equal(c.sliceKeyIsPending('featureFlags', 'a'), true, 'the toggle renders disabled while saving');
    assert.equal(c.confirmedSliceFields('featureFlags', c.state.featureFlags).a.enabled, false, 'the cache keeps the confirmed value');
    take(c.calls, 'api_getFeatureFlags').success({ a: false, b: false });
    assert.deepEqual(enabled(), { a: true, b: false }, 'the pending toggle survives; the other flag takes the server value');
    assert.deepEqual(rendered.pop(), { a: true, b: false }, 'and the re-render shows it');

    // The write's own reply is truth for its flag, but not for a toggle still saving next to it.
    c.updateFeatureFlag('b', true);
    take(c.calls, 'api_setFeatureFlag', (p) => p.feature === 'a').success({ success: true, flags: { a: true, b: false } });
    assert.deepEqual(enabled(), { a: true, b: true });
    c.fetchFeatureFlagsFromServer();
    take(c.calls, 'api_setFeatureFlag').success({ success: true, flags: { a: true, b: true } });
    take(c.calls, 'api_getFeatureFlags').success({ a: true, b: false });
    assert.deepEqual(enabled(), { a: true, b: true }, 'a toggle confirmed after the GET was sent is not reverted by it');

    c.updateFeatureFlag('a', false);
    take(c.calls, 'api_setFeatureFlag').failure(new Error('offline'));
    assert.deepEqual(enabled(), { a: true, b: true }, 'a failed toggle reverts');
  });

  test('contracts edited during an in-flight contracts GET or Lil month GET keep the edit', () => {
    const assessments = fs.readFileSync(path.join(root, 'views/partials/assessments-scripts.html'), 'utf8');
    const lil = (name) => { const at = assessments.indexOf('  function ' + name + '('); assert.notEqual(at, -1, name); return assessments.slice(at, assessments.indexOf('\n  }', at) + 4); };
    const sanitizeContract = (x) => ({ ...x });
    const form = { payload: null };
    const c = context({
      state: { contracts: [{ id: 'c1', name: 'Old' }, { id: 'c2', name: 'Second', archived: false }], hourTypes: [], settings: {},
        editingContractId: null, recurringEntryForm: {}, calendarFilteredContracts: [] },
      sanitizeContract, sanitizeHourType: (x) => ({ ...x }), updateContractMap: () => {}, updateHourTypeMap: () => {},
      contractSaveBtn: {}, getContractFormPayload: () => form.payload, getFeatureFlag: () => false, generateTempId: (p) => p + '-tmp',
      refreshContractBindings: () => {}, hideContractForm: () => {}, renderContractDetail: () => {},
      populateRecurringContractOptions: () => {}, renderCalendar: () => {}, customConfirm: () => true,
      isUpgradeInProgressError: () => false, UPGRADE_RETRY_DELAYS_MS: []
    }, ['fetchContractsFromServer', 'handleContractSave', 'handleContractArchiveToggle']);
    ['lilReferenceTickets', 'lilEndReferenceTickets', 'lilAdoptReferenceData'].forEach((name) => vm.runInNewContext(lil(name), c));
    const names = () => c.state.contracts.map((x) => x.id + ':' + x.name + (x.archived ? ':archived' : ''));

    c.fetchContractsFromServer();
    c.state.editingContractId = 'c1';
    form.payload = { name: 'New' };
    c.handleContractSave();
    take(c.calls, 'api_updateContract').success({ success: true, contract: { id: 'c1', name: 'New' } });
    take(c.calls, 'api_getContracts').success([{ id: 'c1', name: 'Old' }, { id: 'c2', name: 'Second' }, { id: 'c3', name: 'Third' }]);
    assert.deepEqual(names(), ['c1:New', 'c2:Second', 'c3:Third']);

    // lilAdoptReferenceData replaces contracts from any month payload; a month sent before an archive lands after it.
    const refs = c.lilReferenceTickets();
    c.handleContractArchiveToggle('c2', true);
    take(c.calls, 'api_setContractArchived').success({ success: true });
    c.lilAdoptReferenceData({ contracts: [{ id: 'c1', name: 'New' }, { id: 'c2', name: 'Second', archived: false }, { id: 'c3', name: 'Third' }] }, refs);
    c.lilEndReferenceTickets(refs);
    assert.deepEqual(names(), ['c1:New', 'c2:Second:archived', 'c3:Third']);

    // A month fetched after both writes is truth again.
    const fresh = c.lilReferenceTickets();
    c.lilAdoptReferenceData({ contracts: [{ id: 'c1', name: 'Renamed elsewhere' }] }, fresh);
    assert.deepEqual(names(), ['c1:Renamed elsewhere']);
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
