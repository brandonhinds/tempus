/** Ledger-backed BAS actuals with clearly separated operational forecasts. */

function basPeriodRange_(payload) {
  var financialYear = Number(payload.financial_year);
  if (!isFinite(financialYear)) throw new Error('Financial year is required.');
  var periodType = payload.period_type === 'monthly' ? 'monthly' : 'quarterly';
  var startMonth;
  if (periodType === 'quarterly') {
    var quarter = Number(payload.quarter);
    if (!isFinite(quarter) || quarter < 1 || quarter > 4) throw new Error('Quarter must be between 1 and 4.');
    startMonth = 6 + ((quarter - 1) * 3);
  } else {
    var month = Number(payload.month);
    if (!isFinite(month) || month < 0 || month > 11) throw new Error('Month must be between 0 and 11.');
    // `month` is a calendar month index, and a financial year spans two calendar years. Jul-Dec belong to
    // the FY's first calendar year, Jan-Jun to its second, so Jan-Jun are offset past 12 to reuse the same
    // convention the quarterly branch above relies on. Without the offset every Jan-Jun month resolved to
    // the previous calendar year, which made those six months of each FY unreachable and silently returned
    // figures from 12 months earlier.
    startMonth = month < 6 ? month + 12 : month;
  }
  // `financial_year` is the financial year's START year: 2026 means FY 2026-27, matching
  // financialYearLabel() in the client and the financial_year already persisted on bas_submissions.
  // startMonth 6-11 are Jul-Dec of that year; 12-17 are Jan-Jun of the next.
  var startYear = startMonth >= 12 ? financialYear + 1 : financialYear;
  var normalizedMonth = startMonth % 12;
  var monthCount = periodType === 'quarterly' ? 3 : 1;
  var start = new Date(Date.UTC(startYear, normalizedMonth, 1, 12));
  var end = new Date(Date.UTC(startYear, normalizedMonth + monthCount, 0, 12));
  return { from: Utilities.formatDate(start, 'UTC', 'yyyy-MM-dd'), to: Utilities.formatDate(end, 'UTC', 'yyyy-MM-dd') };
}

/**
 * Every invoice is assumed paid, so its income counts in full on its invoice date under both accounting
 * bases. Payments against invoices are not tracked.
 */
function invoiceIncomeForPeriod_(invoice, from, to) {
  var eventDate = String(invoice.invoice_date || '');
  if (!eventDate || eventDate < from || eventDate > to || invoice.status === 'void' || invoice.status === 'draft') return { sales: 0, gst: 0 };
  var totals = summarizeInvoiceLineItems(listInvoiceLineItemsByInvoiceId(invoice.id));
  return { sales: totals.totalWithGst, gst: totals.gstAmount };
}

/** True for a real expense (paid or unpaid); scheduled and skipped rows never count. */
function expenseIsRecorded_(transaction) { return !!transaction && String(transaction.status) === 'recorded'; }
function expenseIsPaid_(transaction) { return expenseIsRecorded_(transaction) && !!String(transaction.paid_date || ''); }

/**
 * The date a recorded expense counts on, or '' when it doesn't count on that basis. Cash: the paid date.
 * Accrual: the earlier of the invoice date and the paid date (the ATO's attribution rule for accruals).
 */
function expenseAttributionDate_(basis, transaction) {
  if (!expenseIsRecorded_(transaction)) return '';
  var paid = String(transaction.paid_date || '');
  if (basis !== 'accrual') return paid;
  var invoice = String(transaction.supplier_invoice_date || '');
  if (paid && invoice) return paid < invoice ? paid : invoice;
  return paid || invoice;
}

/** The GST credit an expense gives: Taxable only, scaled by business use. Never for a schedule forecast. */
function expenseClaimableGst_(transaction) {
  if (!expenseIsRecorded_(transaction) || String(transaction.gst_code) !== 'taxable') return 0;
  return roundMoney_((Number(transaction.gst_amount) || 0) * normalizePercentageDecimal_(transaction.business_use_percentage, 1));
}

/** `source` ({ transactions }) lets a caller summing many periods read the sheet once. */
function expenseActualForPeriod_(basis, from, to, source) {
  var transactions = source ? source.transactions : api_listExpenseTransactions({});
  var totals = { purchases: 0, gst: 0 };
  transactions.forEach(function(transaction) {
    var share = expenseAttributionForPeriod_(basis, from, to, transaction);
    totals.purchases += share.purchases;
    totals.gst += share.gst;
  });
  return { purchases: roundMoney_(totals.purchases), gst: roundMoney_(totals.gst) };
}

