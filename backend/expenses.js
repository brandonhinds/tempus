/** Immutable business-expense ledger and future-only recurring rules. */
var EXPENSE_CACHE_PREFIX = 'expenses_v1_';
var EXPENSE_GST_CODES = { taxable: true, gst_free: true, input_taxed: true, out_of_scope: true };

function expenseNow_() { return Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'"); }
function expenseBoolean_(value) { return value === true || /^(true|1|yes|y)$/i.test(String(value == null ? '' : value).trim()); }

function expenseReadSheet_(name) {
  var sheet = getOrCreateSheet(name);
  var values = sheet.getDataRange().getValues();
  if (!values.length) return { sheet: sheet, headers: [], rows: [] };
  return { sheet: sheet, headers: values[0], rows: values.slice(1).map(function(row, index) { var item = rowObjectFromHeaders_(values[0], row); item.__row = index + 2; return item; }) };
}

function expenseFind_(name, id) {
  var data = expenseReadSheet_(name);
  for (var index = 0; index < data.rows.length; index++) if (String(data.rows[index].id) === String(id)) return { data: data, item: data.rows[index] };
  return { data: data, item: null };
}

function normalizeExpenseRule_(payload, existing) {
  var value = payload || {};
  var amount = roundMoney_(value.amount);
  if (amount < 0) throw new Error('Expense rule amount cannot be negative.');
  var gstCode = String(value.gst_code || (existing && existing.gst_code) || 'taxable');
  if (!EXPENSE_GST_CODES[gstCode]) throw new Error('Unknown GST code.');
  var startDate = normalizeIsoDateStrict_(value.start_date || (existing && existing.start_date), 'Start date', false);
  var endDate = normalizeIsoDateStrict_(value.end_date != null ? value.end_date : (existing && existing.end_date), 'End date', true);
  if (endDate && endDate < startDate) throw new Error('End date must be on or after the start date.');
  return {
    id: existing ? existing.id : (value.id || Utilities.getUuid()), vendor: String(value.vendor || '').trim(), vendor_abn: String(value.vendor_abn || '').trim(),
    description: String(value.description || '').trim(), category: String(value.category || '').trim(), amount: amount, gst_code: gstCode,
    gst_amount: roundMoney_(value.gst_amount !== undefined ? value.gst_amount : (gstCode === 'taxable' ? amount / 11 : 0)),
    business_use_percentage: normalizePercentageDecimal_(value.business_use_percentage, existing ? Number(existing.business_use_percentage) : 1),
    claimable_gst_confirmed: expenseBoolean_(value.claimable_gst_confirmed) ? 'TRUE' : 'FALSE', frequency: String(value.frequency || 'monthly'),
    start_date: startDate, end_date: endDate, active: value.active === undefined ? 'TRUE' : (expenseBoolean_(value.active) ? 'TRUE' : 'FALSE'),
    notes: String(value.notes || ''), created_at: existing ? existing.created_at : expenseNow_(), updated_at: expenseNow_()
  };
}

function api_listExpenseRules(filters) {
  var rules = expenseReadSheet_('expense_rules').rows.map(function(item) { delete item.__row; return item; });
  if (!(filters && expenseBoolean_(filters.include_inactive))) rules = rules.filter(function(item) { return expenseBoolean_(item.active); });
  return rules;
}

function api_upsertExpenseRule(payload) {
  return withScriptLock_('expense rule update', function() {
    var found = payload && payload.id ? expenseFind_('expense_rules', payload.id) : expenseFind_('expense_rules', '');
    var normalized = normalizeExpenseRule_(payload, found.item);
    var row = rowValuesFromObject_(found.data.headers, normalized, found.item ? found.data.sheet.getRange(found.item.__row, 1, 1, found.data.headers.length).getValues()[0] : null);
    if (found.item) found.data.sheet.getRange(found.item.__row, 1, 1, row.length).setValues([row]);
    else found.data.sheet.appendRow(row);
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, rule: normalized };
  });
}

