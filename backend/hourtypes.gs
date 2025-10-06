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
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i];
    }
    return obj;
  });

  var cacheKey = 'hour_types_all';
  cacheSet(cacheKey, hourTypes);

  return hourTypes;
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

  var id = Utilities.getUuid();
  var now = toIsoDateTime(new Date());

  var newRow = [
    id,
    data.name,
    data.slug,
    data.color || '#6b7280',
    data.contributes_to_income ? 'TRUE' : 'FALSE',
    data.contributes_to_income ? 'TRUE' : 'FALSE', // requires_contract = contributes_to_income
    data.is_default ? 'TRUE' : 'FALSE',
    now
  ];

  sh.appendRow(newRow);

  var newHourType = {
    id: id,
    name: data.name,
    slug: data.slug,
    color: data.color || '#6b7280',
    contributes_to_income: data.contributes_to_income || false,
    requires_contract: data.contributes_to_income || false, // requires_contract = contributes_to_income
    is_default: data.is_default || false,
    created_at: now
  };

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

  sh.getRange(rowIndex + 2, 1, 1, updatedRow.length).setValues([updatedRow]);

  var updatedHourType = {
    id: updatedRow[0],
    name: updatedRow[1],
    slug: updatedRow[2],
    color: updatedRow[3],
    contributes_to_income: updatedRow[4] === 'TRUE',
    requires_contract: updatedRow[5] === 'TRUE',
    is_default: updatedRow[6] === 'TRUE',
    created_at: updatedRow[7]
  };

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

  if (data.length === 1) {
    // Only headers, no data rows - create work hour type
    var id = Utilities.getUuid();
    var now = toIsoDateTime(new Date());

    var workRow = [
      id,
      'Work',
      'work',
      '#3b82f6',
      'TRUE', // contributes_to_income
      'TRUE', // requires_contract (same as contributes_to_income)
      'TRUE', // is_default
      now
    ];

    sh.appendRow(workRow);
    cacheClearPrefix('hour_types');

    return {
      id: id,
      name: 'Work',
      slug: 'work',
      color: '#3b82f6',
      contributes_to_income: true,
      requires_contract: true,
      is_default: true,
      created_at: now
    };
  } else {
    // Check if work hour type exists
    var headers = data[0];
    var rows = data.slice(1);
    var slugIndex = headers.indexOf('slug');

    for (var i = 0; i < rows.length; i++) {
      if (rows[i][slugIndex] === 'work') {
        // Return existing work hour type as object
        var row = rows[i];
        return {
          id: row[0],
          name: row[1],
          slug: row[2],
          color: row[3],
          contributes_to_income: row[4] === 'TRUE',
          requires_contract: row[5] === 'TRUE',
          is_default: row[6] === 'TRUE',
          created_at: row[7]
        };
      }
    }

    // Work hour type doesn't exist, create it
    var id = Utilities.getUuid();
    var now = toIsoDateTime(new Date());

    var workRow = [
      id,
      'Work',
      'work',
      '#3b82f6',
      'TRUE', // contributes_to_income
      'TRUE', // requires_contract (same as contributes_to_income)
      'TRUE', // is_default
      now
    ];

    sh.appendRow(workRow);
    cacheClearPrefix('hour_types');

    return {
      id: id,
      name: 'Work',
      slug: 'work',
      color: '#3b82f6',
      contributes_to_income: true,
      requires_contract: true,
      is_default: true,
      created_at: now
    };
  }
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