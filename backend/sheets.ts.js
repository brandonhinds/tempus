/** Canonical, header-driven spreadsheet access. */

var TEMPUS_SCHEMA_VERSION = 3;

var TEMPUS_SHEET_SCHEMAS = {
  timesheet_entries: {
    headers: ['id', 'date', 'duration_minutes', 'contract_id', 'created_at', 'punches_json', 'entry_type', 'hour_type_id', 'recurrence_id', 'note', 'assessment_id', 'source_type', 'source_id', 'source_occurrence_key', 'client_request_id'],
    aliases: { project: 'contract_id', comments: 'note' },
    defaults: { punches_json: '[]', entry_type: 'basic', source_type: 'manual' },
    text: ['id', 'date', 'contract_id', 'created_at', 'punches_json', 'entry_type', 'hour_type_id', 'recurrence_id', 'note', 'assessment_id', 'source_type', 'source_id', 'source_occurrence_key', 'client_request_id']
  },
  user_settings: { headers: ['key', 'value', 'type'], text: ['key', 'type'] },
  feature_flags: { headers: ['feature', 'enabled', 'name', 'description'], text: ['feature', 'enabled', 'name', 'description'] },
  contracts: {
    headers: ['id', 'name', 'start_date', 'end_date', 'hourly_rate', 'total_hours', 'include_weekends', 'standard_hours_per_day', 'line_item_templates_json', 'color', 'archived', 'entry_mode', 'standard_day_json', 'created_at'],
    defaults: { total_hours: 0, include_weekends: 'FALSE', standard_hours_per_day: 7.5, archived: 'FALSE' },
    text: ['id', 'name', 'start_date', 'end_date', 'include_weekends', 'line_item_templates_json', 'color', 'archived', 'entry_mode', 'standard_day_json', 'created_at']
  },
  // Quick-action fields: each hour type can opt into the calendar right-click quick-fill bar with its
  // own one-click duration and icon. quick_fill_mode decides what the one click DOES: 'hours' fills the
  // quick_fill_hours, 'punch' starts the punch clock instead (no hours needed).
  hour_types: {
    headers: ['id', 'name', 'slug', 'color', 'contributes_to_income', 'requires_contract', 'is_default', 'use_for_rate_calculation', 'auto_populate_public_holidays', 'auto_populate_hours', 'entry_mode', 'created_at', 'display_order', 'quick_fill_enabled', 'quick_fill_hours', 'icon', 'quick_fill_mode'],
    defaults: { contributes_to_income: 'FALSE', requires_contract: 'FALSE', is_default: 'FALSE', use_for_rate_calculation: 'FALSE', auto_populate_public_holidays: 'FALSE', auto_populate_hours: 7.5, entry_mode: '', quick_fill_enabled: 'FALSE', quick_fill_mode: 'hours' },
    text: ['id', 'name', 'slug', 'color', 'contributes_to_income', 'requires_contract', 'is_default', 'use_for_rate_calculation', 'auto_populate_public_holidays', 'entry_mode', 'created_at', 'quick_fill_enabled', 'icon', 'quick_fill_mode']
  },
  deductions: {
    headers: ['id', 'name', 'category_id', 'company_expense', 'deduction_type', 'amount_type', 'amount_value', 'gst_inclusive', 'gst_amount', 'frequency', 'start_date', 'end_date', 'notes', 'active', 'created_at', 'updated_at', 'display_order'],
    text: ['id', 'name', 'category_id', 'company_expense', 'deduction_type', 'amount_type', 'gst_inclusive', 'frequency', 'start_date', 'end_date', 'notes', 'active', 'created_at', 'updated_at']
  },
  deduction_categories: { headers: ['id', 'name', 'color', 'created_at', 'updated_at'], text: ['id', 'name', 'color', 'created_at', 'updated_at'] },
  deduction_occurrence_exceptions: { headers: ['id', 'deduction_id', 'original_date', 'exception_type', 'new_date', 'new_amount', 'notes', 'created_at', 'updated_at'], text: ['id', 'deduction_id', 'original_date', 'exception_type', 'new_date', 'notes', 'created_at', 'updated_at'] },
  recurring_time_entries: { headers: ['id', 'label', 'recurrence_type', 'weekly_interval', 'weekly_weekdays_json', 'monthly_interval', 'monthly_mode', 'monthly_day', 'monthly_week', 'monthly_weekday', 'duration_minutes', 'hour_type_id', 'contract_id', 'start_date', 'end_date', 'generated_until', 'warning_message', 'created_at', 'updated_at', 'sessions_json'], text: ['id', 'label', 'recurrence_type', 'weekly_weekdays_json', 'monthly_mode', 'hour_type_id', 'contract_id', 'start_date', 'end_date', 'generated_until', 'warning_message', 'created_at', 'updated_at', 'sessions_json'] },
  bulk_time_entries: { headers: ['id', 'label', 'duration_minutes', 'hour_type_id', 'contract_id', 'start_date', 'end_date', 'include_weekends', 'skip_public_holidays', 'last_synced_at', 'last_synced_count', 'warning_message', 'distribution_mode', 'monthly_total_minutes', 'created_at', 'updated_at', 'sessions_json'], text: ['id', 'label', 'hour_type_id', 'contract_id', 'start_date', 'end_date', 'include_weekends', 'skip_public_holidays', 'last_synced_at', 'warning_message', 'distribution_mode', 'created_at', 'updated_at', 'sessions_json'] },
  invoices: {
    headers: ['id', 'kind', 'year', 'month', 'sequence', 'invoice_number', 'invoice_date', 'status', 'revision_of_invoice_id', 'generated_doc_id', 'generated_doc_url', 'generated_at', 'template_doc_id', 'template_doc_path', 'output_folder_id', 'output_folder_path', 'notes', 'issued_at', 'sent_at', 'voided_at', 'void_reason', 'created_at', 'updated_at'],
    defaults: { kind: 'standard', status: 'draft' },
    text: ['id', 'kind', 'invoice_number', 'invoice_date', 'status', 'revision_of_invoice_id', 'generated_doc_id', 'generated_doc_url', 'generated_at', 'template_doc_id', 'template_doc_path', 'output_folder_id', 'output_folder_path', 'notes', 'issued_at', 'sent_at', 'voided_at', 'void_reason', 'created_at', 'updated_at']
  },
  invoice_line_items: {
    headers: ['id', 'invoice_id', 'is_default', 'default_label', 'position', 'line_date', 'description', 'hours', 'hour_type_id', 'hour_type_name_snapshot', 'amount', 'amount_mode', 'contract_id', 'contract_name_snapshot', 'timesheet_entry_id', 'entry_snapshot_json', 'last_synced_at', 'source_default_id', 'gst_code', 'gst_rate', 'gst_amount', 'source_type', 'source_id', 'source_line_id', 'created_at', 'updated_at'],
    defaults: { gst_code: 'taxable', gst_rate: 0.1, source_type: 'manual' },
    text: ['id', 'invoice_id', 'is_default', 'default_label', 'line_date', 'description', 'hour_type_id', 'hour_type_name_snapshot', 'amount_mode', 'contract_id', 'contract_name_snapshot', 'timesheet_entry_id', 'entry_snapshot_json', 'last_synced_at', 'source_default_id', 'gst_code', 'source_type', 'source_id', 'source_line_id', 'created_at', 'updated_at']
  },
  invoice_payments: { headers: ['id', 'invoice_id', 'payment_date', 'amount', 'reference', 'notes', 'created_at', 'updated_at'], text: ['id', 'invoice_id', 'payment_date', 'reference', 'notes', 'created_at', 'updated_at'] },
  expense_rules: { headers: ['id', 'vendor', 'vendor_abn', 'description', 'category', 'amount', 'gst_code', 'gst_amount', 'business_use_percentage', 'claimable_gst_confirmed', 'frequency', 'start_date', 'end_date', 'active', 'notes', 'created_at', 'updated_at'], text: ['id', 'vendor', 'vendor_abn', 'description', 'category', 'gst_code', 'claimable_gst_confirmed', 'frequency', 'start_date', 'end_date', 'active', 'notes', 'created_at', 'updated_at'] },
  expense_transactions: { headers: ['id', 'vendor', 'vendor_abn', 'description', 'category', 'purchase_date', 'supplier_invoice_date', 'amount', 'gst_code', 'gst_amount', 'business_use_percentage', 'claimable_gst_confirmed', 'gst_override_amount', 'status', 'reconciliation_state', 'source_rule_id', 'source_occurrence_key', 'attachments_json', 'notes', 'created_at', 'updated_at'], text: ['id', 'vendor', 'vendor_abn', 'description', 'category', 'purchase_date', 'supplier_invoice_date', 'gst_code', 'claimable_gst_confirmed', 'status', 'reconciliation_state', 'source_rule_id', 'source_occurrence_key', 'attachments_json', 'notes', 'created_at', 'updated_at'] },
  expense_payments: { headers: ['id', 'expense_transaction_id', 'payment_date', 'amount', 'reference', 'notes', 'created_at', 'updated_at'], text: ['id', 'expense_transaction_id', 'payment_date', 'reference', 'notes', 'created_at', 'updated_at'] },
  bas_submissions: { headers: ['id', 'financial_year', 'period_type', 'quarter', 'month', 'g1_total_sales', 'g1_includes_gst', 'field_1a_gst_on_sales', 'field_1b_gst_on_purchases', 't1_payg_income', 't2_instalment_rate', 'submitted', 'submitted_at', 'accounting_basis', 'source_hash', 'calculation_snapshot_json', 'submission_state', 'created_at', 'updated_at'], defaults: { accounting_basis: 'cash', submission_state: 'draft' }, text: ['id', 'period_type', 'g1_includes_gst', 'submitted', 'submitted_at', 'accounting_basis', 'source_hash', 'calculation_snapshot_json', 'submission_state', 'created_at', 'updated_at'] },
  assessment_types: { headers: ['id', 'name', 'description', 'field_definitions_json', 'line_templates_json', 'active', 'created_at', 'updated_at'], text: ['id', 'name', 'description', 'field_definitions_json', 'line_templates_json', 'active', 'created_at', 'updated_at'] },
  assessments: { headers: ['id', 'assessment_type_id', 'contract_id', 'organisation', 'assessment_date', 'field_values_json', 'percentage_adjustment', 'status', 'invoice_id', 'notes', 'created_at', 'updated_at'], text: ['id', 'assessment_type_id', 'contract_id', 'organisation', 'assessment_date', 'field_values_json', 'status', 'invoice_id', 'notes', 'created_at', 'updated_at'] },
  public_holidays: { headers: ['id', 'date', 'name', 'region', 'source', 'active', 'created_at', 'updated_at', 'local_name', 'counties', 'types', 'year', 'fetched_at'], text: ['id', 'date', 'name', 'region', 'source', 'active', 'created_at', 'updated_at', 'local_name', 'counties', 'types', 'fetched_at'] },
  migration_archive: { headers: ['id', 'migration_id', 'source_sheet', 'source_row_json', 'reason', 'archived_at'], text: ['id', 'migration_id', 'source_sheet', 'source_row_json', 'reason', 'archived_at'] }
};

