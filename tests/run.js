'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MockSpreadsheet, createAppsScriptContext } = require('./mock-apps-script');

const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, callback) {
  try { callback(); passed++; process.stdout.write('ok - ' + name + '\n'); }
  catch (error) { process.stderr.write('not ok - ' + name + '\n' + error.stack + '\n'); process.exitCode = 1; }
}
function load(context, file) { vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }); }
function fixture(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name + '.json'), 'utf8')); }

test('all six migration fixture families are present', () => {
  ['fork-only', 'original-only', 'hybrid', 'empty', 'malformed-header', 'partially-migrated'].forEach((name) => assert.ok(fixture(name).sheets));
});

test('canonical migration remaps aliases by name and preserves unknown named columns', () => {
  const data = fixture('original-only').sheets;
  const { context, spreadsheet } = createAppsScriptContext(data);
  context.assertMigrationsSettled_ = () => true;
  load(context, 'backend/sheets.ts.js');
  const beforeRows = spreadsheet.getSheetByName('timesheet_entries').getLastRow();
  context.canonicalizeSheet_('timesheet_entries');
  const once = spreadsheet.getSheetByName('timesheet_entries').snapshot();
  assert.ok(once[0].includes('contract_id'));
  assert.ok(once[0].includes('legacy_marker'));
  assert.equal(once[1][once[0].indexOf('contract_id')], 'contract-1');
  assert.equal(spreadsheet.getSheetByName('timesheet_entries').getLastRow(), beforeRows);
  context.canonicalizeSheet_('timesheet_entries');
  assert.deepStrictEqual(spreadsheet.getSheetByName('timesheet_entries').snapshot(), once);
});

test('malformed populated header fails loudly', () => {
  const { context } = createAppsScriptContext(fixture('malformed-header').sheets);
  context.assertMigrationsSettled_ = () => true;
  load(context, 'backend/sheets.ts.js');
  assert.throws(() => context.canonicalizeSheet_('timesheet_entries'), /data but no header/);
});

test('canonical migration losslessly coalesces duplicate legacy columns', () => {
  const { context, spreadsheet } = createAppsScriptContext({
    hour_types: [
      ['id', 'name', 'icon', 'quick_fill_enabled', 'icon'],
      ['work', 'Work', '⏱️', 'TRUE', ''],
      ['leave', 'Leave', '', 'TRUE', '🌴'],
      ['sick', 'Sick', '🤒', 'TRUE', '🤒']
    ]
  });
  context.assertMigrationsSettled_ = () => true;
  load(context, 'backend/sheets.ts.js');
  const result = context.canonicalizeSheet_('hour_types');
  const output = spreadsheet.getSheetByName('hour_types').snapshot();
  const iconIndex = output[0].indexOf('icon');
  assert.deepStrictEqual(Array.from(result.coalesced_headers), ['icon']);
  assert.equal(output[0].filter((header) => header === 'icon').length, 1);
  assert.deepStrictEqual([output[1][iconIndex], output[2][iconIndex], output[3][iconIndex]], ['⏱️', '🌴', '🤒']);
});

test('canonical migration rejects conflicting duplicate legacy values', () => {
  const { context } = createAppsScriptContext({
    hour_types: [['id', 'icon', 'icon'], ['work', '⏱️', '💼']]
  });
  context.assertMigrationsSettled_ = () => true;
  load(context, 'backend/sheets.ts.js');
  assert.throws(() => context.canonicalizeSheet_('hour_types'), /duplicate header "icon" has conflicting values in row 2/);
});

