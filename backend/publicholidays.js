/** Public Holidays API */
var PUBLIC_HOLIDAYS_CACHE_KEY = 'public_holidays_v1';
// Bumped when the storage format changes; triggers a one-time wholesale rebuild
// of the sheet so old date-only-keyed data heals itself.
var PH_REBUILD_FLAG = 'ph_rebuild_v2';
var NAGER_API_BASE = 'https://date.nager.at/api/v3';
var _spreadsheetTimeZoneCache = null;

function getSpreadsheetTimeZone() {
  if (_spreadsheetTimeZoneCache) return _spreadsheetTimeZoneCache;
  var tz = null;
  try {
    var ss = SpreadsheetApp.getActive();
    if (ss) tz = ss.getSpreadsheetTimeZone();
  } catch (e) {}
  if (!tz) tz = Session.getScriptTimeZone() || 'UTC';
  _spreadsheetTimeZoneCache = tz;
  return tz;
}

function formatSheetDateKey(value, timezone) {
  if (!value && value !== 0) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  }
  var str = String(value).trim();
  if (!str) return '';
  return str.split('T')[0];
}

/**
 * Fetches public holidays for a specific year from the Nager.Date API
 */
function fetchPublicHolidaysForYear(year) {
  var url = NAGER_API_BASE + '/PublicHolidays/' + year + '/AU';
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    Logger.log('Failed to fetch public holidays for year ' + year + ': ' + response.getResponseCode());
    return [];
  } catch (e) {
    Logger.log('Error fetching public holidays for year ' + year + ': ' + e.toString());
    return [];
  }
}

// Nager.Date occasionally labels a holiday with a name that doesn't match local
// usage. Australia's 26 Dec (and its substitute day) comes back as
// "St. Stephen's Day"; everyone here calls it Boxing Day. Normalise on the way in
// so both this page and the calendar overlay show the familiar name.
var PH_NAME_OVERRIDES = {
  "St. Stephen's Day": 'Boxing Day'
};

function normalizeHolidayName(name) {
  if (!name) return name;
  var trimmed = String(name).trim();
  return PH_NAME_OVERRIDES[trimmed] || trimmed;
}

/**
 * Ensures the public_holidays sheet has proper headers
 * This validates and repairs the schema if needed
 */
function ensurePublicHolidaysSchema() {
  var sh = getOrCreateSheet('public_holidays');
  var values = sh.getDataRange().getValues();

  // If sheet is completely empty, add headers
  if (values.length === 0) {
    sh.appendRow(['date', 'name', 'local_name', 'counties', 'types', 'year', 'fetched_at']);
    return;
  }

  // Check if row 1 contains valid headers
  var firstRow = values[0];
  var expectedHeaders = ['date', 'name', 'local_name', 'counties', 'types', 'year', 'fetched_at'];

  // If first cell is 'date', assume headers are present
  if (firstRow[0] === 'date') {
    return; // Headers already exist, nothing to do
  }

  // Headers are missing - insert them at the top
  sh.insertRowBefore(1);
  sh.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);

  Logger.log('Public holidays schema repaired: inserted missing headers');
}

/**
 * Replaces ALL stored rows for a single year with a fresh set from the source.
 *
 * The source is authoritative and immutable for a known year, so a clean
 * wholesale replace is both simpler and more correct than the old upsert, which
 * keyed only on the date and therefore silently dropped the many Australian dates
 * that carry more than one holiday (e.g. four different state holidays fall on the
 * same March Monday). That date-only collapse — run repeatedly by the old daily
 * "next holidays" writer — is why a state like ACT was showing only a handful of
 * its ~13 holidays.
 *
 * Entries sharing a date AND name are merged so split observances (Anzac Day,
 * which several states move to a different day) keep their combined county
 * coverage rather than clobbering each other.
 */
