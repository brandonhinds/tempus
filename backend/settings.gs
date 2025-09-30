/** Settings / Projects API */
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
