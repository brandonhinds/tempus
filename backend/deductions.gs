var DEDUCTIONS_SHEET_NAME = 'deductions';
var DEDUCTIONS_HEADERS = [
  'id',
  'name',
  'category_id',
  'company_expense',
  'deduction_type',
  'amount_type',
  'amount_value',
  'gst_inclusive',
  'gst_amount',
  'frequency',
  'start_date',
  'end_date',
  'notes',
  'active',
  'created_at',
  'updated_at',
  'display_order'
];
var DEDUCTIONS_CACHE_KEY = 'deductions_v2';
var GST_RATE = 0.1;
var DEDUCTION_FREQUENCIES = ['once', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];

function getDeductionsSheet() {
  var sh = getOrCreateSheet(DEDUCTIONS_SHEET_NAME);
  ensureDeductionsSchema(sh);
  return sh;
}

function ensureDeductionsSchema(sh) {
  var expected = DEDUCTIONS_HEADERS;
  var rowCount = sh.getLastRow();
  var headerRange = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), expected.length));
  var headers = headerRange.getValues()[0];

  function refreshHeaders() {
    headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), expected.length)).getValues()[0];
  }

  // Ensure category_id column exists and rename legacy "category" header if present
  var categoryIdx = headers.indexOf('category_id');
  if (categoryIdx === -1) {
    var legacyIdx = headers.indexOf('category');
    if (legacyIdx !== -1) {
      sh.getRange(1, legacyIdx + 1).setValue('category_id');
      categoryIdx = legacyIdx;
    } else {
      var nameIdx = headers.indexOf('name');
      var insertAfter = nameIdx !== -1 ? nameIdx + 1 : 2;
      sh.insertColumnAfter(insertAfter);
      sh.getRange(1, insertAfter + 1).setValue('category_id');
      if (rowCount > 1) {
        sh.getRange(2, insertAfter + 1, rowCount - 1, 1).setValue('');
      }
      categoryIdx = insertAfter;
    }
  }
  refreshHeaders();

  // Ensure company_expense column exists (defaults to FALSE)
  var companyIdx = headers.indexOf('company_expense');
  if (companyIdx === -1) {
    var categoryCol = headers.indexOf('category_id');
    var anchor = categoryCol !== -1 ? categoryCol + 1 : headers.indexOf('name') + 1;
    if (anchor < 1) anchor = 2;
    sh.insertColumnAfter(anchor);
    sh.getRange(1, anchor + 1).setValue('company_expense');
    if (rowCount > 1) {
      sh.getRange(2, anchor + 1, rowCount - 1, 1).setValue('FALSE');
    }
    companyIdx = anchor;
  }
  refreshHeaders();

  // Migrate legacy personal/company values into new structure
  if (rowCount > 1) {
    var categoryPos = headers.indexOf('category_id');
    var companyPos = headers.indexOf('company_expense');
    if (categoryPos !== -1 && companyPos !== -1) {
      var dataRange = sh.getRange(2, 1, rowCount - 1, Math.max(sh.getLastColumn(), expected.length));
      var data = dataRange.getValues();
      var touched = false;
      for (var r = 0; r < data.length; r++) {
        var categoryValue = data[r][categoryPos];
        var companyValue = data[r][companyPos];
        if (categoryValue === 'company' || categoryValue === 'personal') {
          var isCompany = categoryValue === 'company';
          var desiredCompany = isCompany ? 'TRUE' : 'FALSE';
          if (companyValue !== desiredCompany) {
            data[r][companyPos] = desiredCompany;
            touched = true;
          }
          if (categoryValue !== '') {
            data[r][categoryPos] = '';
            touched = true;
          }
        } else if (companyValue === '' || companyValue === null) {
          data[r][companyPos] = 'FALSE';
          touched = true;
        }
      }
      if (touched) {
        dataRange.setValues(data);
      }
    }
  }

  // Finalize header row
  sh.getRange(1, 1, 1, expected.length).setValues([expected]);
}

