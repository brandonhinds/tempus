function api_getHourTypes() {
  var sh = getOrCreateSheet('hour_types');
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);

  // Ensure work hour type exists if no hour types exist
  if (rows.length === 0) {
    ensureWorkHourType();
    // Reload data after creating work hour type
    data = sh.getDataRange().getValues();
    headers = data[0];
    rows = data.slice(1);
  }

  var hourTypes = rows.map(function(row) {
    return normalizeHourTypeRow(headers, row);
  });

  var cacheKey = 'hour_types_all';
  cacheSet(cacheKey, hourTypes);

  return hourTypes;
}

function boolFromSheetCell(value) {
  return value === true || value === 'TRUE';
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
    created_at: cell('created_at')
  };
}

function api_createHourType(data) {
  if (!data.name || !data.slug) {
    throw new Error('Name and slug are required for hour types');
  }

  var sh = getOrCreateSheet('hour_types');
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

  // If this is being set as default, clear other defaults
  if (data.is_default) {
    for (var i = 0; i < rows.length; i++) {
      var defaultIndex = headers.indexOf('is_default');
      if (rows[i][defaultIndex] === true || rows[i][defaultIndex] === 'TRUE') {
        sh.getRange(i + 2, defaultIndex + 1).setValue('FALSE');
      }
    }
  }

  // If this is being set as use_for_rate_calculation, clear other use_for_rate_calculation flags
  if (data.use_for_rate_calculation) {
    for (var i = 0; i < rows.length; i++) {
      var rateCalcIndex = headers.indexOf('use_for_rate_calculation');
      if (rateCalcIndex !== -1 && (rows[i][rateCalcIndex] === true || rows[i][rateCalcIndex] === 'TRUE')) {
        sh.getRange(i + 2, rateCalcIndex + 1).setValue('FALSE');
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
      case 'created_at':
        return now;
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
  var sh = getOrCreateSheet('hour_types');
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

  // If this is being set as use_for_rate_calculation, clear other use_for_rate_calculation flags
  if (data.use_for_rate_calculation) {
    for (var i = 0; i < rows.length; i++) {
      if (i !== rowIndex) {
        var rateCalcIndex = headers.indexOf('use_for_rate_calculation');
        if (rateCalcIndex !== -1 && (rows[i][rateCalcIndex] === true || rows[i][rateCalcIndex] === 'TRUE')) {
          sh.getRange(i + 2, rateCalcIndex + 1).setValue('FALSE');
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

  sh.getRange(rowIndex + 2, 1, 1, updatedRow.length).setValues([updatedRow]);

  var updatedHourType = normalizeHourTypeRow(headers, updatedRow);

  cacheClearPrefix('hour_types');

  return updatedHourType;
}

function api_deleteHourType(id) {
  var sh = getOrCreateSheet('hour_types');
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

  // Check if hour type is being used by any entries
  var entriesSh = getOrCreateSheet('timesheet_entries');
  var entriesData = entriesSh.getDataRange().getValues();
  var entriesHeaders = entriesData[0];
  var entriesRows = entriesData.slice(1);
  var hourTypeIdIndex = entriesHeaders.indexOf('hour_type_id');

  if (hourTypeIdIndex !== -1) {
    var isUsed = entriesRows.some(function(row) {
      return row[hourTypeIdIndex] === id;
    });

    if (isUsed) {
      throw new Error('Cannot delete hour type that is used by existing entries');
    }
  }

  sh.deleteRow(rowIndex + 2);

  cacheClearPrefix('hour_types');

  return { success: true };
}

function ensureWorkHourType() {
  var sh = getOrCreateSheet('hour_types');
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
        case 'created_at':
          return now;
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

  for (var i = 0; i < rows.length; i++) {
    if (rows[i][slugIndex] === 'work') {
      return normalizeHourTypeRow(headers, rows[i]);
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
  var sh = getOrCreateSheet('hour_types');
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
