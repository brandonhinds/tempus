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

function normalizeContractObject(contract) {
  if (!contract) return contract;
  var normalized = {
    id: contract.id || '',
    name: contract.name ? String(contract.name).trim() : '',
    start_date: toIsoDate(contract.start_date || contract.startDate),
    end_date: toIsoDate(contract.end_date || contract.endDate),
    hourly_rate: normalizeHourlyRate(contract.hourly_rate || contract.hourlyRate),
    total_hours: normalizeContractTotalHours(contract.total_hours || contract.totalHours),
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
    createdAt || normalized.created_at || toIsoDateTime(new Date())
  ];
}

function ensureContractsSchema(sh) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) {
    sh.getRange(1, 1, 1, 7).setValues([['id', 'name', 'start_date', 'end_date', 'hourly_rate', 'total_hours', 'created_at']]);
    return;
  }
  var headerRange = sh.getRange(1, 1, 1, lastColumn);
  var headers = headerRange.getValues()[0];
  var hasHeaderContent = headers.some(function(value) { return String(value || '').trim() !== ''; });
  if (!hasHeaderContent) {
    sh.getRange(1, 1, 1, 7).setValues([['id', 'name', 'start_date', 'end_date', 'hourly_rate', 'total_hours', 'created_at']]);
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
  return { success: true, contract: normalized };
}

function api_updateContract(contract) {
  if (!contract || !contract.id) throw new Error('Contract id is required.');
  var sh = getContractsSheet();
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === contract.id) {
      var originalCreated = values[i][6];
      var normalized = normalizeContractObject(contract);
      normalized.id = contract.id;
      validateContractDates(normalized);
      normalized.created_at = toIsoDateTime(originalCreated);
      var row = buildContractRow(normalized, normalized.created_at);
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
