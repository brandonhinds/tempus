/** Simple PropertiesService-backed cache */
var CACHE_TTL_MS = 5 * 60 * 1000;
var CACHE_PREFIX = 'ts_';

function cacheGet(key) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(CACHE_PREFIX + key);
  if (!raw) return null;
  try {
    var obj = JSON.parse(raw);
    if (Date.now() - obj.ts < CACHE_TTL_MS) return obj.data;
  } catch (e) {}
  return null;
}

function cacheSet(key, data) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data: data }));
}

function cacheClearPrefix(prefix) {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  Object.keys(all).forEach(function(k){ if (k.indexOf(CACHE_PREFIX + prefix) === 0) props.deleteProperty(k); });
}
