/** Monthly generation uses versioned lines and one invoice-row commit pointer.
 * A failed/staged generation is invisible to every canonical ledger reader. Previous versions and
 * payments remain intact; committing a single invoice row switches lines and document together.
 */
/** YYMMNNN, e.g. 2608001 for the first invoice covering August 2026. Numbered by the month the
 * assessments were conducted, not the month the document happened to be generated in — an August
 * invoice raised on 2 September is still 2608001. */
function lilInvoiceNumber_(period, sequence) {
  return String(period).slice(2, 4) + String(period).slice(5, 7) + ('00' + Math.max(1, Number(sequence) || 1)).slice(-3);
}
function lilInvoiceForMonth_(period) {
  return listInvoicesInternal().filter(function(i) { return i.kind === 'lil_assessment' && i.source_month === period; })[0] || null;
}
function lilInvoiceInputs_(period, rows) {
  var settings = api_getSettings();
  var selected = (rows || assessmentRows_('assessments').rows).filter(function(r) { return invoiceToIsoDate(r.assessment_date).slice(0,7) === period; }).sort(function(a,b) { return String(a.assessment_date).localeCompare(String(b.assessment_date)) || String(a.client_name).localeCompare(String(b.client_name)) || String(a.id).localeCompare(String(b.id)); });
  var templates = { template_doc_id: settings.invoice_template_doc_id || settings.invoice_template_reference || '', template_doc_path: settings.invoice_template_path || '', output_folder_id: settings.invoice_output_folder_id || '', output_folder_path: settings.invoice_output_folder_path || '', line_limit: settings.invoice_line_item_limit || '' };
  if (templates.template_doc_id && !looksLikeDriveId(templates.template_doc_id)) { templates.template_doc_path = templates.template_doc_id; templates.template_doc_id = ''; }
  if (!templates.output_folder_id && looksLikeDriveId(templates.output_folder_path)) { templates.output_folder_id = templates.output_folder_path; templates.output_folder_path = ''; }
  var content = selected.map(function(r) { return { id: r.id, date: invoiceToIsoDate(r.assessment_date), contract_id: r.contract_id, type: r.assessment_type_id, name: r.client_name, dob: invoiceToIsoDate(r.client_dob), organisation: r.organisation, adjustment: r.percentage_adjustment, lines: resolveAssessmentLines_(r) }; });
  return { rows: selected, template: templates, hash: sha256Hex_(stableJsonStringify_({ period: period, assessments: content, template: templates })) };
}
function lilMonthInvoiceState_(period, rows) {
  var inputs = lilInvoiceInputs_(period, rows), invoice = lilInvoiceForMonth_(period);
  var conflicts = listInvoicesInternal().filter(function(i) { return i.kind !== 'lil_assessment' && i.status !== 'void' && (i.source_month === period || (i.migration_warning && String(i.migration_warning).indexOf(period) !== -1)); });
  return { invoice: invoice, content_hash: inputs.hash, stale: !!(invoice && invoice.generated_doc_id && invoice.content_hash !== inputs.hash), generating: !!(invoice && invoice.pending_request_id && new Date().getTime() - new Date(invoice.pending_started_at).getTime() < 360000), summary: invoice ? summarizeInvoiceLineItems(listInvoiceLineItemsByInvoiceId(invoice.id)) : null, snapshot: invoice ? assessmentJson_(invoice.financial_snapshot_json, null) : null, historical_invoices: conflicts, warning: conflicts.length ? 'Historical invoices overlap this month. Reconcile them before generating another invoice to avoid duplicate income.' : '' };
}
/** A saved accounting basis wins; with nothing saved, sole traders report on an accrual basis. Mirrors
 * defaultAccountingBasis() on the BAS page so the two surfaces cannot disagree. */
function lilAccountingBasis_() {
  var settings = api_getSettings() || {};
  if (settings.accounting_basis === 'accrual' || settings.accounting_basis === 'cash') return settings.accounting_basis;
  var flags = {};
  try { flags = api_getFeatureFlags() || {}; } catch (error) { flags = {}; }
  return flags.is_sole_trader && flags.is_sole_trader.enabled ? 'accrual' : 'cash';
}

