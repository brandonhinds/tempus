var BULK_SHEET_NAME = 'bulk_time_entries';
var BULK_ENTRY_HEADERS = [
  'id',
  'label',
  'duration_minutes',
  'hour_type_id',
  'contract_id',
  'start_date',
  'end_date',
  'include_weekends',
  'skip_public_holidays',
  'last_synced_at',
  'last_synced_count',
  'warning_message',
  'distribution_mode',
  'monthly_total_minutes',
  'created_at',
  'updated_at',
  // Appended LAST (Phase 6, sessions on schedules) — '' = whole-hours range. Sessions imply the
  // 'daily' distribution (they're a per-day shape; a monthly total can't be expressed as sessions).
  'sessions_json'
];
var BULK_MAX_RANGE_DAYS = 366; // inclusive days (roughly 1 year)

function clampBulkRoundInterval(value) {
  var num = Number(value);
  if (!isFinite(num) || num <= 0) return 0;
  if (num > 60) return 60;
  return num;
}

function getBulkEntriesSheet() {
  var sh = getOrCreateSheet(BULK_SHEET_NAME);
  ensureBulkEntriesSchema(sh);
  return sh;
}

function ensureBulkEntriesSchema(sh) {
  if (!sh) return;
  var headerRange = sh.getRange(1, 1, 1, BULK_ENTRY_HEADERS.length);
  var headers = headerRange.getValues()[0];
  var needsReset = headers.length < BULK_ENTRY_HEADERS.length;
  if (!needsReset) {
    for (var i = 0; i < BULK_ENTRY_HEADERS.length; i++) {
      if (headers[i] !== BULK_ENTRY_HEADERS[i]) {
        needsReset = true;
        break;
      }
    }
  }
  if (needsReset) {
    headerRange.setValues([BULK_ENTRY_HEADERS]);
  }
}

function listBulkEntriesInternal() {
  var sh = getBulkEntriesSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var h = 0; h < headers.length; h++) {
      obj[headers[h]] = row[h];
    }
    var normalized = normalizeBulkEntryRow(obj);
    normalized.__row = i + 1;
    rows.push(normalized);
  }
  return rows;
}

function normalizeBulkEntryRow(entry) {
  if (!entry) entry = {};
  var sessions = parseScheduleSessions(entry.sessions_json);
  return {
    id: entry.id ? String(entry.id).trim() : '',
    label: entry.label ? String(entry.label).trim() : '',
    sessions_json: sessions.length ? JSON.stringify(sessions) : '',
    duration_minutes: sessions.length ? punchesTotalMinutes(sessions) : normalizeDurationMinutes(entry.duration_minutes),
    hour_type_id: entry.hour_type_id ? String(entry.hour_type_id).trim() : '',
    contract_id: entry.contract_id ? String(entry.contract_id).trim() : '',
    start_date: toIsoDate(entry.start_date),
    end_date: toIsoDate(entry.end_date),
    include_weekends: boolFromSheetCell(entry.include_weekends),
    skip_public_holidays: entry.skip_public_holidays === false || entry.skip_public_holidays === 'FALSE'
      ? false
      : true,
    last_synced_at: toIsoDateTime(entry.last_synced_at),
    last_synced_count: parsePositiveInteger(entry.last_synced_count, 0),
    warning_message: entry.warning_message ? String(entry.warning_message).trim() : '',
    distribution_mode: entry.distribution_mode === 'monthly' ? 'monthly' : 'daily',
    monthly_total_minutes: normalizeDurationMinutes(entry.monthly_total_minutes),
    created_at: toIsoDateTime(entry.created_at),
    updated_at: toIsoDateTime(entry.updated_at)
  };
}

