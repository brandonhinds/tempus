var RELEASE_MANIFEST_CACHE_KEY = 'stable_release_manifest_v1';
var RELEASE_MANIFEST_ENDPOINT = 'https://raw.githubusercontent.com/brandonhinds/tempus/refs/heads/release/release-manifest.json';
var RELEASE_MANIFEST_SCHEMA = 1;

function releaseError_(code, message) {
  return { code: String(code || 'unavailable'), message: String(message || 'Release status unavailable'), recoverable: true };
}

function validCommitSha_(value) {
  var sha = String(value || '').toLowerCase();
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : '';
}

function validReleaseTimestamp_(value) {
  var text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(text)) return '';
  return isNaN(new Date(text).getTime()) ? '' : text;
}

function commitsMatch_(localSha, releasedSha) {
  if (!localSha || !releasedSha) return false;
  return localSha.indexOf(releasedSha) === 0 || releasedSha.indexOf(localSha) === 0;
}

function normalizeReleaseManifest_(value) {
  if (!value || typeof value !== 'object') return { error: releaseError_('malformed_manifest', 'Release manifest is not an object.') };
  var schema = Number(value.schema_version);
  var channel = String(value.channel || '');
  var sha = validCommitSha_(value.commit_sha);
  var publishedAt = validReleaseTimestamp_(value.published_at);
  var archiveUrl = String(value.archive_url || '');
  if (schema !== RELEASE_MANIFEST_SCHEMA) return { error: releaseError_('unsupported_schema', 'Unsupported release manifest schema.') };
  if (channel !== 'stable') return { error: releaseError_('wrong_channel', 'Release manifest is not the stable channel.') };
  if (sha.length !== 40 || !publishedAt || !/^https:\/\//.test(archiveUrl)) {
    return { error: releaseError_('malformed_manifest', 'Release manifest is missing required release metadata.') };
  }
  return {
    schema_version: schema,
    channel: channel,
    commit_sha: sha,
    published_at: publishedAt,
    display_version: String(value.display_version || ''),
    archive_url: archiveUrl
  };
}

function getStableReleaseManifest_() {
  var cached = cacheGet(RELEASE_MANIFEST_CACHE_KEY);
  if (cached) return cached;
  try {
    var response = UrlFetchApp.fetch(RELEASE_MANIFEST_ENDPOINT, {
      method: 'get',
      headers: { Accept: 'application/json', 'User-Agent': 'tempus-apps-script' },
      muteHttpExceptions: true
    });
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) return { error: releaseError_('http_error', 'Release manifest request returned HTTP ' + status + '.') };
    var parsed;
    try { parsed = JSON.parse(response.getContentText() || ''); }
    catch (e) { return { error: releaseError_('invalid_json', 'Release manifest could not be read.') }; }
    var normalized = normalizeReleaseManifest_(parsed);
    if (!normalized.error) cacheSet(RELEASE_MANIFEST_CACHE_KEY, normalized, 5 * 60);
    return normalized;
  } catch (e) {
    return { error: releaseError_('network_error', String(e)) };
  }
}

function compareStableRelease_(localMeta, manifest) {
  var localSha = validCommitSha_(localMeta && localMeta.buildCommit);
  var releasedSha = validCommitSha_(manifest && manifest.commit_sha);
  var localTimestamp = validReleaseTimestamp_(localMeta && localMeta.buildTimestamp);
  var releasedTimestamp = validReleaseTimestamp_(manifest && manifest.published_at);
  var localDate = String(localMeta && localMeta.buildDate || '').substring(0, 10);
  var releasedDate = releasedTimestamp ? releasedTimestamp.substring(0, 10) : '';
  var result = { hasUpdate: false, comparisonMode: 'unavailable', relation: 'unknown', legacyComparison: false };

  if (localSha && releasedSha) {
    result.comparisonMode = 'commit_sha';
    if (commitsMatch_(localSha, releasedSha)) { result.relation = 'current'; return result; }
    if (localTimestamp && releasedTimestamp) {
      result.comparisonMode = 'commit_sha_and_timestamp';
      if (releasedTimestamp > localTimestamp) { result.hasUpdate = true; result.relation = 'outdated'; }
      else if (releasedTimestamp < localTimestamp) result.relation = 'local_newer';
      else result.relation = 'divergent';
      return result;
    }
    result.relation = 'divergent';
    return result;
  }

  // One compatibility release for builds stamped before commit metadata was available.
  result.comparisonMode = 'legacy_date';
  result.legacyComparison = true;
  if (localDate && releasedDate) {
    result.hasUpdate = releasedDate > localDate;
    result.relation = result.hasUpdate ? 'outdated' : (releasedDate === localDate ? 'current' : 'local_newer');
  }
  return result;
}

function api_checkForUpdate() {
  var local = (typeof BUILD_META !== 'undefined' && BUILD_META) ? BUILD_META : {};
  var localBuildDate = String(local.buildDate || '');
  var localCommitSha = validCommitSha_(local.buildCommit);
  var localTimestamp = validReleaseTimestamp_(local.buildTimestamp);
  var manifest = getStableReleaseManifest_();
  var releasedTimestamp = manifest && manifest.published_at ? String(manifest.published_at) : '';
  var releasedDate = releasedTimestamp ? releasedTimestamp.substring(0, 10) : '';
  var failure = manifest && manifest.error ? manifest.error : null;
  var comparison = failure
    ? { hasUpdate:false, comparisonMode:'unavailable', relation:'unknown', legacyComparison:false }
    : compareStableRelease_(local, manifest);

  return {
    localCommitSha: localCommitSha,
    releasedCommitSha: failure ? '' : String(manifest.commit_sha || ''),
    localTimestamp: localTimestamp,
    releasedTimestamp: releasedTimestamp,
    releaseChannel: failure ? 'stable' : String(manifest.channel || 'stable'),
    manifestSchema: failure ? null : Number(manifest.schema_version),
    displayVersion: failure ? '' : String(manifest.display_version || ''),
    releaseArchiveUrl: failure ? '' : String(manifest.archive_url || ''),
    comparisonMode: comparison.comparisonMode,
    relation: comparison.relation,
    legacyComparison: comparison.legacyComparison,
    hasUpdate: comparison.hasUpdate,
    recoverableError: failure,
    // Temporary compatibility fields for deployed clients from the previous update API.
    localBuildDate: localBuildDate,
    upstreamDate: releasedDate,
    upstreamTimestamp: releasedTimestamp,
    error: failure ? failure.message : ''
  };
}
