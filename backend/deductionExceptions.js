var DEDUCTION_EXCEPTIONS_SHEET_NAME = 'deduction_occurrence_exceptions';
var DEDUCTION_EXCEPTIONS_HEADERS = [
  'id',
  'deduction_id',
  'original_date',
  'exception_type',
  'new_date',
  'new_amount',
  'notes',
  'created_at',
  'updated_at'
];
var DEDUCTION_EXCEPTIONS_CACHE_KEY = 'deduction_exceptions_v1';
var VALID_EXCEPTION_TYPES = ['skip', 'move', 'adjust_amount', 'move_and_adjust'];

function getDeductionExceptionsSheet() {
  var sh = getOrCreateSheet(DEDUCTION_EXCEPTIONS_SHEET_NAME);
  ensureDeductionExceptionsSchema(sh);
  return sh;
}

function ensureDeductionExceptionsSchema(sh) {
  var headerRange = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), DEDUCTION_EXCEPTIONS_HEADERS.length));
  var headers = headerRange.getValues()[0];
  var needsRewrite = false;
  for (var i = 0; i < DEDUCTION_EXCEPTIONS_HEADERS.length; i++) {
    if (headers[i] !== DEDUCTION_EXCEPTIONS_HEADERS[i]) {
      needsRewrite = true;
      break;
    }
  }
  if (needsRewrite) {
    sh.getRange(1, 1, 1, DEDUCTION_EXCEPTIONS_HEADERS.length).setValues([DEDUCTION_EXCEPTIONS_HEADERS]);
  }
}

function normalizeDeductionExceptionRow(row, headers) {
  if (!row) return null;
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = row[i];
  }
  var id = map.id ? String(map.id) : '';
  if (!id) return null;

  return {
    id: id,
    deduction_id: map.deduction_id ? String(map.deduction_id) : '',
    original_date: toIsoDate(map.original_date || ''),
    exception_type: map.exception_type ? String(map.exception_type) : 'skip',
    new_date: toIsoDate(map.new_date || ''),
    new_amount: Number(map.new_amount) || 0,
    notes: map.notes ? String(map.notes).trim() : '',
    created_at: toIsoDateTime(map.created_at || ''),
    updated_at: toIsoDateTime(map.updated_at || '')
  };
}

function listDeductionExceptionsInternal(deductionId) {
  var cacheKey = DEDUCTION_EXCEPTIONS_CACHE_KEY + '_' + (deductionId || 'all');
  var cached = cacheGet(cacheKey);
  if (cached) return cached;

  var sh = getDeductionExceptionsSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) {
    cacheSet(cacheKey, []);
    return [];
  }

  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var normalized = normalizeDeductionExceptionRow(values[i], headers);
    if (!normalized) continue;

    // Filter by deduction_id if provided
    if (deductionId && normalized.deduction_id !== String(deductionId)) continue;

    result.push(normalized);
  }

  cacheSet(cacheKey, result);
  return result;
}

function api_getDeductionExceptions(deductionId) {
  return listDeductionExceptionsInternal(deductionId);
}

function normalizeDeductionExceptionPayload(payload, existing) {
  if (!payload) throw new Error('Exception payload is required.');

  var deductionId = payload.deduction_id ? String(payload.deduction_id).trim() : '';
  if (!deductionId) throw new Error('Deduction ID is required.');

  var originalDate = toIsoDate(payload.original_date || '');
  if (!originalDate) throw new Error('Original date is required.');

  var exceptionType = payload.exception_type ? String(payload.exception_type).toLowerCase() : 'skip';
  if (VALID_EXCEPTION_TYPES.indexOf(exceptionType) === -1) {
    throw new Error('Invalid exception type. Must be one of: ' + VALID_EXCEPTION_TYPES.join(', '));
  }

  var newDate = '';
  var newAmount = 0;

  if (exceptionType === 'move' || exceptionType === 'move_and_adjust') {
    newDate = toIsoDate(payload.new_date || '');
    if (!newDate) throw new Error('New date is required for move exception.');
  }

  if (exceptionType === 'adjust_amount' || exceptionType === 'move_and_adjust') {
    newAmount = Number(payload.new_amount);
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      throw new Error('New amount must be a non-negative number.');
    }
  }

  var notes = payload.notes != null ? String(payload.notes).trim() : '';

  return {
    id: existing && existing.id ? existing.id : (payload.id ? String(payload.id) : ''),
    deduction_id: deductionId,
    original_date: originalDate,
    exception_type: exceptionType,
    new_date: newDate,
    new_amount: newAmount,
    notes: notes
  };
}

