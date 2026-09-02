/** Explicit, backed-up and resumable upgrades. */
var MIGRATIONS_PROP_KEY = 'tempus_migrations_applied';
var MIGRATION_STATE_PROP_KEY = 'tempus_migration_state_v3';
var MIGRATION_BACKUP_PROP_KEY = 'tempus_migration_backup_v3';
var MIGRATION_CONTEXT = { active: false };
var __migrationsSettledMemo = false;

function listMigrations() {
  return [
    { id: '2026-07-clear-legacy-cache-properties', run: migration_clearLegacyCachePropertiesV3_ },
    { id: '2026-07-contract-column-swap', run: migration_repairContractColumnSwap },
    { id: '2026-08-canonical-header-schemas-v3', run: migrationCanonicalHeaderSchemas_ },
    { id: '2026-08-source-aware-timesheet-entries', run: migrationTimesheetSources_ },
    { id: '2026-08-region-aware-holiday-catalogue', run: migrationPublicHolidayCatalogue_ },
    { id: '2026-08-company-expense-ledger', run: migrationCompanyExpenses_ },
    { id: '2026-08-generic-assessments-unified-invoices', run: migrationAssessmentsAndInvoices_ },
    { id: '2026-08-canonical-quick-fill-columns', run: migrationCanonicalQuickFillColumns_ },
    { id: '2026-08-repair-assessment-entry-identity', run: migrationRepairAssessmentEntryIdentity_ },
    { id: '2026-08-reveal-migrated-expense-ledger', run: migrationRevealExpenseLedger_ },
    { id: '2026-08-usable-legacy-expenses', run: migrationUsableLegacyExpenses_ },
    { id: '2026-08-rebuild-missing-expense-rules', run: migrationRebuildMissingExpenseRules_ }
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

function migration_clearLegacyCachePropertiesV3_() {
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

/**
 * The hour_types quick-fill columns and the contracts columns used to be appended outside the canonical
 * schema by per-sheet fix-ups that tested for an existing column inside the getLastColumn() window. A
 * column holding only a header can fall outside that window, so those fix-ups could append a second
 * quick_fill_hours or icon column and leave every later read failing header validation. Both sheets are
 * now fully declared in TEMPUS_SHEET_SCHEMAS; this pass moves the columns into canonical order and
 * losslessly coalesces any duplicates an earlier release already wrote. It is a distinct migration id so
 * sheets that finished the previous upgrades still get the repair.
 */
function migrationCanonicalQuickFillColumns_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ['hour_types', 'contracts'].forEach(function(name) {
    if (spreadsheet.getSheetByName(name)) canonicalizeSheet_(name);
  });
}

/**
 * Assign source identity to legacy timesheet rows. This pass is NON-DESTRUCTIVE by contract: an earlier
 * release derived every non-manual row's occurrence key from its date and then DELETED whatever collided,
 * which silently destroyed assessment actual-hours tracking rows — legitimately many per assessment per
 * day — whenever they shared a date with the assessment's billable row or with each other. A collision
 * now means the derived key is wrong for that row, so the row loses its derived key (staying distinct and
 * identified by its own id) and is recorded for review. Nothing is ever removed.
 * `migrationRepairAssessmentEntryIdentity_` restores the rows the destructive version already deleted.
 */
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
  var derived = [];
  for (var row = 1; row < values.length; row++) {
    var record = rowObjectFromHeaders_(headers, values[row]);
    var sourceType = String(record.source_type || '').trim();
    var sourceId = String(record.source_id || '').trim();
    if (record.assessment_id) { sourceType = 'assessment'; sourceId = String(record.assessment_id); }
    else if (record.recurrence_id) { sourceType = bulkIds[String(record.recurrence_id)] ? 'bulk' : 'recurring'; sourceId = String(record.recurrence_id); }
    else if (String(record.entry_type || '').toLowerCase() === 'public_holiday') sourceType = 'public_holiday';
    else if (!sourceType) sourceType = 'manual';
    derived.push({ row: row, record: record, source_type: sourceType, source_id: sourceId });
  }
  var billableRows = migrationAssessmentBillableRows_(derived);
  var seenDerived = {};
  var collisions = [];
  derived.forEach(function(item) {
    var occurrence = '';
    if (item.source_type === 'assessment') {
      // Only the one billable row per assessment carries an identity; tracking rows carry none.
      occurrence = billableRows[item.row] ? migrationAssessmentBillableKey_() : '';
    } else if (item.source_type !== 'manual') {
      occurrence = String(item.record.source_occurrence_key || '').trim() || toIsoDate(item.record.date || '');
    }
    if (occurrence && item.source_id) {
      var key = [item.source_type, item.source_id, occurrence].join('|');
      if (seenDerived[key]) { occurrence = ''; collisions.push(item.row + 1); }
      else seenDerived[key] = true;
    }
    values[item.row][indexes.source_type] = item.source_type;
    values[item.row][indexes.source_id] = item.source_id;
    values[item.row][indexes.source_occurrence_key] = occurrence;
  });
  sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  collisions.forEach(function(rowNumber) {
    archiveMigrationRow_('2026-08-source-aware-timesheet-entries', sheet, rowNumber, 'derived_source_collision_retained');
  });
}

function migrationAssessmentBillableKey_() {
  return typeof ASSESSMENT_BILLABLE_OCCURRENCE_KEY === 'string' ? ASSESSMENT_BILLABLE_OCCURRENCE_KEY : 'billable';
}

/**
 * The legacy billable row is the one the old assessment sync maintained, which it located by
 * (assessment_id, default/income hour type). Every other assessment row is tracked actual hours. Where an
 * assessment has several rows on that hour type the earliest created row wins, matching the old sync's
 * first-match lookup. Returns a set of sheet row indexes.
 */
function migrationAssessmentBillableRows_(derived) {
  var billableHourTypeId = migrationBillableHourTypeId_();
  if (!billableHourTypeId) return {};
  var bestByAssessment = {};
  derived.forEach(function(item) {
    if (item.source_type !== 'assessment' || !item.source_id) return;
    if (String(item.record.hour_type_id || '') !== billableHourTypeId) return;
    var current = bestByAssessment[item.source_id];
    var created = String(item.record.created_at || '');
    if (!current || created < current.created) bestByAssessment[item.source_id] = { row: item.row, created: created };
  });
  var result = {};
  Object.keys(bestByAssessment).forEach(function(assessmentId) { result[bestByAssessment[assessmentId].row] = true; });
  return result;
}

function migrationBillableHourTypeId_() {
  try {
    var resolved = resolveDefaultHourTypeId();
    if (resolved) return String(resolved);
  } catch (error) { /* fall through to the sheet scan below */ }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('hour_types');
  if (!sheet || sheet.getLastRow() < 2) return '';
  var values = sheet.getDataRange().getValues();
  var headers = normalizeSheetHeaders_(values[0]);
  var idIndex = headers.indexOf('id');
  var incomeIndex = headers.indexOf('contributes_to_income');
  if (idIndex === -1 || incomeIndex === -1) return '';
  for (var row = 1; row < values.length; row++) {
    if (migrationBoolean_(values[row][incomeIndex])) return String(values[row][idIndex]);
  }
  return '';
}

/**
 * Repair for spreadsheets already upgraded by the destructive version of
 * `migrationTimesheetSources_`. Two jobs, both idempotent: restore the assessment tracking rows it
 * deleted from `migration_archive`, and re-key the surviving assessment rows so the billable row holds
 * the billable identity and tracking rows hold none. Without the re-key the survivors keep date-derived
 * keys, and the restored rows would collide with them all over again.
 */
function migrationRepairAssessmentEntryIdentity_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('timesheet_entries');
  if (!sheet) return;
  canonicalizeSheet_('timesheet_entries');
  var restored = migrationRestoreArchivedTimesheetRows_(sheet);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0];
  var occurrenceIndex = headers.indexOf('source_occurrence_key');
  var sourceTypeIndex = headers.indexOf('source_type');
  var sourceIdIndex = headers.indexOf('source_id');
  if (occurrenceIndex === -1 || sourceTypeIndex === -1 || sourceIdIndex === -1) return;
  var derived = [];
  for (var row = 1; row < values.length; row++) {
    var record = rowObjectFromHeaders_(headers, values[row]);
    if (String(record.source_type || '') !== 'assessment') continue;
    derived.push({ row: row, record: record, source_type: 'assessment', source_id: String(record.source_id || record.assessment_id || '') });
  }
  if (!derived.length) {
    if (restored) cacheClearPrefix(ENTRY_CACHE_PREFIX);
    return;
  }
  var billableRows = migrationAssessmentBillableRows_(derived);
  derived.forEach(function(item) {
    values[item.row][sourceIdIndex] = item.source_id;
    values[item.row][occurrenceIndex] = billableRows[item.row] ? migrationAssessmentBillableKey_() : '';
  });
  sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  cacheClearPrefix(ENTRY_CACHE_PREFIX);
}

