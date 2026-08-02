/** Explicit, backed-up and resumable upgrades. */
var MIGRATIONS_PROP_KEY = 'tempus_migrations_applied';
var MIGRATION_STATE_PROP_KEY = 'tempus_migration_state_v3';
var MIGRATION_BACKUP_PROP_KEY = 'tempus_migration_backup_v3';
var MIGRATION_CONTEXT = { active: false };
var __migrationsSettledMemo = false;

function listMigrations() {
  return [
    { id: '2026-07-clear-legacy-cache-properties', run: migration_clearLegacyCacheProperties },
    { id: '2026-07-contract-column-swap', run: migration_repairContractColumnSwap },
    { id: '2026-08-canonical-header-schemas-v3', run: migrationCanonicalHeaderSchemas_ },
    { id: '2026-08-source-aware-timesheet-entries', run: migrationTimesheetSources_ },
    { id: '2026-08-company-expense-ledger', run: migrationCompanyExpenses_ },
    { id: '2026-08-generic-assessments-unified-invoices', run: migrationAssessmentsAndInvoices_ }
  ];
}

function readAppliedMigrations(props) {
  var raw = props.getProperty(MIGRATIONS_PROP_KEY);
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function pendingMigrations(props) {
  var applied = readAppliedMigrations(props);
  return listMigrations().filter(function(migration) { return applied.indexOf(migration.id) === -1; });
}

function readMigrationState_(props) {
  try { return JSON.parse(props.getProperty(MIGRATION_STATE_PROP_KEY) || '{}'); } catch (error) { return {}; }
}

function writeMigrationState_(props, value) {
  props.setProperty(MIGRATION_STATE_PROP_KEY, JSON.stringify(value || {}));
}

function api_getMigrationStatus() {
  var props = PropertiesService.getScriptProperties();
  var pending = pendingMigrations(props);
  var state = readMigrationState_(props);
  var backup = null;
  try { backup = JSON.parse(props.getProperty(MIGRATION_BACKUP_PROP_KEY) || 'null'); } catch (error) { backup = null; }
  return {
    success: true,
    schema_version: TEMPUS_SCHEMA_VERSION,
    required: pending.length > 0,
    financial_pages_enabled: pending.length === 0,
    applied: readAppliedMigrations(props),
    pending: pending.map(function(item) { return item.id; }),
    state: state.state || (pending.length ? 'required' : 'complete'),
    current_migration: state.current_migration || '',
    completed_count: state.completed_count || 0,
    total_count: listMigrations().length,
    error: state.error || '',
    backup: backup
  };
}

function migrationsSettled_() {
  if (MIGRATION_CONTEXT.active || __migrationsSettledMemo) return true;
  try {
    if (!pendingMigrations(PropertiesService.getScriptProperties()).length) {
      __migrationsSettledMemo = true;
      return true;
    }
  } catch (error) {
    Logger.log('Unable to read migration state: ' + error);
  }
  return false;
}

function assertMigrationsSettled_() {
  if (migrationsSettled_()) return;
  throw new Error('upgrade_required: Tempus must finish its verified spreadsheet upgrade before data can be changed.');
}

/** Kept for one release for callers that used the old automatic hook. */
function runPendingMigrations() {
  return migrationsSettled_() ? 'idle' : 'required';
}

function api_runUpgrade() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { success: false, error: 'upgrade_busy', message: 'Another upgrade is already running.' };
  var props = PropertiesService.getScriptProperties();
  try {
    var pending = pendingMigrations(props);
    if (!pending.length) return api_getMigrationStatus();
    var backup = ensureVerifiedUpgradeBackup_(props);
    writeMigrationState_(props, { state: 'running', current_migration: '', completed_count: listMigrations().length - pending.length, backup_id: backup.id, error: '' });
    MIGRATION_CONTEXT.active = true;
    for (var index = 0; index < pending.length; index++) {
      var migration = pending[index];
      var progress = readMigrationState_(props);
      progress.state = 'running';
      progress.current_migration = migration.id;
      progress.error = '';
      writeMigrationState_(props, progress);
      migration.run();
      var applied = readAppliedMigrations(props);
      if (applied.indexOf(migration.id) === -1) applied.push(migration.id);
      props.setProperty(MIGRATIONS_PROP_KEY, JSON.stringify(applied));
      progress.completed_count = applied.length;
      writeMigrationState_(props, progress);
    }
    __migrationsSettledMemo = true;
    writeMigrationState_(props, { state: 'complete', current_migration: '', completed_count: listMigrations().length, error: '', completed_at: migrationIsoNow_() });
    return api_getMigrationStatus();
  } catch (error) {
    var failed = readMigrationState_(props);
    failed.state = 'error';
    failed.error = error && error.message ? error.message : String(error);
    failed.failed_at = migrationIsoNow_();
    writeMigrationState_(props, failed);
    return { success: false, error: 'upgrade_failed', message: failed.error, status: api_getMigrationStatus() };
  } finally {
    MIGRATION_CONTEXT.active = false;
    lock.releaseLock();
  }
}

