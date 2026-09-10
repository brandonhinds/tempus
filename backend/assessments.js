/** Lil's fixed assessment catalogue, saved prices, and independently recorded actual time. */
var ASSESSMENT_CACHE_PREFIX = 'assessments_lil_';
var ASSESSMENT_BILLABLE_OCCURRENCE_KEY = 'billable';
var ASSESSMENT_INTERNAL_ENTRY_WRITE_ = false;
var LIL_ASSESSMENT_TYPES = [
  { id: 'standard', name: 'Standard', lines: [{ template: '{org} Psychological Assessment Report (Initial){surge_suffix}\nClearance Subject: {name} (DOB: {dob})', multiplier: 1 }] },
  { id: 'enhanced', name: 'Enhanced', lines: [{ template: '{org} Psychological Assessment Report (Initial){surge_suffix}\nClearance Subject: {name} (DOB: {dob})', multiplier: 1 }, { template: '{org} Document Review Fee\nClearance Subject: {name} (DOB: {dob})', multiplier: 0.105 }] },
  { id: 'reval', name: 'Reval', lines: [{ template: '{org} Psychological Assessment Report (Reval){surge_suffix}\nClearance Subject: {name} (DOB: {dob})', multiplier: 1 }, { template: '{org} Document Review Fee\nClearance Subject: {name} (DOB: {dob})', multiplier: 0.105 }] },
  { id: 'cancellation-under-24', name: 'Cancellation (<24 hrs)', lines: [{ template: 'PAR Short Notice Cancellation Fee - < 1 business day\nClearance Subject: {name} (DOB: {dob})', multiplier: 0.75 }] },
  { id: 'cancellation-over-24', name: 'Cancellation (>24 hrs)', lines: [{ template: 'PAR Short Notice Cancellation Fee - > 1 business day\nClearance Subject: {name} (DOB: {dob})', multiplier: 0.5 }] }
];
function api_listAssessmentTypes() { return JSON.parse(JSON.stringify(LIL_ASSESSMENT_TYPES)); }
function assessmentTypeById_(id) { return LIL_ASSESSMENT_TYPES.filter(function(t) { return t.id === String(id); })[0] || null; }
function assessmentContractById_(id) { return api_getContracts().filter(function(c) { return String(c.id) === String(id); })[0] || null; }
function assessmentJson_(value, fallback) { try { var parsed = JSON.parse(value || ''); return parsed === null ? fallback : parsed; } catch (e) { return fallback; } }
function assessmentNow_() { return invoiceToIsoDateTime(new Date()); }
function assessmentToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
var ASSESSMENT_DATE_FIELDS_ = ['assessment_date', 'client_dob'];
/** Sheets turns an ISO date written into a General-formatted cell back into a Date on read. Normalise
 * here, once, so every consumer — validation, invoice line wording and line ordering — sees YYYY-MM-DD
 * rather than each having to remember. */
function assessmentRows_(name) {
  var sheet = getOrCreateSheet(name), values = sheet.getDataRange().getValues();
  var normalizeDates = name === 'assessments';
  return { sheet: sheet, headers: values[0], rows: values.slice(1).map(function(row, index) {
    var item = rowObjectFromHeaders_(values[0], row);
    item.__row = index + 2;
    if (normalizeDates) ASSESSMENT_DATE_FIELDS_.forEach(function(field) {
      if (item[field] !== '' && item[field] != null) item[field] = invoiceToIsoDate(item[field]);
    });
    return item;
  }) };
}
function assessmentFind_(name, id) {
  var data = assessmentRows_(name);
  return { data: data, item: data.rows.filter(function(item) { return String(item.id) === String(id); })[0] || null };
}
/** Claim the schema's text columns on one row. The schema formats a sheet's columns when it appends
 * them, but a row appended past that range carries no format, and a General cell parses "1985-04-12"
 * into a date on write. Only the text columns are touched, so amount/rate formats are left alone. */
