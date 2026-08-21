// Every hour_types column, quick-fill fields included, is declared in TEMPUS_SHEET_SCHEMAS and added by
// name by getOrCreateSheet. There is deliberately no second schema fix-up here: the one that used to
// live in this file decided "does this column exist?" from the getLastColumn() window, which does not
// always reach a column holding only a header, and so appended duplicate quick_fill_hours/icon columns.
function getHourTypesSheet() {
  return getOrCreateSheet('hour_types');
}

// One-time carry-over of the legacy saved "entry defaults" into the new per-hour-type quick-fill
// settings, so a user's existing right-click quick actions (e.g. Work 8.5h, Leave, Sick) survive the
// switch to hour-type-driven quick actions. Each basic default maps to its own hour_type_id (or, for a
// generic work-style default with no/own type, to the current default hour type), enabling that type's
// quick fill and seeding its duration. Guarded by a settings flag so it runs exactly once and never
// re-enables a type the user later turns off.
function migrateEntryDefaultsToHourTypes(sh) {
  var settings;
  try { settings = api_getSettings(); } catch (e) { settings = {}; }
  if (settings && (settings.hour_types_quick_fill_migrated === 'true' || settings.hour_types_quick_fill_migrated === true)) {
    return;
  }

  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);
  var idIdx = headers.indexOf('id');
  var slugIdx = headers.indexOf('slug');
  var isDefaultIdx = headers.indexOf('is_default');
  var enabledIdx = headers.indexOf('quick_fill_enabled');
  var hoursIdx = headers.indexOf('quick_fill_hours');
  if (enabledIdx === -1 || hoursIdx === -1 || idIdx === -1) return; // schema not ready yet

  var basic = [];
  try {
    var defaults = api_getEntryDefaults();
    if (defaults && Array.isArray(defaults.basic)) basic = defaults.basic;
  } catch (e) { basic = []; }

  // The generic "quick fill" default (not named like leave/sick, and carrying no explicit type) maps to
  // whichever hour type is currently the default.
  var defaultId = '';
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][isDefaultIdx] === true || rows[i][isDefaultIdx] === 'TRUE') { defaultId = rows[i][idIdx]; break; }
  }
  if (!defaultId && slugIdx !== -1) {
    for (var j = 0; j < rows.length; j++) {
      if (rows[j][slugIdx] === 'work') { defaultId = rows[j][idIdx]; break; }
    }
  }

  function isLeaveOrSick(name) {
    return /sick|leave|holiday|annual|vacation|pto|rdo|day off/.test(String(name || '').toLowerCase());
  }

  var target = {}; // hour_type_id -> quick-fill hours (first non-zero wins)
  basic.forEach(function(d) {
    var hours = (Number(d.duration_minutes) || 0) / 60;
    if (hours <= 0) return;
    var htId = d.hour_type_id ? String(d.hour_type_id).trim() : '';
    if (!htId) htId = isLeaveOrSick(d.name) ? '' : defaultId;
    if (!htId) return;
    if (target[htId] == null) target[htId] = hours;
  });
  // Guarantee the default type always has a usable quick fill even with no prior defaults.
  if (defaultId && target[defaultId] == null) target[defaultId] = 7.5;

  rows.forEach(function(row, idx) {
    var id = row[idIdx];
    if (target[id] == null) return;
    sh.getRange(idx + 2, enabledIdx + 1).setValue('TRUE');
    sh.getRange(idx + 2, hoursIdx + 1).setValue(target[id]);
  });

  try { api_updateSettings({ hour_types_quick_fill_migrated: 'true' }); } catch (e) {}
  cacheClearPrefix('hour_types');
}

