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
  const operations = fs.readFileSync(path.join(root, 'views/partials/operations-scripts.html'), 'utf8').replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, '');
  new vm.Script(main);
  new vm.Script(operations);
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

if (!process.exitCode) process.stdout.write('\n' + passed + ' tests passed.\n');