function normalizeBulkPayload(payload) {
  if (!payload) throw new Error('Bulk entry payload is required.');
  var normalized = {};
  normalized.id = payload.id ? String(payload.id).trim() : '';
  normalized.label = payload.label ? String(payload.label).trim() : '';
  if (!normalized.label) throw new Error('Name is required.');
  // Sessions range: spans define each day's shape — duration derives from them and the distribution is
  // forced to 'daily' (sessions can't express a spread-over-the-month total).
  var sessions = parseScheduleSessions(payload.sessions != null ? payload.sessions : payload.sessions_json);
  normalized.sessions_json = sessions.length ? JSON.stringify(sessions) : '';
  var durationMinutes = sessions.length
    ? punchesTotalMinutes(sessions)
    : normalizeDurationMinutes(payload.duration_minutes != null ? payload.duration_minutes : payload.durationMinutes);
  if (sessions.length && (!durationMinutes || durationMinutes <= 0)) {
    throw new Error('Sessions must have an end after their start.');
  }
  var monthlyMinutes = normalizeDurationMinutes(payload.monthly_total_minutes != null ? payload.monthly_total_minutes : payload.monthlyMinutes);
  normalized.distribution_mode = (payload.distribution_mode === 'monthly' && !sessions.length) ? 'monthly' : 'daily';
  if (normalized.distribution_mode === 'monthly') {
    if (!monthlyMinutes || monthlyMinutes <= 0) {
      throw new Error('Monthly hours must be greater than zero minutes.');
    }
    normalized.monthly_total_minutes = monthlyMinutes;
    normalized.duration_minutes = durationMinutes > 0 ? durationMinutes : 0;
  } else {
    if (!durationMinutes || durationMinutes <= 0) {
      throw new Error('Duration must be greater than zero minutes.');
    }
    normalized.duration_minutes = durationMinutes;
    normalized.monthly_total_minutes = 0;
  }
  normalized.contract_id = payload.contract_id ? String(payload.contract_id).trim() : '';
  if (!normalized.contract_id) {
    throw new Error('Select a contract.');
  }
  normalized.hour_type_id = payload.hour_type_id ? String(payload.hour_type_id).trim() : '';
  normalized.start_date = toIsoDate(payload.start_date);
  normalized.end_date = toIsoDate(payload.end_date);
  if (!normalized.start_date) throw new Error('Start date is required.');
  if (!normalized.end_date) throw new Error('End date is required.');
  if (normalized.end_date < normalized.start_date) {
    throw new Error('End date must be on or after the start date.');
  }
  var spanDays = daysBetweenIso(normalized.start_date, normalized.end_date);
  if (spanDays > BULK_MAX_RANGE_DAYS) {
    throw new Error('Date range is too large. Limit bulk entries to roughly one year.');
  }
  normalized.include_weekends = payload.include_weekends === true || payload.include_weekends === 'TRUE';
  if (payload.hasOwnProperty('skip_public_holidays')) {
    normalized.skip_public_holidays = payload.skip_public_holidays === true || payload.skip_public_holidays === 'TRUE';
  } else {
    normalized.skip_public_holidays = true;
  }
  normalized.last_synced_at = toIsoDateTime(payload.last_synced_at);
  normalized.last_synced_count = parsePositiveInteger(payload.last_synced_count, 0);
  normalized.warning_message = payload.warning_message ? String(payload.warning_message).trim() : '';
  normalized.created_at = toIsoDateTime(payload.created_at);
  normalized.updated_at = toIsoDateTime(payload.updated_at);
  return normalized;
}

function persistBulkEntry(entry) {
  var sh = getBulkEntriesSheet();
  var values = [
    entry.id,
    entry.label,
    entry.duration_minutes,
    entry.hour_type_id,
    entry.contract_id,
    entry.start_date,
    entry.end_date,
    entry.include_weekends ? 'TRUE' : 'FALSE',
    entry.skip_public_holidays ? 'TRUE' : 'FALSE',
    entry.last_synced_at,
    entry.last_synced_count,
    entry.warning_message,
    entry.distribution_mode,
    entry.monthly_total_minutes,
    entry.created_at,
    entry.updated_at,
    entry.sessions_json || ''
  ];
  // 'label' is free text the user types. Google Sheets auto-coerces a date-like label ("Jul 6") into a
  // real date cell, so it reads back as a Date object and stringifies to "Mon Jul 06 2026 00:00:00 GMT…".
  // Forcing the label column to plain-text format before writing makes Sheets store it verbatim.
  var labelCol = BULK_ENTRY_HEADERS.indexOf('label') + 1;
  var row = entry.__row || (sh.getLastRow() + 1);
  if (labelCol > 0) sh.getRange(row, labelCol).setNumberFormat('@');
  sh.getRange(row, 1, 1, BULK_ENTRY_HEADERS.length).setValues([values]);
  entry.__row = row;
  return entry;
}

