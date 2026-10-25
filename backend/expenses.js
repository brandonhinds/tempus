/**
 * Business-expense ledger and future-only recurring schedules.
 *
 * An expense is either paid (it has a paid date) or unpaid (it doesn't). There are no part payments,
 * reconciliation or void states: Tempus is not the system of record, so a wrong expense is corrected or
 * deleted. Cash basis counts an expense on its paid date; accrual basis on the earlier of its invoice
 * date and paid date. The GST credit follows the expense's GST treatment (only Taxable claims), scaled by
 * its business-use percentage, and lands in the same period as the expense.
 *
 * Statuses: 'recorded' (a real expense, paid or unpaid), 'scheduled' (an upcoming payment from a schedule,
 * never counted, its due date held in supplier_invoice_date) and 'skipped' (a schedule payment that won't
 * happen; kept only so the schedule does not recreate it, never shown or counted).
 */
var EXPENSE_CACHE_PREFIX = 'expenses_v1_';
var EXPENSE_GST_CODES = { taxable: true, gst_free: true, input_taxed: true, out_of_scope: true };
var EXPENSE_STATUSES = { recorded: true, scheduled: true, skipped: true };

function expenseNow_() { return Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'"); }
function expenseToday_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function expenseBoolean_(value) { return value === true || /^(true|1|yes|y)$/i.test(String(value == null ? '' : value).trim()); }

function expenseReadSheet_(name) {
  var sheet = getOrCreateSheet(name);
  var values = sheet.getDataRange().getValues();
  if (!values.length) return { sheet: sheet, headers: [], rows: [] };
  return { sheet: sheet, headers: values[0], rows: values.slice(1).map(function(row, index) {
    var item = rowObjectFromHeaders_(values[0], row);
    // Sheets turns a typed or pasted yyyy-mm-dd (or a value written outside the plain-text range) into a
    // Date. Read it back as the text Tempus stores: google.script.run returns null for any payload holding
    // a Date, which blanks the whole Expenses page, and every period filter compares these as strings.
    Object.keys(item).forEach(function(key) {
      if (Object.prototype.toString.call(item[key]) === '[object Date]') {
        item[key] = /_at$/.test(key) ? toIsoDateTime(item[key]) : toIsoDate(item[key]);
      }
    });
    item.__row = index + 2;
    return item;
  }) };
}

function expenseFind_(name, id) {
  var data = expenseReadSheet_(name);
  for (var index = 0; index < data.rows.length; index++) if (String(data.rows[index].id) === String(id)) return { data: data, item: data.rows[index] };
  return { data: data, item: null };
}

/** The date an expense is listed and filtered by: when it was paid, else its invoice (or due) date. */
function expenseEffectiveDate_(transaction) {
  return String((transaction && (transaction.paid_date || transaction.supplier_invoice_date)) || '');
}

/**
 * The amount including GST, its GST and the amount excluding GST, from a payload that gives either amount.
 * The amount including GST is what was paid, so it is the source of truth: `amount_ex_gst` is only used
 * when `amount` is not given (taxable: ex-GST + 10%). Taxable GST is one-eleventh of the amount unless a
 * GST amount is given (a figure from the invoice); any other treatment has none.
 */
function expenseAmounts_(value, gstCode) {
  var hasAmount = value.amount !== undefined && value.amount !== null && value.amount !== '';
  var hasEx = value.amount_ex_gst !== undefined && value.amount_ex_gst !== null && value.amount_ex_gst !== '';
  var amount = hasAmount ? roundMoney_(value.amount) : (hasEx ? roundMoney_(Number(value.amount_ex_gst) * (gstCode === 'taxable' ? 1.1 : 1)) : 0);
  if (amount < 0) throw new Error('Expense amount cannot be negative.');
  var gst = gstCode === 'taxable' ? roundMoney_(value.gst_amount !== undefined && value.gst_amount !== '' && value.gst_amount !== null ? value.gst_amount : amount / 11) : 0;
  return { amount: amount, gst_amount: gst, amount_ex_gst: roundMoney_(amount - gst) };
}

/**
 * Expenses share the deduction category list (deduction_categories). Rows store the category's id; its
 * name is looked up when listed, so renaming a category renames it everywhere. A payload may give a
 * `category_id` (which must exist; '' for Uncategorised) or, for older callers, a category name, which is
 * matched without regard to case or created if new.
 */
function expenseCategoryIndex_() {
  var byId = {}, byName = {};
  listDeductionCategoriesInternal().forEach(function(category) {
    byId[String(category.id)] = category;
    byName[String(category.name).trim().toLowerCase()] = category;
  });
  return { byId: byId, byName: byName };
}

function expenseCategoryId_(value, existing) {
  if (value.category_id !== undefined && value.category_id !== null) {
    var id = String(value.category_id).trim();
    if (id && !expenseCategoryIndex_().byId[id]) throw new Error('Unknown category. Choose one from the list or add it first.');
    return id;
  }
  var name = String(value.category == null ? '' : value.category).trim();
  if (!name) return existing ? String(existing.category_id || '') : '';
  var index = expenseCategoryIndex_();
  if (index.byId[name]) return name;
  if (index.byName[name.toLowerCase()]) return String(index.byName[name.toLowerCase()].id);
  return String(upsertDeductionCategoryUnlocked_({ name: name }).category.id);
}

/** Adds `category` (the name, '' when uncategorised) and `category_color` to a listed row. */
function expenseResolveCategory_(item, index) {
  var id = String(item.category_id || '').trim();
  // A row from before categories were shared holds the name, or a deduction category's id, as text.
  var legacy = String(item.category || '').trim();
  if (!id && legacy && index.byId[legacy]) id = legacy;
  var category = id ? index.byId[id] : (legacy ? index.byName[legacy.toLowerCase()] : null);
  item.category_id = category ? String(category.id) : '';
  item.category = category ? category.name : (id ? '' : legacy);
  item.category_color = category ? category.color : '';
  return item;
}

/**
 * Removes a schedule's upcoming payments due on or after `fromDate` (and, if given, only after `afterDate`).
 * With `keepEdited`, a payment changed by hand ("Edit this payment") is kept. Returns { removed, kept }.
 */
function removeScheduledExpenseOccurrences_(ruleId, fromDate, options) {
  var opts = options || {};
  var data = expenseReadSheet_('expense_transactions');
  var kept = 0;
  var rows = data.rows.filter(function(item) {
    if ((ruleId && String(item.source_rule_id) !== String(ruleId)) || !item.source_rule_id || String(item.status) !== 'scheduled') return false;
    var due = String(item.supplier_invoice_date);
    if (due < String(fromDate) || (opts.afterDate && due <= String(opts.afterDate))) return false;
    if (opts.keepEdited && expenseBoolean_(item.occurrence_edited)) { kept++; return false; }
    return true;
  }).map(function(item) { return item.__row; });
  return { removed: deleteSheetRowsDescending_(data.sheet, rows), kept: kept };
}

/**
 * How far ahead schedule payments are created (Settings, "Expense creation"): 'on_date' creates each on its
 * due date, 'month' (the default) the whole current month, 'financial_year' through 30 June.
 */
var EXPENSE_CREATION_MODES = { on_date: true, month: true, financial_year: true };

function expenseCreationMode_() {
  var settings = {};
  try { settings = api_getSettings() || {}; } catch (error) { settings = {}; }
  var mode = String(settings.expense_creation || '');
  return EXPENSE_CREATION_MODES[mode] ? mode : 'month';
}

function expenseCreationWindowEnd_(mode, today) {
  if (mode === 'on_date') return today;
  var year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  if (mode === 'financial_year') return (month >= 7 ? year + 1 : year) + '-06-30';
  return year + '-' + today.slice(5, 7) + '-' + ('0' + new Date(Date.UTC(year, month, 0, 12)).getUTCDate()).slice(-2);
}

/** Writes one rule's generated_through (how far its payments have been created). */
function expenseSetGeneratedThrough_(ruleId, through) {
  var found = expenseFind_('expense_rules', ruleId);
  var column = found.data.headers.indexOf('generated_through');
  if (!found.item || column === -1) return;
  found.data.sheet.getRange(found.item.__row, column + 1).setValue(through);
}

/**
 * Brings every schedule's payments in line with the Expense creation setting: creates any due from where
 * it last got to (so payments missed while Tempus wasn't opened appear as Due) through the end of the
 * window, and removes upcoming ones past the window that weren't edited by hand (after switching to a
 * shorter option). Safe to run repeatedly; runs when Tempus and the Expenses page open.
 */
function api_ensureExpenseOccurrences() {
  return withScriptLock_('expense schedule update', function() {
    var today = expenseToday_();
    var mode = expenseCreationMode_();
    var windowEnd = expenseCreationWindowEnd_(mode, today);
    var rules = api_listExpenseRules({});
    var removed = removeScheduledExpenseOccurrences_('', today, { afterDate: windowEnd, keepEdited: true }).removed + removeExpenseOccurrencesAfterEndDates_(rules);
    var created = 0;
    rules.forEach(function(rule) {
      var through = String(rule.generated_through || '');
      var from = through ? addDaysIso(through > windowEnd ? windowEnd : through, 1) : today;
      created += generateExpenseOccurrencesForRules_([rule], from, windowEnd).length;
      if (through !== windowEnd) expenseSetGeneratedThrough_(rule.id, windowEnd);
    });
    if (created || removed) cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, mode: mode, through_date: windowEnd, created_count: created, removed_count: removed };
  });
}

