/** Entries API */
var ENTRY_SHEET_TZ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
var ENTRY_TZ_UTC = 'UTC';
var ENTRY_CACHE_PREFIX = 'entries_v2_';

function clampRoundInterval(value) {
  var num = Number(value);
  if (!isFinite(num) || num <= 0) return 0;
  if (num > 60) return 60;
  return Math.round(num);
}

function resolveDefaultHourTypeId(defaultHourTypeId) {
  var resolved = defaultHourTypeId;
  if (!resolved) resolved = getDefaultHourTypeId();
  if (resolved && typeof resolved === 'object') resolved = resolved.id || '';
  return resolved || '';
}

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

function applyRoundInterval(minutes, interval) {
  var base = normalizeDurationMinutes(minutes);
  var quantum = clampRoundInterval(interval);
  if (quantum > 1 && base > 0) {
    base = Math.round(base / quantum) * quantum;
    // Never let a worked session round away to nothing: a sub-interval punch (e.g. 6 minutes with
    // 15-minute rounding) would round to 0 and the logged hours would vanish from the calendar/agenda
    // on save. Floor any positive duration to one interval — matching the client's roundDuration so the
    // value the server stores equals the optimistic value the UI already showed.
    if (base < quantum) base = quantum;
  }
  return Math.max(0, base);
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

function deriveDurationMinutes(punches, rawDuration, roundInterval) {
  var durationFromPunches = punches && punches.length ? punchesTotalMinutes(punches) : 0;
  if (!durationFromPunches) {
    durationFromPunches = normalizeDurationMinutes(rawDuration);
  }
  return applyRoundInterval(durationFromPunches, roundInterval);
}

function resolveRoundInterval(payloadInterval) {
  var fromPayload = clampRoundInterval(payloadInterval);
  var settingsInterval = 0;
  try {
    var settings = api_getSettings ? api_getSettings() : {};
    settingsInterval = clampRoundInterval(settings && settings.round_to_nearest);
  } catch (e) {
    settingsInterval = 0;
  }
  return fromPayload || settingsInterval || 0;
}

function normalizeEntryForWrite(entry, defaultHourTypeId) {
  if (!entry) return entry;
  var roundInterval = resolveRoundInterval(entry.round_interval);
  var punches = normalizePunches(entry.punches != null ? entry.punches : (entry.punches_json || entry.punchesJson));
  var durationMinutes = deriveDurationMinutes(punches, entry.duration_minutes, roundInterval);
  var entryType = entry.entry_type || 'basic';

  // Handle hour_type_id - default to work hour type if not provided or empty. Break records are the
  // exception: a break isn't "of" an hour type, and defaulting it would collide with real work entries
  // of the default type in the composite dedup key.
  var hourTypeId = entry.hour_type_id || entry.hourTypeId || '';
  if (hourTypeId && typeof hourTypeId === 'object') hourTypeId = hourTypeId.id || '';
  // A break or a comment record isn't "of" an hour type — blank it so it never collides with a real
  // work entry of the default type in the composite dedup key.
  if (entryType === 'break' || entryType === 'comment') hourTypeId = '';
  else if (!hourTypeId) hourTypeId = resolveDefaultHourTypeId(defaultHourTypeId);

  return {
    id: entry.id || '',
    date: toIsoDate(entry.date),
    duration_minutes: durationMinutes,
    contract_id: entry.contract_id || entry.contractId || entry.project || '',
    created_at: toIsoDateTime(entry.created_at),
    punches: punches,
    punches_json: JSON.stringify(punches),
    entry_type: entryType,
    hour_type_id: hourTypeId,
    recurrence_id: entry.recurrence_id || entry.recurrenceId || '',
    note: normalizeEntryNote(entry.note)
  };
}

// A day comment is short free text — cap defensively server-side (client enforces a tighter limit) and
// collapse to a single trimmed line so a stray paste can't bloat the sheet.
function normalizeEntryNote(raw) {
  if (raw == null) return '';
  var s = String(raw).replace(/\s+/g, ' ').trim();
  return s.length > 1000 ? s.slice(0, 1000) : s;
}

function normalizeEntryForRead(entry, defaultHourTypeId) {
  if (!entry) return entry;
  var punches = normalizePunches(entry.punches != null ? entry.punches : (entry.punches_json || entry.punchesJson));
  var entryType = entry.entry_type || 'basic';
  var hourTypeId = entry.hour_type_id || entry.hourTypeId || '';
  if (hourTypeId && typeof hourTypeId === 'object') hourTypeId = hourTypeId.id || '';
  if (entryType === 'break' || entryType === 'comment') hourTypeId = '';
  else if (!hourTypeId) hourTypeId = resolveDefaultHourTypeId(defaultHourTypeId);
  return {
    id: entry.id || '',
    date: toIsoDate(entry.date),
    duration_minutes: normalizeDurationMinutes(entry.duration_minutes),
    contract_id: entry.contract_id || entry.contractId || entry.project || '',
    created_at: toIsoDateTime(entry.created_at),
    punches: punches,
    punches_json: JSON.stringify(punches),
    entry_type: entryType,
    hour_type_id: hourTypeId,
    recurrence_id: entry.recurrence_id || entry.recurrenceId || '',
    note: normalizeEntryNote(entry.note)
  };
}

function buildEntryRow(entry, createdAt) {
  var normalized = entry || {};
  return [
    normalized.id,
    normalized.date,
    normalized.duration_minutes,
    normalized.contract_id,
    createdAt || normalized.created_at || toIsoDateTime(new Date()),
    normalized.punches_json || '[]',
    normalized.entry_type || 'basic',
    normalized.hour_type_id,
    normalized.recurrence_id || '',
    normalized.note || ''
  ];
}

// NO server-side caching here (removed 2026-07-07). Entries are the hottest-mutated dataset AND the
// client reconciliation layer treats this response as authoritative truth — merging a stale cached list
// visually DELETES any entry created after the snapshot (seen live: a fresh load showed days empty that
// the sheet demonstrably had). The old PropertiesService cache had two failure modes: a clear that
// misses (rate limits during heavy churn) leaves a poisoned 5-minute window, and setProperty's ~9KB
// value cap is smaller than a real entries list. The direct sheet read is the safe, honest cost.
function api_getEntries(filters) {
  var defaultHourTypeId = resolveDefaultHourTypeId();
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (!values.length) return [];
  var headers = values[0];
  var rows = values.slice(1).map(function(r){
    var o = {};
    headers.forEach(function(h,i){ o[h] = r[i]; });
    return normalizeEntryForRead(o, defaultHourTypeId);
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
  return out;
}

function buildEntryIndexFromValues(values, headers, defaultHourTypeId) {
  if (!values || !values.length || !headers) return {};
  var dateIdx = headers.indexOf('date');
  var hourTypeIdx = headers.indexOf('hour_type_id');
  var contractIdx = headers.indexOf('contract_id');
  var entryTypeIdx = headers.indexOf('entry_type');
  var index = {};
  var fallbackHourTypeId = resolveDefaultHourTypeId(defaultHourTypeId);
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var dateIso = dateIdx === -1 ? '' : toIsoDate(row[dateIdx]);
    var hourTypeId = hourTypeIdx === -1 ? '' : row[hourTypeIdx] || '';
    var contractId = contractIdx === -1 ? '' : row[contractIdx] || '';
    var entryType = entryTypeIdx === -1 ? '' : row[entryTypeIdx] || '';
    var key = entryCompositeKey(dateIso, hourTypeId, contractId, fallbackHourTypeId, entryType);
    if (dateIso) index[key] = true;
  }
  return index;
}

function api_addEntry(entry) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var defaultHourTypeId = resolveDefaultHourTypeId();
  var sh = getOrCreateSheet('timesheet_entries');
  var id = Utilities.getUuid();
  var now = new Date();
  var normalized = normalizeEntryForWrite({
    id: id,
    date: entry && entry.date ? entry.date : toIsoDate(now),
    duration_minutes: entry && entry.duration_minutes,
    contract_id: entry && entry.contract_id,
    created_at: toIsoDateTime(now),
    punches: entry && entry.punches,
    punches_json: entry && entry.punches_json,
    entry_type: entry && entry.entry_type,
    hour_type_id: entry && entry.hour_type_id ? entry.hour_type_id : defaultHourTypeId,
    recurrence_id: entry && entry.recurrence_id,
    note: entry && entry.note,
    round_interval: entry && entry.round_interval
  }, defaultHourTypeId);
  normalized.id = normalized.id || id;
  normalized.date = normalized.date || toIsoDate(now);
  normalized.contract_id = normalized.contract_id || '';
  normalized.created_at = normalized.created_at || toIsoDateTime(now);
  if (normalized.entry_type !== 'break') normalized.hour_type_id = normalized.hour_type_id || defaultHourTypeId;
  try {
    var existingData = sh.getDataRange().getValues();
    var headers = existingData && existingData.length ? existingData[0] : [];
    var existingIndex = buildEntryIndexFromValues(existingData, headers, defaultHourTypeId);
    var targetKey = entryCompositeKey(normalized.date, normalized.hour_type_id, normalized.contract_id, defaultHourTypeId, normalized.entry_type);
    if (existingIndex[targetKey]) {
      // Return the EXISTING sheet row, not the attempted payload: duplicate-adopt consumers (comment/break
      // create, the duplicate-conflict form handler) take res.entry's id and update/edit that record, so a
      // made-up id here sends their follow-up api_updateEntry into 'Entry not found'. Matches api_updateEntry's
      // duplicate shape. Fallback to the payload only if the scan somehow misses (index/scan race) — callers
      // guard on res.entry anyway.
      var existingDuplicate = findDuplicateEntryForKey(sh, normalized, null, existingData, defaultHourTypeId);
      return { success: false, error: 'duplicate_entry', entry: existingDuplicate || normalizeEntryForRead(normalized, defaultHourTypeId) };
    }
    var row = buildEntryRow(normalized, normalized.created_at);
    sh.appendRow(row);
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
    return { success: true, entry: normalizeEntryForRead({
      id: row[0],
      date: row[1],
      duration_minutes: row[2],
      contract_id: row[3],
      created_at: row[4],
      punches_json: row[5],
      entry_type: row[6],
      hour_type_id: row[7],
      recurrence_id: row[8],
      note: row[9]
    }, defaultHourTypeId) };
  } finally {
    lock.releaseLock();
  }
}

function api_addEntriesBulk(payload) {
  var entries = payload && Array.isArray(payload.entries) ? payload.entries : [];
  if (!entries.length) return { success: true, added: 0, duplicates: 0, entries: [] };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var defaultHourTypeId = resolveDefaultHourTypeId();
    var sh = getOrCreateSheet('timesheet_entries');
    var data = sh.getDataRange().getValues();
    if (!data || !data.length) throw new Error('Entries sheet is not initialized');
    var headers = data[0];
    var existingIndex = buildEntryIndexFromValues(data, headers, defaultHourTypeId);
    var nowIso = toIsoDateTime(new Date());
    var rows = [];
    var added = 0;
    var duplicates = 0;
    var normalizedOut = [];

    entries.forEach(function(entry) {
      var normalized = normalizeEntryForWrite({
        id: entry && entry.id,
        date: entry && entry.date,
        duration_minutes: entry && entry.duration_minutes,
        contract_id: entry && entry.contract_id,
        created_at: entry && entry.created_at || nowIso,
        punches: entry && entry.punches,
        punches_json: entry && entry.punches_json,
        entry_type: entry && entry.entry_type,
        hour_type_id: entry && entry.hour_type_id,
        recurrence_id: entry && entry.recurrence_id,
        note: entry && entry.note,
        round_interval: entry && entry.round_interval
      }, defaultHourTypeId);
      normalized.id = normalized.id || Utilities.getUuid();
      normalized.created_at = normalized.created_at || nowIso;

      var key = entryCompositeKey(normalized.date, normalized.hour_type_id, normalized.contract_id, defaultHourTypeId, normalized.entry_type);
      if (existingIndex[key]) {
        duplicates += 1;
        return;
      }

      existingIndex[key] = true;
      var row = buildEntryRow(normalized, normalized.created_at);
      rows.push(row);
      added += 1;
      normalizedOut.push(normalizeEntryForRead({
        id: row[0],
        date: row[1],
        duration_minutes: row[2],
        contract_id: row[3],
        created_at: row[4],
        punches_json: row[5],
        entry_type: row[6],
        hour_type_id: row[7],
        recurrence_id: row[8],
        note: row[9]
      }, defaultHourTypeId));
    });

    if (rows.length) {
      var startRow = sh.getLastRow() + 1;
      sh.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
      cacheClearPrefix(ENTRY_CACHE_PREFIX);
    }

    return {
      success: true,
      added: added,
      duplicates: duplicates,
      entries: normalizedOut
    };
  } finally {
    lock.releaseLock();
  }
}