function ensureVerifiedUpgradeBackup_(props) {
  var existing = null;
  try { existing = JSON.parse(props.getProperty(MIGRATION_BACKUP_PROP_KEY) || 'null'); } catch (error) { existing = null; }
  if (existing && existing.verified && existing.spreadsheet_id === SpreadsheetApp.getActiveSpreadsheet().getId()) return existing;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sourceFile = DriveApp.getFileById(spreadsheet.getId());
  var parents = sourceFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmmss');
  var backupFile = sourceFile.makeCopy('Tempus pre-upgrade backup ' + timestamp, parent);
  var backupSpreadsheet = SpreadsheetApp.openById(backupFile.getId());
  var sourceSheets = spreadsheet.getSheets();
  var backupSheets = backupSpreadsheet.getSheets();
  if (sourceSheets.length !== backupSheets.length) throw new Error('Backup verification failed: sheet count differs.');
  for (var index = 0; index < sourceSheets.length; index++) {
    var sourceSheet = sourceSheets[index];
    var backupSheet = backupSpreadsheet.getSheetByName(sourceSheet.getName());
    if (!backupSheet || backupSheet.getLastRow() !== sourceSheet.getLastRow() || backupSheet.getLastColumn() !== sourceSheet.getLastColumn()) {
      throw new Error('Backup verification failed for sheet "' + sourceSheet.getName() + '".');
    }
  }
  var record = { id: backupFile.getId(), url: backupFile.getUrl(), name: backupFile.getName(), spreadsheet_id: spreadsheet.getId(), verified: true, verified_at: migrationIsoNow_() };
  props.setProperty(MIGRATION_BACKUP_PROP_KEY, JSON.stringify(record));
  return record;
}

function migrationIsoNow_() {
  return Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function migration_clearLegacyCacheProperties() {
  var props = PropertiesService.getScriptProperties();
  props.getKeys().forEach(function(key) {
    if (key.indexOf('cache_') === 0 || key.indexOf('tempus_cache_') === 0) props.deleteProperty(key);
  });
}

function migration_repairContractColumnSwap() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('contracts');
  if (!sheet || sheet.getLastRow() < 2) return;
  var values = sheet.getDataRange().getValues();
  var headers = normalizeSheetHeaders_(values[0]);
  var standardIndex = headers.indexOf('standard_hours_per_day');
  var weekendIndex = headers.indexOf('include_weekends');
  if (standardIndex === -1 || weekendIndex === -1) return;
  for (var row = 1; row < values.length; row++) {
    var standard = values[row][standardIndex];
    var weekends = values[row][weekendIndex];
    var standardBoolean = standard === true || standard === false || /^(true|false)$/i.test(String(standard));
    var weekendsNumeric = weekends !== '' && weekends != null && isFinite(Number(weekends)) && !/^(true|false)$/i.test(String(weekends));
    if (!standardBoolean || !weekendsNumeric) continue;
    sheet.getRange(row + 1, standardIndex + 1).setValue(Number(weekends));
    sheet.getRange(row + 1, weekendIndex + 1).setValue(String(standard).toLowerCase() === 'true' || standard === true ? 'TRUE' : 'FALSE');
  }
}

