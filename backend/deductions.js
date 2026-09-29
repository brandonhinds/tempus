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
  'display_order',
  'anchor_day'
];
var DEDUCTIONS_CACHE_KEY = 'deductions_v2';
var GST_RATE = 0.1;
var DEDUCTION_FREQUENCIES = ['once', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];

/**
 * The day of month a month-based schedule recurs on when it is later than its start date's day, or null.
 * Only a start date clamped to its month's last day can carry one: splitting a deduction anchored to the
 * 31st starts the new half on its next occurrence, which may be 28 February or 30 April, and anchor_day
 * keeps that half recurring on the 31st (month's last day) like the original. Any other combination is
 * ignored, so editing the start date away from a clamped month end drops a stale anchor.
 * Mirrors sanitizeDeductionAnchorDay in views/partials/scripts.html.
 */
function normalizeDeductionAnchorDay_(value, startDate, frequency) {
  var mode = String(frequency || '').toLowerCase();
  if (mode !== 'monthly' && mode !== 'quarterly' && mode !== 'yearly') return null;
  if (value === '' || value === null || value === undefined) return null;
  var day = Number(value);
  if (!Number.isInteger(day) || day > 31) return null;
  var start = toIsoDate(startDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  var year = Number(start.slice(0, 4));
  var month = Number(start.slice(5, 7));
  var startDay = Number(start.slice(8, 10));
  var lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (startDay !== lastDay || day <= startDay) return null;
  return day;
}

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
  var frequency = map.frequency ? String(map.frequency) : 'once';
  var startDate = toIsoDate(map.start_date || '');
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
    frequency: frequency,
    start_date: startDate,
    end_date: toIsoDate(map.end_date || ''),
    notes: map.notes ? String(map.notes) : '',
    active: map.active === '' ? true : parseBoolean(map.active),
    created_at: createdAt,
    updated_at: updatedAt,
    display_order: displayOrder,
    anchor_day: normalizeDeductionAnchorDay_(map.anchor_day, startDate, frequency)
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

  // The edit form does not send anchor_day, so an edit that keeps the start date keeps the anchor.
  var anchorSource = payload.anchor_day !== undefined
    ? payload.anchor_day
    : (existing && existing.start_date === startDateIso ? existing.anchor_day : null);

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
    display_order: displayOrderValue,
    anchor_day: normalizeDeductionAnchorDay_(anchorSource, startDateIso, frequency)
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
    payload.display_order != null ? payload.display_order : '',
    payload.anchor_day != null ? payload.anchor_day : ''
  ];
}

function api_upsertDeduction(payload) {
  return withScriptLock_('deduction update', function() { return upsertDeductionUnlocked_(payload); });
}

function upsertDeductionUnlocked_(payload) {
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
  return withScriptLock_('deduction removal', function() { return deleteDeductionUnlocked_(id); });
}

function deleteDeductionUnlocked_(id) {
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

/**
 * A deduction schedule's occurrence dates (ISO) from `startIso` through `throughIso`, computed on calendar
 * dates so no timezone can shift them. Month-based steps land on `anchorDay` (or the start date's day),
 * clamped to the target month's last day, like advanceDateByFrequency and the client's deductionOccurrenceDate.
 */
function deductionOccurrenceIsoDates_(startIso, frequency, anchorDay, throughIso) {
  var dates = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso || '') || !throughIso || startIso > throughIso) return dates;
  var y = Number(startIso.slice(0, 4)), m = Number(startIso.slice(5, 7)) - 1, d = Number(startIso.slice(8, 10));
  var iso = function(date) { return date.toISOString().slice(0, 10); };
  var mode = String(frequency || '').toLowerCase();
  var months = mode === 'monthly' ? 1 : mode === 'quarterly' ? 3 : mode === 'yearly' ? 12 : 0;
  var days = mode === 'weekly' ? 7 : mode === 'fortnightly' ? 14 : 0;
  for (var index = 0; index < 5000; index++) {
    var current;
    if (index === 0) current = startIso;
    else if (days) current = iso(new Date(Date.UTC(y, m, d + days * index, 12)));
    else if (months) {
      var lastDay = new Date(Date.UTC(y, m + months * index + 1, 0, 12)).getUTCDate();
      current = iso(new Date(Date.UTC(y, m + months * index, Math.min(anchorDay || d, lastDay), 12)));
    } else break;
    if (current > throughIso) break;
    dates.push(current);
  }
  return dates;
}