function cloneBulkEntry(entry) {
  var clone = JSON.parse(JSON.stringify(entry));
  delete clone.__row;
  return clone;
}

function findBulkEntryById(entries, id) {
  if (!id) return null;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].id === id) return entries[i];
  }
  return null;
}

function api_getBulkTimeEntries() {
  return listBulkEntriesInternal().map(cloneBulkEntry);
}

function api_upsertBulkTimeEntry(payload) {
  return withScriptLock_('bulk schedule update', function() { return upsertBulkTimeEntryUnlocked_(payload); });
}

function upsertBulkTimeEntryUnlocked_(payload) {
  var normalized = normalizeBulkPayload(payload);
  var entries = listBulkEntriesInternal();
  var now = new Date();
  var isoNow = toIsoDateTime(now);
  var existing = normalized.id ? findBulkEntryById(entries, normalized.id) : null;
  if (existing) {
    normalized.id = existing.id;
    normalized.created_at = existing.created_at;
    normalized.last_synced_at = existing.last_synced_at;
    normalized.last_synced_count = existing.last_synced_count;
    normalized.warning_message = existing.warning_message;
    normalized.__row = existing.__row;
  } else {
    normalized.id = Utilities.getUuid();
    normalized.created_at = isoNow;
    normalized.last_synced_at = '';
    normalized.last_synced_count = 0;
    normalized.warning_message = '';
  }
  normalized.updated_at = isoNow;
  persistBulkEntry(normalized);
  var refreshed = listBulkEntriesInternal();
  return {
    success: true,
    entry: cloneBulkEntry(findBulkEntryById(refreshed, normalized.id)),
    entries: refreshed.map(cloneBulkEntry)
  };
}

function deleteEntriesForBulkSchedule(recurrenceId) {
  if (!recurrenceId) return 0;
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return 0;
  var headers = values[0];
  var recurrenceIdx = headers.indexOf('recurrence_id');
  var sourceTypeIdx = headers.indexOf('source_type');
  var sourceIdIdx = headers.indexOf('source_id');
  if (recurrenceIdx === -1 && sourceIdIdx === -1) return 0;
  var rowsToDelete = [];
  for (var i = values.length - 1; i >= 1; i--) {
    var recurrence = String(values[i][recurrenceIdx] || '').trim();
    var sourceMatch = sourceIdIdx !== -1 && String(values[i][sourceIdIdx] || '').trim() === recurrenceId && (sourceTypeIdx === -1 || String(values[i][sourceTypeIdx] || '') === 'bulk');
    if (recurrence !== recurrenceId && !sourceMatch) continue;
    rowsToDelete.push(i + 1);
  }
  var deleted = deleteSheetRowsDescending_(sh, rowsToDelete);
  if (deleted > 0) {
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
  }
  return deleted;
}

// Detach (rather than delete) the entries a bulk schedule created: blank their recurrence_id so they
// become ordinary manual entries. Used when the user removes a range card but wants to keep the time it
// already logged ("the bulk entry did its job — drop the reminder, keep the hours").
function detachEntriesFromBulkSchedule(recurrenceId) {
  if (!recurrenceId) return 0;
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return 0;
  var headers = values[0];
  var recurrenceIdx = headers.indexOf('recurrence_id');
  var sourceTypeIdx = headers.indexOf('source_type');
  var sourceIdIdx = headers.indexOf('source_id');
  var sourceOccurrenceIdx = headers.indexOf('source_occurrence_key');
  if (recurrenceIdx === -1 && sourceIdIdx === -1) return 0;
  var detached = 0;
  for (var i = 1; i < values.length; i++) {
    var recurrence = recurrenceIdx === -1 ? '' : String(values[i][recurrenceIdx] || '').trim();
    var sourceMatch = sourceIdIdx !== -1 && String(values[i][sourceIdIdx] || '').trim() === recurrenceId && (sourceTypeIdx === -1 || String(values[i][sourceTypeIdx] || '') === 'bulk');
    if (recurrence !== recurrenceId && !sourceMatch) continue;
    if (recurrenceIdx !== -1) values[i][recurrenceIdx] = '';
    if (sourceTypeIdx !== -1) values[i][sourceTypeIdx] = 'manual';
    if (sourceIdIdx !== -1) values[i][sourceIdIdx] = '';
    if (sourceOccurrenceIdx !== -1) values[i][sourceOccurrenceIdx] = '';
    detached += 1;
  }
  if (detached) sh.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  if (detached > 0) {
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
  }
  return detached;
}