function migrationCanonicalHeaderSchemas_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TEMPUS_SHEET_SCHEMAS).forEach(function(name) {
    if (spreadsheet.getSheetByName(name)) canonicalizeSheet_(name);
  });
}

function migrationTimesheetSources_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('timesheet_entries');
  if (!sheet) return;
  canonicalizeSheet_('timesheet_entries');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0];
  var indexes = {};
  headers.forEach(function(header, index) { indexes[header] = index; });
  var bulkIds = migrationIdSet_('bulk_time_entries');
  var seenDerived = {};
  var duplicates = [];
  for (var row = 1; row < values.length; row++) {
    var record = rowObjectFromHeaders_(headers, values[row]);
    var sourceType = String(record.source_type || '').trim();
    var sourceId = String(record.source_id || '').trim();
    if (record.assessment_id) { sourceType = 'assessment'; sourceId = String(record.assessment_id); }
    else if (record.recurrence_id) { sourceType = bulkIds[String(record.recurrence_id)] ? 'bulk' : 'recurring'; sourceId = String(record.recurrence_id); }
    else if (String(record.entry_type || '').toLowerCase() === 'public_holiday') sourceType = 'public_holiday';
    else if (!sourceType) sourceType = 'manual';
    var occurrence = String(record.source_occurrence_key || '').trim();
    if (!occurrence && sourceType !== 'manual') occurrence = String(record.date || '');
    values[row][indexes.source_type] = sourceType;
    values[row][indexes.source_id] = sourceId;
    values[row][indexes.source_occurrence_key] = occurrence;
    if (sourceType !== 'manual' && sourceId && occurrence) {
      var key = [sourceType, sourceId, occurrence].join('|');
      if (seenDerived[key]) duplicates.push(row + 1);
      else seenDerived[key] = true;
    }
  }
  sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  for (var index = duplicates.length - 1; index >= 0; index--) {
    archiveMigrationRow_('2026-08-source-aware-timesheet-entries', sheet, duplicates[index], 'duplicate_derived_source');
    sheet.deleteRow(duplicates[index]);
  }
}

function migrationIdSet_(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  var values = sheet.getDataRange().getValues();
  var idIndex = normalizeSheetHeaders_(values[0]).indexOf('id');
  if (idIndex === -1) return result;
  for (var row = 1; row < values.length; row++) if (values[row][idIndex]) result[String(values[row][idIndex])] = true;
  return result;
}

