var DEDUCTION_CATEGORIES_SHEET_NAME = 'deduction_categories';
var DEDUCTION_CATEGORIES_HEADERS = [
  'id',
  'name',
  'color',
  'created_at',
  'updated_at'
];
var DEDUCTION_CATEGORIES_CACHE_KEY = 'deduction_categories_v1';

function getDeductionCategoriesSheet() {
  var sh = getOrCreateSheet(DEDUCTION_CATEGORIES_SHEET_NAME);
  ensureDeductionCategoriesSchema(sh);
  return sh;
}

function ensureDeductionCategoriesSchema(sh) {
  var headerRange = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), DEDUCTION_CATEGORIES_HEADERS.length));
  var headers = headerRange.getValues()[0];
  var needsRewrite = false;
  for (var i = 0; i < DEDUCTION_CATEGORIES_HEADERS.length; i++) {
    if (headers[i] !== DEDUCTION_CATEGORIES_HEADERS[i]) {
      needsRewrite = true;
      break;
    }
  }
  if (needsRewrite) {
    sh.getRange(1, 1, 1, DEDUCTION_CATEGORIES_HEADERS.length).setValues([DEDUCTION_CATEGORIES_HEADERS]);
  }
}

function normalizeDeductionCategoryRow(row, headers) {
  if (!row) return null;
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = row[i];
  }
  var id = map.id ? String(map.id) : '';
  if (!id) return null;
  return {
    id: id,
    name: map.name ? String(map.name).trim() : '',
    color: map.color ? String(map.color).trim() : '#6b7280',
    created_at: toIsoDateTime(map.created_at || ''),
    updated_at: toIsoDateTime(map.updated_at || '')
  };
}

function listDeductionCategoriesInternal() {
  var cached = cacheGet(DEDUCTION_CATEGORIES_CACHE_KEY);
  if (cached) return cached;
  var sh = getDeductionCategoriesSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) {
    cacheSet(DEDUCTION_CATEGORIES_CACHE_KEY, []);
    return [];
  }
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var normalized = normalizeDeductionCategoryRow(values[i], headers);
    if (normalized) result.push(normalized);
  }
  cacheSet(DEDUCTION_CATEGORIES_CACHE_KEY, result);
  return result;
}

function api_getDeductionCategories() {
  return listDeductionCategoriesInternal();
}

function normalizeDeductionCategoryPayload(payload, existing) {
  if (!payload) throw new Error('Category payload is required.');
  var name = payload.name != null ? String(payload.name).trim() : '';
  if (!name) throw new Error('Category name is required.');

  var color = payload.color != null ? String(payload.color).trim() : '#6b7280';
  if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
    throw new Error('Category color must be a hex value like #3b82f6.');
  }
  color = color.toLowerCase();

  return {
    id: existing && existing.id ? existing.id : (payload.id ? String(payload.id) : ''),
    name: name,
    color: color
  };
}

function buildDeductionCategoryRow(payload, timestamps) {
  return [
    payload.id,
    payload.name,
    payload.color,
    timestamps.created_at,
    timestamps.updated_at
  ];
}

function api_upsertDeductionCategory(payload) {
  var list = listDeductionCategoriesInternal();
  var existing = null;
  if (payload && payload.id) {
    existing = list.find(function(item) { return item.id === payload.id; });
  }
  var normalizedPayload = normalizeDeductionCategoryPayload(payload, existing);

  var duplicate = list.find(function(item) {
    if (existing && existing.id === item.id) return false;
    return item.name.toLowerCase() === normalizedPayload.name.toLowerCase();
  });
  if (duplicate) {
    throw new Error('A category with this name already exists.');
  }

  var sh = getDeductionCategoriesSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : DEDUCTION_CATEGORIES_HEADERS;
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

  var row = buildDeductionCategoryRow(normalizedPayload, timestamps);
  if (targetRow === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }

  cacheClearPrefix(DEDUCTION_CATEGORIES_CACHE_KEY);
  return {
    success: true,
    category: listDeductionCategoriesInternal().find(function(item) { return item.id === normalizedPayload.id; })
  };
}

function api_deleteDeductionCategory(id) {
  if (!id) throw new Error('Category id is required.');
  var sh = getDeductionCategoriesSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return { success: true };
  var headers = values[0];
  var idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error('Invalid category sheet.');

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(id)) {
      sh.deleteRow(i + 1);
      break;
    }
  }

  // Clear category reference from deductions that used this category
  var deductionSheet = getDeductionsSheet();
  var deductionValues = deductionSheet.getDataRange().getValues();
  if (deductionValues.length > 1) {
    var deductionHeaders = deductionValues[0];
    var categoryIdx = deductionHeaders.indexOf('category_id');
    if (categoryIdx !== -1) {
      var range = deductionSheet.getRange(2, categoryIdx + 1, deductionValues.length - 1, 1);
      var data = range.getValues();
      var touched = false;
      for (var r = 0; r < data.length; r++) {
        if (String(data[r][0]) === String(id)) {
          data[r][0] = '';
          touched = true;
        }
      }
      if (touched) {
        range.setValues(data);
      }
    }
  }

  cacheClearPrefix(DEDUCTION_CATEGORIES_CACHE_KEY);
  cacheClearPrefix(DEDUCTIONS_CACHE_KEY);
  return { success: true };
}
