var CONTRACT_CACHE_PREFIX = 'contracts_v2_';

// Optional free-text contract fields consumed by the client timesheet print variant. Every one of them may
// be blank — the printout simply omits the line. `max` caps a stray paste so it can't bloat the sheet;
// only the declaration statement keeps its line breaks (the others are single-line identifiers).
var CONTRACT_TEXT_FIELDS = {
  specified_personnel: { max: 200, multiline: false },
  work_order_number: { max: 100, multiline: false },
  contract_reference: { max: 100, multiline: false },
  timesheet_statement: { max: 2000, multiline: true }
};

function normalizeContractText_(value, maxLength, allowMultiline) {
  if (value == null) return '';
  var text = String(value);
  // Collapse runs of spaces/tabs either way; newlines survive only where they carry meaning.
  text = allowMultiline ? text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ') : text.replace(/\s+/g, ' ');
  text = text.trim();
  var cap = Number(maxLength) > 0 ? Number(maxLength) : 200;
  return text.length > cap ? text.slice(0, cap) : text;
}

function normalizeHourlyRate(value) {
  if (value === null || value === undefined || value === '') return 0;
  var num = Number(value);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

function normalizeContractTotalHours(value) {
  if (value === null || value === undefined || value === '') return 0;
  var num = Number(value);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}

function contractParseBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === null || value === undefined || value === '') return false;
  var str = String(value).trim().toLowerCase();
  if (str === 'true' || str === '1' || str === 'yes') return true;
  if (str === 'false' || str === '0' || str === 'no') return false;
  return false;
}

// Identity colours for contracts. Mirrors the hour-type swatch palette (minus the neutral grey)
// so a contract reads as its own engagement at a glance in the calendar filter.
var CONTRACT_COLOR_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

function isValidHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function normalizeContractColor(value) {
  return isValidHexColor(value) ? value.trim().toLowerCase() : '';
}

// Stable colour from a contract's id (or name as a fallback) so legacy rows always render
// the same swatch even before the user picks one.
function contractColorFromSeed(seed) {
  var str = String(seed || '');
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return CONTRACT_COLOR_PALETTE[hash % CONTRACT_COLOR_PALETTE.length];
}

function contractRandomColor() {
  return CONTRACT_COLOR_PALETTE[Math.floor(Math.random() * CONTRACT_COLOR_PALETTE.length)];
}

// Per-contract entry mode: '' = inherit the global default (settings.default_entry_mode), else an explicit
// 'simple' (log total hours) or 'detailed' (log sessions). Anything unrecognised → inherit.
function normalizeContractEntryMode(value) {
  var v = String(value == null ? '' : value).trim().toLowerCase();
  return (v === 'simple' || v === 'detailed') ? v : '';
}

function normalizeContractObject(contract) {
  if (!contract) return contract;
  var standardHoursRaw = contract.standard_hours_per_day != null ? contract.standard_hours_per_day : contract.standardHoursPerDay;
  var standardHoursValue = standardHoursRaw != null ? Number(standardHoursRaw) : 7.5;
  var standardHours = (!isNaN(standardHoursValue) && standardHoursValue > 0) ? Math.round(standardHoursValue * 10) / 10 : 7.5;
  var normalized = {
    id: contract.id || '',
    name: contract.name ? String(contract.name).trim() : '',
    start_date: toIsoDate(contract.start_date || contract.startDate),
    end_date: toIsoDate(contract.end_date || contract.endDate),
    hourly_rate: normalizeHourlyRate(contract.hourly_rate || contract.hourlyRate),
    total_hours: normalizeContractTotalHours(contract.total_hours || contract.totalHours),
    standard_hours_per_day: standardHours,
    include_weekends: contractParseBoolean(contract.include_weekends != null ? contract.include_weekends : contract.includeWeekends),
    line_item_templates_json: contract.line_item_templates_json || '',
    color: normalizeContractColor(contract.color),
    archived: contractParseBoolean(contract.archived),
    entry_mode: normalizeContractEntryMode(contract.entry_mode != null ? contract.entry_mode : contract.entryMode),
    standard_day_json: contract.standard_day_json || '',
    created_at: toIsoDateTime(contract.created_at)
  };
  if (!normalized.end_date || normalized.end_date === 'Invalid Date') normalized.end_date = '';
  Object.keys(CONTRACT_TEXT_FIELDS).forEach(function(field) {
    var spec = CONTRACT_TEXT_FIELDS[field];
    normalized[field] = normalizeContractText_(contract[field], spec.max, spec.multiline);
  });
  return normalized;
}