// keepEntries: when true, the generated entries are detached and left on the sheet; otherwise they are
// deleted along with the range card (the original cascade behaviour).
function api_deleteBulkTimeEntry(id, keepEntries) {
  return withScriptLock_('bulk schedule removal', function() { return deleteBulkTimeEntryUnlocked_(id, keepEntries); });
}

function deleteBulkTimeEntryUnlocked_(id, keepEntries) {
  if (!id) throw new Error('Bulk entry id is required.');
  var sh = getBulkEntriesSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return { success: true, entries: [] };
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sh.deleteRow(i + 1);
      if (keepEntries) {
        detachEntriesFromBulkSchedule(id);
      } else {
        deleteEntriesForBulkSchedule(id);
      }
      var remaining = listBulkEntriesInternal();
      return { success: true, entries: remaining.map(cloneBulkEntry) };
    }
  }
  throw new Error('Bulk entry not found.');
}

function api_syncBulkTimeEntries(options) {
  return withScriptLock_('bulk schedule sync', function() { return syncBulkTimeEntries(options || {}); });
}

function syncBulkTimeEntries(options) {
  var filterId = options && options.entryId ? String(options.entryId).trim() : '';
  var allEntries = listBulkEntriesInternal();
  var entries = allEntries;
  if (filterId) {
    entries = allEntries.filter(function(entry) { return entry.id === filterId; });
  }
  if (!entries.length) {
    var emptyResponse = filterId ? allEntries.map(cloneBulkEntry) : [];
    return { success: true, entries: emptyResponse, summary: [], totalChanges: 0 };
  }
  var contracts = api_getContracts();
  var contractMap = {};
  contracts.forEach(function(contract) {
    contractMap[contract.id] = contract;
  });
  var hourTypeMap = {};
  try {
    var hourTypes = api_getHourTypes();
    hourTypes.forEach(function(type) {
      hourTypeMap[type.id] = type;
    });
  } catch (e) {
    // hour types optional
  }
  var existingEntryCache = buildBulkExistingEntryCache();
  var settings = api_getSettings();
  var roundInterval = clampBulkRoundInterval(settings && settings.round_to_nearest);
  var context = {
    contracts: contractMap,
    hourTypes: hourTypeMap,
    holidayYearCache: {},
    holidayDateCache: {},
    totalCreates: 0,
    totalUpdates: 0,
    totalDeletes: 0,
    existingEntries: existingEntryCache,
    roundInterval: roundInterval,
    batchCreates: [],
    batchMeta: []
  };
  var summaries = [];
  entries.forEach(function(entry) {
    var outcome = processBulkEntry(entry, context);
    summaries.push(outcome.summary);
    if (outcome.entryChanged) {
      persistBulkEntry(entry);
    }
  });
  if (context.batchCreates.length) {
    var bulkRes = api_addEntriesBulk({ entries: context.batchCreates });
    var alignedResults = bulkRes && bulkRes.results ? bulkRes.results : [];
    for (var c = 0; c < alignedResults.length && c < context.batchMeta.length; c++) {
      var meta = context.batchMeta[c];
      var result = alignedResults[c];
      var item = result && result.entry;
      if (!meta || !result) continue;
      if (result.status === 'failed') {
        var failedSummary = summaries.filter(function(summary) { return summary.id === meta.recurrenceId; })[0];
        if (failedSummary) failedSummary.warning = 'Entry for ' + meta.date + ' failed: ' + (result.error || 'unknown error');
        continue;
      }
      if (!item) continue;
      if (!context.existingEntries[meta.recurrenceId]) context.existingEntries[meta.recurrenceId] = {};
      context.existingEntries[meta.recurrenceId][meta.date] = {
        id: item.id,
        duration_minutes: meta.durationMinutes,
        contract_id: meta.contractId,
        hour_type_id: meta.hourTypeId || '',
        punches_json: meta.punchesJson || ''
      };
    }
    context.totalCreates += bulkRes && bulkRes.added ? bulkRes.added : 0;
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
  } else if (context.totalCreates > 0 || context.totalUpdates > 0 || context.totalDeletes > 0) {
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
  }
  var responseEntries = filterId ? allEntries : entries;
  return {
    success: true,
    entries: responseEntries.map(cloneBulkEntry),
    summary: summaries,
    totalChanges: context.totalCreates + context.totalUpdates + context.totalDeletes
  };
}

