/** Entries API */
var ENTRY_SHEET_TZ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
var ENTRY_TZ_UTC = 'UTC';
var ENTRY_CACHE_PREFIX = 'entries_v2_';

function toIsoDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, ENTRY_SHEET_TZ, 'yyyy-MM-dd');
  }
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (trimmed === '') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    var parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, ENTRY_SHEET_TZ, 'yyyy-MM-dd');
    return trimmed;
  }
  var coercible = new Date(value);
  if (!isNaN(coercible.getTime())) {
    return Utilities.formatDate(coercible, ENTRY_SHEET_TZ, 'yyyy-MM-dd');
  }
  return String(value);
}

function toIsoTime(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, ENTRY_SHEET_TZ, 'HH:mm');
  }
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (trimmed === '') return '';
    if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    var parsed = new Date('1970-01-01T' + trimmed + ':00Z');
    if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, 'UTC', 'HH:mm');
    return trimmed;
  }
  var asDate = new Date(value);
  if (!isNaN(asDate.getTime())) {
    return Utilities.formatDate(asDate, ENTRY_SHEET_TZ, 'HH:mm');
  }
  return String(value);
}

function toIsoDateTime(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, ENTRY_TZ_UTC, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  }
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (trimmed === '') return '';
    var parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, ENTRY_TZ_UTC, "yyyy-MM-dd'T'HH:mm:ss'Z'");
    }
    return trimmed;
  }
  var coercible = new Date(value);
  if (!isNaN(coercible.getTime())) {
    return Utilities.formatDate(coercible, ENTRY_TZ_UTC, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  }
  return String(value);
}

function normalizeDurationMinutes(value) {
  if (value === null || value === undefined || value === '') return 0;
  var num = Number(value);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.round(num));
}

function normalizePunchTime(value) {
  var iso = toIsoTime(value);
  if (!iso) return '';
  return /^\d{2}:\d{2}$/.test(iso) ? iso : '';
}

function timeToMinutes(time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
  var parts = time.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function normalizePunches(value) {
  if (!value) return [];
  var source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (e) {
      source = [];
    }
  }
  if (!Array.isArray(source)) source = [source];
  var punches = source.reduce(function(acc, punch) {
    if (!punch) return acc;
    var punchIn = normalizePunchTime(punch['in'] || punch.start || punch.start_time || punch.startTime);
    if (!punchIn) return acc;
    var punchOut = normalizePunchTime(punch.out || punch.stop || punch.end || punch.end_time || punch.endTime);
    if (punchOut && timeToMinutes(punchOut) < timeToMinutes(punchIn)) {
      punchOut = '';
    }
    acc.push({ 'in': punchIn, out: punchOut || '' });
    return acc;
  }, []);
  punches.sort(function(a, b) {
    if (a['in'] === b['in']) {
      return (a.out || '').localeCompare(b.out || '');
    }
    return a['in'].localeCompare(b['in']);
  });
  return punches;
}

function punchesTotalMinutes(punches) {
  return punches.reduce(function(total, punch) {
    if (!punch || !punch['in'] || !punch.out) return total;
    var start = timeToMinutes(punch['in']);
    var end = timeToMinutes(punch.out);
    if (start === null || end === null || end <= start) return total;
    return total + (end - start);
  }, 0);
}

function punchesEarliest(punches) {
  var earliest = '';
  punches.forEach(function(punch) {
    if (!punch || !punch['in']) return;
    if (!earliest || punch['in'] < earliest) {
      earliest = punch['in'];
    }
  });
  return earliest;
}

function punchesLatest(punches) {
  var latest = '';
  punches.forEach(function(punch) {
    if (!punch) return;
    if (punch.out && (!latest || punch.out > latest)) {
      latest = punch.out;
    }
  });
  return latest;
}

function normalizeEntryObject(entry) {
  if (!entry) return entry;
  var punches = normalizePunches(entry.punches != null ? entry.punches : (entry.punches_json || entry.punchesJson));
  var roundInterval = normalizeDurationMinutes(entry.round_interval);
  var durationFromPunches = punches.length ? punchesTotalMinutes(punches) : 0;
  if (punches.length && roundInterval > 1 && durationFromPunches > 0) {
    durationFromPunches = Math.max(roundInterval, Math.round(durationFromPunches / roundInterval) * roundInterval);
  }
  if (!punches.length && roundInterval > 1) {
    var rawDuration = normalizeDurationMinutes(entry.duration_minutes);
    if (rawDuration > 0) {
      rawDuration = Math.max(roundInterval, Math.round(rawDuration / roundInterval) * roundInterval);
      entry.duration_minutes = rawDuration;
    }
  }

  // Handle hour_type_id - default to work hour type if not provided or empty
  var hourTypeId = entry.hour_type_id || entry.hourTypeId || '';
  if (!hourTypeId) {
    hourTypeId = getDefaultHourTypeId();
  }

  return {
    id: entry.id || '',
    date: toIsoDate(entry.date),
    duration_minutes: punches.length ? normalizeDurationMinutes(durationFromPunches) : normalizeDurationMinutes(entry.duration_minutes),
    contract_id: entry.contract_id || entry.contractId || entry.project || '',
    created_at: toIsoDateTime(entry.created_at),
    punches: punches,
    punches_json: JSON.stringify(punches),
    entry_type: entry.entry_type || 'basic',
    hour_type_id: hourTypeId
  };
}