function replaceYearHolidays(year, holidays) {
  if (!holidays || holidays.length === 0) return;

  ensurePublicHolidaysSchema();

  var sh = getOrCreateSheet('public_holidays');
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var dateIdx = headers.indexOf('date');
  var yearIdx = headers.indexOf('year');
  var timezone = getSpreadsheetTimeZone();

  // Remove every existing row for this year (bottom-up so row numbers stay valid).
  for (var i = values.length - 1; i >= 1; i--) {
    var rowYear = yearIdx !== -1
      ? values[i][yearIdx]
      : parseInt(String(values[i][dateIdx]).split('-')[0], 10);
    if (Number(rowYear) === Number(year)) sh.deleteRow(i + 1);
  }

  // Build the fresh rows, merging same date+name entries and normalising names.
  var byKey = {};
  var order = [];
  holidays.forEach(function(holiday) {
    var dateStr = formatSheetDateKey(holiday.date, timezone);
    if (!dateStr) return;
    if (Number(dateStr.split('-')[0]) !== Number(year)) return; // belongs to another year
    var name = normalizeHolidayName(holiday.name || holiday.localName || 'Public holiday');
    var key = dateStr + '|' + name;
    var incomingCounties = Array.isArray(holiday.counties) ? holiday.counties.slice() : null;

    if (byKey[key]) {
      var existing = byKey[key];
      if (existing.counties && incomingCounties) {
        incomingCounties.forEach(function(c) {
          if (existing.counties.indexOf(c) === -1) existing.counties.push(c);
        });
      } else {
        existing.counties = null; // one side is national → the whole holiday is national
      }
      return;
    }

    byKey[key] = {
      date: dateStr,
      name: name,
      localName: holiday.localName || holiday.name || name,
      counties: incomingCounties,
      year: Number(year)
    };
    order.push(key);
  });

  var timestamp = new Date().toISOString();
  var rows = order.map(function(key) {
    var h = byKey[key];
    return [
      h.date,
      h.name,
      h.localName,
      h.counties ? JSON.stringify(h.counties) : '',
      '["Public"]',
      h.year,
      timestamp
    ];
  });

  // One bulk write instead of an appendRow per holiday — far fewer round-trips.
  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  cacheClearPrefix(PUBLIC_HOLIDAYS_CACHE_KEY);
}

/**
 * Gets all public holidays from the sheet for specified years
 */
function getStoredPublicHolidays(years) {
  var sh = getOrCreateSheet('public_holidays');
  var values = sh.getDataRange().getValues();

  if (values.length <= 1) return [];

  var effectiveTimeZone = getSpreadsheetTimeZone();

  var headers = values[0];
  var dateIdx = headers.indexOf('date');
  var nameIdx = headers.indexOf('name');
  var localNameIdx = headers.indexOf('local_name');
  var countiesIdx = headers.indexOf('counties');
  var typesIdx = headers.indexOf('types');
  var yearIdx = headers.indexOf('year');

  var holidays = [];
  // Guard against duplicate rows that may have accumulated in the sheet. The
  // calendar overlay never noticed because it keys holidays into a date map, but
  // a flat list would show the same day 3-4 times. One holiday per date+name.
  var seen = {};

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var year = yearIdx !== -1 ? row[yearIdx] : parseInt(String(row[dateIdx]).split('-')[0]);

    if (years && years.indexOf(year) === -1) continue;

    var countiesStr = countiesIdx !== -1 ? row[countiesIdx] : '';
    var counties = null;
    if (countiesStr && countiesStr !== '') {
      try {
        counties = JSON.parse(countiesStr);
      } catch (e) {
        counties = null;
      }
    }

    // Get date as-is from the sheet, avoiding any timezone conversion
    var dateValue = dateIdx !== -1 ? row[dateIdx] : '';
    var dateStr = '';
    dateStr = formatSheetDateKey(dateValue, effectiveTimeZone);

    var name = nameIdx !== -1 ? row[nameIdx] : '';
    var dedupeKey = dateStr + '|' + String(name);
    if (seen[dedupeKey]) continue;
    seen[dedupeKey] = true;

    holidays.push({
      date: dateStr,
      name: name,
      localName: localNameIdx !== -1 ? row[localNameIdx] : '',
      counties: counties,
      year: year
    });
  }

  return holidays;
}