function processBulkEntry(entry, context) {
  var summary = {
    id: entry.id,
    label: entry.label,
    created: 0,
    updated: 0,
    deleted: 0,
    warning: ''
  };
  var entryChanged = false;
  var contract = context.contracts[entry.contract_id] || null;
  if (!contract) {
    summary.warning = 'Contract not found.';
    if ((entry.warning_message || '') !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged };
  }
  if (!contract.start_date || !contract.end_date) {
    summary.warning = 'Contract "' + contract.name + '" is missing start/end dates.';
    if ((entry.warning_message || '') !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged };
  }
  var startBound = isoDateMax(entry.start_date, contract.start_date);
  var endBound = isoDateMin(entry.end_date, contract.end_date);
  if (!startBound || !endBound || endBound < startBound) {
    summary.warning = 'No valid window inside contract.';
    if ((entry.warning_message || '') !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged };
  }
  var desiredDates = collectBulkDates(startBound, endBound, entry, context);
  var durationResult = buildBulkDateDurations(entry, desiredDates, context);
  if (durationResult.error) {
    summary.warning = durationResult.error;
    if ((entry.warning_message || '') !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged };
  }
  var dayMinutesMap = durationResult.durations || {};
  var desiredMap = {};
  desiredDates.forEach(function(d) {
    if ((dayMinutesMap[d] || 0) > 0) {
      desiredMap[d] = true;
    }
  });
  var existingEntries = context.existingEntries[entry.id] || {};
  context.existingEntries[entry.id] = existingEntries;
  Object.keys(existingEntries).forEach(function(dateIso) {
    if (!desiredMap[dateIso]) {
      var record = existingEntries[dateIso];
      if (record && record.id) {
        try {
          api_deleteEntry(record.id);
          summary.deleted += 1;
          context.totalDeletes += 1;
          delete existingEntries[dateIso];
        } catch (e) {}
      }
    }
  });
  desiredDates.forEach(function(dateIso) {
    var minutesForDay = dayMinutesMap[dateIso] || 0;
    if (minutesForDay <= 0) return;
    var existing = existingEntries[dateIso];
    if (!existing) {
      var createdEntry = createBulkEntryInstance(entry, dateIso, minutesForDay, context);
      if (createdEntry) {
        summary.created += 1;
        if (createdEntry.id) {
          existingEntries[dateIso] = {
            id: createdEntry.id,
            duration_minutes: minutesForDay,
            contract_id: entry.contract_id,
            hour_type_id: entry.hour_type_id || ''
          };
        }
      }
      return;
    }
    var targetHourType = entry.hour_type_id || '';
    var existingHourType = existing.hour_type_id || '';
    // Sessions range: the instance must carry the schedule's spans as advanced punches; a reshape with
    // the same total (which the duration compare can't see) is caught by comparing punches_json.
    var scheduleSessions = parseScheduleSessions(entry.sessions_json);
    var desiredPunches = scheduleSessions.length ? scheduleSessions : buildBasicPunches(minutesForDay);
    var desiredPunchesJson = JSON.stringify(desiredPunches);
    var needsUpdate = existing.duration_minutes !== minutesForDay ||
      existing.contract_id !== entry.contract_id ||
      existingHourType !== targetHourType ||
      (scheduleSessions.length > 0 && (existing.punches_json || '') !== desiredPunchesJson);
    if (!needsUpdate) return;
    var updatePayload = {
      id: existing.id,
      duration_minutes: minutesForDay,
      contract_id: entry.contract_id,
      hour_type_id: targetHourType,
      entry_type: scheduleSessions.length ? 'advanced' : 'basic',
      punches: desiredPunches,
      recurrence_id: entry.id,
      date: dateIso
    };
    try {
      api_updateEntry(updatePayload);
      summary.updated += 1;
      context.totalUpdates += 1;
      existing.duration_minutes = minutesForDay;
      existing.contract_id = entry.contract_id;
      existing.hour_type_id = targetHourType || '';
      existing.punches_json = desiredPunchesJson;
    } catch (e) {}
  });
  var warning = '';
  if (!Object.keys(desiredMap).length) {
    warning = 'No days met the selected filters.';
  }
  if (durationResult.warning) {
    warning = warning ? warning + ' ' + durationResult.warning : durationResult.warning;
  }
  summary.warning = warning;
  if ((entry.warning_message || '') !== warning) {
    entry.warning_message = warning;
    entryChanged = true;
  }
  entry.last_synced_at = toIsoDateTime(new Date());
  entry.last_synced_count = Object.keys(desiredMap).length;
  entry.updated_at = entry.last_synced_at;
  if (!entryChanged && (summary.created || summary.updated || summary.deleted)) {
    entryChanged = true;
  }
  return { summary: summary, entryChanged: entryChanged };
}

