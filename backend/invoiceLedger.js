/** Invoice lifecycle, payment ledger and reconciliation APIs. */
var INVOICE_PAYMENT_CACHE_KEY = 'invoice_payments_v1';

function invoicePayments_() {
  var cached = cacheGet(INVOICE_PAYMENT_CACHE_KEY);
  if (cached) return cached;
  var sheet = getOrCreateSheet('invoice_payments');
  var values = sheet.getDataRange().getValues();
  var result = values.length < 2 ? [] : values.slice(1).map(function(row) { return rowObjectFromHeaders_(values[0], row); }).filter(function(item) { return item.id; });
  cacheSet(INVOICE_PAYMENT_CACHE_KEY, result);
  return result;
}

function invoicePaymentsForInvoice_(invoiceId) {
  return invoicePayments_().filter(function(payment) { return String(payment.invoice_id) === String(invoiceId); }).sort(function(a, b) { return String(a.payment_date).localeCompare(String(b.payment_date)); });
}

function invoicePaymentSummaryByInvoice_() {
  var result = {};
  invoicePayments_().forEach(function(payment) { result[String(payment.invoice_id)] = roundMoney_((result[String(payment.invoice_id)] || 0) + Number(payment.amount || 0)); });
  return result;
}

function invoiceLedgerTotal_(invoiceId) {
  var summary = summarizeInvoiceLineItems(listInvoiceLineItemsByInvoiceId(invoiceId));
  return roundMoney_(summary.totalWithGst);
}

function invoicePaymentState_(invoice, items) {
  var total = summarizeInvoiceLineItems(items || listInvoiceLineItemsByInvoiceId(invoice.id)).totalWithGst;
  var paid = invoicePaymentsForInvoice_(invoice.id).reduce(function(sum, payment) { return sum + Number(payment.amount || 0); }, 0);
  return { state: paid <= 0 ? 'unpaid' : (paid + 0.005 >= total ? 'paid' : 'part_paid'), paid_amount: roundMoney_(paid), balance_due: Math.max(0, roundMoney_(total - paid)), total: roundMoney_(total) };
}

function api_addInvoicePayment(payload) {
  return withScriptLock_('invoice payment', function() {
    var invoice = findInvoiceById(payload && payload.invoice_id);
    if (!invoice) return apiRecoverableFailure_('not_found', 'Invoice not found.');
    if (String(invoice.status) === 'draft') return apiRecoverableFailure_('draft_invoice', 'Issue the invoice before recording payment.');
    if (String(invoice.status) === 'void') return apiRecoverableFailure_('void_invoice', 'A payment cannot be recorded against a void invoice.');
    var amount = roundMoney_(payload.amount);
    if (amount <= 0) return apiRecoverableFailure_('invalid_amount', 'Payment amount must be greater than zero.');
    var current = invoicePaymentState_(invoice);
    if (amount > current.balance_due + 0.005) return apiRecoverableFailure_('overpayment', 'Payment exceeds the invoice balance.', { balance_due: current.balance_due });
    var sheet = getOrCreateSheet('invoice_payments');
    var headers = sheet.getDataRange().getValues()[0];
    var now = invoiceToIsoDateTime(new Date());
    var payment = { id: Utilities.getUuid(), invoice_id: invoice.id, payment_date: normalizeIsoDateStrict_(payload.payment_date, 'Payment date', false), amount: amount, reference: String(payload.reference || ''), notes: String(payload.notes || ''), created_at: now, updated_at: now };
    sheet.appendRow(rowValuesFromObject_(headers, payment));
    cacheClearPrefix(INVOICE_PAYMENT_CACHE_KEY);
    clearInvoiceCaches();
    return { success: true, payment: payment, payment_state: invoicePaymentState_(invoice) };
  });
}