test('upgrade verifies a backup, records failure, and resumes without rerunning completed work', () => {
  const { context, spreadsheet, properties } = createAppsScriptContext({});
  const backup = new MockSpreadsheet({});
  properties.setProperty('tempus_migrations_applied', '[]');
  context.SpreadsheetApp.openById = () => backup;
  context.DriveApp = {
    getRootFolder: () => ({ id: 'root' }),
    getFileById: () => ({
      getParents: () => ({ hasNext: () => false }),
      makeCopy: () => ({ getId: () => 'verified-backup', getUrl: () => 'https://drive.google.com/verified-backup', getName: () => 'Tempus pre-upgrade backup' })
    })
  };
  context.assertMigrationsSettled_ = () => true;
  load(context, 'backend/sheets.ts.js');
  load(context, 'backend/migrations.js');
  let fail = true;
  let firstRuns = 0;
  let secondRuns = 0;
  context.listMigrations = () => [
    { id: 'one', run: () => { firstRuns++; if (fail) { fail = false; throw new Error('forced interruption'); } } },
    { id: 'two', run: () => { secondRuns++; } }
  ];
  const interrupted = context.api_runUpgrade();
  assert.equal(interrupted.success, false);
  assert.equal(interrupted.status.state, 'error');
  assert.equal(JSON.parse(properties.getProperty('tempus_migration_backup_v3')).verified, true);
  const resumed = context.api_runUpgrade();
  assert.equal(resumed.required, false);
  assert.equal(firstRuns, 2);
  assert.equal(secondRuns, 1);
  context.api_runUpgrade();
  assert.equal(firstRuns, 2);
  assert.equal(secondRuns, 1);
  assert.equal(spreadsheet.getSheets().length, 0);
});

test('PAYG tables switch at the Australian financial-year boundary and warn when stale', () => {
  const { context } = createAppsScriptContext({});
  load(context, 'backend/tax.js');
  assert.equal(context.paygFinancialYear_('2026-06-30T12:00:00+10:00'), '2025-26');
  assert.equal(context.paygFinancialYear_('2026-07-01T12:00:00+10:00'), '2026-27');
  assert.equal(context.estimateTaxDetails(10000, '2026-08-01').stale, false);
  assert.equal(context.estimateTaxDetails(10000, '2027-08-01').stale, true);
  assert.ok(context.estimateTax(10000, '2026-08-01') > 0);
});

test('recurring fortnight buckets are based on civil dates across Sydney DST', () => {
  const { context } = createAppsScriptContext({});
  context.toIsoDate = (value) => typeof value === 'string' ? value : value.toISOString().slice(0, 10);
  context.toIsoDateTime = context.toIsoDate;
  context.normalizeDurationMinutes = Number;
  context.punchesTotalMinutes = () => 0;
  load(context, 'backend/recurringEntries.js');
  const schedule = { weekly_weekdays: [0], weekly_interval: 2 };
  assert.equal(context.matchesWeeklySchedule(schedule, new Date(2026, 9, 4), new Date(2026, 8, 27)), false);
  assert.equal(context.matchesWeeklySchedule(schedule, new Date(2026, 9, 11), new Date(2026, 8, 27)), true);
});

test('month-end recurrence keeps its original anchor after February', () => {
  const { context } = createAppsScriptContext({});
  load(context, 'backend/annualviews.js');
  const anchor = new Date(2024, 0, 31);
  const february = context.advanceDateByFrequency(anchor, 'monthly', anchor);
  const march = context.advanceDateByFrequency(february, 'monthly', anchor);
  assert.equal(february.getDate(), 29);
  assert.equal(march.getDate(), 31);
});

test('percentage, URL and CSV protections normalize once', () => {
  const { context } = createAppsScriptContext({});
  context.Utilities.computeDigest = () => [0];
  load(context, 'backend/integrity.js');
  assert.equal(context.normalizePercentageDecimal_(25), 0.25);
  assert.equal(context.normalizePercentageDecimal_(0.25), 0.25);
  assert.throws(() => context.requireHttpUrl_('javascript:alert(1)', 'URL', false));
  assert.ok(context.csvSafeCell_('=SUM(A1:A2)').startsWith('"\''));
});