function archiveMigrationRow_(migrationId, sourceSheet, rowNumber, reason) {
  var archive = getOrCreateSheet('migration_archive');
  var sourceValues = sourceSheet.getRange(rowNumber, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  var headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
  archive.appendRow([Utilities.getUuid(), migrationId, sourceSheet.getName(), JSON.stringify(rowObjectFromHeaders_(headers, sourceValues)), reason, migrationIsoNow_()]);
}

function migrationCompanyExpenses_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var deductions = spreadsheet.getSheetByName('deductions');
  if (!deductions || deductions.getLastRow() < 2) return;
  canonicalizeSheet_('deductions');
  var ruleSheet = getOrCreateSheet('expense_rules');
  var transactionSheet = getOrCreateSheet('expense_transactions');
  var deductionValues = deductions.getDataRange().getValues();
  var deductionHeaders = deductionValues[0];
  var ruleValues = ruleSheet.getDataRange().getValues();
  var ruleHeaders = ruleValues[0];
  var transactionValues = transactionSheet.getDataRange().getValues();
  var transactionHeaders = transactionValues[0];
  var existingRules = migrationIdSet_('expense_rules');
  var existingTransactions = migrationIdSet_('expense_transactions');
  var rowsToRemove = [];
  for (var row = 1; row < deductionValues.length; row++) {
    var deduction = rowObjectFromHeaders_(deductionHeaders, deductionValues[row]);
    if (!migrationBoolean_(deduction.company_expense)) continue;
    var ruleId = 'legacy-rule-' + String(deduction.id || row);
    var note = String(deduction.notes || '');
    var proposedCutoff = '';
    if (!migrationBoolean_(deduction.active) && !deduction.end_date) {
      proposedCutoff = String(deduction.updated_at || deduction.created_at || '').slice(0, 10);
      note += (note ? '\n' : '') + 'Migration review: inactive rule had no end date; proposed cutoff ' + proposedCutoff + '.';
    }
    if (!existingRules[ruleId]) {
      ruleSheet.appendRow(rowValuesFromObject_(ruleHeaders, {
        id: ruleId, vendor: deduction.name || '', vendor_abn: '', description: deduction.name || '', category: deduction.category_id || '', amount: Number(deduction.amount_value) || 0,
        gst_code: migrationBoolean_(deduction.gst_inclusive) ? 'taxable' : 'out_of_scope', gst_amount: Number(deduction.gst_amount) || 0, business_use_percentage: 1,
        claimable_gst_confirmed: 'FALSE', frequency: deduction.frequency || 'once', start_date: deduction.start_date || '', end_date: deduction.end_date || proposedCutoff,
        active: migrationBoolean_(deduction.active) ? 'TRUE' : 'FALSE', notes: note, created_at: deduction.created_at || migrationIsoNow_(), updated_at: deduction.updated_at || migrationIsoNow_()
      }));
      existingRules[ruleId] = true;
    }
    var start = String(deduction.start_date || deduction.created_at || '').slice(0, 10);
    var cutoff = String(deduction.end_date || proposedCutoff || migrationToday_()).slice(0, 10);
    migrationOccurrenceDates_(start, cutoff, deduction.frequency || 'once').forEach(function(date) {
      var transactionId = 'legacy-expense-' + String(deduction.id || row) + '-' + date;
      if (existingTransactions[transactionId]) return;
      var amount = Number(deduction.amount_value) || 0;
      var gst = Number(deduction.gst_amount) || (migrationBoolean_(deduction.gst_inclusive) ? Math.round((amount / 11) * 100) / 100 : 0);
      transactionSheet.appendRow(rowValuesFromObject_(transactionHeaders, {
        id: transactionId, vendor: deduction.name || '', vendor_abn: '', description: deduction.name || '', category: deduction.category_id || '', purchase_date: date,
        supplier_invoice_date: date, amount: amount, gst_code: migrationBoolean_(deduction.gst_inclusive) ? 'taxable' : 'out_of_scope', gst_amount: gst,
        business_use_percentage: 1, claimable_gst_confirmed: 'FALSE', gst_override_amount: '', status: 'legacy_unreconciled', reconciliation_state: 'legacy_unreconciled',
        source_rule_id: ruleId, source_occurrence_key: date, attachments_json: '[]', notes: note, created_at: migrationIsoNow_(), updated_at: migrationIsoNow_()
      }));
      existingTransactions[transactionId] = true;
    });
    rowsToRemove.push(row + 1);
  }
  rowsToRemove.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    archiveMigrationRow_('2026-08-company-expense-ledger', deductions, rowNumber, 'moved_to_expense_ledger');
    deductions.deleteRow(rowNumber);
  });
}

function migrationOccurrenceDates_(start, end, frequency) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return [];
  var dates = [];
  var cursor = new Date(start + 'T12:00:00Z');
  var endDate = new Date(end + 'T12:00:00Z');
  var mode = String(frequency || 'once').toLowerCase();
  while (cursor <= endDate && dates.length < 5000) {
    dates.push(Utilities.formatDate(cursor, 'UTC', 'yyyy-MM-dd'));
    if (mode === 'once' || mode === 'one_off') break;
    if (mode === 'weekly') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else if (mode === 'fortnightly') cursor.setUTCDate(cursor.getUTCDate() + 14);
    else if (mode === 'quarterly') cursor = migrationAddMonths_(cursor, 3);
    else if (mode === 'annually' || mode === 'annual' || mode === 'yearly') cursor = migrationAddMonths_(cursor, 12);
    else cursor = migrationAddMonths_(cursor, 1);
  }
  return dates;
}

