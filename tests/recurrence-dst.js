'use strict';
// Recurring schedules count civil days between the anchor and each candidate date. In Australia/Sydney the
// DST start day (4 Oct 2026) is 23 hours long and the DST end day (4 Apr 2027) is 25 hours long, so a
// local-midnight millisecond diff divided by a 24-hour day and floored lands one day short after DST starts:
// a fortnight anchored on Sat 26 Sep 2026 skipped 10 Oct and jumped to 17 Oct. These tests pin the process
// to Sydney time (restored afterwards) so the transitions are really exercised whatever the host timezone.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createAppsScriptContext } = require('./mock-apps-script');

const root = path.resolve(__dirname, '..');
const clientSource = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');

function extractClientFunction(name) {
  const match = clientSource.match(new RegExp('  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(match, 'Expected client function ' + name);
  return match[0].trimStart();
}

function withSydneyTime(callback) {
  const previous = process.env.TZ;
  process.env.TZ = 'Australia/Sydney';
  try {
    // Guard: the transition must really be in effect, or these tests prove nothing.
    assert.equal(new Date(2026, 9, 3).getTimezoneOffset(), -600, 'expected AEST before 4 Oct 2026');
    assert.equal(new Date(2026, 9, 5).getTimezoneOffset(), -660, 'expected AEDT after 4 Oct 2026');
    assert.equal(new Date(2027, 3, 5).getTimezoneOffset(), -600, 'expected AEST after 4 Apr 2027');
    callback();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

function pad(n) { return String(n).padStart(2, '0'); }
function localIso(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }

// Fortnightly Saturdays from Sat 26 Sep 2026, through DST start (4 Oct 2026) and DST end (4 Apr 2027).
const FORTNIGHT_SCHEDULE = { recurrence_type: 'weekly', weekly_weekdays: [6], weekly_interval: 2 };
const EXPECTED_FORTNIGHTS = [
  '2026-09-26', '2026-10-10', '2026-10-24', '2026-11-07', '2026-11-21', '2026-12-05', '2026-12-19',
  '2027-01-02', '2027-01-16', '2027-01-30', '2027-02-13', '2027-02-27', '2027-03-13', '2027-03-27',
  '2027-04-10', '2027-04-24', '2027-05-08'
];

// Walk local days the way generateEntriesForSchedule / buildRecurringPreview do and collect the matches.
function walkMatches(matcher, anchor, endInclusive) {
  const out = [];
  const cursor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  while (cursor <= endInclusive) {
    if (matcher(cursor)) out.push(localIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function loadBackend() {
  const { context } = createAppsScriptContext({});
  context.toIsoDate = (value) => {
    if (typeof value === 'string') return value;
    return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate());
  };
  context.toIsoDateTime = context.toIsoDate;
  context.normalizeDurationMinutes = Number;
  context.punchesTotalMinutes = () => 0;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'backend/recurringEntries.js'), 'utf8'), context, { filename: 'backend/recurringEntries.js' });
  return context;
}

// A Date whose no-argument form reports a fixed local "now", so client code calling new Date() sees that day.
function fixedNowDate(y, m, d) {
  const RealDate = Date;
  return class FixedDate extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(y, m, d, 9, 0, 0); }
    static now() { return new RealDate(y, m, d, 9, 0, 0).getTime(); }
  };
}

function extractClientConstant(name) {
  const match = clientSource.match(new RegExp('  const ' + name + ' = [\\s\\S]*?\\n  \\};'));
  assert.ok(match, 'Expected client helper ' + name);
  return match[0].trimStart();
}

function loadClientPreview(options = {}) {
  const context = vm.createContext(Object.assign({ contracts: options.contracts || {} }, options.now ? { Date: options.now } : {}));
  vm.runInContext([
    'const getContractById = (id) => (id ? contracts[id] : undefined);',
    'const ISO_DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;',
    extractClientFunction('normalizeDateInput'),
    'const isoDate = (value) => normalizeDateInput(value);',
    'const parseIsoDate = (value) => { const n = normalizeDateInput(value); if (!n) return null; const [y, m, d] = n.split("-").map(Number); return new Date(y, m - 1, d); };',
    'const todayIso = () => isoDate(new Date());',
    'const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());',
    'const sanitizeRecurringEntry = (entry) => entry;',
    extractClientFunction('monthsBetween'),
    extractClientFunction('isLastWeekdayOfMonth'),
    extractClientFunction('matchesWeeklyPreview'),
    extractClientFunction('matchesMonthlyPreview'),
    extractClientFunction('buildRecurringPreview'),
    'this.matchesWeeklyPreview = matchesWeeklyPreview; this.buildRecurringPreview = buildRecurringPreview;'
  ].join('\n'), context, { filename: 'scripts.html (recurring preview)' });
  return context;
}

exports.run = function run(test) {
  test('backend fortnightly schedule stays on its fortnight across Sydney DST start and end', () => withSydneyTime(() => {
    const context = loadBackend();
    const anchor = context.parseIsoDateStrict('2026-09-26');
    const end = context.parseIsoDateStrict('2027-05-08');
    const matches = walkMatches((d) => context.matchesWeeklySchedule(FORTNIGHT_SCHEDULE, d, anchor), anchor, end);
    assert.deepStrictEqual(matches, EXPECTED_FORTNIGHTS);
  }));

  test('backend daysBetweenIso counts whole civil days across Sydney DST start and end', () => withSydneyTime(() => {
    const context = loadBackend();
    assert.equal(context.daysBetweenIso('2026-09-26', '2026-10-10'), 14);
    assert.equal(context.daysBetweenIso('2026-10-03', '2026-10-05'), 2);
    assert.equal(context.daysBetweenIso('2027-04-03', '2027-04-05'), 2);
    assert.equal(context.daysBetweenIso('2026-09-26', '2027-05-08'), 224);
    assert.equal(context.daysBetweenIso('2026-10-10', '2026-09-26'), -14);
  }));

  test('client recurring preview matches the backend fortnight across Sydney DST start and end', () => withSydneyTime(() => {
    const context = loadClientPreview();
    const anchor = new Date(2026, 8, 26);
    const matches = walkMatches((d) => context.matchesWeeklyPreview(FORTNIGHT_SCHEDULE, d, anchor), anchor, new Date(2027, 4, 8));
    assert.deepStrictEqual(matches, EXPECTED_FORTNIGHTS);
    // The preview walks a 200-day weekly horizon (to 14 Apr 2027), which still crosses DST end on 4 Apr.
    const withinHorizon = EXPECTED_FORTNIGHTS.filter((iso) => iso <= '2027-04-14');
    const preview = context.buildRecurringPreview(Object.assign({ start_date: '2026-09-26' }, FORTNIGHT_SCHEDULE), 50);
    assert.deepStrictEqual(Array.from(preview), withinHorizon);
    assert.equal(withinHorizon[withinHorizon.length - 1], '2027-04-10');
  }));

  test('client recurring preview anchors a blank start date on the contract start like the backend', () => withSydneyTime(() => {
    const contracts = { c1: { id: 'c1', start_date: '2026-09-26' }, future: { id: 'future', start_date: '2026-11-07' } };
    // Today is Mon 12 Oct 2026: anchoring on today would put the fortnight on 17 Oct / 31 Oct.
    const context = loadClientPreview({ contracts, now: fixedNowDate(2026, 9, 12) });
    const blank = Object.assign({ start_date: '', contract_id: 'c1' }, FORTNIGHT_SCHEDULE);
    assert.deepStrictEqual(Array.from(context.buildRecurringPreview(blank, 3)), ['2026-10-24', '2026-11-07', '2026-11-21']);
    // A contract that starts later generates from its start, so the preview begins there too.
    const later = Object.assign({}, blank, { contract_id: 'future' });
    assert.deepStrictEqual(Array.from(context.buildRecurringPreview(later, 2)), ['2026-11-07', '2026-11-21']);
    // An explicit start date still wins over the contract.
    const explicit = Object.assign({}, blank, { start_date: '2026-10-03' });
    assert.deepStrictEqual(Array.from(context.buildRecurringPreview(explicit, 2)), ['2026-10-03', '2026-10-17']);
  }));

  test('deduction last past occurrence includes the Sydney DST-start day', () => withSydneyTime(() => {
    const context = vm.createContext({ Date: fixedNowDate(2026, 9, 5) });
    vm.runInContext([
      'const ISO_DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;',
      extractClientFunction('normalizeDateInput'),
      'const isoDate = (value) => normalizeDateInput(value);',
      extractClientConstant('parseIsoDate'),
      clientSource.match(/  const startOfDay = .*\n/)[0],
      extractClientConstant('addDays'),
      extractClientConstant('addMonthsClamped'),
      clientSource.match(/  const DEDUCTION_OCCURRENCE_LIMIT = .*\n/)[0],
      extractClientFunction('deductionOccurrenceDate'),
      extractClientFunction('findLastPastOccurrence'),
      'this.findLastPastOccurrence = findLastPastOccurrence;'
    ].join('\n'), context, { filename: 'scripts.html (deductions)' });
    // Today is Mon 5 Oct 2026; clocks went forward on Sun 4 Oct, so yesterday is 4 Oct.
    assert.equal(context.findLastPastOccurrence({ frequency: 'weekly', start_date: '2026-09-27', end_date: '' }), '2026-10-04');
    assert.equal(context.findLastPastOccurrence({ frequency: 'once', start_date: '2026-10-04', end_date: '' }), '2026-10-04');
  }));

  // Rows generated by the pre-fix matcher sit on the wrong fortnight (17 Oct, 31 Oct). Re-saving the schedule
  // with "Delete future entries" removes them; the schedule's progress must rewind too, or the next sync
  // treats October as done and the correct dates (10 Oct, 24 Oct) are never written.
  test('deleting future recurring entries rewinds progress so a sync regenerates the right fortnights', () => withSydneyTime(() => {
    const scheduleRow = RECURRING_HEADERS_FOR_TEST.map((h) => ({
      id: 'sched-1', label: 'Fortnightly Sat', recurrence_type: 'weekly', weekly_interval: 2, weekly_weekdays_json: '[6]',
      monthly_interval: 1, duration_minutes: 450, contract_id: 'c1', start_date: '2026-09-26', end_date: '2026-11-08',
      generated_until: '2026-11-08'
    })[h] ?? '');
    const { context, spreadsheet } = createAppsScriptContext({
      recurring_time_entries: [RECURRING_HEADERS_FOR_TEST, scheduleRow],
      timesheet_entries: [
        ['id', 'date', 'recurrence_id'],
        ['e1', '2026-09-26', 'sched-1'],
        ['e2', '2026-10-17', 'sched-1'],
        ['e3', '2026-10-31', 'sched-1'],
        ['other', '2026-10-17', 'someone-else']
      ]
    });
    context.toIsoDate = (value) => (typeof value === 'string' ? value : localIso(value));
    context.toIsoDateTime = context.toIsoDate;
    context.getOrCreateSheet = (name) => spreadsheet.getSheetByName(name);
    context.normalizeDurationMinutes = Number;
    context.punchesTotalMinutes = () => 0;
    context.cacheClearPrefix = () => {};
    context.ENTRY_CACHE_PREFIX = 'entries_';
    vm.runInNewContext(fs.readFileSync(path.join(root, 'backend/recurringEntries.js'), 'utf8'), context, { filename: 'backend/recurringEntries.js' });
    vm.runInNewContext(fs.readFileSync(path.join(root, 'backend/integrity.js'), 'utf8'), context, { filename: 'backend/integrity.js' });

    const result = context.deleteFutureRecurringEntriesUnlocked_({ recurrenceId: 'sched-1', fromDate: '2026-10-01' });
    assert.equal(result.deleted, 2);
    const remaining = spreadsheet.getSheetByName('timesheet_entries').values.slice(1).map((r) => r[0]);
    assert.deepStrictEqual(remaining, ['e1', 'other'], 'past rows and other schedules are untouched');

    const schedule = context.listRecurringEntriesInternal()[0];
    assert.equal(schedule.generated_until, '2026-09-30');

    const created = [];
    context.createRecurringEntryInstance = (entry, dateIso) => { created.push(dateIso); return true; };
    context.processRecurringEntry(schedule, {
      contracts: { c1: { name: 'C1', start_date: '2026-01-01', end_date: '2026-12-31' } },
      hourTypes: {},
      existingIndex: { 'sched-1__2026-09-26': true },
      todayIso: '2026-10-01',
      horizonDays: null
    });
    assert.deepStrictEqual(created, ['2026-10-10', '2026-10-24', '2026-11-07']);
  }));

  test('deleting future recurring entries never moves progress forward', () => withSydneyTime(() => {
    const scheduleRow = RECURRING_HEADERS_FOR_TEST.map((h) => ({
      id: 'sched-2', recurrence_type: 'weekly', weekly_interval: 1, weekly_weekdays_json: '[1]', contract_id: 'c1',
      start_date: '2026-09-01', generated_until: '2026-09-20'
    })[h] ?? '');
    const { context, spreadsheet } = createAppsScriptContext({
      recurring_time_entries: [RECURRING_HEADERS_FOR_TEST, scheduleRow],
      timesheet_entries: [['id', 'date', 'recurrence_id']]
    });
    context.toIsoDate = (value) => (typeof value === 'string' ? value : localIso(value));
    context.toIsoDateTime = context.toIsoDate;
    context.getOrCreateSheet = (name) => spreadsheet.getSheetByName(name);
    context.normalizeDurationMinutes = Number;
    context.punchesTotalMinutes = () => 0;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'backend/recurringEntries.js'), 'utf8'), context, { filename: 'backend/recurringEntries.js' });
    context.deleteFutureRecurringEntriesUnlocked_({ recurrenceId: 'sched-2', fromDate: '2026-10-01' });
    assert.equal(context.listRecurringEntriesInternal()[0].generated_until, '2026-09-20');
  }));
};

const RECURRING_HEADERS_FOR_TEST = ['id', 'label', 'recurrence_type', 'weekly_interval', 'weekly_weekdays_json', 'monthly_interval',
  'monthly_mode', 'monthly_day', 'monthly_week', 'monthly_weekday', 'duration_minutes', 'hour_type_id', 'contract_id', 'start_date',
  'end_date', 'generated_until', 'warning_message', 'created_at', 'updated_at', 'sessions_json'];
