/** Settings / Projects / Feature Flags API */
var FEATURE_FLAG_CACHE_KEY = 'feature_flags_v2';
function api_getSettings() {
  var key = 'settings';
  var cached = cacheGet(key);
  if (cached) return cached;
  var sh = getOrCreateSheet('user_settings');
  var values = sh.getDataRange().getValues();
  var out = {};
  values.slice(1).forEach(function(r){ if (r[0] !== '') out[r[0]] = r[1]; });
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

function api_getEntryDefaults() {
  var settings = api_getSettings();
  var defaultsJson = settings.entry_defaults || '{}';
  try {
    var defaults = JSON.parse(defaultsJson);
    return {
      basic: defaults.basic || [],
      advanced: defaults.advanced || []
    };
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

  if (type === 'basic') {
    newDefault.duration_minutes = data.duration_minutes || 0;
  } else {
    newDefault.punches = data.punches || [];
  }

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

  if (type === 'basic') {
    updatedDefault.duration_minutes = data.duration_minutes || 0;
  } else {
    updatedDefault.punches = data.punches || [];
  }

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
