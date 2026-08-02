/** Generic, user-configured assessments integrated with the canonical invoice ledger. */
var ASSESSMENT_CACHE_PREFIX = 'assessments_v2_';
var ASSESSMENT_FIELD_INPUT_TYPES = { text: true, textarea: true, date: true, number: true, email: true, select: true };

function assessmentJson_(value, fallback) { try { var parsed = JSON.parse(value || ''); return parsed === null ? fallback : parsed; } catch (error) { return fallback; } }
function assessmentNow_() { return invoiceToIsoDateTime(new Date()); }

function assessmentRows_(name) {
  var sheet = getOrCreateSheet(name);
  var values = sheet.getDataRange().getValues();
  return { sheet: sheet, headers: values.length ? values[0] : [], rows: values.length > 1 ? values.slice(1).map(function(row, index) { var value = rowObjectFromHeaders_(values[0], row); value.__row = index + 2; return value; }) : [] };
}

function assessmentFind_(name, id) {
  var data = assessmentRows_(name);
  for (var index = 0; index < data.rows.length; index++) if (String(data.rows[index].id) === String(id)) return { data: data, item: data.rows[index] };
  return { data: data, item: null };
}

function normalizeAssessmentFields_(fields) {
  var keys = {};
  return (Array.isArray(fields) ? fields : []).map(function(field, index) {
    var key = String(field.key || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key) key = 'field_' + (index + 1);
    if (keys[key]) throw new Error('Assessment field keys must be unique.');
    keys[key] = true;
    var inputType = String(field.input_type || 'text').toLowerCase();
    if (!ASSESSMENT_FIELD_INPUT_TYPES[inputType]) throw new Error('Unsupported assessment field input type: ' + inputType);
    return { key: key, label: String(field.label || key).trim(), input_type: inputType, required: expenseBoolean_(field.required), options: inputType === 'select' && Array.isArray(field.options) ? field.options.map(String) : [] };
  });
}

function normalizeAssessmentLines_(lines, typeId) {
  var ids = {};
  return (Array.isArray(lines) ? lines : []).map(function(line, index) {
    var id = String(line.id || (typeId ? typeId + '-line-' + (index + 1) : Utilities.getUuid()));
    if (ids[id]) throw new Error('Assessment line IDs must be unique.');
    ids[id] = true;
    var multiplier = Number(line.multiplier);
    if (!isFinite(multiplier) || multiplier < 0) throw new Error('Assessment line multipliers cannot be negative.');
    return { id: id, template: String(line.template || '').trim(), multiplier: multiplier, display_order: Number(line.display_order) || index + 1, percentage_adjustment: normalizePercentageDecimal_(line.percentage_adjustment, 0) };
  }).sort(function(a, b) { return a.display_order - b.display_order; });
}

function api_listAssessmentTypes(filters) {
  var types = assessmentRows_('assessment_types').rows.map(function(item) {
    return { id: String(item.id || ''), name: String(item.name || ''), description: String(item.description || ''), fields: normalizeAssessmentFields_(assessmentJson_(item.field_definitions_json, [])), lines: normalizeAssessmentLines_(assessmentJson_(item.line_templates_json, []), item.id), active: expenseBoolean_(item.active), created_at: item.created_at || '', updated_at: item.updated_at || '' };
  });
  if (!(filters && expenseBoolean_(filters.include_inactive))) types = types.filter(function(type) { return type.active; });
  return types;
}

function api_upsertAssessmentType(payload) {
  return withScriptLock_('assessment type update', function() {
    var found = payload && payload.id ? assessmentFind_('assessment_types', payload.id) : assessmentFind_('assessment_types', '');
    var id = found.item ? found.item.id : (payload.id || Utilities.getUuid());
    var fields = normalizeAssessmentFields_(payload.field_definitions || payload.fields || assessmentJson_(payload.field_definitions_json, []));
    var lines = normalizeAssessmentLines_(payload.line_templates || payload.lines || assessmentJson_(payload.line_templates_json, []), id);
    if (!String(payload.name || '').trim()) return apiRecoverableFailure_('name_required', 'Assessment type name is required.');
    if (!lines.length) return apiRecoverableFailure_('line_required', 'Add at least one invoice line template.');
    var now = assessmentNow_();
    var type = { id: id, name: String(payload.name).trim(), description: String(payload.description || ''), field_definitions_json: JSON.stringify(fields), line_templates_json: JSON.stringify(lines), active: payload.active === undefined ? 'TRUE' : (expenseBoolean_(payload.active) ? 'TRUE' : 'FALSE'), created_at: found.item ? found.item.created_at : now, updated_at: now };
    var existingRow = found.item ? found.data.sheet.getRange(found.item.__row, 1, 1, found.data.headers.length).getValues()[0] : null;
    var row = rowValuesFromObject_(found.data.headers, type, existingRow);
    if (found.item) found.data.sheet.getRange(found.item.__row, 1, 1, row.length).setValues([row]); else found.data.sheet.appendRow(row);
    cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
    return { success: true, type: api_listAssessmentTypes({ include_inactive: true }).filter(function(item) { return item.id === id; })[0] };
  });
}