function normalizeDeductionRow(row, headers) {
  if (!row) return null;
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = row[i];
  }
  var id = map.id ? String(map.id) : '';
  if (!id) return null;
  var amount = Number(map.amount_value) || 0;
  var gstInclusive = parseBoolean(map.gst_inclusive);
  var categoryId = map.category_id != null ? String(map.category_id).trim() : '';
  var legacyCategory = map.category != null ? String(map.category).toLowerCase() : '';
  if (!categoryId && (legacyCategory === 'personal' || legacyCategory === 'company')) {
    categoryId = '';
  }
  var companyExpense = map.company_expense !== undefined
    ? parseBoolean(map.company_expense)
    : legacyCategory === 'company';
  var gstAmount = 0;
  if (companyExpense && gstInclusive) {
    gstAmount = Number(map.gst_amount || (amount - amount / (1 + GST_RATE)));
  }
  var createdAt = toIsoDateTime(map.created_at || '');
  var updatedAt = toIsoDateTime(map.updated_at || '');
  var displayOrderRaw = Number(map.display_order);
  var displayOrder = Number.isFinite(displayOrderRaw) ? displayOrderRaw : null;
  return {
    id: id,
    name: map.name ? String(map.name) : '',
    category_id: categoryId,
    company_expense: companyExpense,
    deduction_type: map.deduction_type === 'extra_super' ? 'extra_super' : 'standard',
    amount_type: map.amount_type === 'percent' ? 'percent' : 'flat',
    amount_value: amount,
    gst_inclusive: gstInclusive,
    gst_amount: gstAmount,
    frequency: map.frequency ? String(map.frequency) : 'once',
    start_date: toIsoDate(map.start_date || ''),
    end_date: toIsoDate(map.end_date || ''),
    notes: map.notes ? String(map.notes) : '',
    active: map.active === '' ? true : parseBoolean(map.active),
    created_at: createdAt,
    updated_at: updatedAt,
    display_order: displayOrder
  };
}

