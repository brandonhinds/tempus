/** Settings / Projects / Feature Flags API */
var FEATURE_FLAG_CACHE_KEY = 'feature_flags_v2';

function api_getScriptId() {
  return ScriptApp.getScriptId();
}

function api_backupSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var backupName = 'Tempus Backup - ' + timestamp;

    // Create a copy in the same folder as the original
    var file = DriveApp.getFileById(ss.getId());
    var parentFolder = file.getParents().hasNext() ? file.getParents().next() : DriveApp.getRootFolder();
    var backup = file.makeCopy(backupName, parentFolder);

    Logger.log('Created backup: ' + backupName + ' (ID: ' + backup.getId() + ')');

    return {
      success: true,
      name: backupName,
      url: backup.getUrl()
    };
  } catch (e) {
    Logger.log('Backup failed: ' + e.toString());
    return {
      success: false,
      error: e.toString()
    };
  }
}

function api_getSettings() {
  var key = 'settings';
  var cached = cacheGet(key);
  // Only use cache if it's a valid non-empty object
  if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
    Logger.log('api_getSettings: Returning ' + Object.keys(cached).length + ' settings from cache');
    return cached;
  }

  Logger.log('api_getSettings: Cache miss or empty, reading from sheet');
  var sh = getOrCreateSheet('user_settings');
  var values = sh.getDataRange().getValues();
  var out = {};

  // Skip header row and build settings object
  for (var i = 1; i < values.length; i++) {
    var rowKey = values[i][0];
    var rowValue = values[i][1];
    if (rowKey !== '' && rowKey !== null && rowKey !== undefined) {
      out[rowKey] = rowValue;
    }
  }

  Logger.log('api_getSettings: Loaded ' + Object.keys(out).length + ' settings from sheet');
  cacheSet(key, out);
  return out;
}

function api_updateSettings(settings) {
  var sh = getOrCreateSheet('user_settings');
  var values = sh.getDataRange().getValues();
  var map = {};
  values.forEach(function(r,i){ if (i>0) map[r[0]] = i+1; });
  Object.keys(settings).forEach(function(k){
    var v = settings[k];
    if (map[k]) { sh.getRange(map[k],2).setValue(v); sh.getRange(map[k],3).setValue(typeof v); }
    else { sh.appendRow([k, v, typeof v]); }
  });
  cacheClearPrefix('settings');
  return { success: true };
}

function api_getProjects() {
  var key = 'projects';
  var cached = cacheGet(key);
  if (cached) return cached;
  var sh = getOrCreateSheet('projects');
  var values = sh.getDataRange().getValues();
  var out = values.slice(1).map(function(r){ return { id: r[0], name: r[1], color: r[2], active: String(r[3]) === 'true' }; });
  cacheSet(key, out);
  return out;
}

function parseBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === null || value === undefined) return false;
  var str = String(value).toLowerCase();
  return str === 'true' || str === '1' || str === 'yes';
}

function api_getFeatureFlags() {
  var cached = cacheGet(FEATURE_FLAG_CACHE_KEY);
  if (cached) return cached;
  var sh = getOrCreateSheet('feature_flags');
  var values = sh.getDataRange().getValues();
  var result = {};
  if (values.length > 1) {
    var headers = values[0];
    var featureIdx = headers.indexOf('feature');
    var enabledIdx = headers.indexOf('enabled');
    values.slice(1).forEach(function(row) {
      var feature = featureIdx === -1 ? '' : String(row[featureIdx] || '').trim();
      if (!feature) return;
      var enabled = enabledIdx === -1 ? false : parseBoolean(row[enabledIdx]);
      result[feature] = { enabled: enabled };
    });
  }
  cacheSet(FEATURE_FLAG_CACHE_KEY, result);
  return result;
}

function api_setFeatureFlag(payload) {
  if (!payload || !payload.feature) {
    throw new Error('Feature identifier is required.');
  }
  var feature = String(payload.feature).trim();
  if (feature === '') {
    throw new Error('Feature identifier is required.');
  }
  var enabled = parseBoolean(payload.enabled);
  var sh = getOrCreateSheet('feature_flags');
  var values = sh.getDataRange().getValues();
  if (!values.length) {
    sh.getRange(1, 1, 1, 2).setValues([['feature', 'enabled']]);
    values = sh.getDataRange().getValues();
  }
  var headers = values.length ? values[0] : ['feature','enabled'];
  if (headers.indexOf('feature') === -1 || headers.indexOf('enabled') === -1) {
    sh.getRange(1, 1, 1, 2).setValues([['feature', 'enabled']]);
    values = sh.getDataRange().getValues();
    headers = values[0];
  }
  var featureIdx = headers.indexOf('feature');
  var enabledIdx = headers.indexOf('enabled');
  var targetRow = -1;
  for (var i = 1; i < values.length; i++) {
    if (featureIdx !== -1 && String(values[i][featureIdx]).trim() === feature) {
      targetRow = i + 1;
      break;
    }
  }
  var rowValues = [feature, enabled ? 'TRUE' : 'FALSE'];
  if (targetRow === -1) {
    sh.appendRow(rowValues);
  } else {
    sh.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  }
  cacheClearPrefix(FEATURE_FLAG_CACHE_KEY);
  return { success: true, flags: api_getFeatureFlags() };
}

