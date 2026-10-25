'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createAppsScriptContext } = require('./mock-apps-script');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const load = (context, file) => vm.runInNewContext(read(file), context, { filename: file });
const plain = (value) => JSON.parse(JSON.stringify(value));
const data = JSON.parse(read('tests/fixtures/financial-cases.json'));

const CATEGORIES = { 'expense-taxable': 'Office Supplies', 'expense-out-of-scope': 'Donations' };

// The BAS fixture (issued and void invoices; paid, unpaid, prepaid, part-business, scheduled and skipped
// expenses) wired to the real BAS and report code, with payment methods and categories.
function reportContext() {
  const { context } = createAppsScriptContext({});
  context.cacheGet = () => null; context.cacheSet = () => {}; context.cacheClearPrefix = () => {};
  context.rowObjectFromHeaders_ = () => ({});
  context.getOrCreateSheet = () => ({ getDataRange: () => ({ getValues: () => [[]] }) });
  load(context, 'backend/integrity.js');
  load(context, 'backend/financialReporting.js');
  load(context, 'backend/accountantReport.js');
  const invoices = data.invoices.map((invoice) => Object.assign({ invoice_number: invoice.id.toUpperCase(), source_month: invoice.id === 'invoice-prepaid' ? '2026-06' : '' }, invoice));
  invoices.push({ id: 'invoice-draft', invoice_number: 'DRAFT', status: 'draft', invoice_date: '2026-07-11' });
  invoices.push({ id: 'invoice-old', invoice_number: 'OLD', status: 'issued', invoice_date: '2025-06-01' });
  context.listInvoicesInternal = () => invoices;
  context.listInvoiceLineItemsByInvoiceId = (id) => (data.invoice_lines[id] || [{ amount: 1000, gst_amount: 100 }]).map((line) => Object.assign({ contract_name_snapshot: 'Acme', description: 'Consulting\nDetail' }, line));
  context.summarizeInvoiceLineItems = (lines) => {
    const amount = lines.reduce((sum, line) => sum + line.amount, 0);
    const gst = lines.reduce((sum, line) => sum + line.gst_amount, 0);
    return { totalAmount: amount, totalHours: 0, gstAmount: gst, totalWithGst: amount + gst };
  };
  const expenses = data.expenses.map((expense) => Object.assign({ vendor: expense.id.replace('expense-', 'Vendor '), description: '', category: CATEGORIES[expense.id] || '' }, expense))
    .concat([{ id: 'expense-last-fy', vendor: 'Insurer', description: 'Indemnity insurance', category: '', status: 'recorded', paid_date: '2026-07-02', supplier_invoice_date: '2026-06-20', amount: 22, gst_code: 'taxable', gst_amount: 2, business_use_percentage: 1, payment_method: 'EFT', attachments: [] }]);
  context.api_listExpenseTransactions = () => expenses;
  context.getSuperGuaranteeRate = (date) => (date >= '2025-07-01' ? 0.12 : 0.115);
  return context;
}