function validateContractDates(contract) {
  if (!contract.start_date) {
    throw new Error('Contract start date is required.');
  }
  if (contract.end_date && contract.end_date < contract.start_date) {
    throw new Error('End date must be on or after the start date.');
  }
}

// Build a sheet row for a contract. When `headers` is supplied, the row is assembled to match the
// sheet's ACTUAL column order (keyed by header name) rather than a hard-coded position list — so a
// future column reorder or schema drift can never write a value into the wrong column and corrupt /
// "lose" a contract. Unknown columns are preserved from `existingRow` (on update) so nothing is wiped.
// The positional fallback is kept only for any caller that doesn't pass headers.
function buildContractRow(contract, createdAt, headers, existingRow) {
  var normalized = normalizeContractObject(contract || {});
  var byName = {
    id: normalized.id,
    name: normalized.name,
    start_date: normalized.start_date,
    end_date: normalized.end_date,
    hourly_rate: normalized.hourly_rate,
    total_hours: normalized.total_hours,
    include_weekends: normalized.include_weekends ? 'TRUE' : 'FALSE',
    standard_hours_per_day: normalized.standard_hours_per_day,
    line_item_templates_json: normalized.line_item_templates_json || '',
    color: normalized.color || '',
    archived: normalized.archived ? 'TRUE' : 'FALSE',
    entry_mode: normalized.entry_mode || '',
    standard_day_json: normalized.standard_day_json || '',
    created_at: createdAt || normalized.created_at || toIsoDateTime(new Date())
  };
  Object.keys(CONTRACT_TEXT_FIELDS).forEach(function(field) { byName[field] = normalized[field] || ''; });
  if (headers && headers.length) {
    return headers.map(function(header, idx) {
      if (Object.prototype.hasOwnProperty.call(byName, header)) return byName[header];
      return existingRow ? existingRow[idx] : '';
    });
  }
  return [
    byName.id,
    byName.name,
    byName.start_date,
    byName.end_date,
    byName.hourly_rate,
    byName.total_hours,
    byName.include_weekends,
    byName.standard_hours_per_day,
    byName.line_item_templates_json,
    byName.color,
    byName.archived,
    byName.entry_mode,
    byName.standard_day_json,
    byName.created_at,
    byName.specified_personnel,
    byName.work_order_number,
    byName.contract_reference,
    byName.timesheet_statement
  ];
}

// Every contracts column is declared in TEMPUS_SHEET_SCHEMAS and added by name by getOrCreateSheet.
// The fix-up that used to run here inserted the same columns from the getLastColumn() window, which is
// the pattern that duplicated hour_types columns; rows missing a colour already fall back to
// contractColorFromSeed on read, so nothing needed a positional back-fill.
function getContractsSheet() {
  return getOrCreateSheet('contracts');
}

function contractHasEntries(contractId) {
  if (!contractId) return false;
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return false;
  var headers = values[0];
  var colIndex = headers.indexOf('contract_id');
  if (colIndex === -1) return false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colIndex] || '') === String(contractId)) {
      return true;
    }
  }
  return false;
}

function api_getContracts() {
  var cacheKey = CONTRACT_CACHE_PREFIX + 'all';
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var sh = getContractsSheet();
  var values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var headers = values[0];
  var rows = values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(header, idx) { obj[header] = row[idx]; });
    var normalized = normalizeContractObject(obj);
    // Belt-and-suspenders: any row that slipped through without a colour gets a stable one.
    if (!normalized.color) normalized.color = contractColorFromSeed(normalized.id || normalized.name);
    return normalized;
  });
  rows.sort(function(a, b) {
    if (a.start_date === b.start_date) return a.name.localeCompare(b.name);
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return a.start_date.localeCompare(b.start_date);
  });
  cacheSet(cacheKey, rows);
  return rows;
}

