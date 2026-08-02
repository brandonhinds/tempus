/**
 * One-time data migrations, run automatically on web app load.
 *
 * doGet calls runPendingMigrations() on every page load; applied migration
 * ids are recorded in script properties, so each migration executes exactly
 * once per spreadsheet — on the first page load after the code containing it
 * is deployed. Users never run anything manually.
 *
 * Adding a migration:
 *  1. Write an idempotent function (safe to run twice; a failed run is
 *     simply retried on the next page load because its id is only recorded
 *     after it returns without throwing). It must no-op on spreadsheets that
 *     don't have the sheet it targets (fresh installs).
 *  2. Register it in listMigrations() with a unique, descriptive id.
 *     Ids are permanent — never reuse or rename a shipped id. Ids shared with
 *     the upstream project are intentionally identical so spreadsheets
 *     upgrading from it skip work they have already done.
 */
var MIGRATIONS_PROP_KEY = 'tempus_migrations_applied';

// True while this execution is the one running migrations, so the sheet
// accessors the migrations themselves use bypass assertMigrationsSettled_.
var MIGRATION_CONTEXT = { active: false };

// Per-execution memo: once the pending list has been observed empty there is
// no need to re-read script properties on every sheet access.
var __migrationsSettledMemo = false;

// Resolved at call time (not file load time) so registered functions may
// live in any file regardless of file evaluation order.
function listMigrations() {
  // Order matters: the property cleanup must run FIRST. Recording an applied
  // migration writes a script property, which throws while the store is at
  // its 500KB quota — the legacy cache is what fills it, so the delete-only
  // cleanup has to free the space before any other migration can be recorded.
  return [
    { id: '2026-07-clear-legacy-cache-properties', run: migration_clearLegacyCacheProperties },
    { id: '2026-07-contract-column-swap', run: migration_repairContractColumnSwap },
    { id: '2026-07-upstream-schema-upgrade', run: migration_upgradeLegacySheetSchemas }
  ];
}

function readAppliedMigrations(props) {
  var raw = props.getProperty(MIGRATIONS_PROP_KEY);
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function pendingMigrations(props) {
  var applied = readAppliedMigrations(props);
  return listMigrations().filter(function(migration) {
    return applied.indexOf(migration.id) === -1;
  });
}

/**
 * True once every registered migration has been applied to this spreadsheet
 * (or while the current execution is itself running them). Never throws —
 * a script-properties outage degrades to "settled" so it can't take the app
 * down harder than the migration it guards.
 */
function migrationsSettled_() {
  if (MIGRATION_CONTEXT.active) return true;
  if (__migrationsSettledMemo) return true;
  try {
    var props = PropertiesService.getScriptProperties();
    if (!pendingMigrations(props).length) {
      __migrationsSettledMemo = true;
      return true;
    }
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * Guard for schema-touching entry points (see getOrCreateSheet). doGet
 * normally completes the upgrade before the app is served, so this only fires
 * for stale tabs and mid-upgrade stragglers. Rather than racing the migration
 * with the callers' own lazy schema fix-ups, it runs the pending migrations
 * itself — the script lock serializes with any concurrent attempt — and only
 * throws (with a message the client retries on, see
 * views/partials/scripts.html) when the upgrade genuinely can't finish here.
 */
function assertMigrationsSettled_() {
  if (migrationsSettled_()) return;
  var status = runPendingMigrations();
  if (status === 'idle' || status === 'done') return;
  throw new Error('Tempus is upgrading this spreadsheet. Please retry in a moment.');
}

/**
 * Runs any unapplied migrations. Returns:
 *   'idle' — nothing pending
 *   'done' — migrations ran and completed
 *   'busy' — another execution holds the migration lock; caller should show
 *            the upgrade splash and let the page retry
 *   'error' — a migration threw; it stays unrecorded and retries on the next
 *             load. Callers still serve the app (never block page load) —
 *             the assertMigrationsSettled_ guard keeps data APIs safe.
 */
function runPendingMigrations() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (!pendingMigrations(props).length) {
      __migrationsSettledMemo = true;
      return 'idle';
    }
    var lock = LockService.getScriptLock();
    // Wait out a concurrent load's migration run — migrations take seconds,
    // so hitting this timeout means contention, not normal operation.
    if (!lock.tryLock(45000)) return 'busy';
    try {
      MIGRATION_CONTEXT.active = true;
      pendingMigrations(props).forEach(function(migration) {
        migration.run();
        var applied = readAppliedMigrations(props);
        applied.push(migration.id);
        props.setProperty(MIGRATIONS_PROP_KEY, JSON.stringify(applied));
        Logger.log('Migration applied: ' + migration.id);
      });
    } finally {
      MIGRATION_CONTEXT.active = false;
      lock.releaseLock();
    }
    __migrationsSettledMemo = true;
    return 'done';
  } catch (e) {
    Logger.log('Migration error: ' + (e && e.message ? e.message : e));
    return 'error';
  }
}

// ---- Migrations -------------------------------------------------------------

/**
 * Upstream spreadsheets track assessments in an 'assessment_id' column at the
 * position this codebase uses for 'note', and predate the contract columns
 * added here (color, archived, entry_mode, standard_day_json). The lazy
 * fix-ups in getOrCreateSheet/ensureContractsSchema handle both — this
 * migration simply runs them once, serially, before the first page load's
 * parallel API calls can all attempt the structural edits at the same time.
 * Only sheets that already exist are touched (fresh installs create their
 * sheets lazily with the current schema).
 */
function migration_upgradeLegacySheetSchemas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ['timesheet_entries', 'user_settings', 'contracts', 'feature_flags', 'hour_types'].forEach(function(name) {
    if (ss.getSheetByName(name)) getOrCreateSheet(name);
  });
  var contractsSheet = ss.getSheetByName('contracts');
  if (contractsSheet) ensureContractsSchema(contractsSheet);
}

/**
 * Ported from upstream (same id, so upgraded spreadsheets that already ran it
 * skip it): earlier upstream builds wrote include_weekends and
 * standard_hours_per_day into each other's columns. Detect rows where the
 * standard-hours cell holds a boolean and the weekends cell holds a number,
 * and swap them back.
 */
function migration_repairContractColumnSwap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('contracts');
  if (!sh) return; // fresh install — nothing to repair
  ensureContractsSchema(sh);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0];
  var stdIdx = headers.indexOf('standard_hours_per_day');
  var weekendsIdx = headers.indexOf('include_weekends');
  if (stdIdx === -1 || weekendsIdx === -1) return;
  var repaired = 0;
  for (var i = 1; i < values.length; i++) {
    var stdValue = values[i][stdIdx];
    var weekendsValue = values[i][weekendsIdx];
    var weekendsIsNumeric = !migrationIsBooleanLike_(weekendsValue) &&
      weekendsValue !== '' && weekendsValue !== null && !isNaN(Number(weekendsValue));
    if (!migrationIsBooleanLike_(stdValue) || !weekendsIsNumeric) continue;
    sh.getRange(i + 1, stdIdx + 1).setValue(Number(weekendsValue));
    sh.getRange(i + 1, weekendsIdx + 1).setValue(contractParseBoolean(stdValue) ? 'TRUE' : 'FALSE');
    repaired++;
  }
  if (repaired > 0) {
    cacheClearPrefix(CONTRACT_CACHE_PREFIX);
  }
  Logger.log('migration_repairContractColumnSwap: repaired ' + repaired + ' contract row(s)');
}

function migrationIsBooleanLike_(value) {
  if (value === true || value === false) return true;
  var str = String(value == null ? '' : value).trim().toLowerCase();
  return str === 'true' || str === 'false';
}