function api_deleteInvoicePayment(id) {
  return withScriptLock_('invoice payment removal', function() {
    var sheet = getOrCreateSheet('invoice_payments');
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return apiRecoverableFailure_('not_found', 'Invoice payment not found.');
    var idIndex = values[0].indexOf('id');
    for (var row = 1; row < values.length; row++) {
      if (String(values[row][idIndex]) !== String(id)) continue;
      archiveMigrationRow_('manual-payment-removal', sheet, row + 1, 'payment_removed');
      sheet.deleteRow(row + 1);
      cacheClearPrefix(INVOICE_PAYMENT_CACHE_KEY);
      clearInvoiceCaches();
      return { success: true };
    }
    return apiRecoverableFailure_('not_found', 'Invoice payment not found.');
  });
}

function api_recalculateInvoiceDraft(id) {
  return withScriptLock_('invoice recalculation', function() {
    var invoice = findInvoiceById(id);
    if (!invoice) return apiRecoverableFailure_('not_found', 'Invoice not found.');
    if (String(invoice.status) !== 'draft') return apiRecoverableFailure_('immutable_invoice', 'Only drafts can be recalculated.');
    var count = recalculateInvoiceLineAmounts(invoice, { lock: false });
    clearInvoiceCaches();
    return { success: true, updated_line_count: count, invoice: api_getInvoice(id) };
  });
}

function api_issueInvoice(id) {
  return withScriptLock_('invoice issue', function() {
    var invoice = findInvoiceById(id);
    if (!invoice) return apiRecoverableFailure_('not_found', 'Invoice not found.');
    if (String(invoice.status) !== 'draft') return apiRecoverableFailure_('invalid_state', 'Only a draft can be issued.');
    if (!listInvoiceLineItemsByInvoiceId(id).length) return apiRecoverableFailure_('empty_invoice', 'Add at least one line before issuing the invoice.');
    recalculateInvoiceLineAmounts(invoice, { lock: true });
    updateInvoiceRecord(id, { status: 'issued', issued_at: invoiceToIsoDateTime(new Date()) });
    return { success: true, invoice: api_getInvoice(id) };
  });
}

function api_markInvoiceSent(id) {
  return withScriptLock_('invoice send state', function() {
    var invoice = findInvoiceById(id);
    if (!invoice) return apiRecoverableFailure_('not_found', 'Invoice not found.');
    if (String(invoice.status) !== 'issued' && String(invoice.status) !== 'sent') return apiRecoverableFailure_('invalid_state', 'Only an issued invoice can be marked sent.');
    updateInvoiceRecord(id, { status: 'sent', sent_at: invoice.sent_at || invoiceToIsoDateTime(new Date()) });
    return { success: true, invoice: api_getInvoice(id) };
  });
}

function api_voidInvoice(payload) {
  return withScriptLock_('invoice void', function() {
    var invoice = findInvoiceById(payload && payload.id);
    if (!invoice) return apiRecoverableFailure_('not_found', 'Invoice not found.');
    if (String(invoice.status) === 'void') return { success: true, invoice: api_getInvoice(invoice.id) };
    if (String(invoice.status) === 'draft') return apiRecoverableFailure_('draft_invoice', 'Delete a draft instead of voiding it.');
    if (invoicePaymentsForInvoice_(invoice.id).length) return apiRecoverableFailure_('payment_exists', 'Remove or reallocate recorded payments before voiding this invoice.');
    var reason = String(payload.reason || '').trim();
    if (!reason) return apiRecoverableFailure_('reason_required', 'A void reason is required.');
    updateInvoiceRecord(invoice.id, { status: 'void', voided_at: invoiceToIsoDateTime(new Date()), void_reason: reason });
    releaseAssessmentsFromVoidedInvoice_(invoice.id);
    return { success: true, invoice: api_getInvoice(invoice.id) };
  });
}