/**
 * Put back the timesheet rows the destructive source-identity pass deleted. Rows are matched by id so a
 * re-run cannot duplicate anything, and restored rows are written through the canonical header order
 * rather than the archived column order.
 */
function migrationRestoreArchivedTimesheetRows_(sheet) {
  var archive = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('migration_archive');
  if (!archive || archive.getLastRow() < 2) return 0;
  var archiveValues = archive.getDataRange().getValues();
  var archiveHeaders = normalizeSheetHeaders_(archiveValues[0]);
  var migrationIndex = archiveHeaders.indexOf('migration_id');
  var sheetIndex = archiveHeaders.indexOf('source_sheet');
  var jsonIndex = archiveHeaders.indexOf('source_row_json');
  var reasonIndex = archiveHeaders.indexOf('reason');
  if (migrationIndex === -1 || sheetIndex === -1 || jsonIndex === -1 || reasonIndex === -1) return 0;

  var sheetValues = sheet.getDataRange().getValues();
  var headers = sheetValues.length ? sheetValues[0] : [];
  var idIndex = headers.indexOf('id');
  if (idIndex === -1) return 0;
  var existingIds = {};
  for (var row = 1; row < sheetValues.length; row++) {
    if (sheetValues[row][idIndex]) existingIds[String(sheetValues[row][idIndex])] = true;
  }

  var rowsToRestore = [];
  for (var index = 1; index < archiveValues.length; index++) {
    if (String(archiveValues[index][migrationIndex]) !== '2026-08-source-aware-timesheet-entries') continue;
    if (String(archiveValues[index][sheetIndex]) !== 'timesheet_entries') continue;
    if (String(archiveValues[index][reasonIndex]) !== 'duplicate_derived_source') continue;
    var record = assessmentJsonSafeMigration_(archiveValues[index][jsonIndex], null);
    if (!record || !record.id || existingIds[String(record.id)]) continue;
    existingIds[String(record.id)] = true;
    // Re-derive identity rather than trusting the archived key: the archived key is the date-derived one
    // that caused the deletion. `migrationRepairAssessmentEntryIdentity_` finalises assessment rows.
    if (String(record.source_type || '') === 'assessment' || record.assessment_id) {
      record.source_type = 'assessment';
      record.source_id = String(record.source_id || record.assessment_id || '');
      record.source_occurrence_key = '';
    }
    rowsToRestore.push(rowValuesFromObject_(headers, record));
  }
  if (!rowsToRestore.length) return 0;
  ensureSheetCapacity_(sheet, sheet.getLastRow() + rowsToRestore.length, headers.length);
  sheet.getRange(sheet.getLastRow() + 1, 1, rowsToRestore.length, headers.length).setValues(rowsToRestore);
  return rowsToRestore.length;
}