function api_getHourTypes() {
  var sh = getHourTypesSheet();
  // Work has always been a protected, income-generating type. Repair legacy/partially-upgraded rows
  // that pre-date that invariant as well as creating the row when it is absent.
  ensureWorkHourType();

  // Carry legacy entry-defaults over to per-type quick-fill settings (runs once), then read fresh.
  migrateEntryDefaultsToHourTypes(sh);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);

  var hourTypes = rows.map(function(row) {
    return normalizeHourTypeRow(headers, row);
  });

  hourTypes.sort(function(a, b) {
    var orderA = Number.isFinite(a.display_order) ? a.display_order : Number.POSITIVE_INFINITY;
    var orderB = Number.isFinite(b.display_order) ? b.display_order : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  var cacheKey = 'hour_types_all';
  cacheSet(cacheKey, hourTypes);

  return hourTypes;
}

function boolFromSheetCell(value) {
  return value === true || value === 'TRUE';
}

function normalizeHourTypeEntryMode(value) {
  var mode = String(value == null ? '' : value).trim().toLowerCase();
  return mode === 'simple' || mode === 'detailed' ? mode : '';
}

function normalizeHourTypeRow(headers, row) {
  if (!headers || !row) return {};
  function cell(header) {
    var idx = headers.indexOf(header);
    return idx === -1 ? '' : row[idx];
  }
  var autoHoursRaw = cell('auto_populate_hours');
  var autoHours = Number(autoHoursRaw);
  if (isNaN(autoHours) || !isFinite(autoHours) || autoHours < 0) autoHours = 0;
  var displayOrderRaw = cell('display_order');
  var displayOrder = Number(displayOrderRaw);
  if (!isFinite(displayOrder)) displayOrder = null;
  // quick_fill_hours is left null when unset so the client can fall back to the default type's value.
  var quickFillRaw = cell('quick_fill_hours');
  var quickFillHours = Number(quickFillRaw);
  if (quickFillRaw === '' || quickFillRaw === null || quickFillRaw === undefined || !isFinite(quickFillHours) || quickFillHours < 0) {
    quickFillHours = null;
  }
  return {
    id: cell('id'),
    name: cell('name'),
    slug: cell('slug'),
    color: cell('color') || '#6b7280',
    contributes_to_income: boolFromSheetCell(cell('contributes_to_income')),
    requires_contract: boolFromSheetCell(cell('requires_contract')),
    is_default: boolFromSheetCell(cell('is_default')),
    use_for_rate_calculation: boolFromSheetCell(cell('use_for_rate_calculation')),
    auto_populate_public_holidays: boolFromSheetCell(cell('auto_populate_public_holidays')),
    auto_populate_hours: autoHours,
    entry_mode: normalizeHourTypeEntryMode(cell('entry_mode')),
    created_at: cell('created_at'),
    display_order: displayOrder,
    quick_fill_enabled: boolFromSheetCell(cell('quick_fill_enabled')),
    quick_fill_hours: quickFillHours,
    icon: cell('icon') ? String(cell('icon')) : '',
    // 'punch' = the quick action starts the clock; anything else (incl. blank legacy rows) = fill hours.
    quick_fill_mode: String(cell('quick_fill_mode')).toLowerCase() === 'punch' ? 'punch' : 'hours'
  };
}

function api_createHourType(data) {
  return withScriptLock_('hour type creation', function() { return createHourTypeUnlocked_(data); });
}

function createHourTypeUnlocked_(data) {
  if (!data.name || !data.slug) {
    throw new Error('Name and slug are required for hour types');
  }

  var sh = getHourTypesSheet();
  var existingData = sh.getDataRange().getValues();
  var headers = existingData[0];
  var rows = existingData.slice(1);

  // Check for slug uniqueness
  var existingSlugs = rows.map(function(row) {
    return row[headers.indexOf('slug')];
  });
  if (existingSlugs.indexOf(data.slug) !== -1) {
    throw new Error('Hour type with slug "' + data.slug + '" already exists');
  }

  var displayIndex = headers.indexOf('display_order');
  if (displayIndex !== -1) {
    var nextOrder = 1;
    for (var rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      var rawOrder = Number(rows[rowIdx][displayIndex]);
      if (isFinite(rawOrder)) {
        nextOrder = Math.max(nextOrder, rawOrder + 1);
      }
    }
    var providedOrder = Number(data.display_order);
    if (!isFinite(providedOrder)) {
      data.display_order = nextOrder;
    } else {
      data.display_order = providedOrder;
    }
  }

  // If this is being set as default, clear other defaults
  if (data.is_default) {
    for (var i = 0; i < rows.length; i++) {
      var defaultIndex = headers.indexOf('is_default');
      if (rows[i][defaultIndex] === true || rows[i][defaultIndex] === 'TRUE') {
        sh.getRange(i + 2, defaultIndex + 1).setValue('FALSE');
      }
    }
  }

  var id = Utilities.getUuid();
  var now = toIsoDateTime(new Date());

  var autoPopulate = data.auto_populate_public_holidays ? 'TRUE' : 'FALSE';
  var autoHours = Number(data.auto_populate_hours);
  if (isNaN(autoHours) || !isFinite(autoHours) || autoHours < 0) {
    autoHours = data.auto_populate_public_holidays ? 7.5 : 0;
  }

  var quickFillHoursNew = Number(data.quick_fill_hours);
  var quickFillHoursCell = (isFinite(quickFillHoursNew) && quickFillHoursNew > 0) ? quickFillHoursNew : '';

  var newRow = headers.map(function(header) {
    switch (header) {
      case 'id':
        return id;
      case 'name':
        return data.name;
      case 'slug':
        return data.slug;
      case 'color':
        return data.color || '#6b7280';
      case 'contributes_to_income':
        return data.contributes_to_income ? 'TRUE' : 'FALSE';
      case 'requires_contract':
        return data.contributes_to_income ? 'TRUE' : 'FALSE';
      case 'is_default':
        return data.is_default ? 'TRUE' : 'FALSE';
      case 'use_for_rate_calculation':
        return data.use_for_rate_calculation ? 'TRUE' : 'FALSE';
      case 'auto_populate_public_holidays':
        return autoPopulate;
      case 'auto_populate_hours':
        return autoHours;
      case 'entry_mode':
        return normalizeHourTypeEntryMode(data.entry_mode);
      case 'created_at':
        return now;
      case 'display_order':
        return Number.isFinite(Number(data.display_order)) ? Number(data.display_order) : '';
      case 'quick_fill_enabled':
        return data.quick_fill_enabled ? 'TRUE' : 'FALSE';
      case 'quick_fill_hours':
        return quickFillHoursCell;
      case 'icon':
        return data.icon ? String(data.icon) : '';
      case 'quick_fill_mode':
        return data.quick_fill_mode === 'punch' ? 'punch' : 'hours';
      default:
        return '';
    }
  });

  sh.appendRow(newRow);

  var newHourType = normalizeHourTypeRow(headers, newRow);

  // normalizeHourTypeRow returns requires_contract from sheet value; ensure consistency
  newHourType.requires_contract = !!data.contributes_to_income;
  newHourType.auto_populate_public_holidays = data.auto_populate_public_holidays ? true : false;
  newHourType.auto_populate_hours = autoHours;

  cacheClearPrefix('hour_types');

  return newHourType;
}

function api_updateHourType(id, data) {
  return withScriptLock_('hour type update', function() { return updateHourTypeUnlocked_(id, data); });
}

function updateHourTypeUnlocked_(id, data) {
  var sh = getHourTypesSheet();
  var allData = sh.getDataRange().getValues();
  var headers = allData[0];
  var rows = allData.slice(1);

  var rowIndex = -1;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === id) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error('Hour type not found');
  }

  // Don't allow deleting or changing the work hour type's core properties
  var currentRow = rows[rowIndex];
  var slugIndex = headers.indexOf('slug');
  if (currentRow[slugIndex] === 'work') {
    if (data.slug && data.slug !== 'work') {
      throw new Error('Cannot change slug of work hour type');
    }
    if (data.hasOwnProperty('contributes_to_income') && !data.contributes_to_income) {
      throw new Error('Work hour type must contribute to income');
    }
    if (data.hasOwnProperty('requires_contract') && !data.requires_contract) {
      throw new Error('Work hour type must require a contract');
    }
  }

  // Check slug uniqueness if changing
  if (data.slug && data.slug !== currentRow[slugIndex]) {
    var existingSlugs = rows.map(function(row, idx) {
      return idx === rowIndex ? null : row[slugIndex];
    }).filter(function(slug) { return slug !== null; });

    if (existingSlugs.indexOf(data.slug) !== -1) {
      throw new Error('Hour type with slug "' + data.slug + '" already exists');
    }
  }

  // If this is being set as default, clear other defaults
  if (data.is_default) {
    for (var i = 0; i < rows.length; i++) {
      if (i !== rowIndex) {
        var defaultIndex = headers.indexOf('is_default');
        if (rows[i][defaultIndex] === true || rows[i][defaultIndex] === 'TRUE') {
          sh.getRange(i + 2, defaultIndex + 1).setValue('FALSE');
        }
      }
    }
  }

  // Update the row
  var updatedRow = currentRow.slice();
  if (data.hasOwnProperty('name')) updatedRow[headers.indexOf('name')] = data.name;
  if (data.hasOwnProperty('slug')) updatedRow[headers.indexOf('slug')] = data.slug;
  if (data.hasOwnProperty('color')) updatedRow[headers.indexOf('color')] = data.color;
  if (data.hasOwnProperty('contributes_to_income')) {
    updatedRow[headers.indexOf('contributes_to_income')] = data.contributes_to_income ? 'TRUE' : 'FALSE';
    updatedRow[headers.indexOf('requires_contract')] = data.contributes_to_income ? 'TRUE' : 'FALSE'; // requires_contract = contributes_to_income
  }
  if (data.hasOwnProperty('is_default')) updatedRow[headers.indexOf('is_default')] = data.is_default ? 'TRUE' : 'FALSE';
  var rateCalcIdx = headers.indexOf('use_for_rate_calculation');
  if (rateCalcIdx !== -1 && data.hasOwnProperty('use_for_rate_calculation')) {
    updatedRow[rateCalcIdx] = data.use_for_rate_calculation ? 'TRUE' : 'FALSE';
  }
  var autoPopulateIndex = headers.indexOf('auto_populate_public_holidays');
  if (autoPopulateIndex !== -1 && data.hasOwnProperty('auto_populate_public_holidays')) {
    updatedRow[autoPopulateIndex] = data.auto_populate_public_holidays ? 'TRUE' : 'FALSE';
  }
  var autoHoursIndex = headers.indexOf('auto_populate_hours');
  if (autoHoursIndex !== -1 && data.hasOwnProperty('auto_populate_hours')) {
    var normalizedHours = Number(data.auto_populate_hours);
    if (isNaN(normalizedHours) || !isFinite(normalizedHours) || normalizedHours < 0) {
      normalizedHours = 0;
    }
    updatedRow[autoHoursIndex] = normalizedHours;
  }
  var entryModeIndex = headers.indexOf('entry_mode');
  if (entryModeIndex !== -1 && data.hasOwnProperty('entry_mode')) {
    updatedRow[entryModeIndex] = normalizeHourTypeEntryMode(data.entry_mode);
  }
  var orderIndex = headers.indexOf('display_order');
  if (orderIndex !== -1 && data.hasOwnProperty('display_order')) {
    var normalizedOrder = Number(data.display_order);
    if (!isFinite(normalizedOrder)) {
      normalizedOrder = '';
    }
    updatedRow[orderIndex] = normalizedOrder;
  }
  var quickEnabledIndex = headers.indexOf('quick_fill_enabled');
  if (quickEnabledIndex !== -1 && data.hasOwnProperty('quick_fill_enabled')) {
    updatedRow[quickEnabledIndex] = data.quick_fill_enabled ? 'TRUE' : 'FALSE';
  }
  var quickHoursIndex = headers.indexOf('quick_fill_hours');
  if (quickHoursIndex !== -1 && data.hasOwnProperty('quick_fill_hours')) {
    var normalizedQuick = Number(data.quick_fill_hours);
    updatedRow[quickHoursIndex] = (isFinite(normalizedQuick) && normalizedQuick > 0) ? normalizedQuick : '';
  }
  var iconIndex = headers.indexOf('icon');
  if (iconIndex !== -1 && data.hasOwnProperty('icon')) {
    updatedRow[iconIndex] = data.icon ? String(data.icon) : '';
  }
  var quickModeIndex = headers.indexOf('quick_fill_mode');
  if (quickModeIndex !== -1 && data.hasOwnProperty('quick_fill_mode')) {
    updatedRow[quickModeIndex] = data.quick_fill_mode === 'punch' ? 'punch' : 'hours';
  }

  sh.getRange(rowIndex + 2, 1, 1, updatedRow.length).setValues([updatedRow]);

  var updatedHourType = normalizeHourTypeRow(headers, updatedRow);

  cacheClearPrefix('hour_types');

  return updatedHourType;
}