test('importer validates calendar dates and represents full days without fake punches', () => {
  const { context } = createAppsScriptContext({});
  context.ENTRY_SHEET_TZ = 'Australia/Sydney';
  load(context, 'backend/timesheetImporter.js');
  const leap = context.normalizeSheetDate('29/02/2024');
  assert.equal(leap.getFullYear(), 2024);
  assert.equal(context.normalizeSheetDate('31/02/2024'), null);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.buildPunchesForDuration(1440))), []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.buildPunchesForDuration(90))), [{ in: '00:00', out: '01:30' }]);
});

test('partial invoice payments allocate cash-basis GST proportionally', () => {
  const { context } = createAppsScriptContext({});
  context.cacheGet = () => null;
  context.cacheSet = () => {};
  context.getOrCreateSheet = () => ({ getDataRange: () => ({ getValues: () => [[]] }) });
  context.rowObjectFromHeaders_ = () => ({});
  context.roundMoney_ = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  context.listInvoiceLineItemsByInvoiceId = () => [{ amount: 100, gst_amount: 10 }];
  context.summarizeInvoiceLineItems = () => ({ totalWithGst: 110, gstAmount: 10 });
  load(context, 'backend/invoiceLedger.js');
  context.invoicePaymentsForInvoice_ = () => [{ payment_date: '2026-07-15', amount: 55 }, { payment_date: '2026-08-15', amount: 55 }];
  const allocation = context.invoiceCashAllocationForPeriod_({ id: 'invoice-1' }, '2026-07-01', '2026-07-31');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(allocation)), { sales: 55, gst: 5 });
});

test('BAS fixtures separate cash, accrual, prepayment, void, and unreconciled GST', () => {
  const data = fixture('financial-cases');
  const { context } = createAppsScriptContext({});
  context.cacheGet = () => null; context.cacheSet = () => {}; context.cacheClearPrefix = () => {};
  context.rowObjectFromHeaders_ = () => ({});
  context.getOrCreateSheet = () => ({ getDataRange: () => ({ getValues: () => [[]] }) });
  context.roundMoney_ = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  load(context, 'backend/invoiceLedger.js');
  load(context, 'backend/financialReporting.js');
  context.listInvoicesInternal = () => data.invoices;
  context.listInvoiceLineItemsByInvoiceId = (id) => data.invoice_lines[id] || [];
  context.listInvoiceLineItemsInternal = () => [];
  context.summarizeInvoiceLineItems = (lines) => ({ totalWithGst: lines.reduce((sum, line) => sum + line.amount + line.gst_amount, 0), gstAmount: lines.reduce((sum, line) => sum + line.gst_amount, 0) });
  context.invoicePayments_ = () => data.invoice_payments;
  context.invoicePaymentsForInvoice_ = (id) => data.invoice_payments.filter((payment) => payment.invoice_id === id).sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  context.api_listExpenseTransactions = () => data.expenses;
  context.expenseReadSheet_ = (name) => ({ rows: name === 'expense_payments' ? data.expense_payments : [] });
  context.expenseClaimableGst_ = (expense) => expense.status !== 'void' && expense.reconciliation_state === 'reconciled' && expense.claimable_gst_confirmed === 'TRUE' && expense.gst_code === 'taxable' ? expense.gst_amount * expense.business_use_percentage : 0;
  context.api_listExpenseRules = () => [];
  context.api_listInvoices = () => [{ id:'invoice-part', status:'issued', invoice_date:'2026-07-10', payment_state:'part_paid', balance_due:55 }];
  context.timesheetForecastForPeriod_ = () => ({ income: 0, uninvoiced_time: 0 });
  context.scheduledExpenseForecastForPeriod_ = () => 0;
  context.sha256Hex_ = () => 'fixture-hash';
  context.stableJsonStringify_ = JSON.stringify;
  const cash = context.api_calculateBasPeriod({ financial_year:2027, period_type:'monthly', month:6, accounting_basis:'cash' });
  const accrual = context.api_calculateBasPeriod({ financial_year:2027, period_type:'monthly', month:6, accounting_basis:'accrual' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(cash.actual)), { g1_total_sales:275, gst_on_sales:25, purchases:105, gst_on_purchases:5 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(accrual.actual)), { g1_total_sales:330, gst_on_sales:30, purchases:215, gst_on_purchases:10 });
  assert.ok(accrual.warnings.some((warning) => warning.includes('excluded from GST credits')));
});

