var ACTUAL_INCOME_SHEET_NAME = 'actual_income';
var ACTUAL_INCOME_HEADERS = [
  'id',
  'month',
  'gross_income',
  'superannuation',
  'tax',
  'net_income',
  'created_at',
  'updated_at'
];
var ACTUAL_INCOME_CACHE_KEY = 'actual_income_v1';
var ACTUAL_INCOME_SHEET_TZ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

function toYearMonth(value) {
  if (!value) return '';
  // If it's a Date object, format it as yyyy-MM using the sheet's timezone
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, ACTUAL_INCOME_SHEET_TZ, 'yyyy-MM');
  }
  // If it's a string, check if it's already in yyyy-MM format
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (trimmed === '') return '';
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
    // If it looks like a date string, parse it and format
    var parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, ACTUAL_INCOME_SHEET_TZ, 'yyyy-MM');
    }
    return trimmed;
  }
  // Try to coerce to date
  var coercible = new Date(value);
  if (!isNaN(coercible.getTime())) {
    return Utilities.formatDate(coercible, ACTUAL_INCOME_SHEET_TZ, 'yyyy-MM');
  }
  return String(value);
}

function getActualIncomeSheet() {
  var sh = getOrCreateSheet(ACTUAL_INCOME_SHEET_NAME);
  ensureActualIncomeSchema(sh);
  return sh;
}

function ensureActualIncomeSchema(sh) {
  var lastColumn = Math.max(sh.getLastColumn(), ACTUAL_INCOME_HEADERS.length);
  var headerRange = sh.getRange(1, 1, 1, lastColumn);
  var headers = headerRange.getValues()[0];
  var needsRewrite = false;
  for (var i = 0; i < ACTUAL_INCOME_HEADERS.length; i++) {
    if (headers[i] !== ACTUAL_INCOME_HEADERS[i]) {
      needsRewrite = true;
      break;
    }
  }
  if (needsRewrite) {
    sh.getRange(1, 1, 1, ACTUAL_INCOME_HEADERS.length).setValues([ACTUAL_INCOME_HEADERS]);
  }
}

function normalizeActualIncomeRow(row, headers) {
  if (!row) return null;
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = row[i];
  }
  var id = map.id ? String(map.id) : '';
  if (!id) return null;

  return {
    id: id,
    month: toYearMonth(map.month),
    gross_income: Number(map.gross_income) || 0,
    superannuation: Number(map.superannuation) || 0,
    tax: Number(map.tax) || 0,
    net_income: Number(map.net_income) || 0,
    created_at: toIsoDateTime(map.created_at || ''),
    updated_at: toIsoDateTime(map.updated_at || '')
  };
}

function listActualIncomeInternal() {
  var cached = cacheGet(ACTUAL_INCOME_CACHE_KEY);
  if (cached) return cached;
  var sh = getActualIncomeSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) {
    cacheSet(ACTUAL_INCOME_CACHE_KEY, []);
    return [];
  }
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var normalized = normalizeActualIncomeRow(values[i], headers);
    if (normalized) result.push(normalized);
  }
  cacheSet(ACTUAL_INCOME_CACHE_KEY, result);
  return result;
}

function api_getActualIncome() {
  return listActualIncomeInternal();
}

function normalizeActualIncomePayload(payload, existing) {
  if (!payload) throw new Error('Actual income payload is required.');
  var month = payload.month ? String(payload.month).trim() : '';
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Month is required in yyyy-MM format.');
  }
  var grossIncome = Number(payload.gross_income);
  if (!Number.isFinite(grossIncome) || grossIncome < 0) {
    throw new Error('Gross income must be a non-negative number.');
  }
  var superannuation = Number(payload.superannuation);
  if (!Number.isFinite(superannuation) || superannuation < 0) {
    throw new Error('Superannuation must be a non-negative number.');
  }
  var tax = Number(payload.tax);
  if (!Number.isFinite(tax) || tax < 0) {
    throw new Error('Tax must be a non-negative number.');
  }
  var netIncome = Number(payload.net_income);
  if (!Number.isFinite(netIncome) || netIncome < 0) {
    throw new Error('Net income must be a non-negative number.');
  }
  return {
    id: existing && existing.id ? existing.id : (payload.id ? String(payload.id) : ''),
    month: month,
    gross_income: grossIncome,
    superannuation: superannuation,
    tax: tax,
    net_income: netIncome
  };
}

function buildActualIncomeRow(payload, timestamps) {
  return [
    payload.id,
    payload.month,
    Number(payload.gross_income),
    Number(payload.superannuation),
    Number(payload.tax),
    Number(payload.net_income),
    timestamps.created_at,
    timestamps.updated_at
  ];
}

function api_upsertActualIncome(payload) {
  var list = listActualIncomeInternal();
  var existing = null;
  if (payload && payload.id) {
    existing = list.find(function(item) { return item.id === payload.id; });
  }
  // Check if an entry already exists for this month (excluding current id if editing)
  var monthExists = list.find(function(item) {
    return item.month === payload.month && (!payload.id || item.id !== payload.id);
  });
  if (monthExists) {
    throw new Error('An actual income entry already exists for ' + payload.month + '. Please edit the existing entry instead.');
  }
  var normalizedPayload = normalizeActualIncomePayload(payload, existing);
  var sh = getActualIncomeSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : ACTUAL_INCOME_HEADERS;
  var idIndex = headers.indexOf('id');
  var targetRow = -1;
  if (normalizedPayload.id) {
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idIndex]) === normalizedPayload.id) {
        targetRow = i + 1;
        break;
      }
    }
  }
  var nowIso = toIsoDateTime(new Date());
  var timestamps = {
    created_at: existing ? existing.created_at : nowIso,
    updated_at: nowIso
  };
  if (!normalizedPayload.id) {
    normalizedPayload.id = Utilities.getUuid();
  }
  if (!timestamps.created_at) {
    timestamps.created_at = nowIso;
  }
  var row = buildActualIncomeRow(normalizedPayload, timestamps);
  if (targetRow === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }
  cacheClearPrefix(ACTUAL_INCOME_CACHE_KEY);
  var updated = listActualIncomeInternal().find(function(item) { return item.id === normalizedPayload.id; });
  return {
    success: true,
    actualIncome: updated
  };
}

function api_deleteActualIncome(id) {
  if (!id) throw new Error('Actual income id is required.');
  var sh = getActualIncomeSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return { success: true };
  var headers = values[0];
  var idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error('Invalid actual income sheet.');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(id)) {
      sh.deleteRow(i + 1);
      cacheClearPrefix(ACTUAL_INCOME_CACHE_KEY);
      return { success: true };
    }
  }
  return { success: true };
}