function assessmentClaimTextRow_(sheet, headers, rowNumber) {
  var schema = typeof getCanonicalSheetSchema_ === 'function' ? getCanonicalSheetSchema_(sheet.getName()) : null;
  if (!schema || !schema.text || !headers.length) return;
  var range = sheet.getRange(rowNumber, 1, 1, headers.length);
  var formats = range.getNumberFormats()[0], changed = false;
  headers.forEach(function(header, index) {
    if (schema.text.indexOf(header) !== -1 && formats[index] !== '@') { formats[index] = '@'; changed = true; }
  });
  if (changed) range.setNumberFormats([formats]);
}
function assessmentWrite_(name, record) {
  var found = assessmentFind_(name, record.id);
  var old = found.item ? found.data.sheet.getRange(found.item.__row, 1, 1, found.data.headers.length).getValues()[0] : null;
  var row = rowValuesFromObject_(found.data.headers, record, old);
  if (found.item) found.data.sheet.getRange(found.item.__row, 1, 1, row.length).setValues([row]);
  else {
    var target = found.data.sheet.getLastRow() + 1;
    ensureSheetCapacity_(found.data.sheet, target, row.length);
    assessmentClaimTextRow_(found.data.sheet, found.data.headers, target);
    found.data.sheet.getRange(target, 1, 1, row.length).setValues([row]);
  }
}
function assessmentMonth_(year, month) {
  if (!Number.isInteger(Number(year)) || Number(year) < 1900 || Number(year) > 9999 || !Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12) throw new Error('Choose a valid calendar month.');
  return Number(year) + '-' + ('0' + Number(month)).slice(-2);
}
function assessmentEntryIsBillable_(entry) { return !!entry && entry.source_type === 'assessment' && entry.source_occurrence_key === ASSESSMENT_BILLABLE_OCCURRENCE_KEY; }
function findAssessmentBillableEntry_(id) { return api_getEntries({}).filter(function(e) { return assessmentEntryIsBillable_(e) && String(e.source_id) === String(id); })[0] || null; }
function assessmentBillableHourTypeId_() {
  var types = api_getHourTypes().filter(function(t) { return t.contributes_to_income === true; });
  var defaultId = resolveDefaultHourTypeId();
  var selected = types.filter(function(t) { return String(t.id) === String(defaultId); })[0] || types[0];
  if (!selected) throw new Error('Create an income-contributing hour type for automatic assessment billing.');
  return String(selected.id);
}
function assessmentEligibleHourTypes_() { return api_getHourTypes().filter(function(t) { return t.contributes_to_income === false; }); }
function api_getAssessmentWorkHourTypeId() {
  var types = assessmentEligibleHourTypes_(), saved = String(api_getSettings().assessment_time_hour_type_id || '');
  if (types.some(function(t) { return String(t.id) === saved; })) return saved;
  return types.length === 1 ? String(types[0].id) : '';
}
function api_setAssessmentTimeDefault(id) {
  return withScriptLock_('assessment time default', function() {
    id = String(id || '');
    if (id && !assessmentEligibleHourTypes_().some(function(t) { return String(t.id) === id; })) throw new Error('Choose a non-billable hour type.');
    updateSettingsUnlocked_({ assessment_time_hour_type_id: id });
    return { success: true, assessment_time_hour_type_id: id };
  });
}
function normalizeAssessmentRecord_(payload, existing) {
  var record = Object.assign({}, existing || {}, payload);
  var type = assessmentTypeById_(record.assessment_type_id), contract = assessmentContractById_(record.contract_id);
  if (!type) throw new Error('Choose one of the five assessment types. Historical custom types need review.');
  if (!contract) throw new Error('Choose a contract.');
  record.assessment_date = normalizeIsoDateStrict_(record.assessment_date, 'Assessment date', false);
  if ((contract.archived && (!existing || String(existing.contract_id) !== String(contract.id))) || (contract.start_date && record.assessment_date < contract.start_date) || (contract.end_date && record.assessment_date > contract.end_date)) throw new Error('Choose a contract valid on the assessment date.');
  record.client_name = String(record.client_name || '').trim();
  if (!record.client_name) throw new Error('Client name is required.');
  record.client_dob = normalizeIsoDateStrict_(record.client_dob, 'Date of birth', false);
  if (record.client_dob > assessmentToday_()) throw new Error('Date of birth cannot be in the future.');
  record.organisation = String(record.organisation || '').trim();
  var historical = existing && String(existing.contract_id) === String(contract.id) && existing.organisation === record.organisation;
  if (!record.organisation || (!historical && assessmentOrganisations_(contract.assessment_organisations).indexOf(record.organisation) === -1)) throw new Error('Choose an organisation configured in Contracts.');
  record.percentage_adjustment = Number(record.percentage_adjustment);
  if (!isFinite(record.percentage_adjustment) || record.percentage_adjustment < 0 || record.percentage_adjustment > 1) throw new Error('Adjustment must be between 0% and 100%.');
  var reprice = !existing || !existing.pricing_snapshot_json || existing.contract_id !== record.contract_id || existing.assessment_type_id !== record.assessment_type_id || Number(existing.percentage_adjustment) !== record.percentage_adjustment;
  // Only an explicit pricing change can replace a previously saved rate or multiplier.
  if (reprice) {
    var rate = Number(contract.hourly_rate);
    if (!isFinite(rate) || rate <= 0) throw new Error('The contract needs a positive assessment rate.');
    record.pricing_snapshot_json = JSON.stringify({ rate: rate, lines: type.lines.map(function(line, index) { return { id: type.id + '-' + (index + 1), template: line.template, multiplier: line.multiplier, amount: roundMoney_(rate * line.multiplier * (1 + record.percentage_adjustment)) }; }) });
  } else record.pricing_snapshot_json = existing.pricing_snapshot_json;
  record.id = existing ? existing.id : String(payload.client_request_id || Utilities.getUuid());
  record.client_request_id = existing ? existing.client_request_id : record.id;
  record.revision = Number(existing && existing.revision || 0) + 1;
  record.last_request_id = String(payload.request_id || '');
  record.created_at = existing ? existing.created_at : assessmentNow_();
  record.updated_at = assessmentNow_();
  record.migration_warning = '';
  return record;
}
function renderAssessmentTemplate_(template, tokens) { return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, function(match, key) { return Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key] || '') : match; }); }
function resolveAssessmentLines_(record) {
  var snapshot = assessmentJson_(record.pricing_snapshot_json, null);
  if (!snapshot || !Array.isArray(snapshot.lines)) return [];
  var isoDob = invoiceToIsoDate(record.client_dob);
  var dob = isoDob ? isoDob.split('-').reverse().join('/') : '';
  var adjustment = Number(record.percentage_adjustment) || 0;
  var tokens = { org: record.organisation, organisation: record.organisation, name: record.client_name, subject_name: record.client_name, dob: dob, subject_date_of_birth: dob, surge_suffix: adjustment ? ' + ' + Number((adjustment * 100).toFixed(2)) + '% Surge' : '' };
  return snapshot.lines.map(function(line) { var amount = Number(line.amount); return { id: line.id, description: renderAssessmentTemplate_(line.template || line.description, tokens), amount: amount, multiplier: line.multiplier, gst_code: line.gst_code || 'taxable', gst_rate: line.gst_rate == null ? 0.1 : Number(line.gst_rate), gst_amount: line.gst_amount == null ? roundMoney_(amount * 0.1) : Number(line.gst_amount) }; });
}
function assessmentJoinList_(items) {
  if (items.length < 2) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}