/**
 * Read-only recovery report for the rows the destructive source-identity pass deleted. Deliberately
 * touches no sheet through getOrCreateSheet, so it can be run BEFORE the repair upgrade to confirm the
 * archive still holds the deleted rows — if `recoverable` is short of `archived`, the shortfall is
 * already back in the sheet; if `archived` is 0 on a spreadsheet that lost rows, the archive was cleared
 * and the pre-upgrade backup is the only source.
 */
function api_getTimesheetRecoveryReport() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('timesheet_entries');
  var archive = spreadsheet.getSheetByName('migration_archive');
  var report = { success: true, entry_rows: 0, entry_minutes: 0, archived: 0, recoverable: 0, recoverable_minutes: 0, already_present: 0, rows: [] };
  var presentIds = {};
  if (sheet && sheet.getLastRow() > 1) {
    var values = sheet.getDataRange().getValues();
    var headers = normalizeSheetHeaders_(values[0]);
    var idIndex = headers.indexOf('id');
    var durationIndex = headers.indexOf('duration_minutes');
    for (var row = 1; row < values.length; row++) {
      if (idIndex === -1 || !values[row][idIndex]) continue;
      presentIds[String(values[row][idIndex])] = true;
      report.entry_rows++;
      report.entry_minutes += Number(values[row][durationIndex]) || 0;
    }
  }
  if (!archive || archive.getLastRow() < 2) return report;
  var archiveValues = archive.getDataRange().getValues();
  var archiveHeaders = normalizeSheetHeaders_(archiveValues[0]);
  var migrationIndex = archiveHeaders.indexOf('migration_id');
  var sheetIndex = archiveHeaders.indexOf('source_sheet');
  var jsonIndex = archiveHeaders.indexOf('source_row_json');
  var reasonIndex = archiveHeaders.indexOf('reason');
  if (migrationIndex === -1 || sheetIndex === -1 || jsonIndex === -1 || reasonIndex === -1) return report;
  for (var index = 1; index < archiveValues.length; index++) {
    if (String(archiveValues[index][migrationIndex]) !== '2026-08-source-aware-timesheet-entries') continue;
    if (String(archiveValues[index][sheetIndex]) !== 'timesheet_entries') continue;
    if (String(archiveValues[index][reasonIndex]) !== 'duplicate_derived_source') continue;
    var record = assessmentJsonSafeMigration_(archiveValues[index][jsonIndex], null);
    if (!record || !record.id) continue;
    report.archived++;
    if (presentIds[String(record.id)]) { report.already_present++; continue; }
    report.recoverable++;
    report.recoverable_minutes += Number(record.duration_minutes) || 0;
    report.rows.push({ id: record.id, date: record.date, duration_minutes: Number(record.duration_minutes) || 0, hour_type_id: record.hour_type_id, assessment_id: record.assessment_id });
  }
  return report;
}

/**
 * Read-only snapshot of the expense ledger and the migration state that produced it.
 *
 * Deliberately avoids getOrCreateSheet so it can be run BEFORE an upgrade, and creates nothing. Answers in
 * one call the questions that otherwise take a round-trip each: did the company-expense migration run, are
 * the rules missing or merely unlistable, is anything left to rebuild them from, and is the page even visible.
 */