function api_deleteHourType(id) {
  return withScriptLock_('hour type removal', function() { return deleteHourTypeUnlocked_(id); });
}

function hourTypeReferenceCount_(id) {
  var references = [
    ['timesheet_entries', 'hour_type_id'],
    ['recurring_time_entries', 'hour_type_id'],
    ['bulk_time_entries', 'hour_type_id'],
    ['invoice_line_items', 'hour_type_id']
  ];
  var count = 0;
  references.forEach(function(reference) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(reference[0]);
    if (!sheet || sheet.getLastRow() < 2) return;
    var values = sheet.getDataRange().getValues();
    var column = values[0].indexOf(reference[1]);
    if (column === -1) return;
    for (var row = 1; row < values.length; row++) if (String(values[row][column]) === String(id)) count++;
  });
  return count;
}

function deleteHourTypeUnlocked_(id) {
  var sh = getHourTypesSheet();
  var allData = sh.getDataRange().getValues();
  var headers = allData[0];
  var rows = allData.slice(1);

  var rowIndex = -1;
  var targetRow = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === id) {
      rowIndex = i;
      targetRow = rows[i];
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error('Hour type not found');
  }

  // Don't allow deleting the work hour type
  var slugIndex = headers.indexOf('slug');
  if (targetRow[slugIndex] === 'work') {
    throw new Error('Cannot delete the work hour type');
  }

  if (hourTypeReferenceCount_(id) > 0) throw new Error('Cannot delete an hour type referenced by entries, schedules, or invoice lines.');

  sh.deleteRow(rowIndex + 2);

  cacheClearPrefix('hour_types');

  return { success: true };
}

