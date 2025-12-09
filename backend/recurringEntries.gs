var RECURRING_SHEET_NAME = 'recurring_time_entries';
var RECURRING_ENTRY_HEADERS = [
  'id',
  'label',
  'recurrence_type',
  'weekly_interval',
  'weekly_weekdays_json',
  'monthly_interval',
  'monthly_mode',
  'monthly_day',
  'monthly_week',
  'monthly_weekday',
  'duration_minutes',
  'hour_type_id',
  'contract_id',
  'start_date',
  'end_date',
  'generated_until',
  'warning_message',
  'created_at',
  'updated_at'
];
var RECURRING_GENERATION_HORIZON_DAYS = 365;
var RECURRING_MAX_CONTRACT_DURATION_DAYS = 365 * 3; // inclusive days

function getRecurringEntriesSheet() {
  var sh = getOrCreateSheet(RECURRING_SHEET_NAME);
  ensureRecurringEntriesSchema(sh);
  return sh;
}

function ensureRecurringEntriesSchema(sh) {
  if (!sh) return;
  var headerRange = sh.getRange(1, 1, 1, RECURRING_ENTRY_HEADERS.length);
  var headers = headerRange.getValues()[0];
  var needsReset = headers.length < RECURRING_ENTRY_HEADERS.length;
  if (!needsReset) {
    for (var i = 0; i < RECURRING_ENTRY_HEADERS.length; i++) {
      if (headers[i] !== RECURRING_ENTRY_HEADERS[i]) {
        needsReset = true;
        break;
      }
    }
  }
  if (needsReset) {
    sh.getRange(1, 1, 1, RECURRING_ENTRY_HEADERS.length).setValues([RECURRING_ENTRY_HEADERS]);
  }
}

function listRecurringEntriesInternal() {
  var sh = getRecurringEntriesSheet();
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
    var normalized = normalizeRecurringEntryRow(obj);
    normalized.__row = i + 1;
    rows.push(normalized);
  }
  return rows;
}

function normalizeRecurringEntryRow(entry) {
  if (!entry) entry = {};
  var recurrenceType = entry.recurrence_type === 'monthly' ? 'monthly' : 'weekly';
  var weeklyInterval = parsePositiveInteger(entry.weekly_interval, 1);
  var weeklyWeekdays = parseWeekdays(entry.weekly_weekdays_json);
  if (recurrenceType === 'weekly' && !weeklyWeekdays.length) {
    weeklyWeekdays = [1];
  }
  var monthlyInterval = parsePositiveInteger(entry.monthly_interval, 1);
  var monthlyMode = entry.monthly_mode === 'weekday_of_month' ? 'weekday_of_month' : 'day_of_month';
  var monthlyDay = clampMonthlyDay(entry.monthly_day);
  var monthlyWeek = clampMonthlyWeek(entry.monthly_week);
  var monthlyWeekday = clampWeekday(entry.monthly_weekday);
  if (monthlyMode === 'weekday_of_month' && monthlyWeek === 0) {
    monthlyWeek = 1;
  }
  var durationMinutes = normalizeDurationMinutes(entry.duration_minutes);
  var startDate = toIsoDate(entry.start_date);
  var endDate = toIsoDate(entry.end_date);
  var generatedUntil = toIsoDate(entry.generated_until);
  var warningMessage = entry.warning_message ? String(entry.warning_message).trim() : '';
  return {
    id: entry.id || '',
    label: entry.label ? String(entry.label).trim() : '',
    recurrence_type: recurrenceType,
    weekly_interval: weeklyInterval,
    weekly_weekdays: weeklyWeekdays,
    weekly_weekdays_json: JSON.stringify(weeklyWeekdays),
    monthly_interval: monthlyInterval,
    monthly_mode: monthlyMode,
    monthly_day: monthlyDay,
    monthly_week: monthlyWeek,
    monthly_weekday: monthlyWeekday,
    duration_minutes: durationMinutes,
    hour_type_id: entry.hour_type_id ? String(entry.hour_type_id).trim() : '',
    contract_id: entry.contract_id ? String(entry.contract_id).trim() : '',
    start_date: startDate,
    end_date: endDate,
    generated_until: generatedUntil,
    warning_message: warningMessage,
    created_at: toIsoDateTime(entry.created_at),
    updated_at: toIsoDateTime(entry.updated_at)
  };
}