function normalizeExpenseRule_(payload, existing) {
  var value = payload || {};
  var gstCode = String(value.gst_code || (existing && existing.gst_code) || 'taxable');
  if (!EXPENSE_GST_CODES[gstCode]) throw new Error('Unknown GST code.');
  var amounts = expenseAmounts_(value, gstCode);
  var startDate = normalizeIsoDateStrict_(value.start_date || (existing && existing.start_date), 'Start date', false);
  var endDate = normalizeIsoDateStrict_(value.end_date != null ? value.end_date : (existing && existing.end_date), 'End date', true);
  // An end date before the start date is allowed: the schedule ended before its first payment, so it lists none.
  return {
    id: existing ? existing.id : (value.id || Utilities.getUuid()), vendor: String(value.vendor || '').trim(), vendor_abn: String(value.vendor_abn || '').trim(),
    description: String(value.description || '').trim(), category_id: expenseCategoryId_(value, existing), category: '', amount: amounts.amount, gst_code: gstCode,
    gst_amount: amounts.gst_amount, amount_ex_gst: amounts.amount_ex_gst,
    business_use_percentage: normalizePercentageDecimal_(value.business_use_percentage, existing ? Number(existing.business_use_percentage) : 1),
    frequency: String(value.frequency || 'monthly'),
    start_date: startDate, end_date: endDate, active: 'TRUE',
    notes: String(value.notes || ''), created_at: existing ? existing.created_at : expenseNow_(), updated_at: expenseNow_()
  };
}