function api_getExpenseLedgerDiagnostic() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  function count(name) {
    var sheet = spreadsheet.getSheetByName(name);
    return { exists: !!sheet, rows: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0 };
  }
  var report = {
    success: true,
    expense_rules: count('expense_rules'),
    expense_transactions: count('expense_transactions'),
    expense_payments: count('expense_payments'),
    deductions: count('deductions'),
    transactions_with_source_rule_id: 0,
    distinct_source_rule_ids: 0,
    archived_deductions: 0,
    archived_company_expense_deductions: 0,
    rules_rebuildable: 0,
    applied_migrations: [],
    enable_expenses: null,
    enable_company_tracking_features: null
  };

  var transactions = spreadsheet.getSheetByName('expense_transactions');
  if (transactions && transactions.getLastRow() > 1) {
    var values = transactions.getDataRange().getValues();
    var index = normalizeSheetHeaders_(values[0]).indexOf('source_rule_id');
    var seen = {};
    if (index !== -1) {
      for (var row = 1; row < values.length; row++) {
        var id = String(values[row][index] || '').trim();
        if (!id) continue;
        report.transactions_with_source_rule_id++;
        seen[id] = true;
      }
    }
    report.distinct_source_rule_ids = Object.keys(seen).length;
  }

  var archived = migrationArchivedDeductionsByRuleId_();
  var existingRules = migrationIdSet_('expense_rules');
  var rebuildable = {};
  Object.keys(archived).forEach(function(ruleId) {
    report.archived_deductions++;
    if (!migrationBoolean_(archived[ruleId].company_expense)) return;
    report.archived_company_expense_deductions++;
    if (!existingRules[ruleId]) rebuildable[ruleId] = true;
  });
  if (transactions && transactions.getLastRow() > 1) {
    var txValues = transactions.getDataRange().getValues();
    var txIndex = normalizeSheetHeaders_(txValues[0]).indexOf('source_rule_id');
    for (var txRow = 1; txIndex !== -1 && txRow < txValues.length; txRow++) {
      var txRuleId = String(txValues[txRow][txIndex] || '').trim();
      if (txRuleId && !existingRules[txRuleId]) rebuildable[txRuleId] = true;
    }
  }
  report.rules_rebuildable = Object.keys(rebuildable).length;

  try { report.applied_migrations = readAppliedMigrations(PropertiesService.getScriptProperties()); } catch (error) { report.applied_migrations = []; }
  var flags = spreadsheet.getSheetByName('feature_flags');
  if (flags && flags.getLastRow() > 1) {
    var flagValues = flags.getDataRange().getValues();
    var flagHeaders = normalizeSheetHeaders_(flagValues[0]);
    var featureIndex = flagHeaders.indexOf('feature');
    var enabledIndex = flagHeaders.indexOf('enabled');
    for (var flagRow = 1; featureIndex !== -1 && flagRow < flagValues.length; flagRow++) {
      var feature = String(flagValues[flagRow][featureIndex] || '').trim();
      if (feature === 'enable_expenses' || feature === 'enable_company_tracking_features') {
        report[feature] = parseBoolean(flagValues[flagRow][enabledIndex]);
      }
    }
  }
  return report;
}

/**
 * Editor helper. The Apps Script editor's execution log shows Logger output, not a function's return
 * value, so running api_getExpenseLedgerDiagnostic directly prints nothing. Run THIS one and read the
 * Execution log instead.
 */
function logExpenseLedgerDiagnostic() {
  Logger.log(JSON.stringify(api_getExpenseLedgerDiagnostic(), null, 2));
}

/**
 * Write the expense-ledger diagnostic into a `_diagnostic` tab of the spreadsheet.
 *
 * The editor's log panel has proven an unreliable output channel, and a sheet is unambiguous: it persists,
 * it can be read without hunting through execution logs, and it can be copied straight out. Uses
 * SpreadsheetApp directly rather than getOrCreateSheet, because that asserts migrations have settled and
 * would refuse to run while an upgrade is pending — which is exactly when this is needed. Delete the tab
 * when you are done with it; nothing reads it.
 */
function writeExpenseLedgerDiagnostic() {
  var report = api_getExpenseLedgerDiagnostic();
  var rows = [['field', 'value']];
  Object.keys(report).forEach(function(key) {
    var value = report[key];
    if (Array.isArray(value)) {
      rows.push([key, value.length ? value.join(', ') : '(none)']);
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(function(inner) { rows.push([key + '.' + inner, String(value[inner])]); });
    } else {
      rows.push([key, value === null ? '(not set)' : String(value)]);
    }
  });
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName('_diagnostic');
  if (!sheet) sheet = spreadsheet.insertSheet('_diagnostic');
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow > 0 && lastColumn > 0) sheet.getRange(1, 1, lastRow, lastColumn).clearContent();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  Logger.log(JSON.stringify(report, null, 2));
  return 'Wrote ' + (rows.length - 1) + ' rows to the _diagnostic sheet.';
}