function migrationAddMonths_(date, count) {
  var day = date.getUTCDate();
  var result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1, 12));
  var lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0, 12)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function migrationToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function migrationBoolean_(value) { return value === true || /^(true|1|yes|y)$/i.test(String(value == null ? '' : value).trim()); }

function migrationAssessmentsAndInvoices_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var typeSheet = spreadsheet.getSheetByName('assessment_types');
  if (typeSheet) {
    canonicalizeSheet_('assessment_types');
    var typeValues = typeSheet.getDataRange().getValues();
    var typeHeaders = typeValues[0];
    for (var typeRow = 1; typeRow < typeValues.length; typeRow++) {
      var type = rowObjectFromHeaders_(typeHeaders, typeValues[typeRow]);
      if (!type.field_definitions_json) type.field_definitions_json = JSON.stringify([
        { key: 'subject_name', label: 'Subject name', input_type: 'text', required: true },
        { key: 'subject_date_of_birth', label: 'Date of birth', input_type: 'date', required: false }
      ]);
      if (!type.line_templates_json && type.default_lines_json) {
        var legacyLines = [];
        try { legacyLines = JSON.parse(type.default_lines_json || '[]'); } catch (error) { legacyLines = []; }
        type.line_templates_json = JSON.stringify(legacyLines.map(function(line, index) {
          return { id: String(type.id) + '-line-' + (index + 1), template: String(line.template || '').replace(/\{name\}/g, '{subject_name}').replace(/\{dob\}/g, '{subject_date_of_birth}'), multiplier: Number(line.multiplier) || 1, display_order: index + 1, percentage_adjustment: 0 };
        }));
      }
      if (!type.active) type.active = 'TRUE';
      typeSheet.getRange(typeRow + 1, 1, 1, typeHeaders.length).setValues([rowValuesFromObject_(typeHeaders, type, typeValues[typeRow])]);
    }
  }
  var assessmentSheet = spreadsheet.getSheetByName('assessments');
  if (assessmentSheet) {
    canonicalizeSheet_('assessments');
    var assessmentValues = assessmentSheet.getDataRange().getValues();
    var assessmentHeaders = assessmentValues[0];
    for (var assessmentRow = 1; assessmentRow < assessmentValues.length; assessmentRow++) {
      var assessment = rowObjectFromHeaders_(assessmentHeaders, assessmentValues[assessmentRow]);
      if (!assessment.assessment_date) assessment.assessment_date = assessment.interview_date || '';
      if (!assessment.field_values_json) assessment.field_values_json = JSON.stringify({ subject_name: assessment.interviewee_name || '', subject_date_of_birth: assessment.interviewee_dob || '' });
      if (!assessment.status) assessment.status = 'draft';
      assessmentSheet.getRange(assessmentRow + 1, 1, 1, assessmentHeaders.length).setValues([rowValuesFromObject_(assessmentHeaders, assessment, assessmentValues[assessmentRow])]);
    }
  }
  migrationLegacyAssessmentInvoices_();
}