function api_updateEntry(update) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var defaultHourTypeId = resolveDefaultHourTypeId();
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  try {
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
    if (!payload.hasOwnProperty('recurrence_id') && values[i][8] != null) {
      payload = Object.assign({}, payload, { recurrence_id: values[i][8] });
    }
    if (!payload.hasOwnProperty('note') && values[i][9] != null) {
      payload = Object.assign({}, payload, { note: values[i][9] });
    }
    if (payload.recurrence_id == null && update.recurrence_id != null) {
      payload = Object.assign({}, payload, { recurrence_id: update.recurrence_id });
    }
    if (!payload.hasOwnProperty('duration_minutes') && values[i][2] != null) {
      payload = Object.assign({}, payload, { duration_minutes: values[i][2] });
    }
    var normalized = normalizeEntryForWrite(payload, defaultHourTypeId);
    normalized.id = update.id;
    normalized.created_at = toIsoDateTime(originalCreated);
    if (normalized.entry_type !== 'break') normalized.hour_type_id = normalized.hour_type_id || defaultHourTypeId;
    var duplicate = findDuplicateEntryForKey(sh, normalized, update.id, values, defaultHourTypeId);
    if (duplicate) {
          return { success: false, error: 'duplicate_entry', entry: duplicate };
        }
        var newRow = buildEntryRow(normalized, normalized.created_at);
        sh.getRange(i+1,1,1,newRow.length).setValues([newRow]);
        cacheClearPrefix(ENTRY_CACHE_PREFIX);
        return { success: true, entry: normalized };
      }
    }
    throw new Error('Entry not found');
  } finally {
    lock.releaseLock();
  }
}