function getCanonicalSheetSchema_(name) {
  return TEMPUS_SHEET_SCHEMAS[name] || null;
}

function normalizeSheetHeaders_(values) {
  return (values || []).map(function(value) { return String(value == null ? '' : value).trim(); });
}

/**
 * Read the whole header row, not just the sheet's reported data region. An optional column nobody has
 * filled in yet (quick_fill_hours, icon) holds nothing but its header, which can sit outside
 * getLastColumn() — and a windowed read makes such a column look absent, so a schema fix-up appends a
 * second copy of it and every later read dies on "duplicate header". Trailing blanks past the data
 * region are dropped; blanks inside it are kept so validateSheetHeaders_ can still catch a populated
 * column that lost its header.
 */
function readSheetHeaderRow_(sheet) {
  var populatedWidth = sheet.getLastColumn();
  var width = Math.max(sheet.getMaxColumns(), populatedWidth);
  if (width < 1) return [];
  var headers = normalizeSheetHeaders_(sheet.getRange(1, 1, 1, width).getValues()[0]);
  while (headers.length > populatedWidth && !headers[headers.length - 1]) headers.pop();
  return headers;
}

function padSheetRowToWidth_(row, width) {
  var padded = (row || []).slice(0, width);
  while (padded.length < width) padded.push('');
  return padded;
}

