var DEDUCTIONS_SHEET_NAME = 'deductions';
var DEDUCTIONS_HEADERS = [
  'id',
  'name',
  'category',
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
  'updated_at'
];
var DEDUCTIONS_CACHE_KEY = 'deductions_v1';
var GST_RATE = 0.1;
var DEDUCTION_FREQUENCIES = ['once', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];

function getDeductionsSheet() {
  var sh = getOrCreateSheet(DEDUCTIONS_SHEET_NAME);
  ensureDeductionsSchema(sh);
  return sh;
}

function ensureDeductionsSchema(sh) {
  var lastColumn = Math.max(sh.getLastColumn(), DEDUCTIONS_HEADERS.length);
  var headerRange = sh.getRange(1, 1, 1, lastColumn);
  var headers = headerRange.getValues()[0];
  var needsRewrite = false;
  for (var i = 0; i < DEDUCTIONS_HEADERS.length; i++) {
    if (headers[i] !== DEDUCTIONS_HEADERS[i]) {
      needsRewrite = true;
      break;
    }
  }
  if (needsRewrite) {
    sh.getRange(1, 1, 1, DEDUCTIONS_HEADERS.length).setValues([DEDUCTIONS_HEADERS]);
  }
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
  var category = (map.category || 'personal').toString().toLowerCase();
  var gstAmount = 0;
  if (category === 'company' && gstInclusive) {
    gstAmount = Number(map.gst_amount || (amount - amount / (1 + GST_RATE)));
  }
  return {
    id: id,
    name: map.name ? String(map.name) : '',
    category: category === 'company' ? 'company' : 'personal',
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
    created_at: toIsoDateTime(map.created_at || ''),
    updated_at: toIsoDateTime(map.updated_at || '')
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

  var categoryRaw = payload.category || 'personal';
  var category = String(categoryRaw).toLowerCase() === 'company' ? 'company' : 'personal';

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

  return {
    id: existing && existing.id ? existing.id : (payload.id ? String(payload.id) : ''),
    name: name,
    category: category,
    deduction_type: deductionType,
    amount_type: amountType,
    amount_value: amountValue,
    gst_inclusive: gstInclusive,
    frequency: frequency,
    start_date: startDateIso,
    end_date: endDateIso,
    notes: notes,
    active: active
  };
}

function buildDeductionRow(payload, timestamps) {
  var amount = payload.amount_value;
  if (payload.amount_type === 'percent') {
    amount = Number(payload.amount_value);
  }
  var gstAmount = 0;
  if (payload.category === 'company' && payload.deduction_type === 'standard') {
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
    payload.category,
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
    timestamps.updated_at
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
