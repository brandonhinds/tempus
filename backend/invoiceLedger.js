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

function invoiceCashAllocationForPeriod_(invoice, from, to) {
  var lines = listInvoiceLineItemsByInvoiceId(invoice.id);
  var totals = summarizeInvoiceLineItems(lines);
  if (totals.totalWithGst <= 0) return { sales: 0, gst: 0 };
  var paid = invoicePaymentsForInvoice_(invoice.id).filter(function(payment) { return payment.payment_date >= from && payment.payment_date <= to; }).reduce(function(sum, payment) { return sum + Number(payment.amount || 0); }, 0);
  var ratio = Math.min(1, Math.max(0, paid / totals.totalWithGst));
  return { sales: roundMoney_(totals.totalWithGst * ratio), gst: roundMoney_(totals.gstAmount * ratio) };
}
