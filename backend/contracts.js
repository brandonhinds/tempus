var CONTRACT_CACHE_PREFIX = 'contracts_v2_';

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
    byName.created_at
  ];
}

function ensureContractsSchema(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) {
    sh.getRange(1, 1, 1, 14).setValues([['id', 'name', 'start_date', 'end_date', 'hourly_rate', 'total_hours', 'include_weekends', 'standard_hours_per_day', 'line_item_templates_json', 'color', 'archived', 'entry_mode', 'standard_day_json', 'created_at']]);
    return;
  }
  var headerRange = sh.getRange(1, 1, 1, lastColumn);
  var headers = headerRange.getValues()[0];
  var hasHeaderContent = headers.some(function(value) { return String(value || '').trim() !== ''; });
  if (!hasHeaderContent) {
    sh.getRange(1, 1, 1, 14).setValues([['id', 'name', 'start_date', 'end_date', 'hourly_rate', 'total_hours', 'include_weekends', 'standard_hours_per_day', 'line_item_templates_json', 'color', 'archived', 'entry_mode', 'standard_day_json', 'created_at']]);
    return;
  }
  if (headers.indexOf('total_hours') === -1) {
    var createdIdx = headers.indexOf('created_at');
    var newColIndex;
    if (createdIdx !== -1) {
      newColIndex = createdIdx + 1;
      sh.insertColumnBefore(newColIndex);
    } else {
      sh.insertColumnAfter(lastColumn);
      newColIndex = sh.getLastColumn();
    }
    sh.getRange(1, newColIndex).setValue('total_hours');
    var rows = sh.getLastRow();
    if (rows > 1) {
      sh.getRange(2, newColIndex, rows - 1, 1).setValue(0);
    }
    headerRange = sh.getRange(1, 1, 1, sh.getLastColumn());
    headers = headerRange.getValues()[0];
  }
  if (headers.indexOf('standard_hours_per_day') === -1) {
    var createdAtIdx = headers.indexOf('created_at');
    var standardHoursColIndex;
    if (createdAtIdx !== -1) {
      standardHoursColIndex = createdAtIdx + 1;
      sh.insertColumnBefore(standardHoursColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      standardHoursColIndex = sh.getLastColumn();
    }
    sh.getRange(1, standardHoursColIndex).setValue('standard_hours_per_day');
    var existingRows = sh.getLastRow();
    if (existingRows > 1) {
      sh.getRange(2, standardHoursColIndex, existingRows - 1, 1).setValue(7.5);
    }
    headerRange = sh.getRange(1, 1, 1, sh.getLastColumn());
    headers = headerRange.getValues()[0];
  }
  if (headers.indexOf('include_weekends') === -1) {
    var createdIndex = headers.indexOf('created_at');
    var weekendsColIndex;
    if (createdIndex !== -1) {
      weekendsColIndex = createdIndex + 1;
      sh.insertColumnBefore(weekendsColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      weekendsColIndex = sh.getLastColumn();
    }
    sh.getRange(1, weekendsColIndex).setValue('include_weekends');
    var totalRows = sh.getLastRow();
    if (totalRows > 1) {
      sh.getRange(2, weekendsColIndex, totalRows - 1, 1).setValue('FALSE');
    }
    headerRange = sh.getRange(1, 1, 1, sh.getLastColumn());
    headers = headerRange.getValues()[0];
  }
  if (headers.indexOf('line_item_templates_json') === -1) {
    var createdAtIndex = headers.indexOf('created_at');
    var templatesColIndex;
    if (createdAtIndex !== -1) {
      templatesColIndex = createdAtIndex + 1;
      sh.insertColumnBefore(templatesColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      templatesColIndex = sh.getLastColumn();
    }
    sh.getRange(1, templatesColIndex).setValue('line_item_templates_json');
    var rowCount = sh.getLastRow();
    if (rowCount > 1) {
      sh.getRange(2, templatesColIndex, rowCount - 1, 1).setValue('');
    }
    headerRange = sh.getRange(1, 1, 1, sh.getLastColumn());
    headers = headerRange.getValues()[0];
  }
  if (headers.indexOf('color') === -1) {
    var createdColorIdx = headers.indexOf('created_at');
    var colorColIndex;
    if (createdColorIdx !== -1) {
      colorColIndex = createdColorIdx + 1;
      sh.insertColumnBefore(colorColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      colorColIndex = sh.getLastColumn();
    }
    sh.getRange(1, colorColIndex).setValue('color');
    var colorRows = sh.getLastRow();
    if (colorRows > 1) {
      // Auto-assign a distinct palette colour to each existing contract so nothing reads as plain.
      var colorValues = [];
      for (var r = 0; r < colorRows - 1; r++) {
        colorValues.push([CONTRACT_COLOR_PALETTE[r % CONTRACT_COLOR_PALETTE.length]]);
      }
      sh.getRange(2, colorColIndex, colorRows - 1, 1).setValues(colorValues);
    }
  }
  if (headers.indexOf('archived') === -1) {
    var createdArchIdx = headers.indexOf('created_at');
    var archivedColIndex;
    if (createdArchIdx !== -1) {
      archivedColIndex = createdArchIdx + 1;
      sh.insertColumnBefore(archivedColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      archivedColIndex = sh.getLastColumn();
    }
    sh.getRange(1, archivedColIndex).setValue('archived');
    var archivedRows = sh.getLastRow();
    if (archivedRows > 1) {
      sh.getRange(2, archivedColIndex, archivedRows - 1, 1).setValue('FALSE');
    }
  }
  // entry_mode (per-contract Simple/Detailed override). Fresh read of headers so earlier inserts in this
  // same call are accounted for. Existing rows default to blank = inherit the global default — no fill.
  var emHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (emHeaders.indexOf('entry_mode') === -1) {
    var createdEmIdx = emHeaders.indexOf('created_at');
    var entryModeColIndex;
    if (createdEmIdx !== -1) {
      entryModeColIndex = createdEmIdx + 1;
      sh.insertColumnBefore(entryModeColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      entryModeColIndex = sh.getLastColumn();
    }
    sh.getRange(1, entryModeColIndex).setValue('entry_mode');
  }
  // standard_day_json (per-contract "standard day" session template, JSON string). Existing rows default to
  // blank = no template. Fresh header read so it accounts for any insert above in this same call.
  var sdHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (sdHeaders.indexOf('standard_day_json') === -1) {
    var createdSdIdx = sdHeaders.indexOf('created_at');
    var standardDayColIndex;
    if (createdSdIdx !== -1) {
      standardDayColIndex = createdSdIdx + 1;
      sh.insertColumnBefore(standardDayColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      standardDayColIndex = sh.getLastColumn();
    }
    sh.getRange(1, standardDayColIndex).setValue('standard_day_json');
  }
}

function getContractsSheet() {
  var sh = getOrCreateSheet('contracts');
  ensureContractsSchema(sh);
  return sh;
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
  if (!id) throw new Error('Contract id is required.');
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
  var id = payload && payload.id;
  var archived = !!(payload && payload.archived);
  if (!id) throw new Error('Contract id is required.');
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

// Hard delete that also removes every timesheet entry logged against the contract. The destructive
// escape hatch (e.g. clearing out test data) — distinct from api_deleteContract, which refuses when
// entries exist. Returns the number of entries removed so the UI can confirm what happened.
function api_deleteContractWithEntries(id) {
  if (!id) throw new Error('Contract id is required.');
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
