'use strict';
// Mobile entry sync: pending markers, merged refreshes, optimistic deletes and per-entry rollback.
// Loads entry-core + mobile-entry-scripts into a vm with a minimal DOM and a scriptable server.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const scriptSource = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\s*<script>\s*/, '').replace(/<\/script>\s*$/, '');

const flush = async () => { for (let i = 0; i < 30; i += 1) await new Promise((r) => setImmediate(r)); };
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

function element() {
  return {
    value: '', textContent: '', innerHTML: '', disabled: false, hidden: false, style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, append() {}, addEventListener() {}, querySelectorAll: () => [], setAttribute() {}
  };
}

function storage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

// A fake Tempus backend. `hold(fn)` makes the next call to fn wait until the test releases it.
function fakeServer(entries) {
  const server = { entries: entries.map((e) => ({ ...e })), calls: [], holds: {}, nextId: 1 };
  server.hold = (fn) => { const d = deferred(); (server.holds[fn] = server.holds[fn] || []).push(d); return d; };
  const handlers = {
    api_getHourTypes: () => [{ id: 'work', name: 'Work', is_default: true }, { id: 'leave', name: 'Leave' }],
    api_getContracts: () => [],
    api_getWebAppUrl: () => null,
    api_getEntries: ({ startDate, endDate }) => server.entries.filter((e) => e.date >= startDate && e.date <= endDate).map((e) => ({ ...e })),
    api_addEntry: (p) => { const entry = { ...p, id: 'srv_' + (server.nextId++) }; server.entries.push(entry); return { success: true, entry: { ...entry } }; },
    api_updateEntry: (p) => {
      const i = server.entries.findIndex((e) => e.id === p.id);
      if (i === -1) return { success: false };
      server.entries[i] = { ...server.entries[i], ...p };
      return { success: true, entry: { ...server.entries[i] } };
    },
    api_deleteEntry: (id) => { server.entries = server.entries.filter((e) => e.id !== id); return { success: true }; }
  };
  server.run = (fn, payload) => {
    server.calls.push([fn, payload]);
    const queue = server.holds[fn];
    const held = queue && queue.shift();
    if (held) return held.promise.then((override) => (override !== undefined ? override : (handlers[fn] ? handlers[fn](payload) : null)));
    return Promise.resolve(handlers[fn] ? handlers[fn](payload) : null);
  };
  return server;
}