function api_archiveExpenseRule(id) {
  return withScriptLock_('expense rule archive', function() {
    var found = expenseFind_('expense_rules', id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense rule not found.');
    var activeIndex = found.data.headers.indexOf('active');
    var endIndex = found.data.headers.indexOf('end_date');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, activeIndex + 1).setValue('FALSE');
    if (endIndex !== -1 && !found.item.end_date) found.data.sheet.getRange(found.item.__row, endIndex + 1).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true };
  });
}

function normalizeExpenseTransaction_(payload, existing) {
  var value = payload || {};
  var amount = roundMoney_(value.amount);
  if (amount < 0) throw new Error('Expense amount cannot be negative.');
  var gstCode = String(value.gst_code || (existing && existing.gst_code) || 'taxable');
  if (!EXPENSE_GST_CODES[gstCode]) throw new Error('Unknown GST code.');
  var businessUse = normalizePercentageDecimal_(value.business_use_percentage, existing ? Number(existing.business_use_percentage) : 1);
  var gstAmount = roundMoney_(value.gst_amount !== undefined ? value.gst_amount : (gstCode === 'taxable' ? amount / 11 : 0));
  var override = value.gst_override_amount === '' || value.gst_override_amount == null ? '' : roundMoney_(value.gst_override_amount);
  return {
    id: existing ? existing.id : (value.id || Utilities.getUuid()), vendor: String(value.vendor || '').trim(), vendor_abn: String(value.vendor_abn || '').trim(),
    description: String(value.description || '').trim(), category: String(value.category || '').trim(), purchase_date: normalizeIsoDateStrict_(value.purchase_date, 'Purchase date', false),
    supplier_invoice_date: normalizeIsoDateStrict_(value.supplier_invoice_date, 'Supplier invoice date', true), amount: amount, gst_code: gstCode, gst_amount: gstAmount,
    business_use_percentage: businessUse, claimable_gst_confirmed: expenseBoolean_(value.claimable_gst_confirmed) ? 'TRUE' : 'FALSE', gst_override_amount: override,
    status: String(value.status || (existing && existing.status) || 'recorded'), reconciliation_state: String(value.reconciliation_state || (existing && existing.reconciliation_state) || 'unreconciled'),
    source_rule_id: String(value.source_rule_id || (existing && existing.source_rule_id) || ''), source_occurrence_key: String(value.source_occurrence_key || (existing && existing.source_occurrence_key) || ''),
    attachments_json: existing ? String(existing.attachments_json || '[]') : '[]', notes: String(value.notes || ''), created_at: existing ? existing.created_at : expenseNow_(), updated_at: expenseNow_()
  };
}

function api_listExpenseTransactions(filters) {
  var data = expenseReadSheet_('expense_transactions');
  var transactions = data.rows.map(function(item) {
    var result = {};
    Object.keys(item).forEach(function(key) { if (key !== '__row') result[key] = item[key]; });
    try { result.attachments = JSON.parse(result.attachments_json || '[]'); } catch (error) { result.attachments = []; }
    result.paid_amount = 0;
    return result;
  });
  var payments = expenseReadSheet_('expense_payments').rows;
  var paid = {};
  payments.forEach(function(payment) { paid[String(payment.expense_transaction_id)] = roundMoney_((paid[String(payment.expense_transaction_id)] || 0) + Number(payment.amount || 0)); });
  transactions.forEach(function(transaction) { transaction.paid_amount = paid[String(transaction.id)] || 0; });
  if (filters && filters.from) transactions = transactions.filter(function(item) { return String(item.purchase_date) >= String(filters.from); });
  if (filters && filters.to) transactions = transactions.filter(function(item) { return String(item.purchase_date) <= String(filters.to); });
  if (filters && filters.reconciliation_state) transactions = transactions.filter(function(item) { return String(item.reconciliation_state) === String(filters.reconciliation_state); });
  return transactions.sort(function(a, b) { return String(b.purchase_date).localeCompare(String(a.purchase_date)); });
}