function parsePositiveInteger(value, fallback) {
  var num = Number(value);
  if (!isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function parseWeekdays(value) {
  if (!value && value !== 0) return [];
  var list = [];
  var source = value;
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value);
    } catch (e) {
      source = value.split(',').map(function(item) { return Number(item); });
    }
  }
  if (!Array.isArray(source)) return [];
  source.forEach(function(item) {
    var num = Number(item);
    if (!isFinite(num)) return;
    var rounded = Math.floor(num);
    if (rounded < 0 || rounded > 6) return;
    if (list.indexOf(rounded) === -1) list.push(rounded);
  });
  list.sort(function(a, b) { return a - b; });
  return list;
}

function clampMonthlyDay(value) {
  var num = Number(value);
  if (!isFinite(num) || num < 1) return 1;
  if (num > 31) return 31;
  return Math.floor(num);
}

function clampMonthlyWeek(value) {
  var num = Number(value);
  if (!isFinite(num) || num < 1) return 1;
  if (num > 5) return 5;
  return Math.floor(num);
}

function clampWeekday(value) {
  var num = Number(value);
  if (!isFinite(num) || num < 0) return 0;
  if (num > 6) return 6;
  return Math.floor(num);
}

function normalizeRecurringPayload(payload) {
  if (!payload) throw new Error('Schedule payload is required.');
  var normalized = {};
  normalized.id = payload.id ? String(payload.id).trim() : '';
  normalized.label = payload.label ? String(payload.label).trim() : '';
  if (!normalized.label) throw new Error('Name is required.');
  normalized.recurrence_type = payload.recurrence_type === 'monthly' ? 'monthly' : 'weekly';
  normalized.weekly_interval = parsePositiveInteger(payload.weekly_interval, 1);
  var weekdaysSource = payload.weekly_weekdays != null ? payload.weekly_weekdays : payload.weekly_weekdays_json;
  normalized.weekly_weekdays = Array.isArray(weekdaysSource) ? weekdaysSource.map(Number) : parseWeekdays(weekdaysSource);
  normalized.weekly_weekdays = normalized.weekly_weekdays.filter(function(day) { return day >= 0 && day <= 6; });
  normalized.weekly_weekdays.sort(function(a, b) { return a - b; });
  if (normalized.recurrence_type === 'weekly' && !normalized.weekly_weekdays.length) {
    throw new Error('Select at least one weekday.');
  }
  normalized.weekly_weekdays_json = JSON.stringify(normalized.weekly_weekdays);
  normalized.monthly_interval = parsePositiveInteger(payload.monthly_interval, 1);
  normalized.monthly_mode = payload.monthly_mode === 'weekday_of_month' ? 'weekday_of_month' : 'day_of_month';
  normalized.monthly_day = clampMonthlyDay(payload.monthly_day);
  normalized.monthly_week = clampMonthlyWeek(payload.monthly_week);
  normalized.monthly_weekday = clampWeekday(payload.monthly_weekday);
  if (normalized.recurrence_type === 'monthly') {
    if (normalized.monthly_mode === 'day_of_month') {
      if (!normalized.monthly_day) {
        throw new Error('Select a day of the month.');
      }
    } else {
      if (!normalized.monthly_week) {
        throw new Error('Select which week of the month.');
      }
    }
  }
  var durationMinutes = normalizeDurationMinutes(payload.duration_minutes != null ? payload.duration_minutes : payload.durationMinutes);
  if (!durationMinutes || durationMinutes <= 0) {
    throw new Error('Duration must be greater than zero minutes.');
  }
  normalized.duration_minutes = durationMinutes;
  normalized.contract_id = payload.contract_id ? String(payload.contract_id).trim() : '';
  if (!normalized.contract_id) {
    throw new Error('Select a contract.');
  }
  normalized.hour_type_id = payload.hour_type_id ? String(payload.hour_type_id).trim() : '';
  normalized.start_date = toIsoDate(payload.start_date);
  normalized.end_date = toIsoDate(payload.end_date);
  if (normalized.end_date && normalized.start_date && normalized.end_date < normalized.start_date) {
    throw new Error('End date must be on or after the start date.');
  }
  normalized.generated_until = payload.generated_until ? toIsoDate(payload.generated_until) : '';
  normalized.warning_message = payload.warning_message ? String(payload.warning_message).trim() : '';
  normalized.created_at = toIsoDateTime(payload.created_at);
  normalized.updated_at = toIsoDateTime(payload.updated_at);
  return normalized;
}