/** The month's business costs, from the same reader the BAS actuals and the transfer split use. */
function lilMonthExpenses_(period, basis) {
  var from = period + '-01';
  var lastDay = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate();
  var to = period + '-' + ('0' + lastDay).slice(-2);
  try {
    var actual = expenseActualForPeriod_(basis, from, to);
    return { paid: roundMoney_(actual.purchases), gst: roundMoney_(actual.gst), available: true };
  } catch (error) {
    // No expense ledger on this spreadsheet: report zero rather than refusing to snapshot.
    return { paid: 0, gst: 0, available: false };
  }
}

/** What of a generated invoice is actually Lil's, once the ATO's and her super fund's shares are set
 * aside. Frozen at generation: it answers "when this is paid, how much can move to the personal
 * account", so it must not drift as the month is edited afterwards — the month's content hash marks it
 * out of date instead.
 *
 * The order of operations is the monthly transfer split's (backend/transferSplit.js): fees ex GST ->
 * business costs -> super -> taxable profit -> tax -> income, holding the same identity
 * income === taxable_profit - tax. GST is money held for the ATO, never earnings; super is deductible,
 * so it comes off before the tax provision.
 *
 * Tax is the same monthly PAYG estimate the rest of Tempus uses (estimateTaxDetails, ATO Scale 2), on
 * the same taxable income. Chosen deliberately over an instalment rate, which needs a rate from the ATO
 * that is not always issued, and over an annualised year-to-date figure: every other Tempus screen taxes
 * a month on that month's earnings, so a quiet month shows less tax, and this figure should not be the
 * one place that behaves differently. The trade-off is the one tax.js notes on
 * INDIVIDUAL_INCOME_TAX_TABLES — a single period is annualised, so an unusually busy month is taxed as
 * though every month were that busy. It is a provision, not an assessment. */
function lilInvoiceSnapshot_(lines, period) {
  var summary = summarizeInvoiceLineItems(lines);
  var fees = roundMoney_(summary.totalAmount);
  var gst = roundMoney_(summary.gstAmount);
  var periodStart = period + '-01';
  var basis = lilAccountingBasis_();
  var expenses = lilMonthExpenses_(period, basis);
  // Business costs come off before super and tax, exactly as the monthly transfer split orders them,
  // and the GST already claimed back on them nets off the GST held from this invoice.
  var expensesExGst = roundMoney_(expenses.paid - expenses.gst);
  var profitBeforeSuper = roundMoney_(fees - expensesExGst);
  var netGst = roundMoney_(gst - expenses.gst);
  var superRate = Number(getSuperGuaranteeRate(periodStart)) || 0;
  var superAmount = roundMoney_(Math.max(0, profitBeforeSuper) * superRate);
  var taxableProfit = roundMoney_(profitBeforeSuper - superAmount);
  // Taxed on the month being invoiced, the same way every other Tempus screen taxes a month.
  var provision = estimateTaxDetails(taxableProfit, periodStart);
  var warnings = [], tax = roundMoney_(Math.max(0, provision.tax));
  if (provision.warning) warnings.push(provision.warning);
  var income = roundMoney_(taxableProfit - tax);
  if (income < 0) warnings.push('This month\u2019s business costs exceed the invoice, so there is nothing to transfer.');
  if (!expenses.available) warnings.push('Business expenses could not be read, so they are shown as nil. Turn on the business expense ledger to include them.');
  return {
    period: period,
    accounting_basis: basis,
    invoice_total: roundMoney_(summary.totalWithGst),
    fees_ex_gst: fees,
    gst: gst,
    gst_credits: expenses.gst,
    net_gst: netGst,
    expenses_paid: expenses.paid,
    expenses_ex_gst: expensesExGst,
    profit_before_super: profitBeforeSuper,
    super: superAmount,
    super_rate: superRate,
    taxable_profit: taxableProfit,
    tax: tax,
    tax_method: 'payg_monthly',
    tax_table: provision.source,
    tax_financial_year: provision.applied_financial_year,
    income: income,
    retained_in_business: roundMoney_(netGst + tax + superAmount + expenses.paid),
    warnings: warnings,
    calculated_at: assessmentNow_()
  };
}

