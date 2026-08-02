/** Shared mutation, validation and export safety helpers. */

var TEMPUS_SCRIPT_LOCK_ACTIVE = false;

function withScriptLock_(operationName, callback) {
  if (TEMPUS_SCRIPT_LOCK_ACTIVE) return callback();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('concurrent_update: Another ' + operationName + ' is still being saved. Please retry.');
  try {
    TEMPUS_SCRIPT_LOCK_ACTIVE = true;
    return callback();
  } finally {
    TEMPUS_SCRIPT_LOCK_ACTIVE = false;
    lock.releaseLock();
  }
}

function apiRecoverableFailure_(code, message, details) {
  var result = { success: false, error: String(code || 'invalid_request'), message: String(message || 'The request could not be completed.') };
  if (details !== undefined) result.details = details;
  return result;
}

function requireHttpUrl_(value, label, allowEmpty) {
  var url = String(value == null ? '' : value).trim();
  if (!url && allowEmpty) return '';
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error((label || 'URL') + ' must begin with http:// or https://.');
  return url;
}

function normalizePercentageDecimal_(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback === undefined ? 0 : fallback;
  var number = Number(value);
  if (!isFinite(number) || number < 0) throw new Error('Percentage must be a non-negative number.');
  if (number > 1 && number <= 100) number = number / 100;
  if (number > 1) throw new Error('Percentage cannot exceed 100%.');
  return Math.round(number * 1000000) / 1000000;
}

function roundMoney_(value) {
  var number = Number(value);
  if (!isFinite(number)) number = 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function normalizeIsoDateStrict_(value, label, allowEmpty) {
  var date = String(value == null ? '' : value).trim();
  if (!date && allowEmpty) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error((label || 'Date') + ' must use YYYY-MM-DD.');
  var parts = date.split('-').map(Number);
  var parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
  if (parsed.getUTCFullYear() !== parts[0] || parsed.getUTCMonth() !== parts[1] - 1 || parsed.getUTCDate() !== parts[2]) throw new Error((label || 'Date') + ' is not valid.');
  return date;
}

function csvSafeCell_(value) {
  var text = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function stableJsonStringify_(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableJsonStringify_).join(',') + ']';
  return '{' + Object.keys(value).sort().map(function(key) { return JSON.stringify(key) + ':' + stableJsonStringify_(value[key]); }).join(',') + '}';
}

function sha256Hex_(value) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return digest.map(function(byte) { var normalized = byte < 0 ? byte + 256 : byte; return ('0' + normalized.toString(16)).slice(-2); }).join('');
}