/**
 * Which of the original deduction's exceptions a split carries over to its new half: every one on an
 * occurrence after `endIso` (the original's new end date) that is also an occurrence of the new half. An
 * exception the legacy page recorded against a drifted date is re-keyed to its anchored date first (the new
 * half has an anchor_day, so it would never re-anchor it). Exceptions on or before the split point stay with
 * the original, and so do later ones the new schedule has no occurrence for (its frequency changed); those
 * stay inert past the original's end date, as before. Returns [{ id, original_date }].
 * Mirrors splitDeductionExceptionMoves in views/partials/scripts.html.
 */
function splitDeductionExceptionMoves_(original, exceptions, endIso, newHalf) {
  var list = (exceptions || []).filter(function(ex) { return ex && ex.id && ex.original_date; });
  if (!list.length) return [];
  var anchored = original.anchor_day ? list : anchorDeductionExceptions_(list, original.frequency, original.start_date);
  var latest = '';
  anchored.forEach(function(ex) { if (ex.original_date > latest) latest = ex.original_date; });
  var through = newHalf.end_date && newHalf.end_date < latest ? newHalf.end_date : latest;
  var occurrences = {};
  deductionOccurrenceIsoDates_(newHalf.start_date, newHalf.frequency, newHalf.anchor_day, through).forEach(function(iso) { occurrences[iso] = true; });
  var moves = [];
  anchored.forEach(function(ex, index) {
    if (list[index].original_date <= endIso || ex.original_date <= endIso || !occurrences[ex.original_date]) return;
    moves.push({ id: ex.id, original_date: ex.original_date });
  });
  return moves;
}

/**
 * Split a deduction that has past occurrences in one locked, idempotent write: end the original on its last
 * past occurrence (`end_date`), create the new half from `deduction` (starting on the next occurrence), and
 * carry the original's exceptions on later occurrences over to the new half. The new half's id is the
 * payload's client_request_id, so a retry after a lost response finds the split already saved and returns
 * it instead of splitting again. If a write fails, the ones before it are undone before the error is
 * rethrown, so the original is never left ended without its continuation.
 * payload: { client_request_id, original_id, expected: { start_date, end_date, frequency, anchor_day },
 *            end_date, deduction }
 */
function api_splitDeduction(payload) {
  return withScriptLock_('deduction split', function() { return splitDeductionUnlocked_(payload); });
}