function api_listExpenseRules(filters) {
  var categories = expenseCategoryIndex_();
  var rules = expenseReadSheet_('expense_rules').rows.map(function(item) {
    delete item.__row;
    expenseResolveCategory_(item, categories);
    if (item.amount_ex_gst === '' || item.amount_ex_gst === undefined || item.amount_ex_gst === null) item.amount_ex_gst = roundMoney_((Number(item.amount) || 0) - (String(item.gst_code) === 'taxable' ? Number(item.gst_amount) || 0 : 0));
    return item;
  });
  // The end date is the only thing that stops a schedule; the old Active flag is ignored (`filters` is
  // accepted for older callers).
  return rules;
}

var EXPENSE_RULE_COPIED_FIELDS = ['vendor', 'vendor_abn', 'description', 'category_id', 'amount', 'gst_code', 'gst_amount', 'amount_ex_gst', 'business_use_percentage'];

function expenseOccurrenceDiffers_(transaction, rule) {
  return EXPENSE_RULE_COPIED_FIELDS.some(function(field) {
    var a = transaction[field], b = rule[field];
    if (typeof b === 'number') return Math.abs((Number(a) || 0) - b) > 0.004;
    return String(a == null ? '' : a) !== String(b == null ? '' : b);
  });
}

/**
 * What saving `rule` does to its unpaid payments. Paid and skipped payments are history and never appear.
 * - removed: unpaid payments after the end date (Due and edited ones too), and upcoming ones whose date is no
 *   longer on the schedule. These go.
 * - updated: upcoming payments that will take the new details.
 * - held: Due payments (date before today) and payments edited by hand whose details differ from the new
 *   ones. They stay as they are unless the save asks for `apply_to_held`.
 * Upcoming payments are those due today or later.
 */
function expenseRuleChangePlan_(rule, today, windowEnd) {
  var plan = { removed: [], updated: [], held: [], rows: [] };
  var through = rule.end_date && rule.end_date < windowEnd ? rule.end_date : windowEnd;
  var dates = {};
  if (today <= through) migrationOccurrencePairs_(rule.start_date, through, rule.frequency).forEach(function(pair) { if (pair.date >= today) { dates[pair.date] = true; dates[pair.drifted] = true; } });
  expenseReadSheet_('expense_transactions').rows.forEach(function(item) {
    if (String(item.source_rule_id) !== String(rule.id) || String(item.status) !== 'scheduled') return;
    var due = String(item.supplier_invoice_date);
    var entry = { id: item.id, date: due, amount: Number(item.amount) || 0, due: due < today, edited: expenseBoolean_(item.occurrence_edited), row: item.__row, item: item };
    plan.rows.push(entry);
    if (rule.end_date && due > rule.end_date) { entry.action = 'remove'; plan.removed.push(entry); return; }
    var differs = expenseOccurrenceDiffers_(item, rule);
    if (entry.due || entry.edited) { entry.action = differs ? 'held' : 'keep'; if (differs) plan.held.push(entry); return; }
    if (!dates[String(item.source_occurrence_key || due)]) { entry.action = 'remove'; plan.removed.push(entry); return; }
    entry.action = differs ? 'update' : 'rebuild';
    if (differs) plan.updated.push(entry);
  });
  return plan;
}

function expensePlanSummary_(entries) {
  return entries.map(function(entry) { return { id: entry.id, date: entry.date, amount: entry.amount, due: entry.due, edited: entry.edited }; });
}

/**
 * Saves a schedule. The end date is what stops one: every unpaid payment after it is removed when the
 * schedule is saved (and whenever Tempus opens), including Due payments and ones edited by hand. Paid and
 * skipped payments are never touched.
 *
 * Changing a saved schedule in a way that alters or removes unpaid payments first comes back as
 * `schedule_changes` with what would change (see expenseRuleChangePlan_). Resend with `confirm_changes: true`
 * to save; add `apply_to_held: true` to give Due and hand-edited payments the new details as well.
 */