function assessmentReferenceCount_(typeId) {
  return assessmentRows_('assessments').rows.filter(function(item) { return String(item.assessment_type_id) === String(typeId); }).length;
}

function api_deleteAssessmentType(id) {
  return withScriptLock_('assessment type removal', function() {
    var found = assessmentFind_('assessment_types', id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Assessment type not found.');
    var count = assessmentReferenceCount_(id);
    if (count) return apiRecoverableFailure_('referenced_record', 'This assessment type is referenced and cannot be deleted.', { assessment_count: count });
    found.data.sheet.deleteRow(found.item.__row);
    cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
    return { success: true };
  });
}

function assessmentTypeById_(id) { var types = api_listAssessmentTypes({ include_inactive: true }); for (var index = 0; index < types.length; index++) if (types[index].id === id) return types[index]; return null; }
function assessmentContractById_(id) { var contracts = api_getContracts(); for (var index = 0; index < contracts.length; index++) if (String(contracts[index].id) === String(id)) return contracts[index]; return null; }

function assessmentInvoiceLocked_(assessment) {
  if (!assessment || !assessment.invoice_id) return false;
  var invoice = findInvoiceById(String(assessment.invoice_id));
  return !!(invoice && invoice.status !== 'draft' && invoice.status !== 'void');
}

function normalizeAssessmentRecord_(payload, existing) {
  var type = assessmentTypeById_(String(payload.assessment_type_id || (existing && existing.assessment_type_id) || ''));
  if (!type) throw new Error('Assessment type not found.');
  var contract = assessmentContractById_(String(payload.contract_id || (existing && existing.contract_id) || ''));
  if (!contract) throw new Error('Contract not found.');
  var date = normalizeIsoDateStrict_(payload.assessment_date || payload.interview_date || (existing && existing.assessment_date), 'Assessment date', false);
  if (contract.start_date && date < contract.start_date) throw new Error('Assessment date is before the contract start date.');
  if (contract.end_date && date > contract.end_date) throw new Error('Assessment date is after the contract end date.');
  var values = payload.field_values || assessmentJson_(payload.field_values_json, existing ? assessmentJson_(existing.field_values_json, {}) : {});
  type.fields.forEach(function(field) { if (field.required && String(values[field.key] == null ? '' : values[field.key]).trim() === '') throw new Error(field.label + ' is required.'); });
  var now = assessmentNow_();
  return {
    id: existing ? existing.id : (payload.id || Utilities.getUuid()), assessment_type_id: type.id, contract_id: contract.id, organisation: String(payload.organisation || (existing && existing.organisation) || contract.name || '').trim(),
    assessment_date: date, field_values_json: JSON.stringify(values), percentage_adjustment: normalizePercentageDecimal_(payload.percentage_adjustment, existing ? Number(existing.percentage_adjustment) : 0),
    status: existing ? existing.status : 'draft', invoice_id: existing ? existing.invoice_id : '', notes: String(payload.notes || ''), created_at: existing ? existing.created_at : now, updated_at: now
  };
}

function decorateAssessment_(item) {
  var type = assessmentTypeById_(String(item.assessment_type_id));
  var contract = assessmentContractById_(String(item.contract_id));
  return { id: String(item.id), assessment_type_id: String(item.assessment_type_id), assessment_type_name: type ? type.name : '', contract_id: String(item.contract_id), contract_name: contract ? contract.name : '', organisation: String(item.organisation || ''), assessment_date: String(item.assessment_date || ''), field_values: assessmentJson_(item.field_values_json, {}), percentage_adjustment: Number(item.percentage_adjustment) || 0, status: String(item.status || 'draft'), invoice_id: String(item.invoice_id || ''), locked: assessmentInvoiceLocked_(item), notes: String(item.notes || ''), created_at: item.created_at || '', updated_at: item.updated_at || '' };
}

function api_getAssessmentsForMonth(year, month) {
  var prefix = Number(year) + '-' + ('0' + Number(month)).slice(-2) + '-';
  var assessments = assessmentRows_('assessments').rows.filter(function(item) { return String(item.assessment_date || '').indexOf(prefix) === 0; }).map(decorateAssessment_);
  return { year: Number(year), month: Number(month), assessments: assessments, summary: { count: assessments.length, invoiced: assessments.filter(function(item) { return !!item.invoice_id; }).length } };
}

function api_upsertAssessment(payload) {
  return withScriptLock_('assessment update', function() {
    var found = payload && payload.id ? assessmentFind_('assessments', payload.id) : assessmentFind_('assessments', '');
    if (found.item && assessmentInvoiceLocked_(found.item)) return apiRecoverableFailure_('locked_assessment', 'This assessment belongs to an issued invoice and cannot be edited. Void and revise the invoice first.');
    var record = normalizeAssessmentRecord_(payload || {}, found.item);
    var existingRow = found.item ? found.data.sheet.getRange(found.item.__row, 1, 1, found.data.headers.length).getValues()[0] : null;
    var row = rowValuesFromObject_(found.data.headers, record, existingRow);
    if (found.item) found.data.sheet.getRange(found.item.__row, 1, 1, row.length).setValues([row]); else found.data.sheet.appendRow(row);
    var entry = syncAssessmentEntry_(record);
    cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
    return { success: true, assessment: decorateAssessment_(record), billable_entry: entry };
  });
}

function api_deleteAssessment(id) {
  return withScriptLock_('assessment removal', function() {
    var found = assessmentFind_('assessments', id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Assessment not found.');
    if (assessmentInvoiceLocked_(found.item)) return apiRecoverableFailure_('locked_assessment', 'This assessment belongs to an issued invoice and cannot be deleted.');
    found.data.sheet.deleteRow(found.item.__row);
    var entries = api_getEntries({}).filter(function(entry) { return entry.source_type === 'assessment' && String(entry.source_id) === String(id); });
    entries.forEach(function(entry) { api_deleteEntry(entry.id); });
    cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
    return { success: true };
  });
}

function assessmentTokenValues_(assessment, type, contract) {
  var values = assessmentJson_(assessment.field_values_json, {});
  values.organisation = assessment.organisation || '';
  values.assessment_date = assessment.assessment_date || '';
  values.contract = contract ? contract.name : '';
  values.assessment_type = type ? type.name : '';
  return values;
}

function renderAssessmentTemplate_(template, tokens) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, function(match, key) { return Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key] == null ? '' : tokens[key]) : match; });
}