/**
 * One expense's share of a period: the whole expense and its GST credit when the date it counts on
 * (expenseAttributionDate_: paid date on cash, the earlier of invoice and paid date on accrual) falls in
 * the period, else nothing. The BAS total above and the accountant report's line items both use it, so
 * they cannot disagree.
 */
function expenseAttributionForPeriod_(basis, from, to, transaction) {
  var date = expenseAttributionDate_(basis, transaction);
  if (!date || date < from || date > to) return { purchases: 0, gst: 0 };
  return { purchases: Number(transaction.amount) || 0, gst: expenseClaimableGst_(transaction) };
}

/**
 * The expenses counted in one calendar month on a basis, for the Time Entry "Company expenses" breakdown:
 * each with its amount including and excluding GST, its GST credit and what it takes off income (the
 * amount less its credit). `month` is the calendar month index (0-11). The total counted is the figure
 * api_getCompanyExpenseMonthlyTotals gives the dashboard for that month, so the two always agree.
 * `pending` lists the month's payments that don't count yet, shown apart and never in the totals: schedule
 * payments due in the month, and unpaid expenses invoiced in it that the basis doesn't count (cash basis).
 */
function api_getCompanyExpensesForMonth(payload) {
  var year = Number(payload && payload.year);
  var month = Number(payload && payload.month);
  if (!isFinite(year) || !isFinite(month) || month < 0 || month > 11) throw new Error('Year and month are required.');
  var basis = payload && payload.accounting_basis === 'accrual' ? 'accrual' : 'cash';
  var key = year + '-' + ('0' + (month + 1)).slice(-2);
  var result = companyExpensesBreakdown_(basis, key, api_listExpenseTransactions({}), null);
  result.success = true;
  result.accounting_basis = basis;
  return result;
}

// What the Company expenses breakdown and the expense form need from each expense, so the breakdowns sent
// with the monthly totals stay small (no attachments or timestamps).
var COMPANY_EXPENSE_BREAKDOWN_FIELDS_ = ['id', 'status', 'vendor', 'vendor_abn', 'description', 'category_id', 'category', 'category_color', 'gst_code',
  'gst_amount', 'amount', 'amount_ex_gst', 'business_use_percentage', 'supplier_invoice_date', 'paid_date', 'payment_method', 'payment_reference', 'notes', 'source_rule_id'];

/**
 * One calendar month ('YYYY-MM') of company expenses on a basis: the expenses it counts (with counted_date,
 * gst_credit and counted, what each takes off income), their totals, and the payments not counted yet
 * (schedule payments due in the month, and unpaid expenses invoiced in it that the basis doesn't count).
 * `fields` limits each item to those keys; null keeps every field.
 */
function companyExpensesBreakdown_(basis, key, transactions, fields) {
  var from = key + '-01';
  var parts = key.split('-').map(Number);
  var to = key + '-' + ('0' + new Date(Date.UTC(parts[0], parts[1], 0, 12)).getUTCDate()).slice(-2);
  var copy = function(transaction) {
    var item = {};
    (fields || Object.keys(transaction)).forEach(function(name) { if (transaction[name] !== undefined) item[name] = transaction[name]; });
    return item;
  };
  var items = [];
  var pending = [];
  transactions.forEach(function(transaction) {
    var share = expenseAttributionForPeriod_(basis, from, to, transaction);
    var date = expenseAttributionDate_(basis, transaction);
    if (!date || date < from || date > to) {
      var due = String(transaction.supplier_invoice_date || '');
      var waiting = String(transaction.status) === 'scheduled' || (expenseIsRecorded_(transaction) && !expenseIsPaid_(transaction));
      if (waiting && due >= from && due <= to) pending.push(copy(transaction));
      return;
    }
    var item = copy(transaction);
    item.counted_date = date;
    item.gst_credit = roundMoney_(share.gst);
    item.counted = roundMoney_(share.purchases - share.gst);
    items.push(item);
  });
  items.sort(function(a, b) { return a.counted_date.localeCompare(b.counted_date) || String(a.vendor).localeCompare(String(b.vendor)); });
  pending.sort(function(a, b) { return String(a.supplier_invoice_date).localeCompare(String(b.supplier_invoice_date)) || String(a.vendor).localeCompare(String(b.vendor)); });
  var sum = function(name, list) { return roundMoney_((list || items).reduce(function(total, item) { return total + (Number(item[name]) || 0); }, 0)); };
  return { from: from, to: to, expenses: items,
    totals: { amount: sum('amount'), amount_ex_gst: sum('amount_ex_gst'), gst_credit: sum('gst_credit'), counted: roundMoney_(sum('amount') - sum('gst_credit')) },
    pending: pending, pending_totals: { amount: sum('amount', pending), amount_ex_gst: sum('amount_ex_gst', pending) } };
}