function api_upsertExpenseRule(payload) {
  return withScriptLock_('expense rule update', function() {
    var found = payload && payload.id ? expenseFind_('expense_rules', payload.id) : expenseFind_('expense_rules', '');
    var normalized = normalizeExpenseRule_(payload, found.item);
    var today = expenseToday_();
    var windowEnd = expenseCreationWindowEnd_(expenseCreationMode_(), today);
    var plan = expenseRuleChangePlan_(normalized, today, windowEnd);
    var applyHeld = !!(payload && expenseBoolean_(payload.apply_to_held));
    if (found.item && (plan.removed.length || plan.updated.length || plan.held.length) && !(payload && expenseBoolean_(payload.confirm_changes))) {
      return apiRecoverableFailure_('schedule_changes', 'Saving changes unpaid payments.', {
        removed: expensePlanSummary_(plan.removed), updated: expensePlanSummary_(plan.updated), held: expensePlanSummary_(plan.held),
        end_date: normalized.end_date, amount: normalized.amount
      });
    }
    // Creation restarts from today: clearing or moving the end date never back-fills past payments.
    normalized.generated_through = windowEnd;
    var row = rowValuesFromObject_(found.data.headers, normalized, found.item ? found.data.sheet.getRange(found.item.__row, 1, 1, found.data.headers.length).getValues()[0] : null);
    if (found.item) found.data.sheet.getRange(found.item.__row, 1, 1, row.length).setValues([row]);
    else found.data.sheet.appendRow(row);

    var data = expenseReadSheet_('expense_transactions');
    var deletions = [];
    var updatedHeld = 0;
    plan.rows.forEach(function(entry) {
      // Upcoming payments that change are recreated from the saved schedule; unchanged ones stay put.
      if (entry.action === 'remove' || entry.action === 'update') { deletions.push(entry.row); return; }
      if (entry.action !== 'held' || !applyHeld) return;
      // An upcoming payment is recreated from the schedule; a Due one (before today) is updated where it is,
      // because payments before today are never created again.
      if (!entry.due) { deletions.push(entry.row); return; }
      var updated = Object.assign({}, entry.item, { occurrence_edited: 'FALSE', updated_at: expenseNow_() });
      EXPENSE_RULE_COPIED_FIELDS.forEach(function(field) { updated[field] = normalized[field]; });
      var values = rowValuesFromObject_(data.headers, updated, data.sheet.getRange(entry.row, 1, 1, data.headers.length).getValues()[0]);
      data.sheet.getRange(entry.row, 1, 1, values.length).setValues([values]);
      updatedHeld++;
    });
    deleteSheetRowsDescending_(data.sheet, deletions);
    var created = generateExpenseOccurrencesForRules_([normalized], today, windowEnd);
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    var keptHeld = applyHeld ? 0 : plan.held.length;
    return {
      success: true, rule: normalized, removed_count: plan.removed.length, updated_count: plan.updated.length + (applyHeld ? plan.held.length : 0),
      kept_count: keptHeld, kept_edited_count: keptHeld, created_count: created.length, through_date: windowEnd
    };
  });
}

/** Kept for older pages: ends the schedule today, as "Ends today" and Save do. */
function api_archiveExpenseRule(id) {
  var found = expenseFind_('expense_rules', id);
  if (!found.item) return apiRecoverableFailure_('not_found', 'Expense rule not found.');
  var today = expenseToday_();
  var rule = Object.assign({}, found.item);
  delete rule.__row;
  if (!rule.end_date || String(rule.end_date) > today) rule.end_date = today;
  return api_upsertExpenseRule(Object.assign(rule, { confirm_changes: true }));
}

/**
 * Removes every unpaid payment due after its schedule's end date, Due and hand-edited ones included. Schedules
 * whose end date was set before this rule existed, or edited in the sheet, are tidied when Tempus opens.
 */
function removeExpenseOccurrencesAfterEndDates_(rules) {
  var ends = {};
  rules.forEach(function(rule) { if (rule.end_date) ends[String(rule.id)] = String(rule.end_date); });
  var data = expenseReadSheet_('expense_transactions');
  var rows = data.rows.filter(function(item) {
    var end = ends[String(item.source_rule_id)];
    return end && String(item.status) === 'scheduled' && String(item.supplier_invoice_date) > end;
  }).map(function(item) { return item.__row; });
  return rows.length ? deleteSheetRowsDescending_(data.sheet, rows) : 0;
}

/** Kept for older pages: does what opening the Expenses page does (see api_ensureExpenseOccurrences). */
function api_generateExpenseRuleOccurrences() {
  return api_ensureExpenseOccurrences();
}