function resolveAssessmentLines_(assessment) {
  var type = assessmentTypeById_(String(assessment.assessment_type_id));
  var contract = assessmentContractById_(String(assessment.contract_id));
  if (!type || !contract) return [];
  var tokens = assessmentTokenValues_(assessment, type, contract);
  var assessmentAdjustment = Number(assessment.percentage_adjustment) || 0;
  return type.lines.map(function(line) {
    var amount = roundMoney_((Number(contract.hourly_rate) || 0) * Number(line.multiplier || 0) * (1 + assessmentAdjustment) * (1 + Number(line.percentage_adjustment || 0)));
    return { id: line.id, description: renderAssessmentTemplate_(line.template, tokens), amount: amount, multiplier: line.multiplier, gst_code: 'taxable', gst_rate: 0.1, gst_amount: roundMoney_(amount * 0.1) };
  });
}

function syncAssessmentEntry_(assessment) {
  var contract = assessmentContractById_(String(assessment.contract_id));
  if (!contract || Number(contract.hourly_rate) <= 0) return null;
  var amount = resolveAssessmentLines_(assessment).reduce(function(sum, line) { return sum + line.amount; }, 0);
  var duration = Math.max(1, Math.round((amount / Number(contract.hourly_rate)) * 60));
  var existing = api_getEntries({ startDate: assessment.assessment_date, endDate: assessment.assessment_date }).filter(function(entry) { return entry.source_type === 'assessment' && String(entry.source_id) === String(assessment.id); })[0];
  var payload = { id: existing ? existing.id : '', date: assessment.assessment_date, duration_minutes: duration, contract_id: contract.id, hour_type_id: resolveDefaultHourTypeId(), entry_type: 'basic', assessment_id: assessment.id, source_type: 'assessment', source_id: assessment.id, source_occurrence_key: assessment.assessment_date };
  var result = existing ? api_updateEntry(payload) : api_addEntry(payload);
  return result && result.entry ? result.entry : null;
}

