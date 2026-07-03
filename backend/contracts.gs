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
    assessment_type_multipliers_json: contract.assessment_type_multipliers_json || '',
    invoice_email_to: contract.invoice_email_to || '',
    invoice_email_cc: contract.invoice_email_cc || '',
    invoice_email_bcc: contract.invoice_email_bcc || '',
    invoice_email_subject_template: contract.invoice_email_subject_template || '',
    invoice_email_body_template: contract.invoice_email_body_template || '',
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

function buildContractRow(contract, createdAt) {
  var normalized = normalizeContractObject(contract || {});
  return [
    normalized.id,
    normalized.name,
    normalized.start_date,
    normalized.end_date,
    normalized.hourly_rate,
    normalized.total_hours,
    normalized.include_weekends ? 'TRUE' : 'FALSE',
    normalized.standard_hours_per_day,
    normalized.line_item_templates_json || '',
    normalized.assessment_type_multipliers_json || '',
    normalized.invoice_email_to || '',
    normalized.invoice_email_cc || '',
    normalized.invoice_email_bcc || '',
    normalized.invoice_email_subject_template || '',
    normalized.invoice_email_body_template || '',
    createdAt || normalized.created_at || toIsoDateTime(new Date())
  ];
}

function ensureContractsSchema(sh) {
  if (!sh) return;
  var fullHeaders = ['id', 'name', 'start_date', 'end_date', 'hourly_rate', 'total_hours', 'include_weekends', 'standard_hours_per_day', 'line_item_templates_json', 'assessment_type_multipliers_json', 'invoice_email_to', 'invoice_email_cc', 'invoice_email_bcc', 'invoice_email_subject_template', 'invoice_email_body_template', 'created_at'];
  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) {
    sh.getRange(1, 1, 1, fullHeaders.length).setValues([fullHeaders]);
    return;
  }
  var headerRange = sh.getRange(1, 1, 1, lastColumn);
  var headers = headerRange.getValues()[0];
  var hasHeaderContent = headers.some(function(value) { return String(value || '').trim() !== ''; });
  if (!hasHeaderContent) {
    sh.getRange(1, 1, 1, fullHeaders.length).setValues([fullHeaders]);
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
  }
  var assessmentColumns = [
    'assessment_type_multipliers_json',
    'invoice_email_to',
    'invoice_email_cc',
    'invoice_email_bcc',
    'invoice_email_subject_template',
    'invoice_email_body_template'
  ];
  assessmentColumns.forEach(function(columnName) {
    var refreshedHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (refreshedHeaders.indexOf(columnName) !== -1) return;
    var createdAtPos = refreshedHeaders.indexOf('created_at');
    var newColIndex;
    if (createdAtPos !== -1) {
      newColIndex = createdAtPos + 1;
      sh.insertColumnBefore(newColIndex);
    } else {
      sh.insertColumnAfter(sh.getLastColumn());
      newColIndex = sh.getLastColumn();
    }
    sh.getRange(1, newColIndex).setValue(columnName);
    var existingRowCount = sh.getLastRow();
    if (existingRowCount > 1) {
      sh.getRange(2, newColIndex, existingRowCount - 1, 1).setValue('');
    }
  });
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
    return normalizeContractObject(obj);
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
  normalized.created_at = toIsoDateTime(now);
  var row = buildContractRow(normalized, normalized.created_at);
  sh.appendRow(row);
  cacheClearPrefix(CONTRACT_CACHE_PREFIX);
  if (typeof ASSESSMENT_CACHE_PREFIX !== 'undefined') {
    cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
  }
  return { success: true, contract: normalized };
}

function api_updateContract(contract) {
  if (!contract || !contract.id) throw new Error('Contract id is required.');
  var sh = getContractsSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : [];
  var createdIdx = headers.indexOf('created_at');
  var multipliersIdx = headers.indexOf('assessment_type_multipliers_json');
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === contract.id) {
      var createdValue = createdIdx !== -1 ? values[i][createdIdx] : values[i][6];
      var existingMultipliers = multipliersIdx !== -1 ? values[i][multipliersIdx] : '';
      var normalized = normalizeContractObject(contract);
      normalized.id = contract.id;
      validateContractDates(normalized);
      assertNoRemovedAssessmentTypesInUse(contract.id, existingMultipliers, normalized.assessment_type_multipliers_json);
      normalized.created_at = toIsoDateTime(createdValue);
      var row = buildContractRow(normalized, normalized.created_at);
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      cacheClearPrefix(CONTRACT_CACHE_PREFIX);
      if (typeof ASSESSMENT_CACHE_PREFIX !== 'undefined') {
        cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
      }
      return { success: true, contract: normalized };
    }
  }
  throw new Error('Contract not found');
}

function parseEnabledAssessmentTypeIds(jsonString) {
  if (!jsonString) return [];
  var parsed;
  try {
    parsed = JSON.parse(String(jsonString));
  } catch (e) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  var ids = [];
  for (var i = 0; i < parsed.length; i++) {
    if (parsed[i] && parsed[i].type_id) ids.push(String(parsed[i].type_id));
  }
  return ids;
}

function assertNoRemovedAssessmentTypesInUse(contractId, previousJson, nextJson) {
  var previous = parseEnabledAssessmentTypeIds(previousJson);
  if (!previous.length) return;
  var nextSet = {};
  parseEnabledAssessmentTypeIds(nextJson).forEach(function(id) { nextSet[id] = true; });
  var removed = previous.filter(function(id) { return !nextSet[id]; });
  if (!removed.length) return;
  var sh = getOrCreateSheet('assessments');
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return;
  var headers = values[0];
  var contractIdx = headers.indexOf('contract_id');
  var typeIdx = headers.indexOf('assessment_type_id');
  if (contractIdx === -1 || typeIdx === -1) return;
  var removedSet = {};
  removed.forEach(function(id) { removedSet[id] = 0; });
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][contractIdx] || '') !== String(contractId)) continue;
    var typeId = String(values[r][typeIdx] || '');
    if (removedSet.hasOwnProperty(typeId)) removedSet[typeId] += 1;
  }
  var blockers = removed.filter(function(id) { return removedSet[id] > 0; });
  if (blockers.length) {
    throw new Error('Cannot remove assessment type(s) from this contract while existing assessments use them: ' + blockers.join(', '));
  }
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
      if (typeof ASSESSMENT_CACHE_PREFIX !== 'undefined') {
        cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
      }
      return { success: true };
    }
  }
  throw new Error('Contract not found');
}