async function bootMobile(serverEntries, opts = {}) {
  const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const server = fakeServer(serverEntries.map((e) => ({ date: today, ...e })));
  if (opts.beforeBoot) opts.beforeBoot(server);
  const elements = {};
  ['mobile-hours', 'mobile-status', 'mobile-punch-toggle'].forEach((id) => { elements[id] = element(); });
  const context = {
    console: { log() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, setImmediate,
    localStorage: storage(),
    document: {
      getElementById: (id) => elements[id] || null, querySelector: () => null, addEventListener() {},
      visibilityState: 'visible', documentElement: null, body: null, scrollingElement: null
    },
    mobileShell: { run: server.run, loadBaseState: async () => ({ settings: {}, featureFlags: {} }), state: { settings: {} } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(scriptSource('views/partials/entry-core.html'), context, { filename: 'entry-core.html' });
  vm.runInContext(scriptSource('views/partials/mobile-entry-scripts.html'), context, { filename: 'mobile-entry-scripts.html' });
  if (!opts.noFlush) await flush();
  const app = context.mobileEntry;
  const ids = () => app.state.entries.map((e) => String(e.id)).sort();
  const byId = (id) => app.state.entries.find((e) => String(e.id) === id);
  return { app, server, elements, context, today, ids, byId };
}

const asyncTests = [];
const asyncTest = (name, fn) => asyncTests.push([name, fn]);

asyncTest('mobile cold load keeps hours typed while the day is still loading', async () => {
  const { app, server, elements } = await bootMobile([], {
    noFlush: true,
    beforeBoot: (s) => { s.coldRead = s.hold('api_getEntries'); }
  });
  await flush();
  assert.equal(server.calls.filter(([fn]) => fn === 'api_getEntries').length, 1, 'the day read is in flight');
  app.padPress('3');
  server.coldRead.resolve();
  await flush();
  assert.equal(elements['mobile-hours'].value, '3', 'typed hours survive the end of hydrateDate');
  assert.equal(app.state.draftHours, '3');
});

asyncTest('mobile swipe-delete stays gone through refreshes while pending and after success', async () => {
  const { app, server, ids } = await bootMobile([{ id: 'e1', hour_type_id: 'work', duration_minutes: 120 }, { id: 'e2', hour_type_id: 'leave', duration_minutes: 60 }]);
  assert.deepEqual(ids(), ['e1', 'e2']);
  const del = server.hold('api_deleteEntry');
  const deleting = app.swipeDelete(app.state.entries.find((e) => e.id === 'e1'));
  assert.deepEqual(ids(), ['e2'], 'removed instantly');
  await app.refreshCurrentDayEntries(); // tab return while the delete is pending — server still has e1
  assert.deepEqual(ids(), ['e2'], 'a refresh during the pending delete does not resurrect it');
  await app.fetchEntriesRange('2000-01-01', '2999-12-31'); // prefetch covering the day
  assert.deepEqual(ids(), ['e2'], 'a prefetch does not resurrect it either');
  // A read issued before the delete lands, answered after it: its snapshot still lists e1.
  const staleRead = server.hold('api_getEntries');
  const refreshing = app.refreshCurrentDayEntries();
  del.resolve();
  await deleting;
  staleRead.resolve(server.entries.concat([{ id: 'e1', date: app.state.currentDate, hour_type_id: 'work', duration_minutes: 120 }]));
  await refreshing;
  assert.deepEqual(ids(), ['e2'], 'a read that predates the delete landing cannot bring it back');
  await app.refreshCurrentDayEntries();
  assert.deepEqual(ids(), ['e2']);
  assert.equal(app.pendingOps.size, 0, 'a read issued after the delete settled retires its marker');
});

asyncTest('mobile failed delete restores only that entry and keeps edits made meanwhile', async () => {
  const { app, server, elements, byId, ids } = await bootMobile([{ id: 'e1', hour_type_id: 'work', duration_minutes: 120 }, { id: 'e2', hour_type_id: 'leave', duration_minutes: 60 }]);
  const del = server.hold('api_deleteEntry');
  const deleting = app.swipeDelete(byId('e1'));
  await app.saveEntry({ id: 'e2', date: app.state.currentDate, hour_type_id: 'leave', contract_id: '', entry_type: 'basic', duration_minutes: 240, punches: [{ in: '00:00', out: '04:00' }] });
  assert.equal(byId('e2').duration_minutes, 240);
  del.resolve(null); // server error
  await deleting;
  assert.deepEqual(ids(), ['e1', 'e2'], 'the failed delete is restored');
  assert.equal(byId('e2').duration_minutes, 240, 'the other entry is not rolled back to a whole-day backup');
  assert.match(elements['mobile-status'].textContent, /Delete failed/);
});

asyncTest('mobile deleteEntry is optimistic and restores with a message on failure', async () => {
  const { app, server, elements, byId, ids } = await bootMobile([{ id: 'e1', hour_type_id: 'work', duration_minutes: 120 }]);
  app.state.currentEntry = byId('e1');
  const del = server.hold('api_deleteEntry');
  const deleting = app.deleteEntry();
  assert.deepEqual(ids(), [], 'gone before the server answers');
  del.resolve(null);
  await deleting;
  assert.deepEqual(ids(), ['e1']);
  assert.match(elements['mobile-status'].textContent, /Delete failed/);
  const again = server.hold('api_deleteEntry');
  app.state.currentEntry = byId('e1');
  const second = app.deleteEntry();
  again.resolve();
  await second;
  assert.deepEqual(ids(), []);
  assert.deepEqual(server.entries, []);
});

asyncTest('mobile punch clock stays usable while a save is in flight and queues behind the add', async () => {
  const { app, server, elements, context, ids } = await bootMobile([]);
  const toggle = elements['mobile-punch-toggle'];
  const add = server.hold('api_addEntry');
  toggle.onclick(); // Punch In
  await flush();
  assert.equal(toggle.disabled, false, 'the punch button is not disabled during the save');
  assert.equal(ids().length, 1);
  assert.ok(ids()[0].indexOf('temp_') === 0, 'the open session shows optimistically');
  vm.runInContext('Date.now = ((n) => () => n() + 60000)(Date.now)', context); // past the double-tap guard
  toggle.onclick(); // Punch Out, while the add is still in flight
  await flush();
  assert.equal(server.calls.filter(([fn]) => fn === 'api_updateEntry').length, 0, 'the edit waits for the add');
  add.resolve();
  await flush();
  const update = server.calls.find(([fn]) => fn === 'api_updateEntry');
  assert.ok(update, 'the punch-out is sent once the add lands');
  assert.equal(update[1].id, 'srv_1', 'and targets the real id, not the temp');
  assert.deepEqual(ids(), ['srv_1']);
  assert.ok(app.state.entries[0].punches[0].out, 'the session is closed');
});

asyncTest('mobile failed save rolls back only that entry', async () => {
  const { app, server, elements, byId } = await bootMobile([{ id: 'e1', hour_type_id: 'work', duration_minutes: 120 }, { id: 'e2', hour_type_id: 'leave', duration_minutes: 60 }]);
  const base = { date: app.state.currentDate, contract_id: '', entry_type: 'basic' };
  const slow = server.hold('api_updateEntry');
  const failing = server.hold('api_updateEntry');
  const e2Save = app.saveEntry({ ...base, id: 'e2', hour_type_id: 'leave', duration_minutes: 180, punches: [{ in: '00:00', out: '03:00' }] });
  const e1Save = app.saveEntry({ ...base, id: 'e1', hour_type_id: 'work', duration_minutes: 300, punches: [{ in: '00:00', out: '05:00' }] });
  assert.equal(byId('e1').duration_minutes, 300);
  server.hold('api_getEntries').resolve(null); // the verify re-read fails too, so only the rollback can restore e1
  failing.resolve(null);
  await e1Save;
  assert.equal(byId('e1').duration_minutes, 120, 'the failed edit is rolled back');
  assert.equal(byId('e2').duration_minutes, 180, 'the other in-flight edit keeps its optimistic value');
  assert.match(elements['mobile-status'].textContent, /Save failed/);
  slow.resolve();
  await e2Save;
  assert.equal(byId('e2').duration_minutes, 180);
});

asyncTest('mobile shell refresh keeps settings on a failed read and preserves local edits', async () => {
  const pending = {};
  const google = {
    script: {
      get run() {
        let success;
        const runner = new Proxy({}, {
          get: (_, fn) => {
            if (fn === 'withSuccessHandler') return (h) => { success = h; return runner; };
            if (fn === 'withFailureHandler') return () => runner;
            return () => { (pending[fn] = pending[fn] || []).push(success); };
          }
        });
        return runner;
      }
    }
  };
  const cache = { ts_mobile_base_cache_v1: JSON.stringify({ savedAt: Date.now(), settings: { theme: 'dark', round_to_nearest: 5 }, featureFlags: { hour_types: true }, entryDefaults: { basic: [], advanced: [] } }) };
  const context = {
    console: { log() {} }, google, localStorage: storage(cache), requestAnimationFrame() {},
    document: { body: { classList: { add() {}, remove() {}, toggle() {} } }, getElementById: () => null, head: { appendChild() {} } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(scriptSource('views/partials/mobile-shell-scripts.html'), context);
  await flush();
  const shell = context.mobileShell;
  const settingsRef = shell.state.settings;
  const answer = (fn, value) => pending[fn].shift()(value);
  // Background refresh from boot: every call fails (null).
  answer('api_getSettings', null); answer('api_getFeatureFlags', null); answer('api_getEntryDefaults', null);
  await flush();
  assert.equal(shell.state.settings.round_to_nearest, 5, 'a null settings reply does not blank settings');
  assert.equal(shell.state.featureFlags.hour_types.enabled, true, 'nor feature flags');
  // A second refresh, with a local edit landing while it is in flight.
  const refreshing = shell.refreshBaseFromServer();
  shell.setLocalSettings({ round_to_nearest: 15 });
  answer('api_getSettings', { theme: 'dark', round_to_nearest: 0, target_hours_per_day: 8 });
  answer('api_getFeatureFlags', { hour_types: false }); answer('api_getEntryDefaults', { basic: [], advanced: [] });
  await refreshing;
  assert.equal(shell.state.settings.round_to_nearest, 15, 'the local edit wins over the older server value');
  assert.equal(shell.state.settings.target_hours_per_day, 8, 'other keys take the server value');
  assert.equal(shell.state.settings, settingsRef, 'settings are updated in place, so the entry module sees them');
});

exports.run = async (test) => {
  for (const [name, fn] of asyncTests) {
    let error = null;
    try { await fn(); } catch (e) { error = e; }
    test(name, () => { if (error) throw error; });
  }
};
