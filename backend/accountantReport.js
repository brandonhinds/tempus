/**
 * Financial-year bookkeeping workbook for the accountant, laid out like the hand-kept workbook it replaces
 * ("Bookkeeping 2024-25"): an Income tab and an Expenses tab, itemised in date order inside each BAS
 * quarter, with a subtotal row per quarter and year-to-date totals. Net, subtotals and super are live
 * formulas so the accountant can adjust a line and see the totals follow.
 *
 * Every invoice is assumed paid: income is one line per invoice on its invoice date. Expenses are one line
 * each, attributed with the same function the BAS figures use (cash: on the paid date; accrual: on the
 * earlier of the invoice and paid dates), so the year totals agree with the BAS page.
 */

var ACCOUNTANT_REPORT_MONEY_FORMAT = '#,##0.00';
var ACCOUNTANT_REPORT_DATE_FORMAT = 'dd/mm/yy';

function accountantReportQuarter_(isoDate) {
  var month = Number(String(isoDate).slice(5, 7));
  return Math.floor(((month + 5) % 12) / 3) + 1;
}

var ACCOUNTANT_REPORT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "August Invoice": the month the invoice bills (a monthly assessment invoice's source month), else its date's month. */
function accountantReportInvoiceDescription_(invoice) {
  var month = /^\d{4}-(\d{2})/.exec(String(invoice.source_month || '')) || /^\d{4}-(\d{2})/.exec(String(invoice.invoice_date || ''));
  return month ? ACCOUNTANT_REPORT_MONTHS[Number(month[1]) - 1] + ' Invoice' : 'Invoice';
}

function accountantReportExpenseDescription_(transaction) {
  var vendor = String(transaction.vendor || '').trim();
  var description = String(transaction.description || '').trim();
  if (vendor && description && vendor.toLowerCase() !== description.toLowerCase()) return vendor + ' - ' + description;
  return vendor || description;
}

/** The workbook's rows, independent of how they are written out. */
function buildAccountantReport_(payload) {
  var financialYear = Number(payload && payload.financial_year);
  if (!isFinite(financialYear)) throw new Error('Financial year is required.');
  var basis = payload && payload.accounting_basis === 'accrual' ? 'accrual' : 'cash';
  var from = financialYear + '-07-01';
  var to = (financialYear + 1) + '-06-30';

  // Every invoice is assumed paid, so each one is a single line counted on its invoice date.
  var income = [];
  listInvoicesInternal().forEach(function(invoice) {
    var allocation = invoiceIncomeForPeriod_(invoice, from, to);
    if (!allocation.sales) return;
    var date = String(invoice.invoice_date || '');
    income.push({ date: date, quarter: accountantReportQuarter_(date), invoice_number: String(invoice.invoice_number || invoice.id),
      description: accountantReportInvoiceDescription_(invoice), gross: roundMoney_(allocation.sales), gst: roundMoney_(allocation.gst), super_rate: getSuperGuaranteeRate(date) });
  });
  income.sort(function(a, b) { return a.date.localeCompare(b.date) || a.invoice_number.localeCompare(b.invoice_number); });

  var expenses = [];
  api_listExpenseTransactions({}).forEach(function(transaction) {
    var share = expenseAttributionForPeriod_(basis, from, to, transaction);
    if (!share.purchases) return;
    var date = expenseAttributionDate_(basis, transaction);
    expenses.push({ description: accountantReportExpenseDescription_(transaction), category: String(transaction.category || '').trim() || 'Uncategorised',
      date: date, quarter: accountantReportQuarter_(date), payment_method: expenseIsPaid_(transaction) ? String(transaction.payment_method || '') : '',
      gross: roundMoney_(share.purchases), gst: roundMoney_(share.gst) });
  });
  expenses.sort(function(a, b) { return a.date.localeCompare(b.date) || a.description.localeCompare(b.description); });
  var categories = [];
  expenses.forEach(function(item) { if (categories.indexOf(item.category) === -1) categories.push(item.category); });
  categories.sort(function(a, b) { return a === 'Uncategorised' ? 1 : b === 'Uncategorised' ? -1 : a.localeCompare(b); });

  var sum = function(list, key) { return roundMoney_(list.reduce(function(total, item) { return total + (Number(item[key]) || 0); }, 0)); };
  return {
    financial_year: financialYear, label: 'FY ' + financialYearLabelSlug_(financialYear), basis: basis, from: from, to: to,
    income: income, expenses: expenses, categories: categories,
    totals: { income: sum(income, 'gross'), income_gst: sum(income, 'gst'), expenses: sum(expenses, 'gross'), expenses_gst: sum(expenses, 'gst') }
  };
}

/** User-entered text that Sheets would read as a formula or number keeps its leading apostrophe (shown as text). */
function accountantReportText_(value) {
  var text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function accountantReportDate_(isoDate) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
  return match ? '=DATE(' + Number(match[1]) + ',' + Number(match[2]) + ',' + Number(match[3]) + ')' : '';
}

function accountantReportColumn_(index) {
  var name = '';
  for (var n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/**
 * Lays rows out quarter by quarter. `itemRow(item, rowNumber)` returns an item's cells; `quarterRow(quarter,
 * first, last, rowNumber)` its subtotal (first/last are sheet row numbers, or null for an empty quarter);
 * `totalRow(quarterRowNumbers, rowNumber)` the year line. Row numbers are 1-based sheet rows.
 */
function accountantReportQuarterLayout_(header, items, itemRow, quarterRow, totalRow) {
  var rows = [header], bold = [0], quarterRows = [];
  [1, 2, 3, 4].forEach(function(quarter) {
    var first = rows.length + 1;
    items.filter(function(item) { return item.quarter === quarter; }).forEach(function(item) { rows.push(itemRow(item, rows.length + 1)); });
    var last = rows.length;
    var rowNumber = rows.length + 1;
    rows.push(quarterRow(quarter, last >= first ? first : null, last >= first ? last : null, rowNumber));
    bold.push(rows.length - 1);
    quarterRows.push(rowNumber);
  });
  rows.push(totalRow(quarterRows, rows.length + 1));
  bold.push(rows.length - 1);
  return { rows: rows, bold: bold };
}

function accountantReportTabs_(report) {
  var sumRange = function(column, first, last) { return first ? '=SUM(' + column + first + ':' + column + last + ')' : 0; };
  var addRows = function(column, rowNumbers) { return '=' + rowNumbers.map(function(row) { return column + row; }).join('+'); };

  var incomeLayout = accountantReportQuarterLayout_(
    ['Date', 'Invoice', 'Description', 'Gross', 'GST', 'Net', 'Superannuation'],
    report.income,
    function(item, row) {
      return [accountantReportDate_(item.date), accountantReportText_(item.invoice_number), accountantReportText_(item.description), item.gross, item.gst, '=D' + row + '-E' + row,
        '=ROUND(F' + row + '*' + item.super_rate + ',2)'];
    },
    function(quarter, first, last, row) {
      return ['', '', 'Q' + quarter, sumRange('D', first, last), sumRange('E', first, last), '=D' + row + '-E' + row, sumRange('G', first, last)];
    },
    function(quarterRows, row) {
      return ['', '', 'YTD Totals:', addRows('D', quarterRows), addRows('E', quarterRows), '=D' + row + '-E' + row, addRows('G', quarterRows)];
    });

  var categoryStart = 7; // A-F are the line, G is a spacer, categories from H.
  var expenseHeader = ['Date', 'Description', 'Payment Method', 'Gross', 'GST', 'Net', ''].concat(report.categories.map(accountantReportText_));
  var categoryColumns = report.categories.map(function(name, index) { return accountantReportColumn_(categoryStart + index); });
  var expenseLayout = accountantReportQuarterLayout_(
    expenseHeader,
    report.expenses,
    function(item, row) {
      return [accountantReportDate_(item.date), accountantReportText_(item.description), item.payment_method, item.gross, item.gst, '=D' + row + '-E' + row, '']
        .concat(report.categories.map(function(name) { return name === item.category ? item.gross : ''; }));
    },
    function(quarter, first, last, row) {
      return ['', 'Q' + quarter + ' Totals', '', sumRange('D', first, last), sumRange('E', first, last), '=D' + row + '-E' + row, '']
        .concat(categoryColumns.map(function(column) { return sumRange(column, first, last); }));
    },
    function(quarterRows, row) {
      return ['', 'YTD Totals', '', addRows('D', quarterRows), addRows('E', quarterRows), '=D' + row + '-E' + row, '']
        .concat(categoryColumns.map(function(column) { return addRows(column, quarterRows); }));
    });

  return [
    { name: 'Income', rows: incomeLayout.rows, bold: incomeLayout.bold, money: [3, 4, 5, 6], dates: [0] },
    { name: 'Expenses', rows: expenseLayout.rows, bold: expenseLayout.bold, money: [3, 4, 5].concat(report.categories.map(function(name, index) { return categoryStart + index; })), dates: [0] }
  ];
}

function writeAccountantReportTab_(sheet, tab) {
  var width = tab.rows[0].length;
  sheet.getRange(1, 1, tab.rows.length, width).setValues(tab.rows);
  tab.bold.forEach(function(index) { sheet.getRange(index + 1, 1, 1, width).setFontWeight('bold'); });
  sheet.setFrozenRows(1);
  if (tab.rows.length > 1) {
    tab.money.forEach(function(column) { sheet.getRange(2, column + 1, tab.rows.length - 1, 1).setNumberFormat(ACCOUNTANT_REPORT_MONEY_FORMAT); });
    tab.dates.forEach(function(column) { sheet.getRange(2, column + 1, tab.rows.length - 1, 1).setNumberFormat(ACCOUNTANT_REPORT_DATE_FORMAT); });
  }
  sheet.autoResizeColumns(1, width);
}

/** Returns the workbook as base64 .xlsx. The temporary Google Sheet is always moved to the bin. */
function api_exportAccountantReport(payload) {
  var report = buildAccountantReport_(payload || {});
  var tabs = accountantReportTabs_(report);
  var spreadsheet = SpreadsheetApp.create('Bookkeeping ' + financialYearLabelSlug_(report.financial_year));
  var fileId = spreadsheet.getId();
  try {
    tabs.forEach(function(tab, index) {
      var sheet = index === 0 ? spreadsheet.getSheets()[0].setName(tab.name) : spreadsheet.insertSheet(tab.name);
      writeAccountantReportTab_(sheet, tab);
    });
    SpreadsheetApp.flush();
    var response = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + fileId + '/export?format=xlsx', {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) throw new Error('Google Sheets could not export the report (HTTP ' + response.getResponseCode() + ').');
    return {
      success: true,
      filename: 'Bookkeeping ' + financialYearLabelSlug_(report.financial_year) + '.xlsx',
      base64: Utilities.base64Encode(response.getContent()),
      totals: report.totals
    };
  } finally {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (error) { Logger.log('Could not remove temporary report ' + fileId + ': ' + error); }
  }
}
