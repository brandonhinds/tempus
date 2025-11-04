var UPSTREAM_COMMIT_CACHE_KEY = 'upstream_commit_meta';
var UPSTREAM_REPO_ENDPOINT = 'https://api.github.com/repos/brandonhinds/tempus/commits/main';

function getUpstreamCommitMeta() {
  var cached = cacheGet(UPSTREAM_COMMIT_CACHE_KEY);
  if (cached && cached.sha) {
    return cached;
  }

  try {
    var response = UrlFetchApp.fetch(UPSTREAM_REPO_ENDPOINT, {
      method: 'get',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'tempus-apps-script'
      },
      muteHttpExceptions: true
    });
    var status = response.getResponseCode();
    if (status >= 200 && status < 300) {
      var text = response.getContentText();
      if (text && text.length) {
        var parsed = JSON.parse(text);
        var sha = parsed && parsed.sha ? String(parsed.sha) : '';
        var timestamp = '';
        if (parsed && parsed.commit && parsed.commit.committer && parsed.commit.committer.date) {
          timestamp = String(parsed.commit.committer.date);
        }
        var payload = { sha: sha, timestamp: timestamp };
        if (sha) {
          cacheSet(UPSTREAM_COMMIT_CACHE_KEY, payload);
        }
        return payload;
      }
    } else {
      return { error: 'HTTP ' + status };
    }
  } catch (e) {
    return { error: String(e) };
  }

  return {};
}

function api_checkForUpdate() {
  var localCommit = BUILD_META && BUILD_META.commit ? String(BUILD_META.commit) : '';
  var upstream = getUpstreamCommitMeta();
  var upstreamSha = upstream && upstream.sha ? String(upstream.sha) : '';
  var upstreamShort = upstreamSha ? upstreamSha.substring(0, 7) : '';

  var hasUpdate = false;
  if (localCommit && upstreamShort) {
    hasUpdate = localCommit !== upstreamShort;
  }

  return {
    localCommit: localCommit,
    upstreamCommit: upstreamShort,
    upstreamTimestamp: upstream && upstream.timestamp ? String(upstream.timestamp) : '',
    hasUpdate: hasUpdate,
    error: upstream && upstream.error ? String(upstream.error) : ''
  };
}
