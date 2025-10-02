/** Settings / Projects / Feature Flags API */
var FEATURE_FLAG_CACHE_KEY = 'feature_flags_v1';
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
    var nameIdx = headers.indexOf('name');
    var descriptionIdx = headers.indexOf('description');
    values.slice(1).forEach(function(row) {
      var feature = featureIdx === -1 ? '' : String(row[featureIdx] || '').trim();
      if (!feature) return;
      var enabled = enabledIdx === -1 ? false : parseBoolean(row[enabledIdx]);
      var name = nameIdx === -1 ? '' : String(row[nameIdx] || '').trim();
      var description = descriptionIdx === -1 ? '' : String(row[descriptionIdx] || '').trim();
      result[feature] = {
        enabled: enabled,
        name: name || feature,
        description: description
      };
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
  var name = payload.name != null ? String(payload.name) : feature;
  var description = payload.description != null ? String(payload.description) : '';
  var sh = getOrCreateSheet('feature_flags');
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : ['feature','enabled','name','description'];
  var featureIdx = headers.indexOf('feature');
  var enabledIdx = headers.indexOf('enabled');
  var nameIdx = headers.indexOf('name');
  var descriptionIdx = headers.indexOf('description');
  var targetRow = -1;
  for (var i = 1; i < values.length; i++) {
    if (featureIdx !== -1 && String(values[i][featureIdx]).trim() === feature) {
      targetRow = i + 1;
      break;
    }
  }
  var rowValues = headers.map(function(header) {
    if (header === 'feature') return feature;
    if (header === 'enabled') return enabled ? 'TRUE' : 'FALSE';
    if (header === 'name') return name || feature;
    if (header === 'description') return description;
    return '';
  });
  if (targetRow === -1) {
    sh.appendRow(rowValues);
  } else {
    sh.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  }
  cacheClearPrefix(FEATURE_FLAG_CACHE_KEY);
  return { success: true, flags: api_getFeatureFlags() };
}