/**
 * Removes duplicate rows from the public_holidays sheet, keeping the first
 * occurrence of each date+name. Duplicates can accumulate from older writes or
 * schema/timezone changes; the calendar masked them (date-keyed map) but a flat
 * list exposes them. Cheap when clean — it only deletes when dupes are found.
 * Returns the number of rows removed.
 */
function dedupePublicHolidaysSheet() {
  var sh = getOrCreateSheet('public_holidays');
  var values = sh.getDataRange().getValues();
  if (values.length <= 2) return 0; // header + at most one row

  var headers = values[0];
  var dateIdx = headers.indexOf('date');
  var nameIdx = headers.indexOf('name');
  if (dateIdx === -1) return 0;

  var timezone = getSpreadsheetTimeZone();
  var seen = {};
  var rowsToDelete = [];

  for (var i = 1; i < values.length; i++) {
    var key = formatSheetDateKey(values[i][dateIdx], timezone) + '|' +
      String(nameIdx !== -1 ? values[i][nameIdx] : '');
    if (seen[key]) {
      rowsToDelete.push(i + 1); // 1-based sheet row number
    } else {
      seen[key] = true;
    }
  }

  // Delete bottom-up so earlier row numbers stay valid.
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sh.deleteRow(rowsToDelete[j]);
  }

  if (rowsToDelete.length > 0) {
    cacheClearPrefix(PUBLIC_HOLIDAYS_CACHE_KEY);
    Logger.log('Public holidays dedupe: removed ' + rowsToDelete.length + ' duplicate row(s)');
  }

  return rowsToDelete.length;
}

/**
 * Checks if we have stored data for a given year
 */
function hasHolidaysForYear(year) {
  var sh = getOrCreateSheet('public_holidays');
  var values = sh.getDataRange().getValues();

  if (values.length <= 1) return false;

  var headers = values[0];
  var yearIdx = headers.indexOf('year');
  var dateIdx = headers.indexOf('date');

  for (var i = 1; i < values.length; i++) {
    var rowYear = yearIdx !== -1 ? values[i][yearIdx] : parseInt(String(values[i][dateIdx]).split('-')[0]);
    if (rowYear === year) return true;
  }

  return false;
}

/**
 * Ensures the requested years are populated in the sheet. Shared by the calendar
 * overlay endpoint and the Public Holidays page endpoint so both stay in sync.
 *
 * Public holidays for an already-fetched year never change, so we fetch each year
 * exactly once (the first time it's viewed) and trust the sheet forever after.
 * There is deliberately NO automatic "phone home" check here — newly announced
 * one-off holidays are picked up only when the user explicitly forces a refresh
 * (Settings → Refresh Public Holidays → api_refreshPublicHolidays). This keeps
 * network calls down to roughly one per new year.
 */
function ensurePublicHolidayData(years) {
  // Ensure schema is valid before doing anything else
  ensurePublicHolidaysSchema();

  // Heal any duplicate rows that accumulated in the sheet (cheap when clean).
  dedupePublicHolidaysSheet();

  // One-time heal: earlier versions stored holidays keyed by date alone, which
  // lost every date that carries more than one holiday. Force a wholesale rebuild
  // of the requested years once, so existing instances repair themselves on the
  // next load without the user having to hit a refresh button.
  var props = PropertiesService.getScriptProperties();
  var needsRebuild = props.getProperty(PH_REBUILD_FLAG) !== '1';

  // Which requested years need fetching?
  var toFetch = [];
  years.forEach(function(y) {
    if (needsRebuild || !hasHolidaysForYear(y)) toFetch.push(y);
  });

  if (toFetch.length === 0) return;

  // Serialise the fetch+store so two concurrent loads (e.g. the calendar overlay
  // and the page, or two tabs) can't both decide a year is missing and write it
  // twice — the original source of the duplicate rows.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    // Another execution is already populating; let it finish and rely on its write.
    return;
  }

  try {
    toFetch.forEach(function(y) {
      // Re-check under the lock — a racing execution may have just populated it.
      if (!needsRebuild && hasHolidaysForYear(y)) return;
      var holidays = fetchPublicHolidaysForYear(y);
      if (holidays.length > 0) {
        replaceYearHolidays(y, holidays);
      }
    });
    if (needsRebuild) props.setProperty(PH_REBUILD_FLAG, '1');
  } finally {
    lock.releaseLock();
  }
}

