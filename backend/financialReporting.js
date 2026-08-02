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
    startMonth = month;
  }
  var startYear = startMonth >= 12 ? financialYear : financialYear - 1;
  var normalizedMonth = startMonth % 12;
  var monthCount = periodType === 'quarterly' ? 3 : 1;
  var start = new Date(Date.UTC(startYear, normalizedMonth, 1, 12));
  var end = new Date(Date.UTC(startYear, normalizedMonth + monthCount, 0, 12));
  return { from: Utilities.formatDate(start, 'UTC', 'yyyy-MM-dd'), to: Utilities.formatDate(end, 'UTC', 'yyyy-MM-dd') };
}

function invoiceAccrualAllocationForPeriod_(invoice, from, to) {
  var payments = invoicePaymentsForInvoice_(invoice.id);
  var eventDate = invoice.invoice_date;
  if (payments.length && payments[0].payment_date < eventDate) eventDate = payments[0].payment_date;
  if (!eventDate || eventDate < from || eventDate > to || invoice.status === 'void' || invoice.status === 'draft') return { sales: 0, gst: 0 };
  var totals = summarizeInvoiceLineItems(listInvoiceLineItemsByInvoiceId(invoice.id));
  return { sales: totals.totalWithGst, gst: totals.gstAmount };
}

function expenseActualForPeriod_(basis, from, to) {
  var transactions = api_listExpenseTransactions({});
  var payments = expenseReadSheet_('expense_payments').rows;
  var totals = { purchases: 0, gst: 0 };
  transactions.forEach(function(transaction) {
    if (String(transaction.status) === 'void') return;
    if (basis === 'accrual') {
      var eventDate = String(transaction.supplier_invoice_date || transaction.purchase_date || '');
      if (eventDate < from || eventDate > to) return;
      totals.purchases += Number(transaction.amount) || 0;
      totals.gst += expenseClaimableGst_(transaction);
      return;
    }
    var transactionPayments = payments.filter(function(payment) { return String(payment.expense_transaction_id) === String(transaction.id) && payment.payment_date >= from && payment.payment_date <= to; });
    var paid = transactionPayments.reduce(function(sum, payment) { return sum + Number(payment.amount || 0); }, 0);
    var amount = Number(transaction.amount) || 0;
    if (amount <= 0 || paid <= 0) return;
    var ratio = Math.min(1, paid / amount);
    totals.purchases += paid;
    totals.gst += expenseClaimableGst_(transaction) * ratio;
  });
  return { purchases: roundMoney_(totals.purchases), gst: roundMoney_(totals.gst) };
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
      var amount = (Number(entry.duration_minutes) || 0) / 60 * (contractRates[String(entry.contract_id)] || 0);
      total += amount;
      if (!invoicedEntries[String(entry.id)]) uninvoiced += amount;
    });
  }
  return { income: roundMoney_(total), uninvoiced_time: roundMoney_(uninvoiced) };
}

function scheduledExpenseForecastForPeriod_(from, to) {
  var total = 0;
  api_listExpenseRules({ include_inactive: false }).forEach(function(rule) {
    var start = rule.start_date > from ? rule.start_date : from;
    var end = rule.end_date && rule.end_date < to ? rule.end_date : to;
    total += migrationOccurrenceDates_(start, end, rule.frequency).length * (Number(rule.amount) || 0);
  });
  return roundMoney_(total);
}

function api_calculateBasPeriod(payload) {
  var range = basPeriodRange_(payload || {});
  var basis = payload && payload.accounting_basis === 'accrual' ? 'accrual' : 'cash';
  var sales = 0, salesGst = 0;
  listInvoicesInternal().forEach(function(invoice) {
    if (invoice.status === 'void' || invoice.status === 'draft') return;
    var allocation = basis === 'cash' ? invoiceCashAllocationForPeriod_(invoice, range.from, range.to) : invoiceAccrualAllocationForPeriod_(invoice, range.from, range.to);
    sales += allocation.sales;
    salesGst += allocation.gst;
  });
  var expenses = expenseActualForPeriod_(basis, range.from, range.to);
  var forecastIncome = timesheetForecastForPeriod_(range.from, range.to);
  var forecastExpenses = scheduledExpenseForecastForPeriod_(range.from, range.to);
  var transactions = api_listExpenseTransactions({ from: range.from, to: range.to });
  var unreconciled = transactions.filter(function(item) { return item.status !== 'void' && item.reconciliation_state !== 'reconciled'; });
  var missingReceipts = transactions.filter(function(item) { return item.status !== 'void' && item.gst_code === 'taxable' && (!item.attachments || !item.attachments.length); });
  var unpaid = api_listInvoices({ include_summary: true }).filter(function(invoice) { return invoice.status !== 'void' && invoice.status !== 'draft' && invoice.payment_state !== 'paid' && invoice.invoice_date <= range.to; });
  var source = { basis: basis, range: range, invoices: listInvoicesInternal(), invoice_payments: invoicePayments_(), expenses: transactions, expense_payments: expenseReadSheet_('expense_payments').rows };
  var result = {
    success: true, accounting_basis: basis, period: range,
    actual: { g1_total_sales: roundMoney_(sales), gst_on_sales: roundMoney_(salesGst), purchases: expenses.purchases, gst_on_purchases: expenses.gst },
    forecast: { timesheet_income: forecastIncome.income, scheduled_expenses: forecastExpenses },
    variance: { uninvoiced_time: forecastIncome.uninvoiced_time, unpaid_invoices: unpaid.reduce(function(sum, invoice) { return sum + Number(invoice.balance_due || 0); }, 0), unreconciled_expenses: unreconciled.reduce(function(sum, item) { return sum + Number(item.amount || 0); }, 0), missing_receipt_count: missingReceipts.length },
    warnings: []
  };
  if (unpaid.length) result.warnings.push(unpaid.length + ' issued invoice(s) remain unpaid or part-paid.');
  if (unreconciled.length) result.warnings.push(unreconciled.length + ' expense(s) are excluded from GST credits until reconciled.');
  if (missingReceipts.length) result.warnings.push(missingReceipts.length + ' taxable expense(s) have no receipt attached.');
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