/** Appends the scheduled payments of each rule due from `from` through `through`, skipping any date already claimed. */
function generateExpenseOccurrencesForRules_(rules, from, through) {
  var transactionData = expenseReadSheet_('expense_transactions');
  var existing = {};
  transactionData.rows.forEach(function(item) { if (item.source_rule_id && item.source_occurrence_key) existing[String(item.source_rule_id) + '|' + String(item.source_occurrence_key)] = true; });
  var created = [];
  rules.forEach(function(rule) {
    if (from > through) return;
    var ruleEnd = rule.end_date && rule.end_date < through ? rule.end_date : through;
    // An occurrence recorded before schedules were anchored to their start date carries its drifted date as
    // its key (28 March for a 31 January start). It is still that occurrence, so it keeps its month claimed.
    migrationOccurrencePairs_(rule.start_date, ruleEnd, rule.frequency).forEach(function(pair) {
      var date = pair.date;
      if (date < from) return;
      var tuple = String(rule.id) + '|' + date;
      if (existing[tuple] || existing[String(rule.id) + '|' + pair.drifted]) return;
      var transaction = normalizeExpenseTransaction_({
        id: 'expense-rule-' + sha256Hex_(tuple).substring(0, 24), vendor: rule.vendor, vendor_abn: rule.vendor_abn, description: rule.description,
        category_id: rule.category_id || '', supplier_invoice_date: date, paid_date: '', amount: rule.amount, gst_code: rule.gst_code, gst_amount: rule.gst_amount,
        business_use_percentage: rule.business_use_percentage, status: 'scheduled', source_rule_id: rule.id, source_occurrence_key: date, notes: rule.notes
      }, null);
      transactionData.sheet.appendRow(rowValuesFromObject_(transactionData.headers, transaction));
      existing[tuple] = true;
      created.push(transaction);
    });
  });
  return created;
}

function normalizeExpenseTransaction_(payload, existing) {
  var value = payload || {};
  var gstCode = String(value.gst_code || (existing && existing.gst_code) || 'taxable');
  if (!EXPENSE_GST_CODES[gstCode]) throw new Error('Unknown GST code.');
  var amounts = expenseAmounts_(value, gstCode);
  var businessUse = normalizePercentageDecimal_(value.business_use_percentage, existing ? Number(existing.business_use_percentage) : 1);
  var paidDate = normalizeIsoDateStrict_(value.paid_date, 'Paid date', true);
  var invoiceDate = normalizeIsoDateStrict_(value.supplier_invoice_date, 'Invoice date', true);
  var status = String(value.status || (existing && existing.status) || 'recorded');
  if (!EXPENSE_STATUSES[status]) throw new Error('Unknown expense status.');
  // A paid date is what makes an upcoming schedule payment a real expense.
  if (status === 'scheduled' && paidDate) status = 'recorded';
  if (status === 'scheduled' && !invoiceDate) throw new Error('A scheduled payment needs a due date.');
  if (status === 'recorded' && !paidDate && !invoiceDate) throw new Error('An unpaid expense needs an invoice date.');
  var paid = status === 'recorded' && !!paidDate;
  return {
    id: existing ? existing.id : (value.id || Utilities.getUuid()), vendor: String(value.vendor || '').trim(), vendor_abn: String(value.vendor_abn || '').trim(),
    description: String(value.description || '').trim(), category_id: expenseCategoryId_(value, existing), category: '',
    paid_date: status === 'recorded' ? paidDate : '', supplier_invoice_date: invoiceDate, amount: amounts.amount, gst_code: gstCode, gst_amount: amounts.gst_amount, amount_ex_gst: amounts.amount_ex_gst,
    business_use_percentage: businessUse,
    payment_method: paid ? normalizePaymentMethod_(value.payment_method) : '', payment_reference: paid ? String(value.payment_reference || '').trim() : '',
    status: status,
    source_rule_id: String(value.source_rule_id || (existing && existing.source_rule_id) || ''), source_occurrence_key: String(value.source_occurrence_key || (existing && existing.source_occurrence_key) || ''),
    occurrence_edited: existing && expenseBoolean_(existing.occurrence_edited) ? 'TRUE' : '',
    attachments_json: existing ? String(existing.attachments_json || '[]') : '[]', notes: String(value.notes || ''), created_at: existing ? existing.created_at : expenseNow_(), updated_at: expenseNow_(),
    // Retired columns, cleared whenever a row is saved so nothing stale is left behind.
    purchase_date: '', reconciliation_state: '', claimable_gst_confirmed: '', gst_override_amount: ''
  };
}

function expenseListItem_(item) {
  var result = {};
  Object.keys(item).forEach(function(key) { if (key !== '__row') result[key] = item[key]; });
  try { result.attachments = JSON.parse(result.attachments_json || '[]'); } catch (error) { result.attachments = []; }
  if (result.amount_ex_gst === '' || result.amount_ex_gst === undefined || result.amount_ex_gst === null) result.amount_ex_gst = roundMoney_((Number(result.amount) || 0) - (String(result.gst_code) === 'taxable' ? Number(result.gst_amount) || 0 : 0));
  return result;
}