function validateSheetHeaders_(name, headers, rows) {
  var seen = {};
  headers.forEach(function(header, index) {
    if (!header) {
      var containsData = (rows || []).some(function(row) { return row[index] !== '' && row[index] != null; });
      if (containsData) throw new Error('Schema error in "' + name + '": column ' + (index + 1) + ' has data but no header.');
      return;
    }
    if (seen[header]) throw new Error('Schema error in "' + name + '": duplicate header "' + header + '".');
    seen[header] = true;
  });
}

function sheetCellIsEmpty_(value) {
  return value === '' || value == null;
}

function sheetCellValuesEqual_(left, right) {
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return left === right || String(left) === String(right);
}

/**
 * Legacy releases could append the same optional column more than once. During
 * the explicit upgrade, collapse those columns only when doing so is lossless:
 * blank cells are ignored and equal values are kept once. If a row contains
 * two different values for the same header, stop and let the user resolve it
 * from the verified backup instead of choosing one silently.
 */
function coalesceDuplicateHeaders_(name, headers, rows) {
  var indexesByHeader = {};
  headers.forEach(function(header, index) {
    if (!header) return;
    if (!indexesByHeader[header]) indexesByHeader[header] = [];
    indexesByHeader[header].push(index);
  });
  var duplicateHeaders = Object.keys(indexesByHeader).filter(function(header) {
    return indexesByHeader[header].length > 1;
  });
  if (!duplicateHeaders.length) return { headers: headers, rows: rows, coalesced: [] };

  var mergedByHeader = {};
  duplicateHeaders.forEach(function(header) {
    var indexes = indexesByHeader[header];
    mergedByHeader[header] = rows.map(function(row, rowIndex) {
      var populated = indexes.map(function(index) { return row[index]; }).filter(function(value) {
        return !sheetCellIsEmpty_(value);
      });
      if (!populated.length) return '';
      var selected = populated[0];
      var conflict = populated.some(function(value) { return !sheetCellValuesEqual_(selected, value); });
      if (conflict) {
        throw new Error('Schema error in "' + name + '": duplicate header "' + header + '" has conflicting values in row ' + (rowIndex + 2) + '.');
      }
      return selected;
    });
  });

  var kept = {};
  var outputHeaders = [];
  var sourceIndexes = [];
  headers.forEach(function(header, index) {
    if (header && indexesByHeader[header].length > 1) {
      if (kept[header]) return;
      kept[header] = true;
    }
    outputHeaders.push(header);
    sourceIndexes.push(index);
  });
  var outputRows = rows.map(function(row, rowIndex) {
    return sourceIndexes.map(function(sourceIndex, outputIndex) {
      var header = outputHeaders[outputIndex];
      return mergedByHeader[header] ? mergedByHeader[header][rowIndex] : row[sourceIndex];
    });
  });
  return { headers: outputHeaders, rows: outputRows, coalesced: duplicateHeaders };
}