function api_addContract(contract) {
  return withScriptLock_('contract creation', function() { return addContractUnlocked_(contract); });
}

function addContractUnlocked_(contract) {
  var sh = getContractsSheet();
  var now = new Date();
  var normalized = normalizeContractObject(contract || {});
  if (!normalized.name) throw new Error('Contract name is required.');
  validateContractDates(normalized);
  normalized.id = Utilities.getUuid();
  // If the user didn't pick a colour, give the contract a random one from the palette.
  if (!normalized.color) normalized.color = contractRandomColor();
  normalized.created_at = toIsoDateTime(now);
  // Align the new row to the sheet's real column order (header-keyed), never a fixed position list.
  var addHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = buildContractRow(normalized, normalized.created_at, addHeaders);
  sh.appendRow(row);
  cacheClearPrefix(CONTRACT_CACHE_PREFIX);
  return { success: true, contract: normalized };
}

function api_updateContract(contract) {
  return withScriptLock_('contract update', function() { return updateContractUnlocked_(contract); });
}

function updateContractUnlocked_(contract) {
  if (!contract || !contract.id) throw new Error('Contract id is required.');
  var sh = getContractsSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : [];
  var createdIdx = headers.indexOf('created_at');
  var archivedIdx = headers.indexOf('archived');
  var entryModeIdx = headers.indexOf('entry_mode');
  var standardDayIdx = headers.indexOf('standard_day_json');
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === contract.id) {
      var createdValue = createdIdx !== -1 ? values[i][createdIdx] : values[i][6];
      var normalized = normalizeContractObject(contract);
      normalized.id = contract.id;
      validateContractDates(normalized);
      normalized.created_at = toIsoDateTime(createdValue);
      // The edit form doesn't carry the archived flag — preserve whatever's on the row unless the
      // caller explicitly set it (archive/unarchive goes through api_setContractArchived instead).
      if (contract.archived == null && archivedIdx !== -1) {
        normalized.archived = contractParseBoolean(values[i][archivedIdx]);
      }
      // Same for entry_mode: partial updates (e.g. saving a line-item template) don't send it, so preserve
      // the row's existing override rather than silently resetting the contract to "inherit".
      if (contract.entry_mode == null && entryModeIdx !== -1) {
        normalized.entry_mode = normalizeContractEntryMode(values[i][entryModeIdx]);
      }
      // Same for the standard-day template: preserve the stored JSON when a partial update omits it.
      if (contract.standard_day_json == null && standardDayIdx !== -1) {
        normalized.standard_day_json = values[i][standardDayIdx] || '';
      }
      // Same again for the optional client-timesheet fields. Partial updates (saving a line-item template,
      // archiving) don't carry them, and blanking a work order number or declaration silently would be a
      // nasty surprise the next time the user printed a client timesheet.
      Object.keys(CONTRACT_TEXT_FIELDS).forEach(function(field) {
        if (contract[field] != null) return;
        var textIdx = headers.indexOf(field);
        if (textIdx === -1) return;
        var spec = CONTRACT_TEXT_FIELDS[field];
        normalized[field] = normalizeContractText_(values[i][textIdx], spec.max, spec.multiline);
      });
      // Header-keyed write aligned to the sheet's real columns, preserving any column we don't manage —
      // so a column reorder can never shift a value into the wrong field and corrupt the row.
      var row = buildContractRow(normalized, normalized.created_at, headers, values[i]);
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      cacheClearPrefix(CONTRACT_CACHE_PREFIX);
      return { success: true, contract: normalized };
    }
  }
  throw new Error('Contract not found');
}

function api_deleteContract(id) {
  return withScriptLock_('contract removal', function() { return deleteContractUnlocked_(id); });
}

function deleteContractUnlocked_(id) {
  if (!id) throw new Error('Contract id is required.');
  var references = contractReferenceSummary_(id);
  if (references.assessments || references.schedules || references.invoice_lines) return apiRecoverableFailure_('referenced_contract', 'This contract is referenced by assessments, schedules or invoice history and cannot be deleted.', references);
  if (contractHasEntries(id)) {
    throw new Error('Cannot delete a contract that has timesheet entries.');
  }
  var sh = getContractsSheet();
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sh.deleteRow(i + 1);
      cacheClearPrefix(CONTRACT_CACHE_PREFIX);
      return { success: true };
    }
  }
  throw new Error('Contract not found');
}

