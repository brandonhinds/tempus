/**
 * CacheService-backed cache.
 *
 * Values live in the script cache (native TTLs, 100KB/value) rather than
 * PropertiesService (9KB/value, no TTL, O(keys) prefix deletes — outgrowing
 * the value cap made cacheSet throw inside read paths).
 *
 * CacheService cannot enumerate keys, so cacheClearPrefix works by bumping a
 * per-prefix version (stored in script properties) that is folded into every
 * cache key: bumping the version makes all keys under that prefix unreachable
 * and they expire naturally. Cache failures always degrade to cache misses —
 * cacheSet/cacheGet never throw into their callers.
 */
var CACHE_TTL_SECONDS = 5 * 60;
var CACHE_MAX_TTL_SECONDS = 6 * 60 * 60; // CacheService hard limit (21600s)
var CACHE_PREFIX = 'ts_';
var CACHE_VERSIONS_KEY = 'tempus_cache_versions';

var __cacheVersionsMemo = null;

function getCacheVersions_() {
  if (__cacheVersionsMemo) return __cacheVersionsMemo;
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(CACHE_VERSIONS_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    __cacheVersionsMemo = (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    __cacheVersionsMemo = {};
  }
  return __cacheVersionsMemo;
}

// Sums the versions of every cleared prefix the key falls under, so
// overlapping prefixes (e.g. 'entries' and 'entries_v2_') both invalidate it.
function versionedCacheKey_(key) {
  var versions = getCacheVersions_();
  var version = 0;
  Object.keys(versions).forEach(function(prefix) {
    if (String(key).indexOf(prefix) === 0) version += versions[prefix];
  });
  return CACHE_PREFIX + 'v' + version + '_' + key;
}

function cacheGet(key) {
  try {
    var raw = CacheService.getScriptCache().get(versionedCacheKey_(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function cacheSet(key, data, ttlSeconds) {
  try {
    var ttl = Number(ttlSeconds);
    if (isNaN(ttl) || ttl <= 0) ttl = CACHE_TTL_SECONDS;
    if (ttl > CACHE_MAX_TTL_SECONDS) ttl = CACHE_MAX_TTL_SECONDS;
    CacheService.getScriptCache().put(versionedCacheKey_(key), JSON.stringify(data), ttl);
  } catch (e) {
    // Oversized values or cache outages degrade to a cache miss.
  }
}

function cacheClearPrefix(prefix) {
  try {
    var props = PropertiesService.getScriptProperties();
    var versions;
    try {
      var raw = props.getProperty(CACHE_VERSIONS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      versions = (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      versions = {};
    }
    versions[prefix] = (Number(versions[prefix]) || 0) + 1;
    props.setProperty(CACHE_VERSIONS_KEY, JSON.stringify(versions));
    __cacheVersionsMemo = versions;
  } catch (e) {
    // Invalidation failure only extends staleness to the entry TTL.
  }
}

/**
 * Migration (see backend/migrations.js): the previous PropertiesService-backed
 * cache left every cached payload in script properties with no expiry,
 * accumulating toward the 500KB store quota. Delete them all; the new cache
 * repopulates on demand.
 */
function migration_clearLegacyCacheProperties() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var removed = 0;
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(CACHE_PREFIX) === 0) {
      props.deleteProperty(key);
      removed++;
    }
  });
  Logger.log('migration_clearLegacyCacheProperties: removed ' + removed + ' legacy cache propert(ies)');
}