function api_deleteEntry(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = getOrCreateSheet('timesheet_entries');
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { success: true, missing: true };
    var ids = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === id) {
        sh.deleteRow(i + 2); // +2 accounts for 1-based indexing and header row
        cacheClearPrefix(ENTRY_CACHE_PREFIX);
        return { success: true };
      }
    }
    // Idempotent delete: the row is already gone (e.g. removed elsewhere, or a phantom client entry
    // that never persisted). Report success so the caller can reconcile its local state rather than
    // surfacing a "delete failed, try again" error the user can't act on.
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
    return { success: true, missing: true };
  } finally {
    lock.releaseLock();
  }
}

function entryCompositeKey(dateIso, hourTypeId, contractId, defaultHourTypeId, entryType) {
  // Break records key on a sentinel instead of an hour type: one break record per (date, contract),
  // never colliding with work entries of the default type (whose empty hour_type_id resolves below).
  if ((entryType || '') === 'break') {
    return [dateIso || '', '__break__', contractId || ''].join('|');
  }
  // One comment record per (date, contract) — a per-day note keys on an empty contract, never colliding
  // with work/break rows.
  if ((entryType || '') === 'comment') {
    return [dateIso || '', '__comment__', contractId || ''].join('|');
  }
  var typeId = hourTypeId || resolveDefaultHourTypeId(defaultHourTypeId) || '';
  if (typeId && typeof typeId === 'object') typeId = typeId.id || '';
  return [dateIso || '', String(typeId || ''), contractId || ''].join('|');
}