/**
 * Every expense row, newest first by paid date (else invoice or due date). Filters: from / to (on that
 * date) and status: 'paid', 'unpaid' or 'scheduled'. Skipped rows are returned so callers can see what a
 * schedule has claimed; the page leaves them out.
 */
function api_listExpenseTransactions(filters) {
  var categories = expenseCategoryIndex_();
  var transactions = expenseReadSheet_('expense_transactions').rows.map(function(item) { return expenseResolveCategory_(expenseListItem_(item), categories); });
  if (filters && filters.from) transactions = transactions.filter(function(item) { return expenseEffectiveDate_(item) >= String(filters.from); });
  if (filters && filters.to) transactions = transactions.filter(function(item) { return expenseEffectiveDate_(item) <= String(filters.to); });
  var wanted = filters && filters.status ? String(filters.status) : '';
  if (wanted) transactions = transactions.filter(function(item) {
    if (wanted === 'paid') return expenseIsPaid_(item);
    if (wanted === 'unpaid') return expenseIsRecorded_(item) && !expenseIsPaid_(item);
    return String(item.status) === wanted;
  });
  return transactions.sort(function(a, b) { return expenseEffectiveDate_(b).localeCompare(expenseEffectiveDate_(a)); });
}

/** "Q1 FY 2026-27" or "September 2026" for a BAS submission. */
function expenseBasPeriodLabel_(submission, range) {
  var fy = Number(submission.financial_year);
  var fyLabel = 'FY ' + fy + '-' + String((fy + 1) % 100).padStart(2, '0');
  if (submission.period_type === 'quarterly') return 'Q' + submission.quarter + ' ' + fyLabel;
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[Number(range.from.slice(5, 7)) - 1] + ' ' + range.from.slice(0, 4);
}

/**
 * Submitted BAS periods whose figures a change would alter: for each one, what `before` contributed
 * (on that submission's basis) differs from what `after` would. Either side may be null (a new or a
 * deleted expense). Expenses stay editable; this only lets the page warn first.
 */
function expenseSubmittedBasPeriodsChanged_(before, after) {
  var labels = [];
  listBasSubmissionsInternal().forEach(function(submission) {
    if (!(submission.submitted || submission.submission_state === 'submitted')) return;
    var range;
    try { range = basPeriodRange_({ financial_year: submission.financial_year, period_type: submission.period_type, quarter: submission.quarter, month: submission.month }); } catch (error) { return; }
    var basis = submission.accounting_basis === 'accrual' ? 'accrual' : 'cash';
    var was = before ? expenseAttributionForPeriod_(basis, range.from, range.to, before) : { purchases: 0, gst: 0 };
    var now = after ? expenseAttributionForPeriod_(basis, range.from, range.to, after) : { purchases: 0, gst: 0 };
    if (roundMoney_(was.purchases) === roundMoney_(now.purchases) && roundMoney_(was.gst) === roundMoney_(now.gst)) return;
    var label = expenseBasPeriodLabel_(submission, range);
    if (labels.indexOf(label) === -1) labels.push(label);
  });
  return labels;
}

/** A recoverable "are you sure" when a change alters a BAS already marked submitted, unless confirmed. */
function expenseSubmittedBasCheck_(payload, before, after) {
  if (payload && expenseBoolean_(payload.confirm_submitted_bas)) return null;
  var periods = expenseSubmittedBasPeriodsChanged_(before, after);
  if (!periods.length) return null;
  var list = periods.length === 1 ? periods[0] : periods.slice(0, -1).join(', ') + ' and ' + periods[periods.length - 1];
  return apiRecoverableFailure_('submitted_bas_period', 'This changes the figures for ' + list + ', which ' + (periods.length === 1 ? 'is' : 'are') + ' marked as submitted. The lodged BAS will no longer match Tempus.', { periods: periods });
}

function expenseWriteTransaction_(found, normalized) {
  var existingRow = found.item ? found.data.sheet.getRange(found.item.__row, 1, 1, found.data.headers.length).getValues()[0] : null;
  var row = rowValuesFromObject_(found.data.headers, normalized, existingRow);
  if (found.item) found.data.sheet.getRange(found.item.__row, 1, 1, row.length).setValues([row]); else found.data.sheet.appendRow(row);
  cacheClearPrefix(EXPENSE_CACHE_PREFIX);
}

/**
 * Saves an expense. Paid when `paid_date` is set, unpaid otherwise (then it needs an invoice date). Any
 * expense can always be edited. When the change alters a BAS marked as submitted, the first call returns
 * `submitted_bas_period`; resend with `confirm_submitted_bas: true` to save anyway.
 */