function shouldResetRecurringProgress(previousEntry, nextEntry) {
  if (!previousEntry) return false;
  var fields = [
    'recurrence_type',
    'weekly_interval',
    'weekly_weekdays_json',
    'monthly_interval',
    'monthly_mode',
    'monthly_day',
    'monthly_week',
    'monthly_weekday',
    'duration_minutes',
    'contract_id',
    'hour_type_id',
    'start_date',
    'end_date'
  ];
  for (var i = 0; i < fields.length; i++) {
    var key = fields[i];
    if ((previousEntry[key] || '') !== (nextEntry[key] || '')) {
      return true;
    }
  }
  return false;
}

function persistRecurringEntry(entry) {
  var sh = getRecurringEntriesSheet();
  var values = [
    entry.id,
    entry.label,
    entry.recurrence_type,
    entry.weekly_interval,
    entry.weekly_weekdays_json,
    entry.monthly_interval,
    entry.monthly_mode,
    entry.monthly_day,
    entry.monthly_week,
    entry.monthly_weekday,
    entry.duration_minutes,
    entry.hour_type_id,
    entry.contract_id,
    entry.start_date,
    entry.end_date,
    entry.generated_until,
    entry.warning_message,
    entry.created_at,
    entry.updated_at
  ];
  if (entry.__row) {
    sh.getRange(entry.__row, 1, 1, RECURRING_ENTRY_HEADERS.length).setValues([values]);
  } else {
    sh.appendRow(values);
    entry.__row = sh.getLastRow();
  }
  return entry;
}

function cloneRecurringEntryForReturn(entry) {
  var clone = JSON.parse(JSON.stringify(entry));
  delete clone.__row;
  return clone;
}

function api_getRecurringTimeEntries() {
  var entries = listRecurringEntriesInternal();
  return entries.map(cloneRecurringEntryForReturn);
}

function api_upsertRecurringTimeEntry(payload) {
  var normalized = normalizeRecurringPayload(payload);
  var now = new Date();
  var isoNow = toIsoDateTime(now);
  var allEntries = listRecurringEntriesInternal();
  var existing = normalized.id ? findRecurringEntryById(allEntries, normalized.id) : null;
  if (existing) {
    normalized.id = existing.id;
    normalized.created_at = existing.created_at;
    normalized.generated_until = existing.generated_until;
    normalized.warning_message = existing.warning_message;
    normalized.__row = existing.__row;
    if (shouldResetRecurringProgress(existing, normalized) || payload.reset_generated) {
      normalized.generated_until = '';
    }
  } else {
    normalized.id = Utilities.getUuid();
    normalized.created_at = isoNow;
    normalized.generated_until = '';
    normalized.warning_message = '';
  }
  normalized.updated_at = isoNow;
  persistRecurringEntry(normalized);
  var refreshed = listRecurringEntriesInternal();
  return {
    success: true,
    entry: cloneRecurringEntryForReturn(findRecurringEntryById(refreshed, normalized.id)),
    entries: refreshed.map(cloneRecurringEntryForReturn)
  };
}

function findRecurringEntryById(entries, id) {
  if (!id) return null;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].id === id) return entries[i];
  }
  return null;
}

function api_deleteRecurringTimeEntry(id) {
  if (!id) throw new Error('Schedule id is required.');
  var sh = getRecurringEntriesSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) return { success: true, entries: [] };
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sh.deleteRow(i + 1);
      var remaining = listRecurringEntriesInternal();
      return { success: true, entries: remaining.map(cloneRecurringEntryForReturn) };
    }
  }
  throw new Error('Schedule not found.');
}