function api_upsertExpenseTransaction(payload) {
  return withScriptLock_('expense transaction update', function() {
    var found = payload && payload.id ? expenseFind_('expense_transactions', payload.id) : expenseFind_('expense_transactions', '');
    if (found.item && (String(found.item.reconciliation_state) === 'reconciled' || String(found.item.status) === 'void')) return apiRecoverableFailure_('immutable_transaction', 'Reconciled or void expense transactions cannot be edited. Record a correction instead.');
    var normalized = normalizeExpenseTransaction_(payload, found.item);
    var existingRow = found.item ? found.data.sheet.getRange(found.item.__row, 1, 1, found.data.headers.length).getValues()[0] : null;
    var row = rowValuesFromObject_(found.data.headers, normalized, existingRow);
    if (found.item) found.data.sheet.getRange(found.item.__row, 1, 1, row.length).setValues([row]); else found.data.sheet.appendRow(row);
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, transaction: normalized };
  });
}

function api_voidExpenseTransaction(payload) {
  return withScriptLock_('expense void', function() {
    var found = expenseFind_('expense_transactions', payload && payload.id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense transaction not found.');
    var statusIndex = found.data.headers.indexOf('status');
    var notesIndex = found.data.headers.indexOf('notes');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, statusIndex + 1).setValue('void');
    if (notesIndex !== -1) found.data.sheet.getRange(found.item.__row, notesIndex + 1).setValue(String(found.item.notes || '') + '\nVoid reason: ' + String(payload.reason || 'Not supplied'));
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true };
  });
}

function api_addExpensePayment(payload) {
  return withScriptLock_('expense payment', function() {
    var transaction = expenseFind_('expense_transactions', payload && payload.expense_transaction_id).item;
    if (!transaction) return apiRecoverableFailure_('not_found', 'Expense transaction not found.');
    if (String(transaction.status) === 'void') return apiRecoverableFailure_('void_transaction', 'A payment cannot be added to a void transaction.');
    var amount = roundMoney_(payload.amount);
    if (amount <= 0) return apiRecoverableFailure_('invalid_amount', 'Payment amount must be greater than zero.');
    var data = expenseReadSheet_('expense_payments');
    var payment = { id: Utilities.getUuid(), expense_transaction_id: transaction.id, payment_date: normalizeIsoDateStrict_(payload.payment_date, 'Payment date', false), amount: amount, reference: String(payload.reference || ''), notes: String(payload.notes || ''), created_at: expenseNow_(), updated_at: expenseNow_() };
    data.sheet.appendRow(rowValuesFromObject_(data.headers, payment));
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, payment: payment };
  });
}

function api_deleteExpensePayment(id) {
  return withScriptLock_('expense payment removal', function() {
    var found = expenseFind_('expense_payments', id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense payment not found.');
    var transaction = expenseFind_('expense_transactions', found.item.expense_transaction_id).item;
    if (transaction && String(transaction.reconciliation_state) === 'reconciled') return apiRecoverableFailure_('immutable_transaction', 'Payments on a reconciled transaction cannot be removed.');
    found.data.sheet.deleteRow(found.item.__row);
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true };
  });
}

function api_attachExpenseReceipt(payload) {
  return withScriptLock_('receipt attachment', function() {
    var found = expenseFind_('expense_transactions', payload && payload.expense_transaction_id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense transaction not found.');
    var attachments = [];
    try { attachments = JSON.parse(found.item.attachments_json || '[]'); } catch (error) { attachments = []; }
    var attachment = { id: String(payload.file_id || Utilities.getUuid()), name: String(payload.name || 'Receipt'), url: requireHttpUrl_(payload.url, 'Receipt URL', false), mime_type: String(payload.mime_type || ''), added_at: expenseNow_() };
    if (!attachments.some(function(item) { return item.id === attachment.id || item.url === attachment.url; })) attachments.push(attachment);
    var attachmentIndex = found.data.headers.indexOf('attachments_json');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, attachmentIndex + 1).setValue(JSON.stringify(attachments));
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, attachments: attachments };
  });
}