function api_upsertExpenseTransaction(payload) {
  return withScriptLock_('expense transaction update', function() {
    var found = payload && payload.id ? expenseFind_('expense_transactions', payload.id) : expenseFind_('expense_transactions', '');
    var normalized = normalizeExpenseTransaction_(payload, found.item);
    // An upcoming schedule payment changed by hand keeps its change when the schedule is edited later.
    if (found.item && String(found.item.status) === 'scheduled' && normalized.status === 'scheduled') normalized.occurrence_edited = 'TRUE';
    var warning = expenseSubmittedBasCheck_(payload, found.item, normalized);
    if (warning) return warning;
    expenseWriteTransaction_(found, normalized);
    return { success: true, transaction: normalized };
  });
}

/** Marks an unpaid expense, or an upcoming schedule payment, paid on `paid_date`. */
function api_markExpensePaid(payload) {
  return withScriptLock_('expense payment', function() {
    var found = expenseFind_('expense_transactions', payload && payload.id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense not found.');
    if (String(found.item.status) === 'skipped') return apiRecoverableFailure_('skipped_transaction', 'This payment was skipped.');
    var merged = {};
    Object.keys(found.item).forEach(function(key) { if (key !== '__row') merged[key] = found.item[key]; });
    merged.status = 'recorded';
    merged.paid_date = normalizeIsoDateStrict_(payload.paid_date, 'Paid date', false);
    merged.payment_method = payload.payment_method;
    merged.payment_reference = payload.payment_reference;
    if (payload.notes) merged.notes = String(found.item.notes || '') ? String(found.item.notes) + '\n' + String(payload.notes) : String(payload.notes);
    var normalized = normalizeExpenseTransaction_(merged, found.item);
    var warning = expenseSubmittedBasCheck_(payload, found.item, normalized);
    if (warning) return warning;
    expenseWriteTransaction_(found, normalized);
    return { success: true, transaction: normalized };
  });
}

/** Skips one upcoming schedule payment. The row stays as 'skipped' so the schedule never recreates it. */
function api_skipExpenseOccurrence(payload) {
  return withScriptLock_('expense skip', function() {
    var found = expenseFind_('expense_transactions', payload && payload.id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense not found.');
    if (String(found.item.status) !== 'scheduled') return apiRecoverableFailure_('not_scheduled', 'Only an upcoming schedule payment can be skipped.');
    var statusIndex = found.data.headers.indexOf('status');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, statusIndex + 1).setValue('skipped');
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true };
  });
}

/**
 * Brings back a skipped schedule payment as it was: paid if it has a paid date (it was a paid payment that was
 * deleted), otherwise Due or Upcoming again. Refused for a date after the schedule's end date, which would only
 * be removed again. Warns first (as saving does) when a submitted BAS would change.
 */
function api_restoreExpenseTransaction(payload) {
  return withScriptLock_('expense restore', function() {
    var found = expenseFind_('expense_transactions', payload && payload.id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense not found.');
    if (String(found.item.status) !== 'skipped') return apiRecoverableFailure_('not_skipped', 'Only a skipped payment can be restored.');
    var due = String(found.item.supplier_invoice_date || '');
    var rule = found.item.source_rule_id ? expenseFind_('expense_rules', found.item.source_rule_id).item : null;
    if (rule && rule.end_date && due > String(rule.end_date)) {
      return apiRecoverableFailure_('after_end_date', 'This payment is after the schedule\'s end date (' + rule.end_date + '). Move or clear the end date first.');
    }
    var restored = Object.assign({}, found.item, { status: found.item.paid_date ? 'recorded' : 'scheduled' });
    delete restored.__row;
    var warning = expenseSubmittedBasCheck_(payload, found.item, restored);
    if (warning) return warning;
    var statusIndex = found.data.headers.indexOf('status');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, statusIndex + 1).setValue(restored.status);
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, status: restored.status };
  });
}

/**
 * Deletes an expense. One that came from a schedule is kept as 'skipped' instead, so the schedule does not
 * list it again. Warns first (as saving does) when a submitted BAS would change.
 */
function api_deleteExpenseTransaction(payload) {
  return withScriptLock_('expense removal', function() {
    var found = expenseFind_('expense_transactions', payload && payload.id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense not found.');
    var warning = expenseSubmittedBasCheck_(payload, found.item, null);
    if (warning) return warning;
    if (found.item.source_rule_id) {
      var statusIndex = found.data.headers.indexOf('status');
      var updatedIndex = found.data.headers.indexOf('updated_at');
      found.data.sheet.getRange(found.item.__row, statusIndex + 1).setValue('skipped');
      if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    } else {
      found.data.sheet.deleteRow(found.item.__row);
    }
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true };
  });
}