function ensureSheetCapacity_(sheet, rows, columns) {
  if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < columns) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
}

function applyCanonicalFormats_(sheet, schema, headers) {
  if (!schema || !schema.text) return;
  schema.text.forEach(function(name) {
    var index = headers.indexOf(name);
    if (index !== -1) sheet.getRange(1, index + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
  });
}

function initialiseCanonicalSheet_(sheet, schema) {
  ensureSheetCapacity_(sheet, 1, schema.headers.length);
  sheet.getRange(1, 1, 1, schema.headers.length).setValues([schema.headers]);
  applyCanonicalFormats_(sheet, schema, schema.headers);
}

/**
 * Normal access never relabels populated columns. Missing canonical columns are appended by name;
 * structural remapping is reserved for the explicit, backed-up migration.
 */
function getOrCreateSheet(name) {
  assertMigrationsSettled_();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  var schema = getCanonicalSheetSchema_(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    if (schema) initialiseCanonicalSheet_(sheet, schema);
    return sheet;
  }
  if (!schema) return sheet;
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    initialiseCanonicalSheet_(sheet, schema);
    return sheet;
  }
  var values = sheet.getDataRange().getValues();
  var headers = readSheetHeaderRow_(sheet);
  validateSheetHeaders_(name, headers, values.slice(1));
  var missing = schema.headers.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missing.length) {
    ensureSheetCapacity_(sheet, Math.max(1, sheet.getLastRow()), headers.length + missing.length);
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    if (sheet.getLastRow() > 1) {
      var defaults = missing.map(function(header) { return schema.defaults && Object.prototype.hasOwnProperty.call(schema.defaults, header) ? schema.defaults[header] : ''; });
      var fill = [];
      for (var row = 1; row < sheet.getLastRow(); row++) fill.push(defaults.slice());
      sheet.getRange(2, headers.length + 1, fill.length, missing.length).setValues(fill);
    }
    headers = headers.concat(missing);
    // Formatting is a schema-write concern, not a read concern. Reapplying it
    // here unconditionally made every data API write across whole columns on
    // every request; on a production-sized timesheet that could make the
    // otherwise read-only entries sync time out during page load. Existing
    // canonical sheets were formatted by their migration, so only format when
    // this call has actually appended schema columns.
    applyCanonicalFormats_(sheet, schema, headers);
  }
  return sheet;
}