/** Why this assessment cannot go on an invoice yet, named in the words the form uses. One list, so the
 * screen can flag it before Generate Invoice is pressed and the server refuses with the same reason
 * rather than a single message covering six different causes. */
function assessmentInvoiceBlockers_(item) {
  var missing = [];
  if (!assessmentTypeById_(item.assessment_type_id)) missing.push('assessment type');
  if (!String(item.client_name || '').trim()) missing.push('client name');
  if (!String(item.client_dob || '').trim()) missing.push('date of birth');
  if (!String(item.organisation || '').trim()) missing.push('organisation');
  if (!item.pricing_snapshot_json) missing.push('fee');
  var blockers = [];
  if (missing.length) blockers.push('Add the ' + assessmentJoinList_(missing) + '.');
  // A migrated record with every field present still needs confirming: saving it clears the warning.
  var warning = String(item.migration_warning || '').trim();
  if (warning) blockers.push(warning + ' Open it, check the details and save to confirm them.');
  return blockers;
}
function decorateAssessment_(item, entries) {
  var type = assessmentTypeById_(item.assessment_type_id), contract = assessmentContractById_(item.contract_id);
  var lines = resolveAssessmentLines_(item);
  var actual = (entries || api_getEntries({})).filter(function(e) { return e.source_type === 'assessment' && String(e.source_id) === String(item.id) && !assessmentEntryIsBillable_(e); }).sort(function(a,b) { return a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)); });
  return { id: String(item.id), assessment_type_id: String(item.assessment_type_id), assessment_type_name: type ? type.name : 'Historical type — review needed', contract_id: String(item.contract_id), contract_name: contract ? contract.name : 'Missing contract', organisation: String(item.organisation || ''), assessment_date: invoiceToIsoDate(item.assessment_date), client_name: String(item.client_name || ''), client_dob: invoiceToIsoDate(item.client_dob), percentage_adjustment: Number(item.percentage_adjustment) || 0, revision: Number(item.revision) || 0, pricing_snapshot: assessmentJson_(item.pricing_snapshot_json, null), lines: lines, fee: roundMoney_(lines.reduce(function(sum,l) { return sum + l.amount; },0)), time_entries: actual, actual_minutes: actual.reduce(function(sum,e) { return sum + Number(e.duration_minutes || 0); },0), migration_warning: String(item.migration_warning || ''), invoice_blockers: assessmentInvoiceBlockers_(item), historical_fields: assessmentJson_(item.field_values_json, {}), updated_at: invoiceToIsoDateTime(item.updated_at) };
}
function syncAssessmentEntry_(record) {
  var snapshot = assessmentJson_(record.pricing_snapshot_json, null);
  if (!snapshot) throw new Error('Assessment pricing needs review.');
  var amount = roundMoney_(resolveAssessmentLines_(record).reduce(function(sum,l) { return sum + l.amount; },0));
  var existing = findAssessmentBillableEntry_(record.id);
  var payload = { id: existing ? existing.id : '', date: record.assessment_date, duration_minutes: Math.max(1, Math.round(amount / Number(snapshot.rate) * 60)), income_amount: amount, contract_id: record.contract_id, hour_type_id: assessmentBillableHourTypeId_(), entry_type: 'basic', punches: [], round_interval: 1, assessment_id: record.id, source_type: 'assessment', source_id: record.id, source_occurrence_key: ASSESSMENT_BILLABLE_OCCURRENCE_KEY };
  ASSESSMENT_INTERNAL_ENTRY_WRITE_ = true;
  try { var result = existing ? api_updateEntry(payload) : api_addEntry(payload); if (!result.success && result.error !== 'duplicate_entry') throw new Error(result.message || result.error); return result.entry; }
  finally { ASSESSMENT_INTERNAL_ENTRY_WRITE_ = false; }
}
/** Durable intent makes a crash between the assessment and billing writes recoverable on the next read. */
function recoverAssessmentMutations_() {
  assessmentRows_('assessment_mutations').rows.filter(function(op) { return op.status === 'pending'; }).forEach(function(op) {
    var record = assessmentJson_(op.record_json, {});
    if (op.action === 'delete') {
      ASSESSMENT_INTERNAL_ENTRY_WRITE_ = true;
      try { api_getEntries({}).filter(function(e) { return e.source_type === 'assessment' && String(e.source_id) === String(record.id); }).forEach(function(e) { api_deleteEntry(e.id); }); }
      finally { ASSESSMENT_INTERNAL_ENTRY_WRITE_ = false; }
      var found = assessmentFind_('assessments', record.id);
      if (found.item) found.data.sheet.deleteRow(found.item.__row);
    } else { syncAssessmentEntry_(record); assessmentWrite_('assessments', record); }
    assessmentWrite_('assessment_mutations', { id: op.id, status: 'committed' });
  });
}
function api_upsertAssessment(payload) {
  return withScriptLock_('assessment update', function() {
    recoverAssessmentMutations_();
    payload = payload || {};
    if (!payload.request_id || (!payload.id && !payload.client_request_id)) throw new Error('A stable save request ID is required.');
    var found = assessmentFind_('assessments', payload.id || payload.client_request_id), existing = found.item;
    if (existing && (existing.last_request_id === payload.request_id || (!payload.id && existing.client_request_id === payload.client_request_id))) return { success: true, assessment: decorateAssessment_(existing), billable_entry: findAssessmentBillableEntry_(existing.id) };
    if (payload.id && !existing) throw new Error('This assessment was deleted. Refresh the month before saving.');
    if (existing && Number(payload.expected_revision) !== Number(existing.revision || 0)) throw new Error('This assessment changed in another session. Reload it before saving.');
    var record = normalizeAssessmentRecord_(payload, existing);
    assessmentBillableHourTypeId_();
    assessmentWrite_('assessment_mutations', { id: payload.request_id, action: 'save', record_json: JSON.stringify(record), status: 'pending' });
    recoverAssessmentMutations_();
    return { success: true, assessment: decorateAssessment_(record), billable_entry: findAssessmentBillableEntry_(record.id), previous_month: existing ? String(existing.assessment_date).slice(0,7) : '' };
  });
}
function api_deleteAssessment(payload) {
  return withScriptLock_('assessment removal', function() {
    recoverAssessmentMutations_();
    var found = assessmentFind_('assessments', payload && payload.id);
    if (!found.item) return { success: true };
    if (Number(payload.expected_revision) !== Number(found.item.revision || 0)) throw new Error('This assessment changed. Reload before deleting it.');
    var ids = api_getEntries({}).filter(function(e) { return e.source_type === 'assessment' && String(e.source_id) === String(found.item.id); }).map(function(e) { return e.id; });
    assessmentWrite_('assessment_mutations', { id: String(payload.request_id || Utilities.getUuid()), action: 'delete', record_json: JSON.stringify(found.item), status: 'pending' });
    recoverAssessmentMutations_();
    return { success: true, deleted_entry_ids: ids };
  });
}
function api_getAssessmentsForMonth(year, month) {
  return withScriptLock_('assessment month', function() {
    recoverAssessmentMutations_();
    var period = assessmentMonth_(year,month), entries = api_getEntries({});
    var rows = assessmentRows_('assessments').rows.filter(function(r) { return invoiceToIsoDate(r.assessment_date).slice(0,7) === period; });
    var assessments = rows.map(function(r) { return decorateAssessment_(r, entries); }).sort(function(a,b) { return a.assessment_date.localeCompare(b.assessment_date) || a.client_name.localeCompare(b.client_name) || a.id.localeCompare(b.id); });
    return { period: period, assessments: assessments, types: api_listAssessmentTypes(), contracts: api_getContracts(), hour_types: api_getHourTypes(), default_hour_type_id: api_getAssessmentWorkHourTypeId(), saved_default_hour_type_id: String(api_getSettings().assessment_time_hour_type_id || ''), summary: { count: assessments.length, fees: roundMoney_(assessments.reduce(function(s,a) { return s+a.fee; },0)), actual_minutes: assessments.reduce(function(s,a) { return s+a.actual_minutes; },0) }, invoice: lilMonthInvoiceState_(period,rows) };
  });
}
/** Called from every ordinary entry writer; clients cannot manufacture or detach a billing identity. */
function validateAssessmentEntryWrite_(entry, existing) {
  if (ASSESSMENT_INTERNAL_ENTRY_WRITE_) return;
  if (assessmentEntryIsBillable_(entry) || assessmentEntryIsBillable_(existing)) throw new Error('The automatic assessment billing entry is maintained by Assessments.');
  var oldParent = existing && existing.source_type === 'assessment' ? String(existing.source_id) : '';
  var parentId = entry.source_type === 'assessment' ? String(entry.source_id || entry.assessment_id || '') : '';
  if (oldParent && oldParent !== parentId) throw new Error('Assessment time cannot be detached or moved to another assessment.');
  if (!parentId && !entry.assessment_id) { entry.income_amount = ''; return; }
  var parent = assessmentFind_('assessments', parentId).item;
  if (!parent) throw new Error('Assessment not found.');
  if (!assessmentEligibleHourTypes_().some(function(t) { return String(t.id) === String(entry.hour_type_id); })) throw new Error('Assessment time requires a non-billable hour type.');
  if (entry.entry_type !== 'basic' || normalizePunches(entry.punches || entry.punches_json).length || entry.source_occurrence_key || entry.recurrence_id) throw new Error('Assessment time uses basic hours without punches or recurrence.');
  normalizeIsoDateStrict_(entry.date, 'Date worked', false);
  if (!isFinite(Number(entry.duration_minutes)) || Number(entry.duration_minutes) < 1) throw new Error('Enter hours that round to at least one minute.');
  entry.contract_id = parent.contract_id;
  entry.assessment_id = parentId;
  entry.income_amount = '';
}
function api_upsertAssessmentTimeEntry(payload) {
  return withScriptLock_('assessment time', function() {
    recoverAssessmentMutations_();
    var parent = assessmentFind_('assessments', payload.assessment_id).item;
    if (!parent) throw new Error('Assessment not found.');
    var existing = payload.id ? findTimesheetEntryById(payload.id) : null;
    if (payload.id && (!existing || existing.source_type !== 'assessment' || String(existing.source_id) !== String(parent.id) || assessmentEntryIsBillable_(existing))) throw new Error('This time entry does not belong to the selected assessment.');
    if (!payload.id && !payload.client_request_id) throw new Error('A stable time entry request ID is required.');
    var minutes = Math.round(Number(payload.hours) * 60);
    if (!isFinite(minutes) || minutes < 1) throw new Error('Enter positive hours that round to at least one minute.');
    var entry = { id: payload.id || '', assessment_id: parent.id, source_type: 'assessment', source_id: parent.id, source_occurrence_key: '', client_request_id: payload.client_request_id || (existing && existing.client_request_id), contract_id: parent.contract_id, hour_type_id: payload.hour_type_id, date: payload.date, duration_minutes: minutes, entry_type: 'basic', punches: [], round_interval: 1 };
    validateAssessmentEntryWrite_(entry, existing);
    var result = existing ? api_updateEntry(entry) : api_addEntry(entry);
    if (result.error === 'duplicate_entry' && result.entry && String(result.entry.source_id) === String(parent.id)) result.success = true;
    return result;
  });
}
function api_deleteAssessmentTimeEntry(payload) {
  return withScriptLock_('assessment time removal', function() {
    var entry = findTimesheetEntryById(payload.id);
    if (!entry) return { success: true };
    if (entry.source_type !== 'assessment' || String(entry.source_id) !== String(payload.assessment_id) || assessmentEntryIsBillable_(entry)) throw new Error('This time entry does not belong to the selected assessment.');
    return api_deleteEntry(entry.id);
  });
}