function migrationPublicHolidayCatalogue_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('public_holidays');
  if (!sheet) return;
  canonicalizeSheet_('public_holidays');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0];
  var idIndex = headers.indexOf('id');
  var dateIndex = headers.indexOf('date');
  var nameIndex = headers.indexOf('name');
  var regionIndex = headers.indexOf('region');
  var countiesIndex = headers.indexOf('counties');
  var yearIndex = headers.indexOf('year');
  var sourceIndex = headers.indexOf('source');
  var activeIndex = headers.indexOf('active');
  for (var row = 1; row < values.length; row++) {
    var date = toIsoDate(values[row][dateIndex] || '');
    var name = String(values[row][nameIndex] || 'Public holiday');
    if (yearIndex !== -1 && !values[row][yearIndex]) values[row][yearIndex] = Number(date.slice(0, 4)) || '';
    if (!values[row][idIndex]) values[row][idIndex] = 'holiday-' + date + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!values[row][regionIndex]) {
      var counties = assessmentJsonSafeMigration_(countiesIndex === -1 ? '' : values[row][countiesIndex], null);
      values[row][regionIndex] = JSON.stringify(Array.isArray(counties) && counties.length ? counties : ['AU']);
    }
    if (!values[row][sourceIndex]) values[row][sourceIndex] = 'legacy';
    if (!values[row][activeIndex]) values[row][activeIndex] = 'TRUE';
  }
  sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
}

function assessmentJsonSafeMigration_(value, fallback) {
  try { return JSON.parse(value || ''); } catch (error) { return fallback; }
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
  var sourceJson = JSON.stringify(rowObjectFromHeaders_(headers, sourceValues));
  var existing = archive.getDataRange().getValues();
  if (existing.length > 1) {
    var migrationIndex = existing[0].indexOf('migration_id');
    var sheetIndex = existing[0].indexOf('source_sheet');
    var jsonIndex = existing[0].indexOf('source_row_json');
    for (var row = 1; row < existing.length; row++) {
      if (String(existing[row][migrationIndex]) === String(migrationId) && String(existing[row][sheetIndex]) === sourceSheet.getName() && String(existing[row][jsonIndex]) === sourceJson) return;
    }
  }
  archive.appendRow([Utilities.getUuid(), migrationId, sourceSheet.getName(), sourceJson, reason, migrationIsoNow_()]);
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
  var exceptionSheet = spreadsheet.getSheetByName('deduction_occurrence_exceptions');
  var exceptionsByDeduction = {};
  if (exceptionSheet && exceptionSheet.getLastRow() > 1) {
    var exceptionValues = exceptionSheet.getDataRange().getValues();
    exceptionValues.slice(1).forEach(function(exceptionRow) {
      var exception = rowObjectFromHeaders_(exceptionValues[0], exceptionRow);
      var key = String(exception.deduction_id || '');
      if (!exceptionsByDeduction[key]) exceptionsByDeduction[key] = {};
      exceptionsByDeduction[key][toIsoDate(exception.original_date || '')] = exception;
    });
  }
  var rowsToRemove = [];
  for (var row = 1; row < deductionValues.length; row++) {
    var deduction = rowObjectFromHeaders_(deductionHeaders, deductionValues[row]);
    if (!migrationBoolean_(deduction.company_expense)) continue;
    var ruleId = 'legacy-rule-' + String(deduction.id || row);
    var note = String(deduction.notes || '');
    var proposedCutoff = '';
    if (!migrationBoolean_(deduction.active) && !deduction.end_date) {
      proposedCutoff = toIsoDate(deduction.updated_at || deduction.created_at || '');
      note += (note ? '\n' : '') + 'Migration review: inactive rule had no end date; proposed cutoff ' + proposedCutoff + '.';
    }
    if (!existingRules[ruleId]) {
      ruleSheet.appendRow(rowValuesFromObject_(ruleHeaders, {
        id: ruleId, vendor: deduction.name || '', vendor_abn: '', description: deduction.name || '', category: deduction.category_id || '', amount: Number(deduction.amount_value) || 0,
        gst_code: migrationBoolean_(deduction.gst_inclusive) ? 'taxable' : 'out_of_scope', gst_amount: Number(deduction.gst_amount) || 0, business_use_percentage: 1,
        claimable_gst_confirmed: 'FALSE', frequency: deduction.frequency || 'once', start_date: toIsoDate(deduction.start_date || ''), end_date: toIsoDate(deduction.end_date || proposedCutoff || ''),
        active: migrationBoolean_(deduction.active) ? 'TRUE' : 'FALSE', notes: note, created_at: deduction.created_at || migrationIsoNow_(), updated_at: deduction.updated_at || migrationIsoNow_()
      }));
      existingRules[ruleId] = true;
    }
    var start = toIsoDate(deduction.start_date || deduction.created_at || '');
    var cutoff = toIsoDate(deduction.end_date || proposedCutoff || migrationToday_());
    // The rule is the durable replacement for this deduction, but it can only generate occurrences from a
    // parseable start date. Without one it is inert, so nothing usable has replaced the source row.
    var ruleUsable = /^\d{4}-\d{2}-\d{2}$/.test(start);
    migrationOccurrenceDates_(start, cutoff, deduction.frequency || 'once').forEach(function(date) {
      var exception = (exceptionsByDeduction[String(deduction.id || '')] || {})[date];
      if (exception && String(exception.exception_type) === 'skip') return;
      var effectiveDate = exception && (String(exception.exception_type) === 'move' || String(exception.exception_type) === 'move_and_adjust') ? (toIsoDate(exception.new_date || '') || date) : date;
      var transactionId = 'legacy-expense-' + String(deduction.id || row) + '-' + date;
      if (existingTransactions[transactionId]) return;
      var amount = exception && (String(exception.exception_type) === 'adjust_amount' || String(exception.exception_type) === 'move_and_adjust') ? Number(exception.new_amount) || 0 : Number(deduction.amount_value) || 0;
      var gst = Number(deduction.gst_amount) || (migrationBoolean_(deduction.gst_inclusive) ? Math.round((amount / 11) * 100) / 100 : 0);
      transactionSheet.appendRow(rowValuesFromObject_(transactionHeaders, {
        id: transactionId, vendor: deduction.name || '', vendor_abn: '', description: deduction.name || '', category: deduction.category_id || '', purchase_date: effectiveDate,
        supplier_invoice_date: effectiveDate, amount: amount, gst_code: migrationBoolean_(deduction.gst_inclusive) ? 'taxable' : 'out_of_scope', gst_amount: gst,
        business_use_percentage: 1, claimable_gst_confirmed: 'FALSE', gst_override_amount: '', status: 'recorded', reconciliation_state: 'legacy_unreconciled',
        source_rule_id: ruleId, source_occurrence_key: date, attachments_json: '[]', notes: note + (exception ? '\nLegacy exception applied: ' + String(exception.exception_type) + '.' : ''), created_at: migrationIsoNow_(), updated_at: migrationIsoNow_()
      }));
      existingTransactions[transactionId] = true;
      migrationEnsureLegacyExpensePayment_(transactionId, effectiveDate, amount);
    });
    // Only relinquish the source row once something usable stands in its place.
    if (ruleUsable) rowsToRemove.push(row + 1);
    else migrationAnnotateDeductionRow_(deductions, deductionHeaders, row + 1, 'Migration review: no parseable start date, so no expense rule could be generated. Left in place rather than removed.');
  }
  rowsToRemove.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    archiveMigrationRow_('2026-08-company-expense-ledger', deductions, rowNumber, 'moved_to_expense_ledger');
    deductions.deleteRow(rowNumber);
  });
  // These rows now live on a page that is hidden unless the expense ledger is switched on.
  if (rowsToRemove.length) migrationEnableFeatureFlag_('enable_expenses');
}