function api_previewAssessmentInvoices(payload) {
  var ids = payload && Array.isArray(payload.assessment_ids) ? payload.assessment_ids.map(String) : [];
  var selected = assessmentRows_('assessments').rows.filter(function(item) { return ids.indexOf(String(item.id)) !== -1; });
  var grouping = payload && payload.grouping === 'per_organisation' ? 'per_organisation' : 'combined';
  var groups = {};
  selected.forEach(function(assessment) {
    if (assessmentInvoiceLocked_(assessment)) return;
    var key = grouping === 'per_organisation' ? String(assessment.organisation || 'Unspecified') : 'combined';
    if (!groups[key]) groups[key] = { key: key, organisation: grouping === 'per_organisation' ? key : '', assessments: [], lines: [], total: 0 };
    var lines = resolveAssessmentLines_(assessment);
    groups[key].assessments.push(String(assessment.id));
    lines.forEach(function(line) { groups[key].lines.push({ assessment_id: assessment.id, source_line_id: line.id, description: line.description, amount: line.amount, gst_code: line.gst_code, gst_rate: line.gst_rate, gst_amount: line.gst_amount, line_date: assessment.assessment_date, contract_id: assessment.contract_id }); groups[key].total += line.amount + line.gst_amount; });
  });
  return { success: true, grouping: grouping, groups: Object.keys(groups).map(function(key) { groups[key].total = roundMoney_(groups[key].total); return groups[key]; }) };
}

function api_generateAssessmentInvoices(payload) {
  return withScriptLock_('assessment invoice generation', function() {
    var preview = api_previewAssessmentInvoices(payload || {});
    if (!preview.groups.length) return apiRecoverableFailure_('no_assessments', 'Select at least one available assessment.');
    var generated = [];
    preview.groups.forEach(function(group) {
      var date = normalizeIsoDateStrict_(payload.invoice_date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), 'Invoice date', false);
      var invoice = upsertInvoiceUnlocked_({ kind: 'assessment', invoice_date: date, status: 'draft', notes: group.organisation ? 'Assessment invoice for ' + group.organisation : 'Assessment invoice' });
      var lineSheet = getOrCreateSheet('invoice_line_items');
      var headers = lineSheet.getDataRange().getValues()[0];
      group.lines.forEach(function(line, index) {
        var now = assessmentNow_();
        lineSheet.appendRow(rowValuesFromObject_(headers, { id: Utilities.getUuid(), invoice_id: invoice.id, is_default: 'FALSE', position: index + 1, line_date: line.line_date, description: line.description, hours: 0, amount: line.amount, amount_mode: 'amount', contract_id: line.contract_id, gst_code: line.gst_code, gst_rate: line.gst_rate, gst_amount: line.gst_amount, source_type: 'assessment', source_id: line.assessment_id, source_line_id: line.source_line_id, created_at: now, updated_at: now }));
      });
      group.assessments.forEach(function(id) {
        var found = assessmentFind_('assessments', id);
        if (!found.item) return;
        var invoiceIndex = found.data.headers.indexOf('invoice_id');
        var statusIndex = found.data.headers.indexOf('status');
        found.data.sheet.getRange(found.item.__row, invoiceIndex + 1).setValue(invoice.id);
        found.data.sheet.getRange(found.item.__row, statusIndex + 1).setValue('invoiced');
      });
      generated.push(invoice);
    });
    clearInvoiceCaches();
    cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
    return { success: true, invoices: generated.map(function(invoice) { return api_getInvoice(invoice.id); }) };
  });
}

function api_listAssessmentInvoicesForMonth(year, month) {
  return api_listInvoices({ year: year, month: month, include_summary: true }).filter(function(invoice) { return invoice.kind === 'assessment'; });
}

function api_sendAssessmentInvoice(payload) {
  var invoiceId = typeof payload === 'string' ? payload : payload && payload.invoice_id;
  var invoice = findInvoiceById(invoiceId);
  if (!invoice || invoice.kind !== 'assessment') return apiRecoverableFailure_('not_found', 'Assessment invoice not found.');
  var settings = api_getSettings();
  var recipients = String((payload && payload.recipients) || settings.assessment_email_recipients || '').split(',').map(function(item) { return item.trim(); }).filter(Boolean);
  if (!recipients.length) return apiRecoverableFailure_('recipient_required', 'Configure at least one assessment invoice recipient.');
  var tokens = { invoice_number: invoice.invoice_number, invoice_date: invoice.invoice_date };
  var subject = renderAssessmentTemplate_((payload && payload.subject) || settings.assessment_email_subject || 'Invoice {invoice_number}', tokens);
  var body = renderAssessmentTemplate_((payload && payload.body) || settings.assessment_email_body || 'Please find invoice {invoice_number} attached.', tokens);
  var attachments = [];
  if (invoice.generated_doc_id) attachments.push(DriveApp.getFileById(invoice.generated_doc_id).getAs(MimeType.PDF));
  MailApp.sendEmail({ to: recipients.join(','), subject: subject, body: body, attachments: attachments });
  return api_markInvoiceSent(invoice.id);
}

/** One-release wrappers for the removed assessment-invoice store. */
function api_unlockAssessmentInvoice(invoiceId) { return apiRecoverableFailure_('deprecated_lifecycle', 'Issued invoices are immutable. Void and revise this invoice instead.', { invoice_id: invoiceId }); }