function buildDeductionExceptionRow(payload, timestamps) {
  return [
    payload.id,
    payload.deduction_id,
    payload.original_date,
    payload.exception_type,
    payload.new_date || '',
    payload.new_amount || 0,
    payload.notes,
    timestamps.created_at,
    timestamps.updated_at
  ];
}

function api_upsertDeductionException(payload) {
  var list = listDeductionExceptionsInternal(payload.deduction_id);
  var existing = null;
  if (payload && payload.id) {
    existing = list.find(function(item) { return item.id === payload.id; });
  }

  var normalizedPayload = normalizeDeductionExceptionPayload(payload, existing);

  var sh = getDeductionExceptionsSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : DEDUCTION_EXCEPTIONS_HEADERS;
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

  var row = buildDeductionExceptionRow(normalizedPayload, timestamps);
  if (targetRow === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }

  cacheClearPrefix(DEDUCTION_EXCEPTIONS_CACHE_KEY);

  var updated = listDeductionExceptionsInternal(normalizedPayload.deduction_id).find(function(item) {
    return item.id === normalizedPayload.id;
  });

  return {
    success: true,
    exception: updated
  };
}

function api_deleteDeductionException(id) {
  if (!id) throw new Error('Exception id is required.');

  var sh = getDeductionExceptionsSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return { success: true };

  var headers = values[0];
  var idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error('Invalid exceptions sheet.');

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(id)) {
      sh.deleteRow(i + 1);
      cacheClearPrefix(DEDUCTION_EXCEPTIONS_CACHE_KEY);
      return { success: true };
    }
  }

  return { success: true };
}

function api_deleteExceptionsByDeductionId(deductionId) {
  if (!deductionId) throw new Error('Deduction id is required.');

  var sh = getDeductionExceptionsSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return { success: true };

  var headers = values[0];
  var deductionIdIndex = headers.indexOf('deduction_id');
  if (deductionIdIndex === -1) throw new Error('Invalid exceptions sheet.');

  // Delete rows in reverse order to avoid index shifting issues
  var rowsToDelete = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][deductionIdIndex]) === String(deductionId)) {
      rowsToDelete.push(i + 1);
    }
  }

  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sh.deleteRow(rowsToDelete[j]);
  }

  if (rowsToDelete.length > 0) {
    cacheClearPrefix(DEDUCTION_EXCEPTIONS_CACHE_KEY);
  }

  return { success: true, deletedCount: rowsToDelete.length };
}

/**
 * Apply exceptions to a list of occurrence dates
 * @param {Array} occurrences - Array of date strings (yyyy-MM-dd)
 * @param {Array} exceptions - Array of exception objects
 * @returns {Array} Modified array of occurrence objects with exception info
 */