function api_reconcileExpenseTransaction(payload) {
  return withScriptLock_('expense reconciliation', function() {
    var found = expenseFind_('expense_transactions', payload && payload.id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense transaction not found.');
    if (String(found.item.status) === 'void') return apiRecoverableFailure_('void_transaction', 'A void expense cannot be reconciled.');
    var attachments = [];
    try { attachments = JSON.parse(found.item.attachments_json || '[]'); } catch (error) { attachments = []; }
    var confirmed = expenseBoolean_(payload.claimable_gst_confirmed);
    if (confirmed && String(found.item.gst_code) === 'taxable' && !attachments.length) return apiRecoverableFailure_('missing_receipt', 'Attach a tax invoice before confirming a GST credit.');
    var reconciliationIndex = found.data.headers.indexOf('reconciliation_state');
    var confirmedIndex = found.data.headers.indexOf('claimable_gst_confirmed');
    var overrideIndex = found.data.headers.indexOf('gst_override_amount');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, reconciliationIndex + 1).setValue('reconciled');
    found.data.sheet.getRange(found.item.__row, confirmedIndex + 1).setValue(confirmed ? 'TRUE' : 'FALSE');
    if (overrideIndex !== -1 && payload.gst_override_amount !== undefined) found.data.sheet.getRange(found.item.__row, overrideIndex + 1).setValue(payload.gst_override_amount === '' ? '' : roundMoney_(payload.gst_override_amount));
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true };
  });
}

function expenseClaimableGst_(transaction) {
  if (String(transaction.status) === 'void' || String(transaction.reconciliation_state) !== 'reconciled' || !expenseBoolean_(transaction.claimable_gst_confirmed) || String(transaction.gst_code) !== 'taxable') return 0;
  var gst = transaction.gst_override_amount !== '' && transaction.gst_override_amount != null ? Number(transaction.gst_override_amount) : Number(transaction.gst_amount);
  return roundMoney_(gst * normalizePercentageDecimal_(transaction.business_use_percentage, 1));
}

function api_getExpenseReport(filters) {
  var financialYear = Number(filters && filters.financial_year);
  if (!isFinite(financialYear)) throw new Error('Financial year is required.');
  var from = (financialYear - 1) + '-07-01';
  var to = financialYear + '-06-30';
  var transactions = api_listExpenseTransactions({ from: from, to: to });
  var actual = 0, gstCreditable = 0, unreconciled = 0, nonCreditable = 0;
  transactions.forEach(function(transaction) {
    if (String(transaction.status) === 'void') return;
    var amount = Number(transaction.amount) || 0;
    actual += amount;
    var gst = expenseClaimableGst_(transaction);
    gstCreditable += gst;
    if (String(transaction.reconciliation_state) !== 'reconciled') unreconciled += amount;
    else nonCreditable += Math.max(0, (Number(transaction.gst_amount) || 0) - gst);
  });
  var scheduled = api_listExpenseRules({ include_inactive: false }).reduce(function(sum, rule) { return sum + (Number(rule.amount) || 0); }, 0);
  return { success: true, financial_year: financialYear, from: from, to: to, totals: { actual: roundMoney_(actual), scheduled: roundMoney_(scheduled), unreconciled: roundMoney_(unreconciled), gst_creditable: roundMoney_(gstCreditable), non_creditable_gst: roundMoney_(nonCreditable) }, transactions: transactions };
}

function api_exportExpenseReportCsv(filters) {
  var report = api_getExpenseReport(filters);
  var rows = [['Date', 'Vendor', 'ABN', 'Description', 'Category', 'Amount', 'GST code', 'GST amount', 'Claimable GST', 'Reconciliation', 'Status']];
  report.transactions.forEach(function(item) { rows.push([item.purchase_date, item.vendor, item.vendor_abn, item.description, item.category, roundMoney_(item.amount), item.gst_code, roundMoney_(item.gst_amount), expenseClaimableGst_(item), item.reconciliation_state, item.status]); });
  return { success: true, filename: 'tempus-expenses-fy' + report.financial_year + '.csv', csv: rows.map(function(row) { return row.map(csvSafeCell_).join(','); }).join('\r\n') };
}