function sanitizeEntryDefaults(raw) {
  var sanitized = { basic: [], advanced: [] };
  if (raw && Array.isArray(raw.basic)) {
    sanitized.basic = raw.basic.map(function(item) {
      var out = item && typeof item === 'object' ? Object.assign({}, item) : {};
      out.name = out.name ? String(out.name) : '';
      out.duration_minutes = Number(out.duration_minutes) || 0;
      out.hour_type_id = out.hour_type_id ? String(out.hour_type_id).trim() : '';
      return out;
    });
  }
  if (raw && Array.isArray(raw.advanced)) {
    sanitized.advanced = raw.advanced.map(function(item) {
      var out = item && typeof item === 'object' ? Object.assign({}, item) : {};
      out.name = out.name ? String(out.name) : '';
      out.punches = Array.isArray(out.punches) ? out.punches : [];
      out.hour_type_id = out.hour_type_id ? String(out.hour_type_id).trim() : '';
      return out;
    });
  }
  return sanitized;
}

function api_getEntryDefaults() {
  var settings = api_getSettings();
  var defaultsJson = settings.entry_defaults || '{}';
  try {
    var defaults = JSON.parse(defaultsJson) || {};
    return sanitizeEntryDefaults(defaults);
  } catch (e) {
    return { basic: [], advanced: [] };
  }
}

function api_saveEntryDefault(type, name, data) {
  if (!type || (type !== 'basic' && type !== 'advanced')) {
    throw new Error('Type must be "basic" or "advanced".');
  }
  if (!name || String(name).trim() === '') {
    throw new Error('Default name is required.');
  }
  if (!data) {
    throw new Error('Default data is required.');
  }

  var defaults = api_getEntryDefaults();
  var trimmedName = String(name).trim();

  // Check if name already exists
  var existingIndex = defaults[type].findIndex(function(d) {
    return d.name === trimmedName;
  });

  if (existingIndex !== -1) {
    throw new Error('A default with this name already exists.');
  }

  // Create new default object
  var newDefault = {
    name: trimmedName
  };

  var hourTypeId = data.hour_type_id ? String(data.hour_type_id).trim() : '';

  if (type === 'basic') {
    newDefault.duration_minutes = data.duration_minutes || 0;
  } else {
    newDefault.punches = data.punches || [];
  }

  newDefault.hour_type_id = hourTypeId;

  // Add to defaults
  defaults[type].push(newDefault);

  // Save back to settings
  var settingsUpdate = {};
  settingsUpdate.entry_defaults = JSON.stringify(defaults);
  api_updateSettings(settingsUpdate);

  return { success: true, defaults: defaults };
}

function api_updateEntryDefault(type, oldName, newName, data) {
  if (!type || (type !== 'basic' && type !== 'advanced')) {
    throw new Error('Type must be "basic" or "advanced".');
  }
  if (!oldName || String(oldName).trim() === '') {
    throw new Error('Original default name is required.');
  }
  if (!newName || String(newName).trim() === '') {
    throw new Error('New default name is required.');
  }
  if (!data) {
    throw new Error('Default data is required.');
  }

  var defaults = api_getEntryDefaults();
  var trimmedOldName = String(oldName).trim();
  var trimmedNewName = String(newName).trim();

  // Find existing default
  var existingIndex = defaults[type].findIndex(function(d) {
    return d.name === trimmedOldName;
  });

  if (existingIndex === -1) {
    throw new Error('Default not found.');
  }

  // Check if new name conflicts with another default (unless it's the same name)
  if (trimmedOldName !== trimmedNewName) {
    var nameConflict = defaults[type].findIndex(function(d) {
      return d.name === trimmedNewName;
    });

    if (nameConflict !== -1) {
      throw new Error('A default with this name already exists.');
    }
  }

  // Update the default
  var updatedDefault = {
    name: trimmedNewName
  };

  var hourTypeId = data.hour_type_id ? String(data.hour_type_id).trim() : '';

  if (type === 'basic') {
    updatedDefault.duration_minutes = data.duration_minutes || 0;
  } else {
    updatedDefault.punches = data.punches || [];
  }

  updatedDefault.hour_type_id = hourTypeId;

  defaults[type][existingIndex] = updatedDefault;

  // Save back to settings
  var settingsUpdate = {};
  settingsUpdate.entry_defaults = JSON.stringify(defaults);
  api_updateSettings(settingsUpdate);

  return { success: true, defaults: defaults };
}