function applyExceptionsToOccurrences(occurrences, exceptions, periodStart, periodEnd) {
  var result = [];
  var seenKeys = {};
  var startIso = periodStart ? toIsoDate(periodStart) : null;
  var endIso = periodEnd ? toIsoDate(periodEnd) : null;
  var deductionId = '';
  if (exceptions && exceptions.length && exceptions[0].deduction_id) {
    deductionId = exceptions[0].deduction_id;
  } else if (Array.isArray(occurrences) && occurrences.length) {
    deductionId = 'unknown';
  }
  var debugPrefix = '[deductionExceptions] ';
  Logger.log(debugPrefix + 'applyExceptionsToOccurrences start deductionId=' + deductionId + ' occurrences=' + (occurrences ? occurrences.length : 0) + ' exceptions=' + (exceptions ? exceptions.length : 0) + ' window=' + (startIso || '-') + ' to ' + (endIso || '-'));

  function addOccurrence(entry, source) {
    if (!entry || !entry.date) {
      Logger.log(debugPrefix + 'skip addOccurrence - missing date. source=' + (source || ''));
      return;
    }
    if (startIso && entry.date < startIso) {
      Logger.log(debugPrefix + 'skip addOccurrence - before period start. date=' + entry.date + ' source=' + (source || ''));
      return;
    }
    if (endIso && entry.date > endIso) {
      Logger.log(debugPrefix + 'skip addOccurrence - after period end. date=' + entry.date + ' source=' + (source || ''));
      return;
    }
    var key = entry.date + '|' + (entry.originalDate || '');
    if (seenKeys[key]) {
      Logger.log(debugPrefix + 'skip addOccurrence - duplicate key ' + key + ' source=' + (source || ''));
      return;
    }
    seenKeys[key] = true;
    result.push(entry);
    Logger.log(debugPrefix + 'added occurrence date=' + entry.date + ' original=' + (entry.originalDate || '') + ' amount=' + (entry.amount || 'null') + ' exceptionType=' + (entry.exceptionType || 'none') + ' source=' + (source || 'base'));
  }

  var exceptionMap = {};
  if (Array.isArray(exceptions)) {
    exceptions.forEach(function(ex) {
      if (ex && ex.original_date) {
        exceptionMap[ex.original_date] = ex;
        Logger.log(debugPrefix + 'register exception original=' + ex.original_date + ' type=' + ex.exception_type + ' new=' + (ex.new_date || '') + ' amount=' + (ex.new_amount || ''));
      }
    });
  } else {
    exceptions = [];
  }

  if (Array.isArray(occurrences) && occurrences.length) {
    occurrences.forEach(function(date) {
      var exception = exceptionMap[date];
      if (exception) {
        if (exception.exception_type === 'skip') {
          Logger.log(debugPrefix + 'apply skip for ' + date);
          return;
        } else if (exception.exception_type === 'move' && exception.new_date) {
          Logger.log(debugPrefix + 'apply move for ' + date + ' -> ' + exception.new_date);
          addOccurrence({
            date: exception.new_date,
            originalDate: date,
            amount: null,
            hasException: true,
            exceptionType: 'move'
          }, 'exception:move');
        } else if (exception.exception_type === 'adjust_amount') {
          Logger.log(debugPrefix + 'apply adjust for ' + date + ' amount=' + exception.new_amount);
          addOccurrence({
            date: date,
            amount: exception.new_amount,
            hasException: true,
            exceptionType: 'adjust_amount'
          }, 'exception:adjust_amount');
        } else if (exception.exception_type === 'move_and_adjust' && exception.new_date) {
          Logger.log(debugPrefix + 'apply move_and_adjust for ' + date + ' -> ' + exception.new_date + ' amount=' + exception.new_amount);
          addOccurrence({
            date: exception.new_date,
            originalDate: date,
            amount: exception.new_amount,
            hasException: true,
            exceptionType: 'move_and_adjust'
          }, 'exception:move_and_adjust');
        } else {
          Logger.log(debugPrefix + 'unhandled exception type=' + exception.exception_type + ' for date=' + date);
        }
      } else {
        addOccurrence({
          date: date,
          amount: null,
          hasException: false,
          exceptionType: null
        }, 'base');
      }
    });
  }

  // Include moved occurrences whose originals were outside the occurrence window
  exceptions.forEach(function(ex) {
    if (!ex || (ex.exception_type !== 'move' && ex.exception_type !== 'move_and_adjust') || !ex.new_date) return;
    Logger.log(debugPrefix + 'add moved exception outside window original=' + (ex.original_date || '') + ' new=' + ex.new_date + ' type=' + ex.exception_type + ' amount=' + (ex.new_amount || ''));
    addOccurrence({
      date: ex.new_date,
      originalDate: ex.original_date || null,
      amount: ex.exception_type === 'move_and_adjust' ? ex.new_amount : null,
      hasException: true,
      exceptionType: ex.exception_type
    }, 'exception:moved_outside_window');
  });

  result.sort(function(a, b) {
    return a.date.localeCompare(b.date);
  });

  try {
    Logger.log(debugPrefix + 'applyExceptionsToOccurrences result count=' + result.length + ' dates=' + JSON.stringify(result));
  } catch (e) {
    Logger.log(debugPrefix + 'applyExceptionsToOccurrences result count=' + result.length);
  }

  return result;
}
