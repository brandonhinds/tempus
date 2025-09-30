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

function normalizeEntryObject(entry) {
  if (!entry) return entry;
  return {
    id: entry.id || '',
    date: toIsoDate(entry.date),
    start_time: toIsoTime(entry.start_time),
    end_time: toIsoTime(entry.end_time),
    duration_minutes: normalizeDurationMinutes(entry.duration_minutes),
    description: entry.description || '',
    project: entry.project || '',
    created_at: toIsoDateTime(entry.created_at)
  };
}

function buildEntryRow(entry, createdAt) {
  var normalized = normalizeEntryObject(entry || {});
  return [
    normalized.id,
    normalized.date,
    normalized.start_time,
    normalized.end_time,
    normalized.duration_minutes,
    normalized.description,
    normalized.project,
    createdAt || normalized.created_at || toIsoDateTime(new Date())
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
  var record = normalizeEntryObject(entry || {});
  var row = buildEntryRow({
    id: id,
    date: record.date || toIsoDate(now),
    start_time: record.start_time,
    end_time: record.end_time,
    duration_minutes: record.duration_minutes,
    description: record.description,
    project: record.project,
    created_at: toIsoDateTime(now)
  }, toIsoDateTime(now));
  sh.appendRow(row);
  cacheClearPrefix(ENTRY_CACHE_PREFIX);
  return { success: true, entry: normalizeEntryObject({
    id: row[0],
    date: row[1],
    start_time: row[2],
    end_time: row[3],
    duration_minutes: row[4],
    description: row[5],
    project: row[6],
    created_at: row[7]
  }) };
}

function api_updateEntry(update) {
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  for (var i=1; i<values.length; i++) {
    if (values[i][0] === update.id) {
      var originalCreated = values[i][7];
      var normalized = normalizeEntryObject(update || {});
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