function splitDeductionUnlocked_(payload) {
  if (!payload || !payload.deduction) throw new Error('Split payload is required.');
  var requestId = String(payload.client_request_id || '').trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) throw new Error('A stable split request ID is required.');
  var list = listDeductionsInternal();
  var original = list.find(function(item) { return item.id === String(payload.original_id || ''); });
  if (!original) return apiRecoverableFailure_('not_found', 'This deduction was removed elsewhere. Reload before saving.');
  var endIso = toIsoDate(payload.end_date || '');

  var replay = list.find(function(item) { return item.id === requestId; });
  if (replay) {
    // A retry of a split that already committed (its response was lost): return what it saved.
    if (original.end_date !== endIso) return apiRecoverableFailure_('conflict', 'This split request was already used. Reload before saving.');
    return { success: true, replayed: true, original: original, deduction: replay, exceptions: listDeductionExceptionsInternal(replay.id) };
  }

  var expected = payload.expected || {};
  var same = function(a, b) { return String(a == null ? '' : a) === String(b == null ? '' : b); };
  if (!same(original.start_date, toIsoDate(expected.start_date || '')) || !same(original.end_date, toIsoDate(expected.end_date || ''))
    || !same(original.frequency, expected.frequency) || !same(original.anchor_day, expected.anchor_day)) {
    return apiRecoverableFailure_('stale', 'This deduction changed elsewhere. Reload before saving.');
  }
  if (!endIso || endIso < original.start_date || (original.end_date && endIso > original.end_date)) {
    return apiRecoverableFailure_('invalid_request', 'The split date is outside this deduction.');
  }

  // Validate both halves before writing anything.
  var newPayload = {};
  Object.keys(payload.deduction).forEach(function(key) { newPayload[key] = payload.deduction[key]; });
  newPayload.id = requestId;
  var newHalf = normalizeDeductionPayload(newPayload, null);
  if (newHalf.start_date <= endIso) return apiRecoverableFailure_('invalid_request', 'The new deduction must start after the split date.');
  var endedOriginal = {};
  Object.keys(original).forEach(function(key) { endedOriginal[key] = original[key]; });
  endedOriginal.end_date = endIso;
  normalizeDeductionPayload(endedOriginal, original);

  var moves = splitDeductionExceptionMoves_(original, listDeductionExceptionsInternal(original.id), endIso, newHalf);

  var dsh = getDeductionsSheet();
  var dValues = dsh.getDataRange().getValues();
  var dIdIndex = dValues[0].indexOf('id');
  var originalRow = null;
  for (var r = 1; r < dValues.length; r++) {
    if (String(dValues[r][dIdIndex]) === original.id) { originalRow = { number: r + 1, values: dValues[r].slice() }; break; }
  }
  if (!originalRow) throw new Error('Deduction row not found.');

  var created = false, movedCells = [];
  var esh = null, eIdx = null;
  try {
    // The new half first, then its exceptions, and the original is ended last.
    var createdResult = upsertDeductionUnlocked_(newPayload);
    created = true;
    if (moves.length) {
      esh = getDeductionExceptionsSheet();
      var eValues = esh.getDataRange().getValues();
      var eHeaders = eValues[0];
      eIdx = { id: eHeaders.indexOf('id'), deduction: eHeaders.indexOf('deduction_id'), date: eHeaders.indexOf('original_date'), updated: eHeaders.indexOf('updated_at') };
      var byId = {};
      moves.forEach(function(move) { byId[move.id] = move; });
      var nowIso = toIsoDateTime(new Date());
      for (var e = 1; e < eValues.length; e++) {
        var move = byId[String(eValues[e][eIdx.id])];
        if (!move) continue;
        movedCells.push({ row: e + 1, deduction: eValues[e][eIdx.deduction], date: eValues[e][eIdx.date], updated: eIdx.updated === -1 ? null : eValues[e][eIdx.updated] });
        esh.getRange(e + 1, eIdx.deduction + 1).setValue(requestId);
        esh.getRange(e + 1, eIdx.date + 1).setValue(move.original_date);
        if (eIdx.updated !== -1) esh.getRange(e + 1, eIdx.updated + 1).setValue(nowIso);
      }
      cacheClearPrefix(DEDUCTION_EXCEPTIONS_CACHE_KEY);
    }
    var endedResult = upsertDeductionUnlocked_(endedOriginal);
    return {
      success: true,
      original: endedResult.deduction,
      deduction: createdResult.deduction,
      exceptions: listDeductionExceptionsInternal(requestId),
      moved_exception_ids: moves.map(function(move) { return move.id; })
    };
  } catch (err) {
    // Undo what was written, newest first, so the sheets are as they were before the split.
    try {
      // The new half was appended below the original, so the original's row number still holds.
      if (created) dsh.getRange(originalRow.number, 1, 1, originalRow.values.length).setValues([originalRow.values]);
      for (var u = movedCells.length - 1; u >= 0; u--) {
        var cell = movedCells[u];
        esh.getRange(cell.row, eIdx.deduction + 1).setValue(cell.deduction);
        esh.getRange(cell.row, eIdx.date + 1).setValue(cell.date);
        if (cell.updated !== null) esh.getRange(cell.row, eIdx.updated + 1).setValue(cell.updated);
      }
      if (created) deleteDeductionUnlocked_(requestId);
    } finally {
      cacheClearPrefix(DEDUCTIONS_CACHE_KEY);
      cacheClearPrefix(DEDUCTION_EXCEPTIONS_CACHE_KEY);
    }
    throw err;
  }
}