/**
 * Company expenses per calendar month ('YYYY-MM'), on both bases, for the client's dashboard income and
 * BAS 1B. Each month is summed by expenseActualForPeriod_, the function the backend BAS uses, so the
 * three figures come from one source and can't drift apart. Months with no activity are omitted (zero).
 */
function api_getCompanyExpenseMonthlyTotals() {
  var source = { transactions: api_listExpenseTransactions({}) };
  var months = {};
  var breakdownMonths = {};
  source.transactions.forEach(function(transaction) {
    ['cash', 'accrual'].forEach(function(basis) {
      var date = expenseAttributionDate_(basis, transaction);
      if (/^\d{4}-\d{2}/.test(date)) months[date.substring(0, 7)] = breakdownMonths[date.substring(0, 7)] = true;
    });
    // Months with only payments not counted yet still get a breakdown.
    var due = String(transaction.supplier_invoice_date || '');
    if (/^\d{4}-\d{2}/.test(due) && String(transaction.status) !== 'skipped') breakdownMonths[due.substring(0, 7)] = true;
  });
  var result = { cash: {}, accrual: {} };
  Object.keys(months).sort().forEach(function(key) {
    var parts = key.split('-').map(Number);
    var lastDay = new Date(Date.UTC(parts[0], parts[1], 0, 12)).getUTCDate();
    var from = key + '-01';
    var to = key + '-' + ('0' + lastDay).slice(-2);
    ['cash', 'accrual'].forEach(function(basis) {
      var totals = expenseActualForPeriod_(basis, from, to, source);
      if (totals.purchases || totals.gst) result[basis][key] = totals;
    });
  });
  // Each month's Company expenses breakdown, so the Time Entry popup opens from memory with no server call.
  var breakdowns = { cash: {}, accrual: {} };
  Object.keys(breakdownMonths).sort().forEach(function(key) {
    ['cash', 'accrual'].forEach(function(basis) {
      var breakdown = companyExpensesBreakdown_(basis, key, source.transactions, COMPANY_EXPENSE_BREAKDOWN_FIELDS_);
      if (breakdown.expenses.length || breakdown.pending.length) breakdowns[basis][key] = breakdown;
    });
  });
  return { success: true, months: result, breakdowns: breakdowns, hash: sha256Hex_(JSON.stringify(result)).substring(0, 16) };
}

function timesheetForecastForPeriod_(from, to) {
  var entrySheet = getOrCreateSheet('timesheet_entries');
  var entryValues = entrySheet.getDataRange().getValues();
  var contractData = expenseReadSheet_('contracts');
  var contractRates = {};
  contractData.rows.forEach(function(contract) { contractRates[String(contract.id)] = Number(contract.hourly_rate) || 0; });
  var hourTypeData = expenseReadSheet_('hour_types');
  var incomeTypes = {};
  hourTypeData.rows.forEach(function(type) { incomeTypes[String(type.id)] = expenseBoolean_(type.contributes_to_income); });
  var invoicedEntries = {};
  listInvoiceLineItemsInternal().forEach(function(line) { if (line.timesheet_entry_id && line.invoice_id) invoicedEntries[String(line.timesheet_entry_id)] = true; });
  var total = 0, uninvoiced = 0;
  if (entryValues.length > 1) {
    var headers = entryValues[0];
    entryValues.slice(1).forEach(function(row) {
      var entry = rowObjectFromHeaders_(headers, row);
      var date = String(entry.date || '');
      if (date < from || date > to || !incomeTypes[String(entry.hour_type_id)]) return;
      var amount = entry.source_type === 'assessment' && entry.source_occurrence_key === 'billable' && entry.income_amount !== '' && entry.income_amount != null ? Number(entry.income_amount) : (Number(entry.duration_minutes) || 0) / 60 * (contractRates[String(entry.contract_id)] || 0);
      total += amount;
      if (!invoicedEntries[String(entry.id)]) uninvoiced += amount;
    });
  }
  return { income: roundMoney_(total), uninvoiced_time: roundMoney_(uninvoiced) };
}