/**
 * Turn a feature flag on from inside a migration.
 *
 * A migration that relocates data into a feature-gated page MUST also open the gate. Moving the company
 * expenses out of `deductions` into the expense ledger without enabling `enable_expenses` left every row
 * present in the sheet but unreachable in the UI, which is indistinguishable from data loss to the person
 * using it. Only ever enables: an explicit decision to switch a feature off is never overwritten.
 */
function migrationEnableFeatureFlag_(feature) {
  var sheet = getOrCreateSheet('feature_flags');
  var values = sheet.getDataRange().getValues();
  if (!values.length) return false;
  var headers = normalizeSheetHeaders_(values[0]);
  var featureIndex = headers.indexOf('feature');
  var enabledIndex = headers.indexOf('enabled');
  if (featureIndex === -1 || enabledIndex === -1) return false;
  for (var row = 1; row < values.length; row++) {
    if (String(values[row][featureIndex] || '').trim() !== String(feature)) continue;
    if (parseBoolean(values[row][enabledIndex])) return false;
    sheet.getRange(row + 1, enabledIndex + 1).setValue('TRUE');
    cacheClearPrefix(FEATURE_FLAG_CACHE_KEY);
    return true;
  }
  sheet.appendRow(rowValuesFromObject_(values[0], { feature: String(feature), enabled: 'TRUE' }));
  cacheClearPrefix(FEATURE_FLAG_CACHE_KEY);
  return true;
}

/**
 * Reveal the expense ledger on spreadsheets where the company-expense migration has already run and left
 * `enable_expenses` off. Enables the flag only when there is ledger data to show, so a spreadsheet that
 * never had company expenses is untouched.
 *
 * Deliberately does NOT enable `enable_company_tracking_features`, which the Expenses nav also requires:
 * that flag feeds the income calculation (it decides whether company income and expenses reduce the
 * employee package at all), so switching it on would move gross income, super and tax. Anyone who had
 * company expenses to migrate almost certainly has it on already.
 */
function migrationRevealExpenseLedger_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var hasLedgerData = ['expense_transactions', 'expense_rules'].some(function(name) {
    var sheet = spreadsheet.getSheetByName(name);
    return !!sheet && sheet.getLastRow() > 1;
  });
  if (!hasLedgerData) return;
  migrationEnableFeatureFlag_('enable_expenses');
}

/**
 * Record that a migrated expense occurrence was actually paid.
 *
 * The old `deductions` model had no notion of "incurred but unpaid" — every occurrence of a recurring
 * deduction was money that had already left the account on that date. Creating the transaction without a
 * payment therefore DISCARDS what the old row asserted, and leaves the ledger unusable on a cash basis:
 * `expenseActualForPeriod_` skips any transaction with no payment, so migrated costs read as zero.
 * Deterministic id keyed to the transaction, so a re-run cannot double-pay.
 */