function api_deleteFutureRecurringEntries(payload) {
  if (!payload || !payload.recurrenceId) {
    throw new Error('Recurrence identifier is required.');
  }
  var recurrenceId = String(payload.recurrenceId).trim();
  if (!recurrenceId) {
    throw new Error('Recurrence identifier is required.');
  }
  var fromDate = payload.fromDate ? toIsoDate(payload.fromDate) : toIsoDate(new Date());
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) {
    return { success: true, deleted: 0 };
  }
  var headers = values[0];
  var recurrenceIdx = headers.indexOf('recurrence_id');
  var dateIdx = headers.indexOf('date');
  if (recurrenceIdx === -1 || dateIdx === -1) {
    return { success: true, deleted: 0 };
  }
  var deleted = 0;
  for (var i = values.length - 1; i >= 1; i--) {
    var rowRecurrence = String(values[i][recurrenceIdx] || '').trim();
    if (rowRecurrence !== recurrenceId) continue;
    var rowDate = toIsoDate(values[i][dateIdx]);
    if (fromDate && rowDate && rowDate < fromDate) continue;
    sh.deleteRow(i + 1);
    deleted += 1;
  }
  if (deleted > 0) {
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
  }
  return { success: true, deleted: deleted };
}

function api_syncRecurringTimeEntries(options) {
  var result = syncRecurringTimeEntries(options);
  return result;
}

function syncRecurringTimeEntries(options) {
  var horizon = null;
  if (options && options.hasOwnProperty('horizonDays')) {
    horizon = Number(options.horizonDays);
    if (!isFinite(horizon) || horizon < 7) {
      horizon = RECURRING_GENERATION_HORIZON_DAYS;
    }
  }
  var entries = listRecurringEntriesInternal();
  if (!entries.length) {
    return { success: true, entries: [], summary: [] };
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
    // Ignore hour type failures; default behaviour will treat schedules as income-generating
  }
  var existingIndex = buildRecurringEntryIndex();
  var totalCreated = 0;
  var summaries = [];
  var todayIso = toIsoDate(new Date());
  entries.forEach(function(entry) {
    var summary = processRecurringEntry(entry, {
      contracts: contractMap,
      hourTypes: hourTypeMap,
      existingIndex: existingIndex,
      horizonDays: horizon,
      todayIso: todayIso
    });
    totalCreated += summary.createdEntries;
    summaries.push(summary.summary);
    if (summary.entryChanged) {
      persistRecurringEntry(entry);
    }
  });
  if (totalCreated > 0) {
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
  }
  return {
    success: true,
    entries: entries.map(cloneRecurringEntryForReturn),
    summary: summaries,
    generatedEntries: totalCreated
  };
}

function buildRecurringEntryIndex() {
  var map = {};
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (!values.length) return map;
  var headers = values[0];
  var recurrenceIdx = headers.indexOf('recurrence_id');
  var dateIdx = headers.indexOf('date');
  if (recurrenceIdx === -1 || dateIdx === -1) return map;
  for (var i = 1; i < values.length; i++) {
    var recurrenceId = String(values[i][recurrenceIdx] || '').trim();
    if (!recurrenceId) continue;
    var dateIso = toIsoDate(values[i][dateIdx]);
    if (!dateIso) continue;
    map[recurrenceId + '__' + dateIso] = true;
  }
  return map;
}