function api_attachExpenseReceipt(payload) {
  return withScriptLock_('receipt attachment', function() {
    var found = expenseFind_('expense_transactions', payload && payload.expense_transaction_id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense transaction not found.');
    var attachments = [];
    try { attachments = JSON.parse(found.item.attachments_json || '[]'); } catch (error) { attachments = []; }
    var attachment = { id: String(payload.file_id || Utilities.getUuid()), name: String(payload.name || 'Receipt'), url: requireHttpUrl_(payload.url, 'Receipt URL', false), mime_type: String(payload.mime_type || ''), added_at: expenseNow_() };
    if (!attachments.some(function(item) { return item.id === attachment.id || item.url === attachment.url; })) attachments.push(attachment);
    var attachmentIndex = found.data.headers.indexOf('attachments_json');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, attachmentIndex + 1).setValue(JSON.stringify(attachments));
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, attachments: attachments };
  });
}

function api_detachExpenseReceipt(payload) {
  return withScriptLock_('receipt removal', function() {
    var found = expenseFind_('expense_transactions', payload && payload.expense_transaction_id);
    if (!found.item) return apiRecoverableFailure_('not_found', 'Expense transaction not found.');
    var attachments = [];
    try { attachments = JSON.parse(found.item.attachments_json || '[]'); } catch (error) { attachments = []; }
    attachments = attachments.filter(function(item) { return String(item.id) !== String(payload.attachment_id); });
    var attachmentIndex = found.data.headers.indexOf('attachments_json');
    var updatedIndex = found.data.headers.indexOf('updated_at');
    found.data.sheet.getRange(found.item.__row, attachmentIndex + 1).setValue(JSON.stringify(attachments));
    if (updatedIndex !== -1) found.data.sheet.getRange(found.item.__row, updatedIndex + 1).setValue(expenseNow_());
    cacheClearPrefix(EXPENSE_CACHE_PREFIX);
    return { success: true, attachments: attachments };
  });
}

/**
 * Financial-year totals on the given basis (cash unless 'accrual'): what counts, its GST credits, unpaid
 * expenses invoiced in the year (not counted on a cash basis until paid) and the schedule forecast.
 */
function api_getExpenseReport(filters) {
  var financialYear = Number(filters && filters.financial_year);
  if (!isFinite(financialYear)) throw new Error('Financial year is required.');
  var basis = filters && filters.accounting_basis === 'accrual' ? 'accrual' : 'cash';
  // financial_year is the FY START year: 2026 means FY 2026-27, as everywhere else.
  var from = financialYear + '-07-01';
  var to = (financialYear + 1) + '-06-30';
  var all = api_listExpenseTransactions({});
  var counted = 0, gstCredits = 0, unpaid = 0;
  all.forEach(function(transaction) {
    var share = expenseAttributionForPeriod_(basis, from, to, transaction);
    counted += share.purchases;
    gstCredits += share.gst;
    var invoice = String(transaction.supplier_invoice_date || '');
    if (expenseIsRecorded_(transaction) && !expenseIsPaid_(transaction) && invoice >= from && invoice <= to) unpaid += Number(transaction.amount) || 0;
  });
  var scheduled = api_listExpenseRules({}).reduce(function(sum, rule) {
    var start = rule.start_date > from ? rule.start_date : from;
    var end = rule.end_date && rule.end_date < to ? rule.end_date : to;
    return sum + migrationOccurrenceDates_(rule.start_date, end, rule.frequency).filter(function(date) { return date >= start; }).length * (Number(rule.amount) || 0);
  }, 0);
  var transactions = all.filter(function(item) { var date = expenseEffectiveDate_(item); return String(item.status) !== 'skipped' && date >= from && date <= to; });
  return { success: true, financial_year: financialYear, accounting_basis: basis, from: from, to: to, totals: { counted: roundMoney_(counted), gst_credits: roundMoney_(gstCredits), unpaid: roundMoney_(unpaid), scheduled: roundMoney_(scheduled) }, transactions: transactions };
}

function expenseStatusLabel_(transaction) {
  if (String(transaction.status) === 'scheduled') return 'Scheduled';
  return expenseIsPaid_(transaction) ? 'Paid' : 'Unpaid';
}

function api_exportExpenseReportCsv(filters) {
  var report = api_getExpenseReport(filters);
  var rows = [['Paid date', 'Invoice date', 'Vendor', 'ABN', 'Description', 'Category', 'Amount inc GST', 'Amount ex GST', 'GST code', 'GST amount', 'Business use', 'Claimable GST', 'Paid by', 'Reference', 'Status']];
  report.transactions.slice().reverse().forEach(function(item) {
    rows.push([item.paid_date, item.supplier_invoice_date, item.vendor, item.vendor_abn, item.description, item.category, roundMoney_(item.amount), roundMoney_(item.amount_ex_gst), item.gst_code, roundMoney_(item.gst_amount),
      Math.round(normalizePercentageDecimal_(item.business_use_percentage, 1) * 10000) / 100 + '%', expenseClaimableGst_(item), item.payment_method, item.payment_reference, expenseStatusLabel_(item)]);
  });
  return { success: true, filename: 'tempus-expenses-fy' + financialYearLabelSlug_(report.financial_year) + '.csv', csv: rows.map(function(row) { return row.map(csvSafeCell_).join(','); }).join('\r\n') };
}