/**
 * API endpoint to get public holidays for the current view
 * Handles fetching missing years and daily checks
 */
function api_getPublicHolidays(payload) {
  var year = payload && payload.year ? parseInt(payload.year) : new Date().getFullYear();
  var years = [year - 1, year, year + 1];
  var settings = api_getSettings();
  var userState = settings.public_holiday_state || 'ACT';

  // Ensure schema is valid before doing anything else
  ensurePublicHolidaysSchema();

  // Check cache first for performance ('v3' suffix bumped alongside the storage rebuild).
  var cacheKey = PUBLIC_HOLIDAYS_CACHE_KEY + '_v3_' + years.join('_') + '_' + userState;
  var cached = cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  ensurePublicHolidayData(years);

  // Get all stored holidays for the requested years
  var holidays = getStoredPublicHolidays(years);

  // Filter by user's state setting
  var userCountyCode = 'AU-' + userState;

  var filtered = holidays.filter(function(holiday) {
    if (!holiday.counties || holiday.counties.length === 0) {
      return true; // Nationwide holiday
    }
    return holiday.counties.indexOf(userCountyCode) !== -1;
  });

  // Cache the result for 1 hour (3600 seconds)
  cacheSet(cacheKey, filtered, 3600);

  return filtered;
}

/**
 * API endpoint for the Public Holidays page.
 *
 * Returns every stored holiday for the requested year WITHOUT filtering by the
 * user's saved state, keeping each holiday's `counties` so the page can let the
 * user switch state on the fly and render an accurate "National / regional"
 * badge. Filtering by state happens client-side for instant pill switching.
 */
function api_getPublicHolidaysForYear(payload) {
  var year = payload && payload.year ? parseInt(payload.year) : new Date().getFullYear();

  ensurePublicHolidaysSchema();

  // v3: bumped alongside the storage rebuild so stale pre-rebuild results aren't served.
  var cacheKey = PUBLIC_HOLIDAYS_CACHE_KEY + '_page_v3_' + year;
  var cached = cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  // The page has no year selector — only ensure the requested year (the calendar's load already populates
  // neighbouring years at boot), so a missing neighbour can't trigger an external Nager fetch on this path.
  ensurePublicHolidayData([year]);

  var holidays = getStoredPublicHolidays([year]);

  // Sort chronologically so the page can render the year in order.
  holidays.sort(function(a, b) {
    return String(a.date).localeCompare(String(b.date));
  });

  cacheSet(cacheKey, holidays, 3600);

  return holidays;
}

/**
 * API endpoint to manually force a refresh of public holidays (Settings → Tools).
 * Re-pulls each year wholesale from the source, which both catches any newly
 * announced one-off holidays and repairs the sheet if it ever drifts.
 */
function api_refreshPublicHolidays() {
  ensurePublicHolidaysSchema();

  var currentYear = new Date().getFullYear();
  var years = [currentYear - 1, currentYear, currentYear + 1];

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { success: false, message: 'A refresh is already in progress — try again in a moment.' };
  }

  try {
    years.forEach(function(year) {
      var holidays = fetchPublicHolidaysForYear(year);
      if (holidays.length > 0) {
        replaceYearHolidays(year, holidays);
      }
    });
    // The wholesale rebuild has now happened by definition.
    PropertiesService.getScriptProperties().setProperty(PH_REBUILD_FLAG, '1');
  } finally {
    lock.releaseLock();
  }

  return { success: true, message: 'Public holidays refreshed successfully' };
}
