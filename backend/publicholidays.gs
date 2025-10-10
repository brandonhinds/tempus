/** Public Holidays API */
var PUBLIC_HOLIDAYS_CACHE_KEY = 'public_holidays_v1';
var PUBLIC_HOLIDAYS_LAST_CHECK_KEY = 'public_holidays_last_check';
var NAGER_API_BASE = 'https://date.nager.at/api/v3';

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

/**
 * Fetches upcoming public holidays from the Nager.Date API
 */
function fetchNextPublicHolidays() {
  var url = NAGER_API_BASE + '/NextPublicHolidays/AU';
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    Logger.log('Failed to fetch next public holidays: ' + response.getResponseCode());
    return [];
  } catch (e) {
    Logger.log('Error fetching next public holidays: ' + e.toString());
    return [];
  }
}

/**
 * Stores public holiday data in the public_holidays sheet
 */
function storePublicHolidays(holidays) {
  if (!holidays || holidays.length === 0) return;

  var sh = getOrCreateSheet('public_holidays');
  var values = sh.getDataRange().getValues();
  var headers = values.length > 0 ? values[0] : ['date', 'name', 'local_name', 'counties', 'types', 'year', 'fetched_at'];

  if (values.length === 0) {
    sh.appendRow(headers);
  }

  var existingDates = {};
  for (var i = 1; i < values.length; i++) {
    existingDates[values[i][0]] = i + 1; // Store row number
  }

  var timestamp = new Date().toISOString();

  holidays.forEach(function(holiday) {
    var dateStr = holiday.date;
    var year = parseInt(dateStr.split('-')[0]);
    var counties = holiday.counties ? JSON.stringify(holiday.counties) : '';
    var types = holiday.types ? JSON.stringify(holiday.types) : '["Public"]';

    var rowData = [
      dateStr,
      holiday.name || holiday.localName,
      holiday.localName || holiday.name,
      counties,
      types,
      year,
      timestamp
    ];

    if (existingDates[dateStr]) {
      // Update existing row
      sh.getRange(existingDates[dateStr], 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Append new row
      sh.appendRow(rowData);
    }
  });

  // Clear cache to force reload
  cacheClearPrefix(PUBLIC_HOLIDAYS_CACHE_KEY);
}

/**
 * Gets all public holidays from the sheet for specified years
 */
function getStoredPublicHolidays(years) {
  var sh = getOrCreateSheet('public_holidays');
  var values = sh.getDataRange().getValues();

  if (values.length <= 1) return [];

  var headers = values[0];
  var dateIdx = headers.indexOf('date');
  var nameIdx = headers.indexOf('name');
  var localNameIdx = headers.indexOf('local_name');
  var countiesIdx = headers.indexOf('counties');
  var typesIdx = headers.indexOf('types');
  var yearIdx = headers.indexOf('year');

  var holidays = [];

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
    if (dateValue instanceof Date) {
      // Format using Utilities.formatDate to get the date in the sheet's timezone without conversion
      // This preserves the exact date stored in the sheet (e.g., 2025-12-25 stays 2025-12-25)
      dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      // If it's already a string, extract just the date part (YYYY-MM-DD)
      dateStr = String(dateValue).split('T')[0];
    }

    holidays.push({
      date: dateStr,
      name: nameIdx !== -1 ? row[nameIdx] : '',
      localName: localNameIdx !== -1 ? row[localNameIdx] : '',
      counties: counties,
      year: year
    });
  }

  return holidays;
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
 * API endpoint to get public holidays for the current view
 * Handles fetching missing years and daily checks
 */
function api_getPublicHolidays(payload) {
  var year = payload && payload.year ? parseInt(payload.year) : new Date().getFullYear();
  var years = [year - 1, year, year + 1];
  var settings = api_getSettings();
  var userState = settings.public_holiday_state || 'ACT';

  // Check cache first for performance
  var cacheKey = PUBLIC_HOLIDAYS_CACHE_KEY + '_' + years.join('_') + '_' + userState;
  var cached = cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  // Only check for missing years if we don't have data in the sheet at all
  var sh = getOrCreateSheet('public_holidays');
  var rowCount = sh.getLastRow();

  // If we have very little data (just headers or a few rows), fetch all years
  if (rowCount < 50) {
    var missingYears = [];
    years.forEach(function(y) {
      if (!hasHolidaysForYear(y)) {
        missingYears.push(y);
      }
    });

    // Fetch missing years
    if (missingYears.length > 0) {
      missingYears.forEach(function(y) {
        var holidays = fetchPublicHolidaysForYear(y);
        if (holidays.length > 0) {
          storePublicHolidays(holidays);
        }
      });
    }
  }

  // Check if we should do the daily "next holidays" check (for newly announced holidays)
  var lastCheck = cacheGet(PUBLIC_HOLIDAYS_LAST_CHECK_KEY);
  var now = new Date().getTime();
  var oneDayMs = 24 * 60 * 60 * 1000;

  if (!lastCheck || (now - lastCheck) > oneDayMs) {
    var nextHolidays = fetchNextPublicHolidays();
    if (nextHolidays.length > 0) {
      storePublicHolidays(nextHolidays);
    }
    cacheSet(PUBLIC_HOLIDAYS_LAST_CHECK_KEY, now, 86400); // Cache for 24 hours
  }

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
 * API endpoint to manually refresh public holidays
 */
function api_refreshPublicHolidays() {
  var currentYear = new Date().getFullYear();
  var years = [currentYear - 1, currentYear, currentYear + 1];

  years.forEach(function(year) {
    var holidays = fetchPublicHolidaysForYear(year);
    if (holidays.length > 0) {
      storePublicHolidays(holidays);
    }
  });

  // Also fetch next holidays
  var nextHolidays = fetchNextPublicHolidays();
  if (nextHolidays.length > 0) {
    storePublicHolidays(nextHolidays);
  }

  // Update last check timestamp
  cacheSet(PUBLIC_HOLIDAYS_LAST_CHECK_KEY, new Date().getTime(), 86400);

  return { success: true, message: 'Public holidays refreshed successfully' };
}