function scheduledExpenseForecastForPeriod_(from, to) {
  var total = 0;
  api_listExpenseRules({}).forEach(function(rule) {
    var start = rule.start_date > from ? rule.start_date : from;
    var end = rule.end_date && rule.end_date < to ? rule.end_date : to;
    total += migrationOccurrenceDates_(start, end, rule.frequency).length * (Number(rule.amount) || 0);
  });
  return roundMoney_(total);
}

/**
 * The four BAS actuals for a date range. Extracted so the monthly transfer split reconciles with the BAS
 * figures by construction rather than by two implementations agreeing — sales are GST-INCLUSIVE here, as
 * G1 is reported.
 */
function basActualsForRange_(basis, from, to) {
  var sales = 0, salesGst = 0;
  listInvoicesInternal().forEach(function(invoice) {
    if (invoice.status === 'void' || invoice.status === 'draft') return;
    var allocation = invoiceIncomeForPeriod_(invoice, from, to);
    sales += allocation.sales;
    salesGst += allocation.gst;
  });
  var expenses = expenseActualForPeriod_(basis, from, to);
  return { g1_total_sales: roundMoney_(sales), gst_on_sales: roundMoney_(salesGst), purchases: expenses.purchases, gst_on_purchases: expenses.gst };
}

function api_calculateBasPeriod(payload) {
  var range = basPeriodRange_(payload || {});
  var basis = payload && payload.accounting_basis === 'accrual' ? 'accrual' : 'cash';
  var actuals = basActualsForRange_(basis, range.from, range.to);
  var sales = actuals.g1_total_sales, salesGst = actuals.gst_on_sales;
  var expenses = { purchases: actuals.purchases, gst: actuals.gst_on_purchases };
  var forecastIncome = timesheetForecastForPeriod_(range.from, range.to);
  var forecastExpenses = scheduledExpenseForecastForPeriod_(range.from, range.to);
  var transactions = api_listExpenseTransactions({ from: range.from, to: range.to }).filter(function(item) { return String(item.status) !== 'skipped'; });
  // Unpaid expenses invoiced in the period: counted on accrual, but not on a cash basis until paid.
  var unpaid = transactions.filter(function(item) { var invoice = String(item.supplier_invoice_date || ''); return expenseIsRecorded_(item) && !expenseIsPaid_(item) && invoice >= range.from && invoice <= range.to; });
  var source = { basis: basis, range: range, invoices: listInvoicesInternal(), expenses: transactions };
  var result = {
    success: true, accounting_basis: basis, period: range,
    actual: { g1_total_sales: roundMoney_(sales), gst_on_sales: roundMoney_(salesGst), purchases: expenses.purchases, gst_on_purchases: expenses.gst },
    forecast: { timesheet_income: forecastIncome.income, scheduled_expenses: forecastExpenses },
    variance: { uninvoiced_time: forecastIncome.uninvoiced_time, unpaid_expenses: roundMoney_(unpaid.reduce(function(sum, item) { return sum + Number(item.amount || 0); }, 0)), unpaid_expense_count: unpaid.length },
    warnings: []
  };
  if (unpaid.length && basis === 'cash') result.warnings.push(unpaid.length + ' unpaid expense(s) invoiced in this period are not counted on a cash basis until marked paid.');
  result.source_hash = sha256Hex_(stableJsonStringify_(source));
  return result;
}

function api_getBasReconciliation(payload) {
  var current = api_calculateBasPeriod(payload || {});
  var submissions = listBasSubmissionsInternal().filter(function(item) {
    return item.financial_year === Number(payload.financial_year) && item.period_type === (payload.period_type === 'monthly' ? 'monthly' : 'quarterly') && (item.period_type === 'monthly' ? item.month === Number(payload.month) : item.quarter === Number(payload.quarter));
  });
  var submitted = submissions.length ? submissions[submissions.length - 1] : null;
  return { success: true, current: current, submitted: submitted, changed_since_submission: !!(submitted && submitted.source_hash && submitted.source_hash !== current.source_hash) };
}