function migrationEnsureLegacyExpensePayment_(transactionId, paymentDate, amount) {
  if (!transactionId || !/^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate)) || !(Number(amount) > 0)) return false;
  var sheet = getOrCreateSheet('expense_payments');
  var values = sheet.getDataRange().getValues();
  var headers = values.length ? values[0] : [];
  var idIndex = normalizeSheetHeaders_(headers).indexOf('id');
  var paymentId = 'legacy-payment-' + String(transactionId);
  for (var row = 1; row < values.length; row++) {
    if (idIndex !== -1 && String(values[row][idIndex]) === paymentId) return false;
  }
  sheet.appendRow(rowValuesFromObject_(headers, {
    id: paymentId, expense_transaction_id: String(transactionId), payment_date: String(paymentDate),
    amount: roundMoney_(amount), reference: 'Legacy deduction occurrence',
    notes: 'Created by migration: the legacy deduction recorded this amount as paid on this date.',
    created_at: migrationIsoNow_(), updated_at: migrationIsoNow_()
  }));
  return true;
}

/** Append a review note to a deduction row the migration deliberately left behind. */
function migrationAnnotateDeductionRow_(sheet, headers, rowNumber, message) {
  var notesIndex = normalizeSheetHeaders_(headers).indexOf('notes');
  if (notesIndex === -1) return;
  var cell = sheet.getRange(rowNumber, notesIndex + 1);
  var existing = String(cell.getValues()[0][0] || '');
  if (existing.indexOf(message) !== -1) return;
  cell.setValue(existing ? existing + '\n' + message : message);
}

/**
 * Make the expenses on an already-migrated spreadsheet usable.
 *
 * The first release of the company-expense migration left every row as status `legacy_unreconciled` with no
 * payment. That is a state nothing can consume: cash-basis reporting skips unpaid transactions entirely, so
 * the expenses existed in the sheet while every figure derived from them read zero. This normalises the
 * status to `recorded` and records the payment the legacy deduction already asserted. GST credits are left
 * unconfirmed on purpose — claiming those without a checked tax invoice is the user's call, not a migration's.
 */
function migrationUsableLegacyExpenses_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('expense_transactions');
  if (!sheet || sheet.getLastRow() < 2) return;
  canonicalizeSheet_('expense_transactions');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var statusIndex = headers.indexOf('status');
  var idIndex = headers.indexOf('id');
  var amountIndex = headers.indexOf('amount');
  var dateIndex = headers.indexOf('purchase_date');
  if (statusIndex === -1 || idIndex === -1 || amountIndex === -1 || dateIndex === -1) return;
  var touched = false;
  for (var row = 1; row < values.length; row++) {
    if (String(values[row][statusIndex]) !== 'legacy_unreconciled') continue;
    values[row][statusIndex] = 'recorded';
    touched = true;
    migrationEnsureLegacyExpensePayment_(values[row][idIndex], toIsoDate(values[row][dateIndex] || ''), values[row][amountIndex]);
  }
  if (touched) sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  if (typeof EXPENSE_CACHE_PREFIX !== 'undefined') cacheClearPrefix(EXPENSE_CACHE_PREFIX);
}

/**
 * Rebuild expense rules that exist only as a reference on their transactions.
 *
 * Every legacy transaction names its `source_rule_id`, so a missing rule is recoverable even though the row
 * itself was never written. Rebuilt faithfully from the archived deduction where one survives — that is what
 * carries the frequency and start/end dates a rule needs in order to generate. Where the archive is gone the
 * rule is reconstructed from its transactions and left INACTIVE on purpose: an inferred schedule must not
 * silently start generating future expenses nobody asked for.
 */