function findDuplicateEntryForKey(sh, normalizedEntry, excludeId, values, defaultHourTypeId) {
  if (!sh || !normalizedEntry || !normalizedEntry.date) return null;
  var data = values || sh.getDataRange().getValues();
  if (!data || data.length < 2) return null;
  var headers = data[0];
  var idIdx = headers.indexOf('id');
  var dateIdx = headers.indexOf('date');
  var durationIdx = headers.indexOf('duration_minutes');
  var contractIdx = headers.indexOf('contract_id');
  var createdIdx = headers.indexOf('created_at');
  var punchesIdx = headers.indexOf('punches_json');
  var entryTypeIdx = headers.indexOf('entry_type');
  var hourTypeIdx = headers.indexOf('hour_type_id');
  var recurrenceIdx = headers.indexOf('recurrence_id');
  var noteIdx = headers.indexOf('note');
  var fallbackHourTypeId = resolveDefaultHourTypeId(defaultHourTypeId);
  var targetKey = entryCompositeKey(normalizedEntry.date, normalizedEntry.hour_type_id, normalizedEntry.contract_id, fallbackHourTypeId, normalizedEntry.entry_type);
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowId = idIdx === -1 ? '' : row[idIdx];
    if (rowId === excludeId) continue;
    var rowDate = dateIdx === -1 ? '' : toIsoDate(row[dateIdx]);
    var rowHourType = hourTypeIdx === -1 ? '' : row[hourTypeIdx];
    var rowContract = contractIdx === -1 ? '' : row[contractIdx];
    var rowEntryType = entryTypeIdx === -1 ? 'basic' : row[entryTypeIdx];
    var key = entryCompositeKey(rowDate, rowHourType, rowContract, fallbackHourTypeId, rowEntryType);
    if (key === targetKey) {
      return normalizeEntryForRead({
        id: rowId,
        date: rowDate,
        duration_minutes: durationIdx === -1 ? '' : row[durationIdx],
        contract_id: rowContract,
        created_at: createdIdx === -1 ? '' : row[createdIdx],
        punches_json: punchesIdx === -1 ? '[]' : row[punchesIdx],
        entry_type: rowEntryType,
        hour_type_id: rowHourType || fallbackHourTypeId,
        recurrence_id: recurrenceIdx === -1 ? '' : row[recurrenceIdx],
        note: noteIdx === -1 ? '' : row[noteIdx]
      }, fallbackHourTypeId);
    }
  }
  return null;
}