function lilCleanupInvoice_(invoice) {
  var ids = assessmentJson_(invoice.retired_doc_ids_json, []), remaining = [];
  ids.forEach(function(id) {
    if (!id || id === invoice.generated_doc_id || id === invoice.template_doc_id) return;
    try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { remaining.push(id); }
  });
  if (remaining.length !== ids.length) updateInvoiceRecord(invoice.id, { retired_doc_ids_json: JSON.stringify(remaining) });
  return remaining;
}
function api_getLilInvoiceGeneration(year, month) {
  return withScriptLock_('invoice generation status', function() {
    var period = assessmentMonth_(year,month), invoice = lilInvoiceForMonth_(period);
    if (invoice) lilCleanupInvoice_(invoice);
    return lilMonthInvoiceState_(period);
  });
}
function lilValidateInvoiceRows_(inputs) {
  if (!inputs.rows.length) throw new Error('Add an assessment before generating this month’s invoice.');
  inputs.rows.forEach(function(row) {
    var name = String(row.client_name || '').trim() || 'The assessment dated ' + invoiceToIsoDate(row.assessment_date);
    var blockers = assessmentInvoiceBlockers_(row);
    if (blockers.length) throw new Error(name + ': ' + blockers.join(' '));
    normalizeIsoDateStrict_(row.client_dob, name + ' date of birth', false);
    if (row.client_dob > assessmentToday_()) throw new Error(name + ': date of birth cannot be in the future.');
    var lines = resolveAssessmentLines_(row);
    if (!lines.length || lines.some(function(l) { return !isFinite(l.amount) || l.amount < 0 || !isFinite(l.gst_amount) || /\{\w+\}/.test(l.description); })) throw new Error(name + ': saved pricing needs review.');
  });
}
function api_generateLilMonthlyInvoice(payload) {
  payload = payload || {};
  var period = assessmentMonth_(payload.year,payload.month), requestId = String(payload.request_id || '');
  if (!requestId) throw new Error('A stable generation request ID is required.');
  // Reserve quickly; Drive runs outside the lock so other months and actual time remain usable.
  var reservation = withScriptLock_('reserve monthly invoice', function() {
    recoverAssessmentMutations_();
    clearInvoiceCaches();
    var state = lilMonthInvoiceState_(period), invoice = state.invoice, inputs = lilInvoiceInputs_(period);
    if (invoice && invoice.generation_request_id === requestId) { lilCleanupInvoice_(invoice); return { committed: true, invoice: invoice }; }
    if (state.warning) throw new Error(state.warning);
    if (state.generating) throw new Error('This month’s invoice is generating. Check its status before trying again.');
    if (inputs.hash !== payload.expected_hash) throw new Error('The month changed. Review the saved assessments and generate again.');
    if (invoice && invoice.generated_doc_id && payload.confirmed_document_id !== invoice.generated_doc_id) throw new Error('Confirm replacement of the current invoice before generating again.');
    lilValidateInvoiceRows_(inputs);
    var now = assessmentNow_();
    var periodYear = Number(period.slice(0,4)), periodMonth = Number(period.slice(5,7));
    if (!invoice) {
      // invoice_date stays the generation date; the number and the year/month identity follow the period.
      var sequence = getNextInvoiceSequence(periodYear, periodMonth);
      invoice = { id: Utilities.getUuid(), kind: 'lil_assessment', source_month: period, year: periodYear, month: periodMonth, sequence: sequence, invoice_number: lilInvoiceNumber_(period, sequence), invoice_date: assessmentToday_(), status: 'draft', created_at: now };
    } else if (!/^\d{7}$/.test(String(invoice.invoice_number || ''))) {
      // An invoice numbered before this format existed is renumbered in place: same identity, same id
      // and payment references, written the way the convention reads now.
      invoice = Object.assign({}, invoice, { year: periodYear, month: periodMonth, sequence: Math.max(1, Number(invoice.sequence) || 1), invoice_number: lilInvoiceNumber_(period, invoice.sequence) });
    }
    var retired = assessmentJson_(invoice.retired_doc_ids_json, []);
    if (invoice.pending_doc_id) retired.push(invoice.pending_doc_id);
    invoice = Object.assign({}, invoice, { pending_request_id: requestId, pending_started_at: now, pending_doc_id: '', retired_doc_ids_json: JSON.stringify(retired) });
    var lines = [];
    inputs.rows.forEach(function(row) {
      var billing = findAssessmentBillableEntry_(row.id);
      if (!billing) throw new Error('The billing entry for ' + row.client_name + ' needs repair before invoicing.');
      resolveAssessmentLines_(row).forEach(function(line) {
        lines.push(Object.assign({}, line, { id: Utilities.getUuid(), invoice_id: invoice.id, generation_id: requestId, position: lines.length + 1, is_default: 'FALSE', line_date: row.assessment_date, hours: 0, amount_mode: 'amount', contract_id: row.contract_id, contract_name_snapshot: (assessmentContractById_(row.contract_id) || {}).name || '', timesheet_entry_id: billing.id, source_type: 'assessment', source_id: row.id, source_line_id: line.id, created_at: now, updated_at: now }));
      });
    });
    var total = summarizeInvoiceLineItems(lines).totalWithGst, paid = invoicePaymentsForInvoice_(invoice.id).reduce(function(s,p) { return s + Number(p.amount || 0); },0);
    if (paid > total + 0.005) { throw new Error('Historical payments exceed the replacement total. Reconcile that balance before replacing the invoice.'); }
    assessmentWrite_('invoices', invoice); clearInvoiceCaches();
    return { invoice: invoice, inputs: inputs, lines: lines };
  });
  if (reservation.committed) return { success: true, invoice: reservation.invoice };
  var staged = null;
  try {
    var invoice = reservation.invoice, template = reservation.inputs.template;
    staged = renderInvoiceDocument_(invoice, reservation.lines, template, function(file) {
      withScriptLock_('record staged document', function() { updateInvoiceRecord(invoice.id, { pending_doc_id: file.getId() }); });
    });
    return withScriptLock_('commit monthly invoice', function() {
      recoverAssessmentMutations_(); clearInvoiceCaches();
      var current = findInvoiceById(invoice.id);
      if (!current || current.pending_request_id !== requestId || lilInvoiceInputs_(period).hash !== reservation.inputs.hash) throw new Error('Assessments or template settings changed during generation. Generate again using the current month.');
      var data = assessmentRows_('invoice_line_items');
      // A retry may encounter rows staged before an interrupted response. Stable generation IDs hide
      // incomplete versions until the invoice pointer changes, and prevent duplicate active lines.
      var existing = data.rows.filter(function(l) { return l.invoice_id === invoice.id && l.generation_id === requestId; });
      existing.sort(function(a,b) { return b.__row-a.__row; }).forEach(function(l) { data.sheet.deleteRow(l.__row); });
      var lineRows = reservation.lines.map(function(l) { return rowValuesFromObject_(data.headers,l); });
      data.sheet.getRange(data.sheet.getLastRow()+1,1,lineRows.length,data.headers.length).setValues(lineRows);
      var retired = assessmentJson_(current.retired_doc_ids_json, []);
      if (current.generated_doc_id) retired.push(current.generated_doc_id);
      var updates = Object.assign({}, staged, { status: current.status === 'sent' ? 'sent' : 'issued', issued_at: current.issued_at || assessmentNow_(), generated_at: assessmentNow_(), content_hash: reservation.inputs.hash, financial_snapshot_json: JSON.stringify(lilInvoiceSnapshot_(reservation.lines, period)), generation_request_id: requestId, pending_request_id: '', pending_started_at: '', pending_doc_id: '', retired_doc_ids_json: JSON.stringify(retired) });
      updateInvoiceRecord(invoice.id, updates);
      var saved = findInvoiceById(invoice.id);
      // Cleanup is best effort after commit. A failed trash operation never undoes a successful invoice.
      try { lilCleanupInvoice_(saved); } catch (e) { Logger.log('Invoice cleanup will retry: ' + e); }
      return { success: true, invoice: saved };
    });
  } catch (error) {
    // A Sheets call can succeed remotely then lose its response. Re-read the commit pointer before
    // discarding anything, especially the new document which may already be the current invoice.
    return withScriptLock_('recover monthly invoice', function() {
      clearInvoiceCaches(); var current = lilInvoiceForMonth_(period);
      if (current && current.generation_request_id === requestId) return { success: true, invoice: current };
      if (current && current.pending_request_id === requestId) {
        var retired = assessmentJson_(current.retired_doc_ids_json, []);
        if (current.pending_doc_id) retired.push(current.pending_doc_id);
        updateInvoiceRecord(current.id, { pending_request_id: '', pending_started_at: '', pending_doc_id: '', retired_doc_ids_json: JSON.stringify(retired) });
        try { lilCleanupInvoice_(findInvoiceById(current.id)); } catch (e) { Logger.log(e); }
      }
      throw error;
    });
  }
}
