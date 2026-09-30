'use strict';
// BAS ledger summary guards: renderBasLedgerSummary() only computes on the BAS page, debounces bursts of
// income re-renders into one api_calculateBasPeriod call, and never runs two calculations at once.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'views/partials/operations-scripts.html'), 'utf8');

const flush = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r)); };
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

// The guard block: the three module-level flags plus renderBasLedgerSummary and runBasLedgerSummary_.
// calculateBasLedgerSummary_ (the real server call) is replaced by a stub whose calls the test can hold.
function client(page) {
  const start = source.indexOf('  let basLedgerTimer');
  const end = source.indexOf('  async function calculateBasLedgerSummary_()');
  assert.ok(start > -1 && end > start, 'expected the BAS ledger guard block');
  const timers = new Map();
  let nextTimer = 1;
  const c = {
    state: { currentPage: page },
    calls: 0, holds: [],
    setTimeout: (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    timers,
    // Fire every pending timer (the debounce), as if 800ms had passed. A browser timer would only log a
    // rejected callback, so swallow it here instead of letting Node treat it as an unhandled rejection.
    tick: () => { const due = [...timers.values()]; timers.clear(); due.forEach((t) => { const r = t.fn(); if (r && r.catch) r.catch(() => {}); }); }
  };
  c.calculateBasLedgerSummary_ = () => { c.calls += 1; const d = deferred(); c.holds.push(d); return d.promise; };
  vm.createContext(c);
  vm.runInContext(source.slice(start, end), c);
  return c;
}

const asyncTests = [];
const asyncTest = (name, fn) => asyncTests.push([name, fn]);

asyncTest('bas ledger: renderBasLedgerSummary does nothing off the BAS page', async () => {
  const c = client('time');
  c.renderBasLedgerSummary();
  c.renderBasLedgerSummary();
  assert.equal(c.timers.size, 0, 'no calculation is scheduled while the panel is off-screen');
  c.tick();
  await flush();
  assert.equal(c.calls, 0);
});

asyncTest('bas ledger: a burst of re-renders collapses into one calculation after 800ms', async () => {
  const c = client('bas');
  for (let i = 0; i < 5; i += 1) c.renderBasLedgerSummary();
  assert.equal(c.timers.size, 1, 'each call replaces the pending debounce timer');
  assert.equal([...c.timers.values()][0].ms, 800);
  assert.equal(c.calls, 0, 'nothing runs before the debounce fires');
  c.tick();
  await flush();
  assert.equal(c.calls, 1);
  c.holds[0].resolve();
  await flush();
  assert.equal(c.timers.size, 0, 'no rerun is queued when nothing changed during the calculation');
});

asyncTest('bas ledger: re-renders during a calculation queue exactly one rerun', async () => {
  const c = client('bas');
  c.renderBasLedgerSummary();
  c.tick();
  await flush();
  assert.equal(c.calls, 1);
  // Several more renders land (and debounce out) while the first calculation is still in flight.
  c.renderBasLedgerSummary(); c.tick();
  c.renderBasLedgerSummary(); c.renderBasLedgerSummary(); c.tick();
  await flush();
  assert.equal(c.calls, 1, 'never two calculations at once');
  c.holds[0].resolve();
  await flush();
  assert.equal(c.timers.size, 1, 'settling schedules one debounced rerun');
  c.tick();
  await flush();
  assert.equal(c.calls, 2, 'exactly one rerun');
  c.holds[1].resolve();
  await flush();
  assert.equal(c.timers.size, 0);
  assert.equal(c.calls, 2);
});

asyncTest('bas ledger: a failed calculation still clears the in-flight flag', async () => {
  const c = client('bas');
  c.calculateBasLedgerSummary_ = () => { c.calls += 1; return Promise.reject(new Error('boom')); };
  c.renderBasLedgerSummary(); c.tick();
  await flush();
  c.renderBasLedgerSummary(); c.tick();
  await flush();
  assert.equal(c.calls, 2, 'the next render calculates again');
});

asyncTest('bas ledger: leaving the BAS page before the debounce fires skips the calculation', async () => {
  const c = client('bas');
  c.renderBasLedgerSummary();
  c.state.currentPage = 'time';
  c.tick();
  await flush();
  assert.equal(c.calls, 0, 'the page is re-checked when the timer fires');
  // Likewise a queued rerun is dropped if the user has left by the time the calculation settles.
  c.state.currentPage = 'bas';
  c.renderBasLedgerSummary(); c.tick();
  await flush();
  c.renderBasLedgerSummary(); c.tick();
  await flush();
  c.state.currentPage = 'time';
  c.holds[0].resolve();
  await flush();
  assert.equal(c.timers.size, 0);
  assert.equal(c.calls, 1);
});

asyncTest('bas ledger: the heavy calculation lives behind the guard and showPage(bas) re-renders on arrival', async () => {
  const calc = source.slice(source.indexOf('  async function calculateBasLedgerSummary_()'));
  assert.match(calc.slice(0, 1500), /operationsApi\('api_calculateBasPeriod',payload\)/);
  const guard = source.slice(source.indexOf('  function renderBasLedgerSummary()'), source.indexOf('  async function calculateBasLedgerSummary_()'));
  assert.ok(!guard.includes('api_calculateBasPeriod'), 'the entry point never calls the server directly');
  const shell = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
  assert.match(shell, /state\.currentPage = normalized;[\s\S]{0,1500}if \(normalized === 'bas'\) \{\s*renderBasReporting\(\);/);
});

exports.run = async (test) => {
  for (const [name, fn] of asyncTests) {
    let error = null;
    try { await fn(); } catch (e) { error = e; }
    test(name, () => { if (error) throw error; });
  }
};