function reroundTimesheetEntries(roundInterval) {
  var effectiveInterval = resolveRoundInterval(roundInterval);
  var sh = getOrCreateSheet('timesheet_entries');
  if (!sh) return 0;
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return 0;
  var headers = values[0];
  var durationIdx = headers.indexOf('duration_minutes');
  var punchesIdx = headers.indexOf('punches_json');
  var entryTypeIdx = headers.indexOf('entry_type');
  if (durationIdx === -1) return 0;
  var quantum = clampRoundInterval(effectiveInterval);
  var updated = 0;
  var durationRange = sh.getRange(2, durationIdx + 1, values.length - 1, 1);
  var durationValues = durationRange.getValues();
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    // Break records aren't worked time — re-rounding (and its ≥1-interval floor) doesn't apply.
    if (entryTypeIdx !== -1 && row[entryTypeIdx] === 'break') continue;
    var punches = punchesIdx === -1 ? [] : normalizePunches(row[punchesIdx]);
    var existing = row[durationIdx];
    var recalculated = deriveDurationMinutes(punches, existing, quantum);
    var currentRounded = normalizeDurationMinutes(existing);
    if (recalculated !== currentRounded) {
      durationValues[i - 1][0] = recalculated;
      updated += 1;
    }
  }
  if (updated > 0) {
    durationRange.setValues(durationValues);
    cacheClearPrefix(ENTRY_CACHE_PREFIX);
  }
  return updated;
}

function api_reroundEntries(payload) {
  var interval = payload && payload.round_interval != null ? payload.round_interval : null;
  var updated = reroundTimesheetEntries(interval);
  return { success: true, updated: updated };
}