function processRecurringEntry(entry, context) {
  var contract = context.contracts[entry.contract_id] || null;
  var summary = {
    id: entry.id,
    label: entry.label,
    createdEntries: 0,
    windowStart: '',
    windowEnd: '',
    warning: ''
  };
  var entryChanged = false;
  if (!contract) {
    summary.warning = 'Contract not found.';
    if (entry.warning_message !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged, createdEntries: 0 };
  }
  if (!contract.start_date || !contract.end_date) {
    summary.warning = 'Contract "' + contract.name + '" is missing start/end dates.';
    if (entry.warning_message !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged, createdEntries: 0 };
  }
  var contractDuration = daysBetweenIso(contract.start_date, contract.end_date);
  if (contractDuration > RECURRING_MAX_CONTRACT_DURATION_DAYS) {
    summary.warning = 'Contract "' + contract.name + '" exceeds 3-year limit. Skipping.';
    if (entry.warning_message !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged, createdEntries: 0 };
  }
  var startBound = entry.start_date ? isoDateMax(entry.start_date, contract.start_date) : contract.start_date;
  var endBound = entry.end_date ? isoDateMin(entry.end_date, contract.end_date) : contract.end_date;
  if (!endBound || endBound < startBound) {
    summary.warning = 'End date precedes start date.';
    if (entry.warning_message !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged, createdEntries: 0 };
  }
  var generationEnd = endBound;
  if (context.horizonDays != null) {
    var horizonBound = addDaysIso(context.todayIso, context.horizonDays);
    generationEnd = isoDateMin(endBound, horizonBound);
    if (!generationEnd) {
      summary.warning = 'No generation window available.';
      if (entry.warning_message !== summary.warning) {
        entry.warning_message = summary.warning;
        entryChanged = true;
      }
      return { summary: summary, entryChanged: entryChanged, createdEntries: 0 };
    }
  }
  var anchor = entry.start_date || contract.start_date;
  var cursor = entry.generated_until ? isoDateMax(addDaysIso(entry.generated_until, 1), startBound) : startBound;
  var isIncome = isIncomeGeneratingHourType(entry.hour_type_id, context.hourTypes);
  if (isIncome) {
    var futureStart = isoDateMax(context.todayIso, startBound);
    cursor = isoDateMax(cursor, futureStart);
  }
  if (!cursor || cursor > generationEnd) {
    if (entry.warning_message !== (isIncome ? incomeWarningText(startBound, context.todayIso) : '')) {
      entry.warning_message = isIncome ? incomeWarningText(startBound, context.todayIso) : '';
      entryChanged = true;
    }
    summary.windowStart = cursor || '';
    summary.windowEnd = generationEnd;
    return { summary: summary, entryChanged: entryChanged, createdEntries: 0 };
  }
  var cursorDate = parseIsoDateStrict(cursor);
  var endDate = parseIsoDateStrict(generationEnd);
  if (!cursorDate || !endDate) {
    summary.warning = 'Invalid date configuration.';
    if (entry.warning_message !== summary.warning) {
      entry.warning_message = summary.warning;
      entryChanged = true;
    }
    return { summary: summary, entryChanged: entryChanged, createdEntries: 0 };
  }
  var anchorDate = parseIsoDateStrict(anchor) || cursorDate;
  var todayIncomeWarning = incomeWarningText(startBound, context.todayIso, entry.generated_until, isIncome);
  if ((entry.warning_message || '') !== todayIncomeWarning) {
    entry.warning_message = todayIncomeWarning;
    entryChanged = true;
  }
  var lastProcessedIso = cursor;
  while (cursorDate <= endDate) {
    var dateIso = toIsoDate(cursorDate);
    if (dateIso >= startBound && dateIso <= endBound) {
      var shouldGenerate = false;
      if (entry.recurrence_type === 'weekly') {
        shouldGenerate = matchesWeeklySchedule(entry, cursorDate, anchorDate);
      } else {
        shouldGenerate = matchesMonthlySchedule(entry, cursorDate, anchorDate);
      }
      if (shouldGenerate) {
        var key = entry.id + '__' + dateIso;
        if (!context.existingIndex[key]) {
          var created = createRecurringEntryInstance(entry, dateIso);
          if (created) {
            context.existingIndex[key] = true;
            summary.createdEntries += 1;
          }
        }
      }
    }
    lastProcessedIso = dateIso;
    cursorDate.setDate(cursorDate.getDate() + 1);
  }
  if (entry.generated_until !== lastProcessedIso) {
    entry.generated_until = lastProcessedIso;
    entryChanged = true;
  }
  summary.windowStart = cursor;
  summary.windowEnd = lastProcessedIso;
  summary.warning = entry.warning_message || '';
  return { summary: summary, entryChanged: entryChanged, createdEntries: summary.createdEntries };
}