function migrationRebuildMissingExpenseRules_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var transactionSheet = spreadsheet.getSheetByName('expense_transactions');
  var transactionValues = transactionSheet && transactionSheet.getLastRow() > 1 ? transactionSheet.getDataRange().getValues() : [[]];
  var ruleIdIndex = normalizeSheetHeaders_(transactionValues[0] || []).indexOf('source_rule_id');
  if (ruleIdIndex === -1) transactionValues = [transactionValues[0] || []];

  var referenced = {};
  for (var row = 1; row < transactionValues.length; row++) {
    var ruleId = String(transactionValues[row][ruleIdIndex] || '').trim();
    if (!ruleId) continue;
    if (!referenced[ruleId]) referenced[ruleId] = [];
    referenced[ruleId].push(rowObjectFromHeaders_(transactionValues[0], transactionValues[row]));
  }
  // Every archived company-expense deduction is owed a rule whether or not a transaction still points at
  // one. Transactions written by an older release may carry no source_rule_id, so keying solely off them
  // would find nothing to rebuild.
  var archived = migrationArchivedDeductionsByRuleId_();
  var existingRules = migrationIdSet_('expense_rules');
  var candidates = {};
  Object.keys(referenced).forEach(function(id) { candidates[id] = true; });
  Object.keys(archived).forEach(function(id) { if (migrationBoolean_(archived[id].company_expense)) candidates[id] = true; });
  var missing = Object.keys(candidates).filter(function(id) { return !existingRules[id]; });
  if (!missing.length) return;
  var ruleSheet = getOrCreateSheet('expense_rules');
  var ruleHeaders = ruleSheet.getDataRange().getValues()[0];
  var note = 'Rebuilt by migration: the rule row was missing while its transactions referenced it.';
  missing.forEach(function(ruleId) {
    var occurrences = (referenced[ruleId] || []).slice().sort(function(a, b) { return String(a.purchase_date).localeCompare(String(b.purchase_date)); });
    var sample = occurrences[0] || {};
    var deduction = archived[ruleId];
    if (!deduction && !occurrences.length) return;
    var rule = deduction ? {
      id: ruleId, vendor: deduction.name || sample.vendor || '', vendor_abn: '', description: deduction.name || sample.description || '',
      category: deduction.category_id || sample.category || '', amount: Number(deduction.amount_value) || Number(sample.amount) || 0,
      gst_code: migrationBoolean_(deduction.gst_inclusive) ? 'taxable' : 'out_of_scope', gst_amount: Number(deduction.gst_amount) || 0,
      business_use_percentage: 1, claimable_gst_confirmed: 'FALSE', frequency: deduction.frequency || 'once',
      start_date: toIsoDate(deduction.start_date || sample.purchase_date || ''), end_date: toIsoDate(deduction.end_date || ''),
      active: migrationBoolean_(deduction.active) ? 'TRUE' : 'FALSE',
      notes: note + ' Restored from the archived deduction.',
      created_at: deduction.created_at || migrationIsoNow_(), updated_at: migrationIsoNow_()
    } : {
      id: ruleId, vendor: sample.vendor || '', vendor_abn: sample.vendor_abn || '', description: sample.description || '',
      category: sample.category || '', amount: Number(sample.amount) || 0, gst_code: sample.gst_code || 'out_of_scope',
      gst_amount: Number(sample.gst_amount) || 0, business_use_percentage: Number(sample.business_use_percentage) || 1,
      claimable_gst_confirmed: 'FALSE', frequency: occurrences.length > 1 ? 'monthly' : 'once',
      start_date: toIsoDate(sample.purchase_date || ''), end_date: '', active: 'FALSE',
      notes: note + ' The archived deduction was unavailable, so the schedule is inferred and the rule is left archived; activate it once you have confirmed the frequency.',
      created_at: migrationIsoNow_(), updated_at: migrationIsoNow_()
    };
    ruleSheet.appendRow(rowValuesFromObject_(ruleHeaders, rule));
  });
  if (typeof EXPENSE_CACHE_PREFIX !== 'undefined') cacheClearPrefix(EXPENSE_CACHE_PREFIX);
}

/** Archived company-expense deductions, keyed by the rule id the migration derived from them. */
function migrationArchivedDeductionsByRuleId_() {
  var archive = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('migration_archive');
  var result = {};
  if (!archive || archive.getLastRow() < 2) return result;
  var values = archive.getDataRange().getValues();
  var headers = normalizeSheetHeaders_(values[0]);
  var sheetIndex = headers.indexOf('source_sheet');
  var jsonIndex = headers.indexOf('source_row_json');
  if (sheetIndex === -1 || jsonIndex === -1) return result;
  for (var row = 1; row < values.length; row++) {
    if (String(values[row][sheetIndex]) !== 'deductions') continue;
    var record = assessmentJsonSafeMigration_(values[row][jsonIndex], null);
    if (!record || !record.id) continue;
    result['legacy-rule-' + String(record.id)] = record;
  }
  return result;
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
  var invoiceSheet = spreadsheet.getSheetByName('invoices');
  if (invoiceSheet) {
    canonicalizeSheet_('invoices');
    var invoiceValues = invoiceSheet.getDataRange().getValues();
    var invoiceHeaders = invoiceValues[0];
    var invoiceStatusIndex = invoiceHeaders.indexOf('status');
    var issuedAtIndex = invoiceHeaders.indexOf('issued_at');
    var generatedAtIndex = invoiceHeaders.indexOf('generated_at');
    var kindIndex = invoiceHeaders.indexOf('kind');
    for (var invoiceRow = 1; invoiceRow < invoiceValues.length; invoiceRow++) {
      if (!invoiceValues[invoiceRow][kindIndex]) invoiceValues[invoiceRow][kindIndex] = 'standard';
      if (String(invoiceValues[invoiceRow][invoiceStatusIndex]).toLowerCase() === 'generated') {
        invoiceValues[invoiceRow][invoiceStatusIndex] = 'issued';
        if (!invoiceValues[invoiceRow][issuedAtIndex]) invoiceValues[invoiceRow][issuedAtIndex] = invoiceValues[invoiceRow][generatedAtIndex] || '';
      }
    }
    if (invoiceValues.length > 1) invoiceSheet.getRange(2, 1, invoiceValues.length - 1, invoiceHeaders.length).setValues(invoiceValues.slice(1));
  }
  if (spreadsheet.getSheetByName('invoice_line_items')) canonicalizeSheet_('invoice_line_items');
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
      assessment.assessment_date = toIsoDate(assessment.assessment_date || assessment.interview_date || '');
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