// Evaluates the workbook's own formulas (SUM ranges, +/-, ROUND, DATE) so tests check what Excel shows.
function evaluator(rows) {
  const cell = (ref) => {
    const match = /^([A-Z]+)(\d+)$/.exec(ref);
    const column = match[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    return value(rows[Number(match[2]) - 1][column]);
  };
  const value = (raw) => {
    if (typeof raw === 'number') return raw;
    if (typeof raw !== 'string' || !raw.startsWith('=')) return 0;
    const expression = raw.slice(1)
      .replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (all, column, first, _, last) => '(' + Array.from({ length: Number(last) - Number(first) + 1 }, (x, i) => column + (Number(first) + i)).join('+') + ')')
      .replace(/ROUND\(/g, 'round(')
      .replace(/DATE\((\d+),(\d+),(\d+)\)/g, '0')
      .replace(/\b([A-Z]+\d+)\b/g, "cell('$1')");
    return Function('cell', 'round', 'return ' + expression)(cell, (n, d) => Math.round(n * 10 ** d) / 10 ** d);
  };
  return (ref) => Math.round(cell(ref) * 100) / 100;
}

exports.run = function run(test) {
  test('accountant report totals reconcile with the BAS actuals for the year on both bases', () => {
    const context = reportContext();
    ['cash', 'accrual'].forEach((basis) => {
      const report = context.buildAccountantReport_({ financial_year: 2026, accounting_basis: basis });
      const bas = context.basActualsForRange_(basis, '2026-07-01', '2027-06-30');
      assert.equal(report.totals.income, bas.g1_total_sales, basis + ' income');
      assert.equal(report.totals.income_gst, bas.gst_on_sales, basis + ' income GST');
      assert.equal(report.totals.expenses, bas.purchases, basis + ' expenses');
      assert.equal(report.totals.expenses_gst, bas.gst_on_purchases, basis + ' GST credits');

      // And the workbook's own YTD formulas land on the same figures.
      const [income, expenses] = plain(context.accountantReportTabs_(report));
      const incomeAt = evaluator(income.rows), expensesAt = evaluator(expenses.rows);
      const incomeYtd = income.rows.length, expenseYtd = expenses.rows.length;
      assert.equal(incomeAt('D' + incomeYtd), bas.g1_total_sales, basis + ' income YTD formula');
      assert.equal(incomeAt('E' + incomeYtd), bas.gst_on_sales);
      assert.equal(incomeAt('F' + incomeYtd), Math.round((bas.g1_total_sales - bas.gst_on_sales) * 100) / 100);
      assert.equal(expensesAt('D' + expenseYtd), bas.purchases, basis + ' expenses YTD formula');
      assert.equal(expensesAt('E' + expenseYtd), bas.gst_on_purchases);
      const categoryTotal = expenses.rows[0].slice(7).reduce((sum, name, index) => sum + expensesAt(String.fromCharCode(72 + index) + expenseYtd), 0);
      assert.equal(Math.round(categoryTotal * 100) / 100, bas.purchases, basis + ' category columns add up to the gross');
    });
  });

  test('income is one line per invoice on its invoice date, the same on both bases', () => {
    const context = reportContext();
    ['cash', 'accrual'].forEach((basis) => {
      const report = plain(context.buildAccountantReport_({ financial_year: 2026, accounting_basis: basis }));
      assert.deepStrictEqual(report.income.map((item) => [item.invoice_number, item.date, item.description, item.gross, item.gst, item.quarter]), [
        ['INVOICE-PART', '2026-07-10', 'July Invoice', 110, 10, 1],
        ['INVOICE-PREPAID', '2026-08-10', 'June Invoice', 220, 20, 1]
      ], basis + ': void, draft and last year\'s invoices are left out');
      assert.ok(report.income.every((item) => !('payment_method' in item) && !('date_banked' in item)), 'invoice payments are not tracked');
    });
  });

  test('cash basis lists each paid expense once, on its paid date, with how it was paid', () => {
    const report = plain(reportContext().buildAccountantReport_({ financial_year: 2026, accounting_basis: 'cash' }));
    assert.deepStrictEqual(report.expenses.map((item) => [item.date, item.description, item.payment_method, item.gross, item.gst, item.category]), [
      ['2026-07-02', 'Insurer - Indemnity insurance', 'EFT', 22, 2, 'Uncategorised'],
      ['2026-07-16', 'Vendor taxable', 'Credit card', 110, 10, 'Office Supplies'],
      ['2026-07-17', 'Vendor out-of-scope', 'Credit card', 50, 0, 'Donations'],
      ['2026-07-20', 'Vendor prepaid', 'Direct debit', 22, 2, 'Uncategorised'],
      ['2026-08-02', 'Vendor half', 'EFT', 220, 10, 'Uncategorised']
    ], 'unpaid, scheduled and skipped expenses are left out; last FY\'s purchase counts when it was paid');
    assert.deepStrictEqual(report.categories, ['Donations', 'Office Supplies', 'Uncategorised']);
  });

  test('accrual basis lists each expense once, on the earlier of its invoice and paid dates', () => {
    const report = plain(reportContext().buildAccountantReport_({ financial_year: 2026, accounting_basis: 'accrual' }));
    assert.deepStrictEqual(report.expenses.map((item) => [item.date, item.description, item.payment_method, item.gross]), [
      ['2026-07-05', 'Vendor taxable', 'Credit card', 110], ['2026-07-06', 'Vendor out-of-scope', 'Credit card', 50], ['2026-07-07', 'Vendor unpaid', '', 55],
      ['2026-07-20', 'Vendor prepaid', 'Direct debit', 22], ['2026-07-28', 'Vendor half', 'EFT', 220]
    ], 'last FY\'s invoice stays in last FY');
  });

  test('the Income tab itemises by quarter with live formulas and super per line', () => {
    const context = reportContext();
    const [income] = plain(context.accountantReportTabs_(context.buildAccountantReport_({ financial_year: 2026, accounting_basis: 'cash' })));
    assert.deepStrictEqual(income.rows[0], ['Date', 'Invoice', 'Description', 'Gross', 'GST', 'Net', 'Superannuation']);
    assert.deepStrictEqual(income.rows[1], ['=DATE(2026,7,10)', 'INVOICE-PART', 'July Invoice', 110, 10, '=D2-E2', '=ROUND(F2*0.12,2)']);
    assert.deepStrictEqual(income.rows[3], ['', '', 'Q1', '=SUM(D2:D3)', '=SUM(E2:E3)', '=D4-E4', '=SUM(G2:G3)']);
    assert.deepStrictEqual(income.rows[4], ['', '', 'Q2', 0, 0, '=D5-E5', 0], 'an empty quarter still gets its row');
    assert.deepStrictEqual(income.rows[7], ['', '', 'YTD Totals:', '=D4+D5+D6+D7', '=E4+E5+E6+E7', '=D8-E8', '=G4+G5+G6+G7']);
    assert.deepStrictEqual(income.bold, [0, 3, 4, 5, 6, 7]);
    assert.deepStrictEqual(income.money, [3, 4, 5, 6]);
    assert.deepStrictEqual(income.dates, [0]);
    const at = evaluator(income.rows);
    assert.equal(at('G8'), Math.round((100 + 200) * 0.12 * 100) / 100, 'super is the SG rate on the amount excluding GST');
  });

  test('the Expenses tab puts each line\'s gross under its category, with quarter and YTD totals', () => {
    const context = reportContext();
    const [, expenses] = plain(context.accountantReportTabs_(context.buildAccountantReport_({ financial_year: 2026, accounting_basis: 'cash' })));
    assert.deepStrictEqual(expenses.rows[0], ['Date', 'Description', 'Payment Method', 'Gross', 'GST', 'Net', '', 'Donations', 'Office Supplies', 'Uncategorised']);
    assert.deepStrictEqual(expenses.rows[2], ['=DATE(2026,7,16)', 'Vendor taxable', 'Credit card', 110, 10, '=D3-E3', '', '', 110, '']);
    assert.deepStrictEqual(expenses.rows[6], ['', 'Q1 Totals', '', '=SUM(D2:D6)', '=SUM(E2:E6)', '=D7-E7', '', '=SUM(H2:H6)', '=SUM(I2:I6)', '=SUM(J2:J6)']);
    assert.deepStrictEqual(expenses.rows[expenses.rows.length - 1].slice(0, 4), ['', 'YTD Totals', '', '=D7+D8+D9+D10']);
    assert.deepStrictEqual(expenses.money, [3, 4, 5, 7, 8, 9]);
    expenses.rows.forEach((row, index) => assert.equal(row.length, expenses.rows[0].length, 'row ' + index + ' width'));
  });

  test('accountant report helpers: descriptions, quarters and column letters', () => {
    const context = reportContext();
    assert.equal(context.accountantReportInvoiceDescription_({ source_month: '2026-08', invoice_date: '2026-09-02' }), 'August Invoice', 'the month billed, not the month issued');
    assert.equal(context.accountantReportInvoiceDescription_({ source_month: '', invoice_date: '2027-01-15' }), 'January Invoice');
    assert.equal(context.accountantReportInvoiceDescription_({}), 'Invoice');
    assert.deepStrictEqual([7, 9, 10, 12, 1, 3, 4, 6].map((month) => context.accountantReportQuarter_('2026-' + String(month).padStart(2, '0') + '-15')), [1, 1, 2, 2, 3, 3, 4, 4]);
    assert.deepStrictEqual([0, 7, 25, 26, 27].map(context.accountantReportColumn_), ['A', 'H', 'Z', 'AA', 'AB']);
    assert.deepStrictEqual(['=HYPERLINK(1)', '+61 400', '-5', '@x', 'Officeworks'].map(context.accountantReportText_), ["'=HYPERLINK(1)", "'+61 400", "'-5", "'@x", 'Officeworks']);
    assert.throws(() => context.buildAccountantReport_({}), /Financial year is required/);
  });

  test('accountant report exports xlsx and always bins the temporary sheet', () => {
    const context = reportContext();
    const written = {};
    const trashed = [];
    const range = { setValues: () => range, setFontWeight: () => range, setNumberFormat: () => range };
    const sheetFor = (name) => {
      const sheet = { name, setName: (value) => { sheet.name = value; return sheet; }, setFrozenRows: () => {}, autoResizeColumns: () => {} };
      sheet.getRange = (row) => Object.assign({}, range, { setValues: (values) => { if (row === 1) written[sheet.name] = values; return range; } });
      return sheet;
    };
    context.SpreadsheetApp = {
      create: (title) => { context.createdTitle = title; const first = sheetFor('Sheet1'); return { getId: () => 'temp-id', getSheets: () => [first], insertSheet: (name) => sheetFor(name) }; },
      flush: () => {}
    };
    context.ScriptApp = { getOAuthToken: () => 'token' };
    context.DriveApp = { getFileById: (id) => ({ setTrashed: (value) => { if (value) trashed.push(id); } }) };
    let status = 200;
    context.UrlFetchApp = { fetch: (url, options) => { context.fetched = { url, options }; return { getResponseCode: () => status, getContent: () => [80, 75] }; } };
    context.Utilities.base64Encode = (bytes) => Buffer.from(bytes).toString('base64');

    const result = context.api_exportAccountantReport({ financial_year: 2026, accounting_basis: 'cash' });
    assert.equal(result.filename, 'Bookkeeping 2026-27.xlsx');
    assert.equal(result.base64, 'UEs=');
    assert.equal(context.createdTitle, 'Bookkeeping 2026-27');
    assert.equal(context.fetched.url, 'https://docs.google.com/spreadsheets/d/temp-id/export?format=xlsx');
    assert.equal(context.fetched.options.headers.Authorization, 'Bearer token');
    assert.deepStrictEqual(Object.keys(written), ['Income', 'Expenses']);
    assert.deepStrictEqual(trashed, ['temp-id']);

    status = 500;
    assert.throws(() => context.api_exportAccountantReport({ financial_year: 2026 }), /HTTP 500/);
    assert.deepStrictEqual(trashed, ['temp-id', 'temp-id'], 'a failed export still removes the temporary sheet');
  });

  test('accountant report button is on the BAS page and sends the year and basis', () => {
    const markup = read('views/partials/bas.html');
    const client = read('views/partials/operations-scripts.html');
    assert.ok(markup.includes('id="bas-accountant-report"'));
    assert.match(client, /operationsApi\('api_exportAccountantReport', \{ financial_year: fy, accounting_basis: basis \}\)/);
    new vm.Script(client.slice(client.indexOf('<script>') + 8, client.lastIndexOf('</script>')), { filename: 'operations-scripts.html' });
  });
};