function buildEntryRow(entry, createdAt) {
  var normalized = normalizeEntryObject(entry || {});
  return [
    normalized.id,
    normalized.date,
    normalized.duration_minutes,
    normalized.contract_id,
    createdAt || normalized.created_at || toIsoDateTime(new Date()),
    normalized.punches_json || '[]',
    normalized.entry_type || 'basic',
    normalized.hour_type_id
  ];
}

function api_getEntries(filters) {
  var key = ENTRY_CACHE_PREFIX + JSON.stringify(filters || {});
  var cached = cacheGet(key);
  if (cached) return cached;
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var headers = values[0];
  var rows = values.slice(1).map(function(r){
    var o = {};
    headers.forEach(function(h,i){ o[h] = r[i]; });
    return normalizeEntryObject(o);
  });
  var out = rows;
  if (filters && filters.startDate) {
    var startIso = toIsoDate(filters.startDate);
    out = out.filter(function(e){ return !startIso || (e.date && e.date >= startIso); });
  }
  if (filters && filters.endDate) {
    var endIso = toIsoDate(filters.endDate);
    out = out.filter(function(e){ return !endIso || (e.date && e.date <= endIso); });
  }
  cacheSet(key, out);
  return out;
}

function api_addEntry(entry) {
  var sh = getOrCreateSheet('timesheet_entries');
  var id = Utilities.getUuid();
  var now = new Date();
  var normalized = normalizeEntryObject({
    id: id,
    date: entry && entry.date ? entry.date : toIsoDate(now),
    duration_minutes: entry && entry.duration_minutes,
    contract_id: entry && entry.contract_id,
    created_at: toIsoDateTime(now),
    punches: entry && entry.punches,
    punches_json: entry && entry.punches_json,
    entry_type: entry && entry.entry_type,
    hour_type_id: entry && entry.hour_type_id
  });
  normalized.id = normalized.id || id;
  normalized.date = normalized.date || toIsoDate(now);
  normalized.contract_id = normalized.contract_id || '';
  normalized.created_at = normalized.created_at || toIsoDateTime(now);
  var row = buildEntryRow(normalized, normalized.created_at);
  sh.appendRow(row);
  cacheClearPrefix(ENTRY_CACHE_PREFIX);
  return { success: true, entry: normalizeEntryObject({
    id: row[0],
    date: row[1],
    duration_minutes: row[2],
    contract_id: row[3],
    created_at: row[4],
    punches_json: row[5],
    entry_type: row[6],
    hour_type_id: row[7]
  }) };
}

function api_updateEntry(update) {
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  for (var i=1; i<values.length; i++) {
    if (values[i][0] === update.id) {
      var originalCreated = values[i][4];
      var payload = update || {};
      if (payload.punches == null && payload.punches_json == null) {
        payload = Object.assign({}, payload, { punches_json: values[i][5] || '[]' });
      }
      if (!payload.entry_type && values[i][6] != null) {
        payload = Object.assign({}, payload, { entry_type: values[i][6] });
      }
      if (!payload.hour_type_id && values[i][7] != null) {
        payload = Object.assign({}, payload, { hour_type_id: values[i][7] });
      }
      var normalized = normalizeEntryObject(payload);
      normalized.id = update.id;
      normalized.created_at = toIsoDateTime(originalCreated);
      var newRow = buildEntryRow(normalized, normalized.created_at);
      sh.getRange(i+1,1,1,newRow.length).setValues([newRow]);
      cacheClearPrefix(ENTRY_CACHE_PREFIX);
      return { success: true, entry: normalized };
    }
  }
  throw new Error('Entry not found');
}

function api_deleteEntry(id) {
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  for (var i=1; i<values.length; i++) {
    if (values[i][0] === id) {
      sh.deleteRow(i+1);
      cacheClearPrefix(ENTRY_CACHE_PREFIX);
      return { success: true };
    }
  }
  throw new Error('Entry not found');
}