function api_reorderHourTypes(payload) {
  return withScriptLock_('hour type reorder', function() {
    var order = Array.isArray(payload && payload.order) ? payload.order : [];
    applyDisplayOrderToSheet('hour_types', order);
    cacheClearPrefix('hour_types');
    return { success: true };
  });
}

function ensureWorkHourType() {
  if (typeof withScriptLock_ === 'function') {
    return withScriptLock_('work hour type repair', ensureWorkHourTypeUnlocked_);
  }
  return ensureWorkHourTypeUnlocked_();
}

function ensureWorkHourTypeUnlocked_() {
  var sh = getHourTypesSheet();
  var data = sh.getDataRange().getValues();
  var headers = data[0];

  // Check if any other hour type already has use_for_rate_calculation
  var hasRateCalcHourType = false;
  var rateCalcIndex = headers.indexOf('use_for_rate_calculation');
  if (rateCalcIndex !== -1 && data.length > 1) {
    var rows = data.slice(1);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][rateCalcIndex] === true || rows[i][rateCalcIndex] === 'TRUE') {
        hasRateCalcHourType = true;
        break;
      }
    }
  }

  function buildWorkRow(id, now) {
    return headers.map(function(header) {
      switch (header) {
        case 'id':
          return id;
        case 'name':
          return 'Work';
        case 'slug':
          return 'work';
        case 'color':
          return '#3b82f6';
        case 'contributes_to_income':
        case 'requires_contract':
        case 'is_default':
          return 'TRUE';
        case 'use_for_rate_calculation':
          return hasRateCalcHourType ? 'FALSE' : 'TRUE';
        case 'auto_populate_public_holidays':
          return 'FALSE';
        case 'auto_populate_hours':
          return 0;
        case 'entry_mode':
          return '';
        case 'created_at':
          return now;
        case 'display_order':
          return 1;
        case 'quick_fill_enabled':
          // The default type anchors the "Quick Fill Hours" action at the top of the menu, so it ships on.
          return 'TRUE';
        case 'quick_fill_hours':
          return 7.5;
        case 'icon':
          return 'clock';
        default:
          return '';
      }
    });
  }

  if (data.length === 1) {
    // Only headers, no data rows - create work hour type
    var newId = Utilities.getUuid();
    var created = toIsoDateTime(new Date());
    var workRow = buildWorkRow(newId, created);
    sh.appendRow(workRow);
    cacheClearPrefix('hour_types');
    return normalizeHourTypeRow(headers, workRow);
  }

  var rows = data.slice(1);
  var slugIndex = headers.indexOf('slug');
  var incomeIndex = headers.indexOf('contributes_to_income');
  var requiresContractIndex = headers.indexOf('requires_contract');
  var isDefaultIndex = headers.indexOf('is_default');
  var hasExplicitDefault = isDefaultIndex !== -1 && rows.some(function(row) {
    return row[isDefaultIndex] === true || row[isDefaultIndex] === 'TRUE';
  });

  for (var i = 0; i < rows.length; i++) {
    if (rows[i][slugIndex] === 'work') {
      var repaired = rows[i].slice();
      var changed = false;
      if (incomeIndex !== -1 && repaired[incomeIndex] !== true && repaired[incomeIndex] !== 'TRUE') {
        repaired[incomeIndex] = 'TRUE';
        changed = true;
      }
      if (requiresContractIndex !== -1 && repaired[requiresContractIndex] !== true && repaired[requiresContractIndex] !== 'TRUE') {
        repaired[requiresContractIndex] = 'TRUE';
        changed = true;
      }
      if (!hasExplicitDefault && isDefaultIndex !== -1) {
        repaired[isDefaultIndex] = 'TRUE';
        changed = true;
      }
      if (!hasRateCalcHourType && rateCalcIndex !== -1) {
        repaired[rateCalcIndex] = 'TRUE';
        changed = true;
      }
      if (changed) {
        sh.getRange(i + 2, 1, 1, repaired.length).setValues([repaired]);
        cacheClearPrefix('hour_types');
      }
      return normalizeHourTypeRow(headers, repaired);
    }
  }

  // Work hour type doesn't exist, create it
  var id = Utilities.getUuid();
  var now = toIsoDateTime(new Date());
  var workRowNew = buildWorkRow(id, now);
  sh.appendRow(workRowNew);
  cacheClearPrefix('hour_types');

  return normalizeHourTypeRow(headers, workRowNew);
}

function getDefaultHourTypeId() {
  var sh = getHourTypesSheet();
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);

  if (rows.length === 0) {
    return ensureWorkHourType();
  }

  var isDefaultIndex = headers.indexOf('is_default');
  var slugIndex = headers.indexOf('slug');

  // First look for explicitly marked default
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][isDefaultIndex] === true || rows[i][isDefaultIndex] === 'TRUE') {
      return rows[i][0];
    }
  }

  // If no default is marked, return work hour type
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][slugIndex] === 'work') {
      return rows[i][0];
    }
  }

  // If no work hour type exists, create it and return its ID
  return ensureWorkHourType();
}