function matchesWeeklySchedule(entry, dateObj, anchorDate) {
  var weekdays = entry.weekly_weekdays || [];
  if (!weekdays.length) return false;
  var diffDays = Math.floor((startOfDay(dateObj) - startOfDay(anchorDate)) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return false;
  var weekIndex = Math.floor(diffDays / 7);
  if (weekIndex % entry.weekly_interval !== 0) return false;
  var weekday = dateObj.getDay();
  return weekdays.indexOf(weekday) !== -1;
}

function matchesMonthlySchedule(entry, dateObj, anchorDate) {
  var diffMonths = monthsBetween(anchorDate, dateObj);
  if (diffMonths < 0) return false;
  if (diffMonths % entry.monthly_interval !== 0) return false;
  if (entry.monthly_mode === 'weekday_of_month') {
    var weekday = dateObj.getDay();
    if (weekday !== entry.monthly_weekday) return false;
    var weekOfMonth = Math.floor((dateObj.getDate() - 1) / 7) + 1;
    if (entry.monthly_week === 5) {
      return isLastWeekdayOfMonth(dateObj);
    }
    return weekOfMonth === entry.monthly_week;
  } else {
    var targetDay = Math.min(entry.monthly_day, daysInMonth(dateObj.getFullYear(), dateObj.getMonth()));
    return dateObj.getDate() === targetDay;
  }
}

function monthsBetween(startDate, targetDate) {
  var start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  var target = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  return (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
}

function isLastWeekdayOfMonth(dateObj) {
  var check = new Date(dateObj.getTime());
  check.setDate(check.getDate() + 7);
  return check.getMonth() !== dateObj.getMonth();
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDateStrict(value) {
  var iso = toIsoDate(value);
  if (!iso) return null;
  var parts = iso.split('-');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function isoDateMax(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function isoDateMin(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function addDaysIso(dateIso, days) {
  var date = parseIsoDateStrict(dateIso);
  if (!date) return '';
  date.setDate(date.getDate() + Number(days || 0));
  return toIsoDate(date);
}

function daysBetweenIso(startIso, endIso) {
  var start = parseIsoDateStrict(startIso);
  var end = parseIsoDateStrict(endIso);
  if (!start || !end) return 0;
  return Math.floor((startOfDay(end) - startOfDay(start)) / (24 * 60 * 60 * 1000));
}

function isIncomeGeneratingHourType(hourTypeId, hourTypeMap) {
  if (hourTypeId && hourTypeMap[hourTypeId]) {
    return hourTypeMap[hourTypeId].contributes_to_income !== false;
  }
  // Default hour type contributes to income
  return true;
}

function incomeWarningText(startBound, todayIso, generatedUntil, isIncome) {
  if (!isIncome) return '';
  if (!startBound || !todayIso) return '';
  if (generatedUntil) return '';
  if (todayIso <= startBound) return '';
  return 'Income-generating schedules only create entries from ' + todayIso + ' onward (no backfill).';
}

function createRecurringEntryInstance(entry, dateIso) {
  try {
    var payload = {
      date: dateIso,
      duration_minutes: entry.duration_minutes,
      contract_id: entry.contract_id,
      entry_type: 'basic',
      hour_type_id: entry.hour_type_id,
      punches: buildBasicPunches(entry.duration_minutes),
      recurrence_id: entry.id
    };
    api_addEntry(payload);
    return true;
  } catch (e) {
    Logger.log('Failed to create recurring entry for ' + dateIso + ': ' + e.message);
    return false;
  }
}

function buildBasicPunches(durationMinutes) {
  var total = Math.max(0, Number(durationMinutes) || 0);
  if (!total) return [];
  if (total > (24 * 60)) {
    total = 24 * 60;
  }
  var hours = Math.floor(total / 60);
  var minutes = total % 60;
  var outTime = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  return [{ 'in': '00:00', out: outTime }];
}