test('assessment catalogues keep stable generic fields, line IDs, and token output', () => {
  const { context } = createAppsScriptContext({});
  context.expenseBoolean_ = (value) => value === true || String(value).toLowerCase() === 'true';
  context.invoiceToIsoDateTime = (value) => new Date(value).toISOString();
  context.invoiceToIsoDate = (value) => typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
  context.roundMoney_ = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  context.normalizePercentageDecimal_ = (value) => Number(value) > 1 ? Number(value) / 100 : Number(value || 0);
  load(context, 'backend/assessments.js');
  const fields = context.normalizeAssessmentFields_([{ key:'reference-number', label:'Reference', input_type:'text', required:true }, { key:'outcome', label:'Outcome', input_type:'select', options:['A','B'] }]);
  assert.equal(fields[0].key, 'reference_number');
  assert.equal(fields[1].options.length, 2);
  assert.throws(() => context.normalizeAssessmentFields_([{key:'same'},{key:'same'}]), /unique/);
  const lines = context.normalizeAssessmentLines_([{ id:'stable-line', template:'{organisation} – {reference_number}', multiplier:1.5, percentage_adjustment:10 }], 'type-1');
  assert.equal(lines[0].id, 'stable-line');
  assert.equal(lines[0].percentage_adjustment, 0.1);
  context.assessmentTypeById_ = () => ({ id:'type-1', name:'Configured type', lines, fields });
  context.assessmentContractById_ = () => ({ id:'contract-1', name:'Contract', hourly_rate:100 });
  const resolved = context.resolveAssessmentLines_({ assessment_type_id:'type-1', contract_id:'contract-1', organisation:'Organisation', assessment_date:'2026-07-01', field_values_json:'{"reference_number":"REF-1"}', percentage_adjustment:0 });
  assert.equal(resolved[0].description, 'Organisation – REF-1');
  assert.equal(resolved[0].amount, 165);
  assert.equal(resolved[0].gst_amount, 16.5);
});