function listDeductionsInternal() {
  var cached = cacheGet(DEDUCTIONS_CACHE_KEY);
  if (cached) return cached;
  var sh = getDeductionsSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) {
    cacheSet(DEDUCTIONS_CACHE_KEY, []);
    return [];
  }
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var normalized = normalizeDeductionRow(values[i], headers);
    if (normalized) result.push(normalized);
  }
  result.sort(function(a, b) {
    var orderA = Number.isFinite(a.display_order) ? a.display_order : Number.POSITIVE_INFINITY;
    var orderB = Number.isFinite(b.display_order) ? b.display_order : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  cacheSet(DEDUCTIONS_CACHE_KEY, result);
  return result;
}

function api_getDeductions() {
  return listDeductionsInternal();
}

function normalizeDeductionPayload(payload, existing) {
  if (!payload) throw new Error('Deduction payload is required.');
  var name = payload.name != null ? String(payload.name).trim() : '';
  if (!name) throw new Error('Deduction name is required.');

  var categoryId = payload.category_id != null ? String(payload.category_id).trim() : '';
  if (categoryId === 'company' || categoryId === 'personal') {
    categoryId = '';
  }
  var companyExpense = payload.company_expense !== undefined
    ? parseBoolean(payload.company_expense)
    : String(payload.category || '').toLowerCase() === 'company';

  var deductionType = payload.deduction_type === 'extra_super' ? 'extra_super' : 'standard';
  var amountType = deductionType === 'extra_super' && payload.amount_type === 'percent' ? 'percent' : 'flat';
  if (deductionType === 'standard' && amountType === 'percent') {
    throw new Error('Standard deductions must use flat amounts.');
  }

  var amountValue = Number(payload.amount_value);
  if (!Number.isFinite(amountValue) || amountValue < 0) {
    throw new Error('Deduction amount must be a non-negative number.');
  }
  if (amountType === 'percent') {
    if (amountValue > 1) {
      amountValue = amountValue / 100;
    }
    if (amountValue < 0 || amountValue > 0.5) {
      throw new Error('Percentage-based deductions must be between 0% and 50%.');
    }
  }

  var gstInclusive = parseBoolean(payload.gst_inclusive);
  if (deductionType === 'extra_super') {
    gstInclusive = false;
    companyExpense = false;
  }
  if (!companyExpense) {
    gstInclusive = false;
  }

  var frequencyRaw = payload.frequency ? String(payload.frequency).toLowerCase() : 'once';
  var frequency = DEDUCTION_FREQUENCIES.indexOf(frequencyRaw) === -1 ? 'once' : frequencyRaw;
  if (deductionType === 'extra_super' && amountType === 'percent' && frequency !== 'monthly') {
    throw new Error('Percentage-based extra super contributions must recur monthly.');
  }

  var startDateIso = toIsoDate(payload.start_date || '');
  if (!startDateIso) {
    throw new Error('A start date is required.');
  }
  var endDateIso = toIsoDate(payload.end_date || '');
  if (frequency !== 'once' && endDateIso && endDateIso < startDateIso) {
    throw new Error('End date must be after the start date.');
  }
  if (frequency === 'once') {
    endDateIso = '';
  }

  var notes = payload.notes != null ? String(payload.notes).trim() : '';
  var active = payload.active === '' || payload.active === undefined ? true : parseBoolean(payload.active);
  var displayOrderValue = null;
  if (payload.display_order !== undefined && payload.display_order !== null) {
    var candidateOrder = Number(payload.display_order);
    if (Number.isFinite(candidateOrder)) {
      displayOrderValue = candidateOrder;
    }
  } else if (existing && Number.isFinite(existing.display_order)) {
    displayOrderValue = existing.display_order;
  }

  return {
    id: existing && existing.id ? existing.id : (payload.id ? String(payload.id) : ''),
    name: name,
    category_id: categoryId,
    company_expense: companyExpense,
    deduction_type: deductionType,
    amount_type: amountType,
    amount_value: amountValue,
    gst_inclusive: gstInclusive,
    frequency: frequency,
    start_date: startDateIso,
    end_date: endDateIso,
    notes: notes,
    active: active,
    display_order: displayOrderValue
  };
}

function buildDeductionRow(payload, timestamps) {
  var amount = payload.amount_value;
  if (payload.amount_type === 'percent') {
    amount = Number(payload.amount_value);
  }
  var gstAmount = 0;
  if (payload.company_expense && payload.deduction_type === 'standard') {
    if (payload.gst_inclusive) {
      var inclusiveValue = Number(payload.amount_value);
      var ex = inclusiveValue / (1 + GST_RATE);
      gstAmount = inclusiveValue - ex;
    } else {
      gstAmount = 0;
    }
  }
  gstAmount = Math.round(gstAmount * 100) / 100;
  return [
    payload.id,
    payload.name,
    payload.category_id || '',
    payload.company_expense ? 'TRUE' : 'FALSE',
    payload.deduction_type,
    payload.amount_type,
    payload.amount_type === 'percent' ? payload.amount_value : Number(payload.amount_value),
    payload.gst_inclusive ? 'TRUE' : 'FALSE',
    gstAmount,
    payload.frequency,
    payload.start_date,
    payload.end_date,
    payload.notes,
    payload.active ? 'TRUE' : 'FALSE',
    timestamps.created_at,
    timestamps.updated_at,
    payload.display_order != null ? payload.display_order : ''
  ];
}

function api_upsertDeduction(payload) {
  var list = listDeductionsInternal();
  var existing = null;
  if (payload && payload.id) {
    existing = list.find(function(item) { return item.id === payload.id; });
  }
  var normalizedPayload = normalizeDeductionPayload(payload, existing);
  var sh = getDeductionsSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : DEDUCTIONS_HEADERS;
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
  var orderIndex = headers.indexOf('display_order');
  if (orderIndex !== -1 && !Number.isFinite(normalizedPayload.display_order)) {
    var nextOrder = 1;
    for (var i = 1; i < values.length; i++) {
      var existingOrder = Number(values[i][orderIndex]);
      if (isFinite(existingOrder)) {
        nextOrder = Math.max(nextOrder, existingOrder + 1);
      }
    }
    normalizedPayload.display_order = nextOrder;
  }
  var row = buildDeductionRow(normalizedPayload, timestamps);
  if (targetRow === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }
  cacheClearPrefix(DEDUCTIONS_CACHE_KEY);
  var updated = listDeductionsInternal().find(function(item) { return item.id === normalizedPayload.id; });
  return {
    success: true,
    deduction: updated
  };
}

function api_deleteDeduction(id) {
  if (!id) throw new Error('Deduction id is required.');
  var sh = getDeductionsSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return { success: true };
  var headers = values[0];
  var idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error('Invalid deductions sheet.');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(id)) {
      sh.deleteRow(i + 1);
      cacheClearPrefix(DEDUCTIONS_CACHE_KEY);
      return { success: true };
    }
  }
  return { success: true };
}