function collectBulkDates(startIso, endIso, entry, context) {
  var result = [];
  var startDate = parseIsoDateStrict(startIso);
  var endDate = parseIsoDateStrict(endIso);
  if (!startDate || !endDate) return result;
  var holidaySet = null;
  if (entry.skip_public_holidays) {
    holidaySet = getHolidaySetForRange(startIso, endIso, context);
  }
  var cursor = new Date(startDate.getTime());
  while (cursor <= endDate) {
    var iso = toIsoDate(cursor);
    var isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
    if (!entry.include_weekends && isWeekend) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    if (entry.skip_public_holidays && holidaySet && holidaySet[iso]) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    result.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function buildBulkDateDurations(entry, dates, context) {
  var map = {};
  if (!dates || !dates.length) {
    return { durations: map };
  }
  if (entry.distribution_mode === 'monthly') {
    return distributeMonthlyDurations(entry, dates, context);
  }
  var minutes = Number(entry.duration_minutes) || 0;
  if (minutes <= 0) {
    return { error: 'Hours per day must be greater than zero minutes.' };
  }
  dates.forEach(function(dateIso) {
    map[dateIso] = minutes;
  });
  return { durations: map };
}

function distributeMonthlyDurations(entry, dates, context) {
  var map = {};
  var totalMinutes = Number(entry.monthly_total_minutes) || 0;
  if (totalMinutes <= 0) {
    return { error: 'Monthly hours must be greater than zero minutes.' };
  }
  if (!dates || !dates.length) {
    return { durations: map, warning: 'No days met the selected filters.' };
  }
  var interval = clampBulkRoundInterval(context.roundInterval);
  var quantum = interval > 0 ? interval : 1;
  var totalUnits = Math.round(totalMinutes / quantum);
  if (totalUnits <= 0) {
    return { error: 'Monthly hours must be greater than zero minutes.' };
  }
  var days = dates.length;
  var perDayUnits = Math.max(0, Math.round(totalUnits / days));
  var allocations = [];
  for (var i = 0; i < days - 1; i++) {
    allocations.push(perDayUnits);
  }
  var lastUnits = totalUnits - perDayUnits * (days - 1);
  var adjustments = 0;
  if (lastUnits <= 0) {
    for (var j = allocations.length - 1; j >= 0 && lastUnits <= 0; j--) {
      if (allocations[j] > 0) {
        allocations[j] -= 1;
        lastUnits += 1;
        adjustments += 1;
      }
    }
    if (lastUnits <= 0) {
      lastUnits = 0;
    }
  }
  allocations.push(lastUnits);
  var warningParts = [];
  if (adjustments > 0) {
    warningParts.push('Adjusted earlier days to keep the last day above zero hours.');
  }
  var zeroCount = 0;
  allocations.forEach(function(units, idx) {
    var minutes = units * quantum;
    if (minutes <= 0) zeroCount += 1;
    map[dates[idx]] = minutes;
  });
  if (zeroCount > 0) {
    warningParts.push('Some days were skipped because the monthly hours are lower than the selected rounding interval.');
  }
  return { durations: map, warning: warningParts.join(' ') };
}

function getHolidaySetForRange(startIso, endIso, context) {
  var key = startIso + '__' + endIso;
  if (context.holidayDateCache[key]) {
    return context.holidayDateCache[key];
  }
  var startDate = parseIsoDateStrict(startIso);
  var endDate = parseIsoDateStrict(endIso);
  if (!startDate || !endDate) return {};
  for (var year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
    if (!context.holidayYearCache[year]) {
      try {
        var holidays = api_getPublicHolidays({ year: year }) || [];
        holidays.forEach(function(item) {
          context.holidayYearCache[getHolidayYear(item.date)] = context.holidayYearCache[getHolidayYear(item.date)] || {};
          context.holidayYearCache[getHolidayYear(item.date)][item.date] = true;
        });
      } catch (e) {
        context.holidayYearCache[year] = {};
      }
    }
  }
  var set = {};
  Object.keys(context.holidayYearCache).forEach(function(yearKey) {
    var map = context.holidayYearCache[yearKey];
    Object.keys(map).forEach(function(dateIso) {
      if (dateIso >= startIso && dateIso <= endIso) {
        set[dateIso] = true;
      }
    });
  });
  context.holidayDateCache[key] = set;
  return set;
}

function getHolidayYear(dateStr) {
  if (!dateStr) return 0;
  var parts = String(dateStr).split('-');
  return Number(parts[0]);
}

function buildBulkExistingEntryCache() {
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  var map = {};
  if (values.length <= 1) return map;
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var dateIdx = headers.indexOf('date');
  var durationIdx = headers.indexOf('duration_minutes');
  var contractIdx = headers.indexOf('contract_id');
  var hourTypeIdx = headers.indexOf('hour_type_id');
  var recurrenceIdx = headers.indexOf('recurrence_id');
  var punchesIdx = headers.indexOf('punches_json');
  for (var i = 1; i < values.length; i++) {
    var recurrenceId = recurrenceIdx !== -1 ? String(values[i][recurrenceIdx] || '').trim() : '';
    if (!recurrenceId) continue;
    var iso = dateIdx !== -1 ? toIsoDate(values[i][dateIdx]) : '';
    if (!iso) continue;
    if (!map[recurrenceId]) map[recurrenceId] = {};
    map[recurrenceId][iso] = {
      id: idIdx !== -1 ? values[i][idIdx] : '',
      duration_minutes: durationIdx !== -1 ? Number(values[i][durationIdx]) : 0,
      contract_id: contractIdx !== -1 ? String(values[i][contractIdx] || '').trim() : '',
      hour_type_id: hourTypeIdx !== -1 ? String(values[i][hourTypeIdx] || '').trim() : '',
      // Needed to detect a same-total reshape of a sessions schedule (e.g. 9–12,1–5 → 8–11,12–4).
      punches_json: punchesIdx !== -1 ? String(values[i][punchesIdx] || '') : ''
    };
  }
  return map;
}

function createBulkEntryInstance(entry, dateIso, durationMinutes, context) {
  try {
    var minutes = durationMinutes != null ? durationMinutes : entry.duration_minutes;
    if (!minutes || minutes <= 0) return null;
    // Sessions range → advanced entries carrying the day's spans; whole-hours → basic as before.
    var sessions = parseScheduleSessions(entry.sessions_json);
    var payload = sessions.length
      ? {
          date: dateIso,
          duration_minutes: punchesTotalMinutes(sessions),
          contract_id: entry.contract_id,
          entry_type: 'advanced',
          hour_type_id: entry.hour_type_id,
          punches: sessions,
          recurrence_id: entry.id,
          source_type: 'bulk',
          source_id: entry.id,
          source_occurrence_key: dateIso
        }
      : {
          date: dateIso,
          duration_minutes: minutes,
          contract_id: entry.contract_id,
          entry_type: 'basic',
          hour_type_id: entry.hour_type_id,
          punches: buildBasicPunches(minutes),
          recurrence_id: entry.id,
          source_type: 'bulk',
          source_id: entry.id,
          source_occurrence_key: dateIso
        };
    if (context && context.batchCreates && context.batchMeta) {
      context.batchCreates.push(payload);
      context.batchMeta.push({
        recurrenceId: entry.id,
        date: dateIso,
        durationMinutes: payload.duration_minutes,
        contractId: entry.contract_id,
        hourTypeId: entry.hour_type_id || '',
        punchesJson: JSON.stringify(payload.punches || [])
      });
      return payload;
    }
    var res = api_addEntry(payload);
    return res && res.entry ? res.entry : payload;
  } catch (e) {
    Logger.log('Failed to create bulk entry for ' + dateIso + ': ' + e.message);
    return null;
  }
}