function releaseAssessmentsFromVoidedInvoice_(invoiceId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('assessments');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var values = sheet.getDataRange().getValues();
  var invoiceIndex = values[0].indexOf('invoice_id');
  var statusIndex = values[0].indexOf('status');
  var updatedIndex = values[0].indexOf('updated_at');
  if (invoiceIndex === -1) return 0;
  var count = 0;
  for (var row = 1; row < values.length; row++) {
    if (String(values[row][invoiceIndex]) !== String(invoiceId)) continue;
    sheet.getRange(row + 1, invoiceIndex + 1).setValue('');
    if (statusIndex !== -1) sheet.getRange(row + 1, statusIndex + 1).setValue('draft');
    if (updatedIndex !== -1) sheet.getRange(row + 1, updatedIndex + 1).setValue(invoiceToIsoDateTime(new Date()));
    count++;
  }
  return count;
}

function api_reviseInvoice(payload) {
  return withScriptLock_('invoice revision', function() {
    var source = findInvoiceById(payload && payload.id);
    if (!source) return apiRecoverableFailure_('not_found', 'Invoice not found.');
    if (String(source.status) === 'draft') return apiRecoverableFailure_('invalid_state', 'Edit the existing draft instead.');
    var revision = upsertInvoiceUnlocked_({ kind: source.kind, invoice_date: payload.invoice_date || source.invoice_date, year: source.year, month: source.month, status: 'draft', revision_of_invoice_id: source.id, template_doc_id: source.template_doc_id, template_doc_path: source.template_doc_path, output_folder_id: source.output_folder_id, output_folder_path: source.output_folder_path, notes: payload.notes || ('Revision of ' + source.invoice_number) });
    if (revision && revision.success === false) return revision;
    var lineSheet = getOrCreateSheet('invoice_line_items');
    var headers = lineSheet.getDataRange().getValues()[0];
    listInvoiceLineItemsByInvoiceId(source.id).forEach(function(item) {
      item.id = Utilities.getUuid();
      item.invoice_id = revision.id;
      item.timesheet_entry_id = '';
      item.entry_snapshot_json = '';
      item.last_synced_at = '';
      item.created_at = invoiceToIsoDateTime(new Date());
      item.updated_at = item.created_at;
      lineSheet.appendRow(buildInvoiceLineItemRow(headers, item));
    });
    clearInvoiceCaches();
    return { success: true, invoice: api_getInvoice(revision.id) };
  });
}

function api_getInvoiceReconciliation(filters) {
  var invoices = api_listInvoices({ include_summary: true });
  if (filters && filters.from) invoices = invoices.filter(function(invoice) { return invoice.invoice_date >= filters.from; });
  if (filters && filters.to) invoices = invoices.filter(function(invoice) { return invoice.invoice_date <= filters.to; });
  var unpaidLegacy = invoices.filter(function(invoice) { return (invoice.status === 'issued' || invoice.status === 'sent') && invoice.payment_state !== 'paid' && invoice.generated_at && !invoicePaymentsForInvoice_(invoice.id).length; });
  return { success: true, invoices: invoices, unpaid_legacy: unpaidLegacy, warnings: unpaidLegacy.length ? [unpaidLegacy.length + ' legacy issued invoice(s) have no reconciled payment.'] : [] };
}

/** Proportional payment attribution for cash-basis BAS. */
function invoiceCashAllocationForPeriod_(invoice, from, to) {
  var lines = listInvoiceLineItemsByInvoiceId(invoice.id);
  var totals = summarizeInvoiceLineItems(lines);
  if (totals.totalWithGst <= 0) return { sales: 0, gst: 0 };
  var paid = invoicePaymentsForInvoice_(invoice.id).filter(function(payment) { return payment.payment_date >= from && payment.payment_date <= to; }).reduce(function(sum, payment) { return sum + Number(payment.amount || 0); }, 0);
  var ratio = Math.min(1, Math.max(0, paid / totals.totalWithGst));
  return { sales: roundMoney_(totals.totalWithGst * ratio), gst: roundMoney_(totals.gstAmount * ratio) };
}