/** Rebuild a sheet by header name while preserving every named legacy column and cell. */
function canonicalizeSheet_(name) {
  var schema = getCanonicalSheetSchema_(name);
  if (!schema) throw new Error('No canonical schema is registered for "' + name + '".');
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) return { sheet: name, state: 'missing', rows: 0 };
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    initialiseCanonicalSheet_(sheet, schema);
    return { sheet: name, state: 'initialised', rows: 0 };
  }
  var values = sheet.getDataRange().getValues();
  var headers = readSheetHeaderRow_(sheet);
  var priorColumns = Math.max(headers.length, sheet.getLastColumn());
  var priorRows = Math.max(1, sheet.getLastRow());
  var rows = values.slice(1).map(function(row) { return padSheetRowToWidth_(row, headers.length); });
  var coalesced = coalesceDuplicateHeaders_(name, headers, rows);
  headers = coalesced.headers;
  rows = coalesced.rows;
  validateSheetHeaders_(name, headers, rows);
  Object.keys(schema.aliases || {}).forEach(function(alias) {
    var canonical = schema.aliases[alias];
    var aliasIndex = headers.indexOf(alias);
    if (aliasIndex === -1) return;
    if (headers.indexOf(canonical) !== -1) throw new Error('Schema error in "' + name + '": both legacy "' + alias + '" and canonical "' + canonical + '" exist.');
    headers[aliasIndex] = canonical;
  });
  validateSheetHeaders_(name, headers, rows);
  var extras = headers.filter(function(header) { return header && schema.headers.indexOf(header) === -1; });
  var outputHeaders = schema.headers.concat(extras);
  var indexByHeader = {};
  headers.forEach(function(header, index) { if (header) indexByHeader[header] = index; });
  var outputRows = rows.map(function(row) {
    return outputHeaders.map(function(header) {
      if (Object.prototype.hasOwnProperty.call(indexByHeader, header)) return row[indexByHeader[header]];
      return schema.defaults && Object.prototype.hasOwnProperty.call(schema.defaults, header) ? schema.defaults[header] : '';
    });
  });
  var clearRows = Math.max(priorRows, outputRows.length + 1);
  var clearColumns = Math.max(priorColumns, outputHeaders.length);
  ensureSheetCapacity_(sheet, clearRows, clearColumns);
  // Clear the previous used rectangle before the name-based rewrite so a discarded blank legacy column
  // cannot leave hidden values beyond the new header boundary. The rectangle is measured from the full
  // header row rather than the data region, because a duplicate column appended by an older release
  // holds nothing but its header and would otherwise survive the rewrite.
  sheet.getRange(1, 1, clearRows, clearColumns).clearContent();
  sheet.getRange(1, 1, 1, outputHeaders.length).setValues([outputHeaders]);
  if (outputRows.length) sheet.getRange(2, 1, outputRows.length, outputHeaders.length).setValues(outputRows);
  applyCanonicalFormats_(sheet, schema, outputHeaders);
  return { sheet: name, state: 'canonical', rows: outputRows.length, extra_headers: extras, coalesced_headers: coalesced.coalesced };
}

function rowObjectFromHeaders_(headers, row) {
  var result = {};
  headers.forEach(function(header, index) { if (header) result[header] = row[index]; });
  return result;
}

function rowValuesFromObject_(headers, value, existingRow) {
  return headers.map(function(header, index) {
    return Object.prototype.hasOwnProperty.call(value || {}, header) ? value[header] : (existingRow ? existingRow[index] : '');
  });
}

function applyDisplayOrderToSheet(name, orderIds) {
  if (!name) return [];
  var sheet = getOrCreateSheet(name);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  var headers = values[0];
  var idIndex = headers.indexOf('id');
  var orderIndex = headers.indexOf('display_order');
  if (idIndex === -1 || orderIndex === -1) return [];
  var normalizedOrder = Array.isArray(orderIds) ? orderIds : [];
  var map = {};
  var next = normalizedOrder.length + 1;
  normalizedOrder.forEach(function(id, index) { if (id || id === 0) map[String(id)] = index + 1; });
  for (var row = 1; row < values.length; row++) {
    var rowId = String(values[row][idIndex] || '');
    var desired = map[rowId] || next++;
    map[rowId] = desired;
    if (Number(values[row][orderIndex]) !== desired) sheet.getRange(row + 1, orderIndex + 1).setValue(desired);
  }
  return map;
}