// Archive / unarchive: an archived contract keeps all its entries and history but is hidden from the
// time-entry contract pickers (you can't log new time against it). Reversible — the everyday way to
// retire a contract without destroying its record.
function api_setContractArchived(payload) {
  return withScriptLock_('contract archive', function() { return setContractArchivedUnlocked_(payload); });
}

function setContractArchivedUnlocked_(payload) {
  var id = payload && payload.id;
  var archived = !!(payload && payload.archived);
  if (!id) throw new Error('Contract id is required.');
  if (archived) {
    var references = contractReferenceSummary_(id);
    if (references.assessments || references.schedules || references.invoice_lines) return apiRecoverableFailure_('referenced_contract', 'This contract cannot be archived while assessments, schedules or invoice lines reference it.', references);
  }
  var sh = getContractsSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : [];
  var archivedIdx = headers.indexOf('archived');
  if (archivedIdx === -1) throw new Error('Contracts sheet is missing the archived column.');
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sh.getRange(i + 1, archivedIdx + 1).setValue(archived ? 'TRUE' : 'FALSE');
      cacheClearPrefix(CONTRACT_CACHE_PREFIX);
      return { success: true, id: id, archived: archived };
    }
  }
  throw new Error('Contract not found');
}

function contractReferenceSummary_(contractId) {
  var result = { assessments: 0, schedules: 0, invoice_lines: 0, locked_invoices: 0 };
  ['assessments', 'recurring_time_entries', 'bulk_time_entries', 'invoice_line_items'].forEach(function(name) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var values = sheet.getDataRange().getValues();
    var contractIndex = values[0].indexOf('contract_id');
    var invoiceIndex = values[0].indexOf('invoice_id');
    if (contractIndex === -1) return;
    for (var row = 1; row < values.length; row++) {
      if (String(values[row][contractIndex]) !== String(contractId)) continue;
      if (name === 'assessments') result.assessments++;
      else if (name === 'invoice_line_items') {
        result.invoice_lines++;
        var invoice = invoiceIndex === -1 ? null : findInvoiceById(String(values[row][invoiceIndex] || ''));
        if (invoice && invoice.status !== 'draft' && invoice.status !== 'void') result.locked_invoices++;
      } else result.schedules++;
    }
  });
  return result;
}

// Hard delete that also removes every timesheet entry logged against the contract. The destructive
// escape hatch (e.g. clearing out test data) — distinct from api_deleteContract, which refuses when
// entries exist. Returns the number of entries removed so the UI can confirm what happened.
function api_deleteContractWithEntries(id) {
  if (!id) throw new Error('Contract id is required.');
  var externalReferences = contractReferenceSummary_(id);
  if (externalReferences.assessments || externalReferences.schedules || externalReferences.invoice_lines) return apiRecoverableFailure_('referenced_contract', 'Timesheet entries can be removed, but this contract is still referenced elsewhere.', externalReferences);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Remove the entries first (bottom-up so row indices stay valid as we delete).
    var entriesSh = getOrCreateSheet('timesheet_entries');
    var entryValues = entriesSh.getDataRange().getValues();
    var deletedEntries = 0;
    if (entryValues.length > 1) {
      var entryHeaders = entryValues[0];
      var contractIdx = entryHeaders.indexOf('contract_id');
      if (contractIdx !== -1) {
        for (var r = entryValues.length - 1; r >= 1; r--) {
          if (String(entryValues[r][contractIdx] || '') === String(id)) {
            entriesSh.deleteRow(r + 1);
            deletedEntries++;
          }
        }
      }
    }
    if (deletedEntries > 0) cacheClearPrefix(ENTRY_CACHE_PREFIX);

    // Then remove the contract itself.
    var sh = getContractsSheet();
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sh.deleteRow(i + 1);
        cacheClearPrefix(CONTRACT_CACHE_PREFIX);
        return { success: true, deletedEntries: deletedEntries };
      }
    }
    throw new Error('Contract not found');
  } finally {
    lock.releaseLock();
  }
}