function api_deleteEntryDefault(type, name) {
  if (!type || (type !== 'basic' && type !== 'advanced')) {
    throw new Error('Type must be "basic" or "advanced".');
  }
  if (!name || String(name).trim() === '') {
    throw new Error('Default name is required.');
  }

  var defaults = api_getEntryDefaults();
  var trimmedName = String(name).trim();

  // Find and remove the default
  var originalLength = defaults[type].length;
  defaults[type] = defaults[type].filter(function(d) {
    return d.name !== trimmedName;
  });

  if (defaults[type].length === originalLength) {
    throw new Error('Default not found.');
  }

  // Save back to settings
  var settingsUpdate = {};
  settingsUpdate.entry_defaults = JSON.stringify(defaults);
  api_updateSettings(settingsUpdate);

  return { success: true, defaults: defaults };
}

/** Super Guarantee Rates API */
var SUPER_RATES_CACHE_KEY = 'super_guarantee_rates';
var DEFAULT_SUPER_GUARANTEE_RATES = [
  { start_date: '2002-07-01', end_date: '2013-06-30', percentage: 9.00 },
  { start_date: '2013-07-01', end_date: '2014-06-30', percentage: 9.25 },
  { start_date: '2014-07-01', end_date: '2021-06-30', percentage: 9.50 },
  { start_date: '2021-07-01', end_date: '2022-06-30', percentage: 10.00 },
  { start_date: '2022-07-01', end_date: '2023-06-30', percentage: 10.50 },
  { start_date: '2023-07-01', end_date: '2024-06-30', percentage: 11.00 },
  { start_date: '2024-07-01', end_date: '2025-06-30', percentage: 11.50 },
  { start_date: '2025-07-01', end_date: null, percentage: 12.00 }
];

function api_getSuperGuaranteeRates() {
  var cached = cacheGet(SUPER_RATES_CACHE_KEY);
  if (cached) return cached;

  var settings = api_getSettings();
  var ratesJson = settings.super_guarantee_rates || null;

  var rates;
  if (!ratesJson) {
    rates = DEFAULT_SUPER_GUARANTEE_RATES;
  } else {
    try {
      rates = JSON.parse(ratesJson);
      if (!Array.isArray(rates)) {
        rates = DEFAULT_SUPER_GUARANTEE_RATES;
      }
    } catch (e) {
      rates = DEFAULT_SUPER_GUARANTEE_RATES;
    }
  }

  cacheSet(SUPER_RATES_CACHE_KEY, rates);
  return rates;
}

function api_setSuperGuaranteeRates(rates) {
  if (!Array.isArray(rates)) {
    throw new Error('Rates must be an array.');
  }

  // Validate each rate
  for (var i = 0; i < rates.length; i++) {
    var rate = rates[i];
    if (!rate.start_date) {
      throw new Error('Each rate must have a start_date.');
    }
    if (typeof rate.percentage !== 'number' || rate.percentage < 0) {
      throw new Error('Each rate must have a valid non-negative percentage.');
    }
  }

  var settingsUpdate = {};
  settingsUpdate.super_guarantee_rates = JSON.stringify(rates);
  api_updateSettings(settingsUpdate);

  cacheClearPrefix(SUPER_RATES_CACHE_KEY);
  return { success: true, rates: api_getSuperGuaranteeRates() };
}

function getSuperGuaranteeRate(targetDate) {
  var rates = api_getSuperGuaranteeRates();

  // Parse target date as yyyy-MM-dd
  var targetStr = String(targetDate).substring(0, 10);

  var matchingRates = [];
  for (var i = 0; i < rates.length; i++) {
    var rate = rates[i];
    var startDate = String(rate.start_date).substring(0, 10);
    var endDate = rate.end_date ? String(rate.end_date).substring(0, 10) : null;

    // Check if target date falls within this rate's range
    if (targetStr >= startDate) {
      if (endDate === null || targetStr <= endDate) {
        matchingRates.push(rate);
      }
    }
  }

  if (matchingRates.length === 0) {
    // No matching rate found, return 12% as fallback
    return 0.12;
  }

  // If multiple matches, use the one with the most recent start date
  if (matchingRates.length > 1) {
    matchingRates.sort(function(a, b) {
      return String(b.start_date).localeCompare(String(a.start_date));
    });
  }

  var percentage = matchingRates[0].percentage;
  // Convert percentage to decimal (e.g., 12 -> 0.12)
  return percentage > 1 ? percentage / 100 : percentage;
}