test('income summaries wait for complete finance data and invalidate on reference-data changes', () => {
  const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
  assert.match(scripts, /if \(!incomeDependenciesReady\(\)\) \{\s*state\.incomeSummary = null;/);
  assert.match(scripts, /function processMonthCalculationQueue\(\) \{\s*if \(!state\.lazyLoadQueue\) return;\s*if \(!incomeDependenciesReady\(\)\) return;/);
  assert.match(scripts, /const isDirty = shouldRecalculateMonth\(year, month\);/);
  assert.match(scripts, /metadata\.dependencyHash !== dependencyHash/);
  assert.match(scripts, /state\.incomeCacheMetadata\[monthKey\]\.dependencyHash = calculateIncomeDependencyHash\(\);/);
  ['contributes_to_income', 'hourly_rate', 'amount_value', 'lost_super_recovery_mode', 'percentage'].forEach((dependency) => {
    assert.ok(scripts.includes(dependency), 'missing income dependency: ' + dependency);
  });
  assert.match(scripts, /const entries = entriesForMonth\(year, month\)\.filter\(entryContributesToIncome\);/);
  assert.match(scripts, /return !getFeatureFlag\('hour_types'\);/);
  assert.match(scripts, /String\(candidate\.slug \|\| ''\)\.trim\(\)\.toLowerCase\(\) === legacySlug/);
  assert.equal((scripts.match(/function entryContributesToIncome\(entry\)/g) || []).length, 1);
  const helperStart = scripts.indexOf('function hourTypeContributesToIncome(');
  const helperEnd = scripts.indexOf('\nfunction ensureIncomeCacheStructures()', helperStart);
  const clientContext = {
    state: {
      hourTypeMap: {
        'work-id': { id: 'work-id', slug: 'work', contributes_to_income: true },
        'leave-id': { id: 'leave-id', slug: 'leave', contributes_to_income: false }
      },
      hourTypes: [
        { id: 'work-id', slug: 'work', contributes_to_income: true },
        { id: 'leave-id', slug: 'leave', contributes_to_income: false }
      ]
    },
    getDefaultHourTypeId: () => 'work-id',
    getFeatureFlag: () => true
  };
  vm.createContext(clientContext);
  vm.runInContext(scripts.slice(helperStart, helperEnd), clientContext);
  assert.equal(clientContext.hourTypeContributesToIncome('work'), true);
  assert.equal(clientContext.hourTypeContributesToIncome('leave-id'), false);
  assert.equal(clientContext.hourTypeContributesToIncome('unknown-type'), false);
});

test('legacy Work hour types are repaired to billable without overriding an explicit default', () => {
  const headers = ['id', 'name', 'slug', 'color', 'contributes_to_income', 'requires_contract', 'is_default', 'use_for_rate_calculation', 'auto_populate_public_holidays', 'auto_populate_hours', 'created_at', 'display_order', 'quick_fill_enabled', 'quick_fill_hours', 'icon', 'quick_fill_mode'];
  const { context, spreadsheet } = createAppsScriptContext({
    hour_types: [
      headers,
      ['work-id', 'Work', 'work', '#3b82f6', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 0, '', 1, 'TRUE', 7.5, 'clock', 'hours'],
      ['wfh-id', 'WFH', 'wfh', '#10b981', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'FALSE', 0, '', 2, 'FALSE', '', '', 'hours']
    ]
  });
  context.assertMigrationsSettled_ = () => true;
  context.cacheClearPrefix = () => {};
  load(context, 'backend/sheets.ts.js');
  load(context, 'backend/hourtypes.js');
  const work = context.ensureWorkHourType();
  assert.equal(work.contributes_to_income, true);
  assert.equal(work.requires_contract, true);
  assert.equal(work.is_default, false);
  const rows = spreadsheet.getSheetByName('hour_types').snapshot();
  const workRow = rows.find((row) => row[headers.indexOf('id')] === 'work-id');
  assert.equal(workRow[headers.indexOf('contributes_to_income')], 'TRUE');
  assert.equal(workRow[headers.indexOf('requires_contract')], 'TRUE');
  assert.equal(workRow[headers.indexOf('is_default')], 'FALSE');
});

test('hour type entry modes persist and invalid values fall back to the global default', () => {
  const headers = ['id', 'name', 'slug', 'color', 'contributes_to_income', 'requires_contract', 'is_default', 'use_for_rate_calculation', 'auto_populate_public_holidays', 'auto_populate_hours', 'entry_mode', 'created_at', 'display_order', 'quick_fill_enabled', 'quick_fill_hours', 'icon', 'quick_fill_mode'];
  const { context, spreadsheet } = createAppsScriptContext({
    hour_types: [
      headers,
      ['work-id', 'Work', 'work', '#3b82f6', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'FALSE', 0, '', '', 1, 'TRUE', 7.5, 'clock', 'hours']
    ]
  });
  context.assertMigrationsSettled_ = () => true;
  context.cacheClearPrefix = () => {};
  context.withScriptLock_ = (label, callback) => callback();
  load(context, 'backend/sheets.ts.js');
  load(context, 'backend/hourtypes.js');
  assert.equal(context.api_updateHourType('work-id', { entry_mode: 'detailed' }).entry_mode, 'detailed');
  assert.equal(context.api_updateHourType('work-id', { entry_mode: 'unexpected' }).entry_mode, '');
  const rows = spreadsheet.getSheetByName('hour_types').snapshot();
  assert.equal(rows[1][rows[0].indexOf('entry_mode')], '');
});

test('Annual View uses taxable income and the same FY2026 PAYG result as the server', () => {
  const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
  assert.match(scripts, /tax = estimateTaxLocal\(taxableIncome, periodStartIso\);/);
  assert.doesNotMatch(scripts, /tax = estimateTaxLocal\(grossIncome,/);
  const start = scripts.indexOf('  function estimateTaxLocal(');
  const end = scripts.indexOf('\n  function renderAnnualViews()', start);
  assert.ok(start >= 0 && end > start);
  const clientContext = {
    Date,
    parseIsoDate(value) {
      const parts = String(value).split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  };
  vm.createContext(clientContext);
  vm.runInContext(scripts.slice(start, end), clientContext);

  const { context: serverContext } = createAppsScriptContext({});
  load(serverContext, 'backend/tax.js');
  [2372.69, 4735.19, 10000].forEach((income) => {
    assert.equal(clientContext.estimateTaxLocal(income, '2026-08-01'), serverContext.estimateTax(income, '2026-08-01'));
  });
  assert.equal(clientContext.estimateTaxLocal(2372.69, '2026-08-01'), 125);
});

test('backend globals and modified HTML scripts parse without duplicate functions', () => {
  const files = fs.readdirSync(path.join(root, 'backend')).filter((file) => file.endsWith('.js'));
  const names = new Map();
  files.forEach((file) => {
    const source = fs.readFileSync(path.join(root, 'backend', file), 'utf8');
    new vm.Script(source, { filename: file });
    for (const match of source.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      if (!names.has(match[1])) names.set(match[1], []);
      names.get(match[1]).push(file);
    }
  });
  const duplicates = [...names.entries()].filter(([, locations]) => locations.length > 1);
  assert.deepStrictEqual(duplicates, []);
  const main = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8').replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
  const mobile = fs.readFileSync(path.join(root, 'views/partials/mobile-entry-scripts.html'), 'utf8').replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
  const operations = fs.readFileSync(path.join(root, 'views/partials/operations-scripts.html'), 'utf8').replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
  new vm.Script(main);
  new vm.Script(mobile);
  new vm.Script(operations);
});

test('time entry controls expose contextual clocks and hour-type-owned entry modes', () => {
  const html = fs.readFileSync(path.join(root, 'views/index.html'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'views/partials/settings.html'), 'utf8');
  const hourTypes = fs.readFileSync(path.join(root, 'views/partials/hourtypes.html'), 'utf8');
  const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
  const mobile = fs.readFileSync(path.join(root, 'views/partials/mobile-entry-scripts.html'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'views/partials/head.html'), 'utf8');
  assert.match(html, /id="calendar-clock-toggle"/);
  assert.match(scripts, /data-clock-action="\$\{clockAction\}"/);
  assert.match(scripts, /clockBtn\.dataset\.clockAction === 'out'\) quickPunchOutForDate/);
  assert.match(scripts, /clockLabel\.textContent = showPunchOut \? 'Clock out' : 'Clock in'/);
  assert.match(settings, /id="set-entry-mode-source"/);
  assert.match(hourTypes, /id="hour-type-entry-mode"/);
  assert.match(scripts, /state\.settings\.entry_mode_source === 'hour_type'/);
  assert.match(mobile, /state\.settings\.entry_mode_source === 'hour_type'/);
  assert.match(scripts, /scheduleEntryMode\(draft\.contract_id, draft\.hour_type_id\)/);
  assert.doesNotMatch(scripts, /scheduleContractEntryMode/);
  assert.match(styles, /\.ts-pace-burndown \+ \.ts-pace-month-section/);
  assert.doesNotMatch(styles, /\.ts-pace-card-divider/);
  assert.doesNotMatch(scripts, /className = 'ts-pace-card-divider'/);
});

test('quick actions expose menu semantics and keyboard controls', () => {
  const html = fs.readFileSync(path.join(root, 'views/index.html'), 'utf8');
  const scripts = fs.readFileSync(path.join(root, 'views/partials/scripts.html'), 'utf8');
  assert.match(html, /id="calendar-context-menu" role="menu"/);
  ['ContextMenu', 'Shift+F10', 'ArrowDown', 'ArrowUp', 'Escape'].forEach((token) => {
    if (token === 'Shift+F10') assert.match(scripts, /event\.shiftKey && event\.key === 'F10'/);
    else assert.ok(scripts.includes(token));
  });
});

test('upgrade completion provides a top-level continuation link and refresh fallback', () => {
  const upgrade = fs.readFileSync(path.join(root, 'views/upgrade.html'), 'utf8');
  assert.match(upgrade, /id="continue"[^>]+target="_top"/);
  assert.match(upgrade, /Upgrade complete\. Refresh this page to open Tempus\./);
  assert.doesNotMatch(upgrade, /window\.top\.location\.reload/);
});

test('public holiday refresh replaces legacy blank-year rows instead of appending duplicates', () => {
  const headers = ['id', 'date', 'name', 'region', 'source', 'active', 'created_at', 'updated_at', 'local_name', 'counties', 'types', 'year', 'fetched_at'];
  const { context, spreadsheet } = createAppsScriptContext({
    public_holidays: [headers, ['legacy', '2026-01-01', "New Year's Day", '["AU"]', 'legacy', 'TRUE', '', '', "New Year's Day", '', '["Public"]', '', '']]
  });
  context.assertMigrationsSettled_ = () => true;
  context.cacheClearPrefix = () => {};
  load(context, 'backend/sheets.ts.js');
  load(context, 'backend/publicholidays.js');
  assert.equal(context.repairPublicHolidayYears_(), 1);
  context.replaceYearHolidays(2026, [{ date:'2026-01-01', name:"New Year's Day", localName:"New Year's Day", counties:null }]);
  const rows = spreadsheet.getSheetByName('public_holidays').snapshot();
  assert.equal(rows.length, 2);
  assert.equal(rows[1][headers.indexOf('year')], 2026);
});

test('public holiday time population adopts an existing date and hour type under the server lock', () => {
  const headers = ['id', 'date', 'duration_minutes', 'contract_id', 'created_at', 'punches_json', 'entry_type', 'hour_type_id', 'recurrence_id', 'note', 'assessment_id', 'source_type', 'source_id', 'source_occurrence_key', 'client_request_id'];
  const { context, spreadsheet } = createAppsScriptContext({
    timesheet_entries: [headers, ['existing', '2026-01-01', 450, '', '2026-01-01T00:00:00Z', '[]', 'basic', 'leave', '', '', '', 'manual', '', '', '']]
  });
  context.assertMigrationsSettled_ = () => true;
  context.getDefaultHourTypeId = () => 'work';
  context.api_getSettings = () => ({});
  context.cacheClearPrefix = () => {};
  load(context, 'backend/integrity.js');
  load(context, 'backend/sheets.ts.js');
  load(context, 'backend/entries.js');
  load(context, 'backend/publicholidays.js');
  const duplicate = context.api_addPublicHolidayEntry({ date:'2026-01-01', duration_minutes:450, hour_type_id:'leave' });
  assert.equal(duplicate.error, 'duplicate_entry');
  assert.equal(spreadsheet.getSheetByName('timesheet_entries').getLastRow(), 2);
  const added = context.api_addPublicHolidayEntry({ date:'2026-01-02', duration_minutes:450, hour_type_id:'leave' });
  assert.equal(added.success, true);
  assert.equal(added.entry.source_type, 'public_holiday');
  assert.equal(added.entry.source_occurrence_key, '2026-01-02');
  assert.deepStrictEqual(Array.from(added.entry.punches), []);
});

if (!process.exitCode) process.stdout.write('\n' + passed + ' tests passed.\n');