function migrationLegacyAssessmentInvoices_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var legacySheet = spreadsheet.getSheetByName('assessment_invoices');
  if (!legacySheet || legacySheet.getLastRow() < 2) return;
  var invoiceSheet = getOrCreateSheet('invoices');
  var lineSheet = getOrCreateSheet('invoice_line_items');
  var assessmentSheet = spreadsheet.getSheetByName('assessments');
  var legacyValues = legacySheet.getDataRange().getValues();
  var legacyHeaders = normalizeSheetHeaders_(legacyValues[0]);
  validateSheetHeaders_('assessment_invoices', legacyHeaders, legacyValues.slice(1));
  var invoiceHeaders = invoiceSheet.getDataRange().getValues()[0];
  var lineHeaders = lineSheet.getDataRange().getValues()[0];
  var existingInvoices = migrationIdSet_('invoices');
  var assessments = [];
  if (assessmentSheet && assessmentSheet.getLastRow() > 1) {
    var assessmentValues = assessmentSheet.getDataRange().getValues();
    assessments = assessmentValues.slice(1).map(function(row) { return rowObjectFromHeaders_(assessmentValues[0], row); });
  }
  for (var row = 1; row < legacyValues.length; row++) {
    var legacy = rowObjectFromHeaders_(legacyHeaders, legacyValues[row]);
    var invoiceId = String(legacy.id || 'legacy-assessment-invoice-' + row);
    if (!existingInvoices[invoiceId]) {
      invoiceSheet.appendRow(rowValuesFromObject_(invoiceHeaders, {
        id: invoiceId, kind: 'assessment', year: legacy.year || '', month: legacy.month || '', sequence: '', invoice_number: legacy.invoice_number || '', invoice_date: legacy.invoice_date || '',
        status: migrationBoolean_(legacy.locked) || String(legacy.status).toLowerCase() === 'generated' ? 'issued' : 'draft', generated_doc_id: legacy.generated_doc_id || '',
        generated_doc_url: legacy.generated_doc_url || '', generated_at: legacy.generated_at || '', template_doc_id: legacy.template_doc_id || '', output_folder_id: legacy.output_folder_id || '',
        notes: legacy.notes || '', issued_at: legacy.generated_at || '', sent_at: legacy.sent_at || '', created_at: legacy.created_at || migrationIsoNow_(), updated_at: legacy.updated_at || migrationIsoNow_()
      }));
      existingInvoices[invoiceId] = true;
    }
    assessments.filter(function(assessment) {
      var date = String(assessment.assessment_date || assessment.interview_date || '');
      return Number(date.slice(0, 4)) === Number(legacy.year) && Number(date.slice(5, 7)) === Number(legacy.month) && (!legacy.contract_id || String(assessment.contract_id) === String(legacy.contract_id));
    }).forEach(function(assessment, index) {
      if (assessment.invoice_id && String(assessment.invoice_id) !== invoiceId) return;
      assessment.invoice_id = invoiceId;
      assessment.status = 'invoiced';
      if (assessmentSheet) {
        var assessmentValues = assessmentSheet.getDataRange().getValues();
        var idIndex = assessmentValues[0].indexOf('id');
        for (var assessmentRow = 1; assessmentRow < assessmentValues.length; assessmentRow++) {
          if (String(assessmentValues[assessmentRow][idIndex]) === String(assessment.id)) assessmentSheet.getRange(assessmentRow + 1, 1, 1, assessmentValues[0].length).setValues([rowValuesFromObject_(assessmentValues[0], assessment, assessmentValues[assessmentRow])]);
        }
      }
      var lineId = 'assessment-line-' + invoiceId + '-' + assessment.id;
      if (!migrationIdSet_('invoice_line_items')[lineId]) lineSheet.appendRow(rowValuesFromObject_(lineHeaders, { id: lineId, invoice_id: invoiceId, is_default: 'FALSE', position: index + 1, line_date: assessment.assessment_date || assessment.interview_date || '', description: 'Assessment', hours: 0, amount: 0, amount_mode: 'fixed', contract_id: assessment.contract_id || '', source_type: 'assessment', source_id: assessment.id, source_line_id: 'legacy', gst_code: 'taxable', gst_rate: 0.1, gst_amount: 0, created_at: migrationIsoNow_(), updated_at: migrationIsoNow_() }));
    });
    archiveMigrationRow_('2026-08-generic-assessments-unified-invoices', legacySheet, row + 1, 'migrated_to_invoice_ledger');
  }
}
