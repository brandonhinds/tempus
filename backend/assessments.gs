/** Assessments API */
var ASSESSMENT_SHEET_NAME = 'assessments';
var ASSESSMENT_TYPE_SHEET_NAME = 'assessment_types';
var ASSESSMENT_INVOICE_SHEET_NAME = 'assessment_invoices';
var ASSESSMENT_CACHE_PREFIX = 'assessments_v1_';

var ASSESSMENT_HEADERS = [
  'id',
  'interview_date',
  'contract_id',
  'assessment_type_id',
  'interviewee_name',
  'interviewee_dob',
  'surge_percentage',
  'notes',
  'created_at',
  'updated_at'
];

var ASSESSMENT_TYPE_HEADERS = [
  'id',
  'name',
  'display_order',
  'default_lines_json',
  'is_built_in',
  'created_at',
  'updated_at'
];

var ASSESSMENT_INVOICE_HEADERS = [
  'id',
  'year',
  'month',
  'contract_id',
  'invoice_number',
  'invoice_date',
  'status',
  'locked',
  'generated_doc_id',
  'generated_doc_url',
  'generated_at',
  'pdf_file_id',
  'pdf_file_url',
  'sent_at',
  'template_doc_id',
  'output_folder_id',
  'notes',
  'created_at',
  'updated_at'
];

var ASSESSMENT_TYPE_BUILT_IN_DEFINITIONS = [
  {
    name: 'Standard',
    display_order: 1,
    default_lines_json: JSON.stringify([
      {
        template: '{org} Psychological Assessment Report (Initial){surge_suffix}\nClearance Subject: {name} (DOB: {dob})',
        multiplier: 1.0
      }
    ])
  },
  {
    name: 'Enhanced',
    display_order: 2,
    default_lines_json: JSON.stringify([
      {
        template: '{org} Psychological Assessment Report (Initial){surge_suffix}\nClearance Subject: {name} (DOB: {dob})',
        multiplier: 1.0
      },
      {
        template: '{org} Document Review Fee\nClearance Subject: {name} (DOB: {dob})',
        multiplier: 0.105
      }
    ])
  },
  {
    name: 'Reval',
    display_order: 3,
    default_lines_json: JSON.stringify([
      {
        template: '{org} Psychological Assessment Report (Reval){surge_suffix}\nClearance Subject: {name} (DOB: {dob})',
        multiplier: 1.0
      },
      {
        template: '{org} Document Review Fee\nClearance Subject: {name} (DOB: {dob})',
        multiplier: 0.105
      }
    ])
  },
  {
    name: 'Cancellation (<24 hrs)',
    display_order: 4,
    default_lines_json: JSON.stringify([
      {
        template: 'PAR Short Notice Cancellation Fee - < 1 business day\nClearance Subject: {name} (DOB: {dob})',
        multiplier: 0.75
      }
    ])
  },
  {
    name: 'Cancellation (>24 hrs)',
    display_order: 5,
    default_lines_json: JSON.stringify([
      {
        template: 'PAR Short Notice Cancellation Fee - > 1 business day\nClearance Subject: {name} (DOB: {dob})',
        multiplier: 0.5
      }
    ])
  }
];

function ensureSheetHeaders(sh, expectedHeaders) {
  if (!sh) return;
  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) {
    sh.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return;
  }
  var headers = sh.getRange(1, 1, 1, lastColumn).getValues()[0];
  var hasHeaderContent = headers.some(function(value) { return String(value || '').trim() !== ''; });
  if (!hasHeaderContent) {
    sh.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return;
  }
  var rowCount = sh.getLastRow();
  expectedHeaders.forEach(function(name) {
    var currentHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (currentHeaders.indexOf(name) !== -1) return;
    var insertCol = sh.getLastColumn() + 1;
    sh.insertColumnAfter(sh.getLastColumn());
    sh.getRange(1, insertCol).setValue(name);
    if (rowCount > 1) {
      sh.getRange(2, insertCol, rowCount - 1, 1).setValue('');
    }
  });
}

function ensureAssessmentSchema(sh) {
  ensureSheetHeaders(sh, ASSESSMENT_HEADERS);
}

function ensureAssessmentTypeSchema(sh) {
  ensureSheetHeaders(sh, ASSESSMENT_TYPE_HEADERS);
}

function ensureAssessmentInvoiceSchema(sh) {
  ensureSheetHeaders(sh, ASSESSMENT_INVOICE_HEADERS);
}

function getAssessmentSheet() {
  var sh = getOrCreateSheet(ASSESSMENT_SHEET_NAME);
  ensureAssessmentSchema(sh);
  return sh;
}

function getAssessmentTypeSheet() {
  var sh = getOrCreateSheet(ASSESSMENT_TYPE_SHEET_NAME);
  ensureAssessmentTypeSchema(sh);
  seedBuiltInAssessmentTypes(sh);
  return sh;
}

function getAssessmentInvoiceSheet() {
  var sh = getOrCreateSheet(ASSESSMENT_INVOICE_SHEET_NAME);
  ensureAssessmentInvoiceSchema(sh);
  return sh;
}

function seedBuiltInAssessmentTypes(sh) {
  if (!sh) return;
  if (sh.getLastRow() > 1) return;
  var now = toIsoDateTime(new Date());
  var rows = ASSESSMENT_TYPE_BUILT_IN_DEFINITIONS.map(function(def) {
    return [
      Utilities.getUuid(),
      def.name,
      def.display_order,
      def.default_lines_json,
      'TRUE',
      now,
      now
    ];
  });
  sh.getRange(2, 1, rows.length, ASSESSMENT_TYPE_HEADERS.length).setValues(rows);
}

/* ---------- parsing / normalisation helpers ---------- */

function assessmentParseBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === null || value === undefined || value === '') return false;
  var str = String(value).trim().toLowerCase();
  return str === 'true' || str === '1' || str === 'yes' || str === 'y';
}

function assessmentParseNumber(value, defaultValue) {
  var fallback = defaultValue === undefined ? 0 : defaultValue;
  if (value === null || value === undefined || value === '') return fallback;
  var num = Number(value);
  if (!isFinite(num)) return fallback;
  return num;
}

function assessmentParseNullableNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  var num = Number(value);
  if (!isFinite(num)) return '';
  return num;
}

function parseLinesJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    var parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function normaliseLinesDefinition(lines) {
  var raw = parseLinesJson(lines);
  return raw.map(function(line) {
    return {
      template: line && line.template != null ? String(line.template) : '',
      multiplier: assessmentParseNumber(line && line.multiplier, 0)
    };
  });
}

function normalizeAssessmentTypeObject(type) {
  if (!type) return type;
  var normalised = {
    id: type.id || '',
    name: type.name ? String(type.name).trim() : '',
    display_order: assessmentParseNumber(type.display_order, 0),
    default_lines_json: '',
    is_built_in: assessmentParseBoolean(type.is_built_in),
    created_at: toIsoDateTime(type.created_at),
    updated_at: toIsoDateTime(type.updated_at)
  };
  var lines = normaliseLinesDefinition(type.default_lines_json != null ? type.default_lines_json : type.lines);
  normalised.lines = lines;
  normalised.default_lines_json = JSON.stringify(lines);
  return normalised;
}

function buildAssessmentTypeRow(type, createdAt) {
  var normalised = normalizeAssessmentTypeObject(type || {});
  return [
    normalised.id,
    normalised.name,
    normalised.display_order,
    normalised.default_lines_json,
    normalised.is_built_in ? 'TRUE' : 'FALSE',
    createdAt || normalised.created_at || toIsoDateTime(new Date()),
    toIsoDateTime(new Date())
  ];
}

function normalizeAssessmentObject(assessment) {
  if (!assessment) return assessment;
  var surge = assessmentParseNullableNumber(assessment.surge_percentage != null ? assessment.surge_percentage : assessment.surgePercentage);
  var normalised = {
    id: assessment.id || '',
    interview_date: toIsoDate(assessment.interview_date || assessment.interviewDate),
    contract_id: assessment.contract_id || assessment.contractId || '',
    assessment_type_id: assessment.assessment_type_id || assessment.assessmentTypeId || '',
    interviewee_name: assessment.interviewee_name != null ? String(assessment.interviewee_name).trim() : '',
    interviewee_dob: toIsoDate(assessment.interviewee_dob || assessment.intervieweeDob),
    surge_percentage: surge,
    notes: assessment.notes != null ? String(assessment.notes) : '',
    created_at: toIsoDateTime(assessment.created_at),
    updated_at: toIsoDateTime(assessment.updated_at)
  };
  return normalised;
}

function buildAssessmentRow(assessment, createdAt) {
  var normalised = normalizeAssessmentObject(assessment || {});
  return [
    normalised.id,
    normalised.interview_date,
    normalised.contract_id,
    normalised.assessment_type_id,
    normalised.interviewee_name,
    normalised.interviewee_dob,
    normalised.surge_percentage,
    normalised.notes,
    createdAt || normalised.created_at || toIsoDateTime(new Date()),
    toIsoDateTime(new Date())
  ];
}

/* ---------- price / line resolution ---------- */

function formatSurgeSuffix(surgePercentage) {
  var num = Number(surgePercentage);
  if (!isFinite(num) || num <= 0) return '';
  var pct = num * 100;
  // Render whole-number percentages without trailing decimals, otherwise keep up to two decimal places.
  var rendered = Math.abs(pct - Math.round(pct)) < 1e-9 ? String(Math.round(pct)) : String(Math.round(pct * 100) / 100);
  return ' + ' + rendered + '% Surge';
}

function renderAssessmentLineTemplate(template, context) {
  if (!template) return '';
  var ctx = context || {};
  var orgValue = ctx.org != null ? String(ctx.org) : '';
  var nameValue = ctx.name != null ? String(ctx.name) : '';
  var dobValue = ctx.dob != null ? String(ctx.dob) : '';
  var surgeSuffix = ctx.surge_suffix != null ? String(ctx.surge_suffix) : '';
  return String(template)
    .split('{org}').join(orgValue)
    .split('{name}').join(nameValue)
    .split('{dob}').join(dobValue)
    .split('{surge_suffix}').join(surgeSuffix);
}

function formatAssessmentDob(isoDate) {
  if (!isoDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    var parts = isoDate.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return String(isoDate);
}

function parseContractMultipliersForType(contract, typeId) {
  if (!contract || !typeId) return null;
  var raw = contract.assessment_type_multipliers_json;
  if (!raw) return null;
  var parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch (e) {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  for (var i = 0; i < parsed.length; i++) {
    var entry = parsed[i];
    if (entry && entry.type_id === typeId) {
      if (Array.isArray(entry.multipliers)) {
        return entry.multipliers.map(function(value) { return assessmentParseNumber(value, 0); });
      }
      return null;
    }
  }
  return null;
}

function resolveAssessmentLines(assessment, contract, type) {
  if (!assessment || !contract || !type) {
    return { lines: [], total_amount: 0, total_multiplier: 0, base_rate: 0, surge_percentage: 0 };
  }
  var baseRate = Number(contract.hourly_rate) || 0;
  var surge = Number(assessment.surge_percentage) || 0;
  var surgeMultiplier = 1 + surge;
  var defaultLines = normaliseLinesDefinition(type.default_lines_json != null ? type.default_lines_json : type.lines);
  var overrideMultipliers = parseContractMultipliersForType(contract, type.id);
  var context = {
    org: contract.name || '',
    name: assessment.interviewee_name || '',
    dob: formatAssessmentDob(assessment.interviewee_dob),
    surge_suffix: formatSurgeSuffix(surge)
  };
  var lines = defaultLines.map(function(line, idx) {
    var multiplier = (overrideMultipliers && overrideMultipliers[idx] != null)
      ? overrideMultipliers[idx]
      : (Number(line.multiplier) || 0);
    var amount = Math.round(baseRate * multiplier * surgeMultiplier * 100) / 100;
    return {
      template: line.template,
      description: renderAssessmentLineTemplate(line.template, context),
      multiplier: multiplier,
      amount: amount
    };
  });
  var totalAmount = lines.reduce(function(sum, line) { return sum + line.amount; }, 0);
  totalAmount = Math.round(totalAmount * 100) / 100;
  var totalMultiplier = lines.reduce(function(sum, line) { return sum + (Number(line.multiplier) || 0); }, 0);
  return {
    lines: lines,
    total_amount: totalAmount,
    total_multiplier: totalMultiplier,
    base_rate: baseRate,
    surge_percentage: surge
  };
}

/* ---------- internal readers ---------- */

function rowToObject(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i];
  }
  return obj;
}

function loadAllAssessmentTypes() {
  var sh = getAssessmentTypeSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    rows.push(normalizeAssessmentTypeObject(rowToObject(headers, values[i])));
  }
  rows.sort(function(a, b) {
    if (a.display_order !== b.display_order) return (a.display_order || 0) - (b.display_order || 0);
    return (a.name || '').localeCompare(b.name || '');
  });
  return rows;
}

function loadAllAssessments() {
  var sh = getAssessmentSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    rows.push(normalizeAssessmentObject(rowToObject(headers, values[i])));
  }
  return rows;
}

function loadAllAssessmentInvoices() {
  var sh = getAssessmentInvoiceSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var raw = rowToObject(headers, values[i]);
    rows.push({
      id: raw.id || '',
      year: assessmentParseNumber(raw.year, 0),
      month: assessmentParseNumber(raw.month, 0),
      contract_id: raw.contract_id || '',
      invoice_number: raw.invoice_number || '',
      invoice_date: toIsoDate(raw.invoice_date),
      status: raw.status || 'draft',
      locked: assessmentParseBoolean(raw.locked),
      generated_doc_id: raw.generated_doc_id || '',
      generated_doc_url: raw.generated_doc_url || '',
      generated_at: toIsoDateTime(raw.generated_at),
      pdf_file_id: raw.pdf_file_id || '',
      pdf_file_url: raw.pdf_file_url || '',
      sent_at: toIsoDateTime(raw.sent_at),
      template_doc_id: raw.template_doc_id || '',
      output_folder_id: raw.output_folder_id || '',
      notes: raw.notes || '',
      created_at: toIsoDateTime(raw.created_at),
      updated_at: toIsoDateTime(raw.updated_at)
    });
  }
  return rows;
}

function findLockingInvoiceForAssessment(assessment) {
  if (!assessment || !assessment.interview_date) return null;
  var parts = assessment.interview_date.split('-');
  if (parts.length !== 3) return null;
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var invoices = loadAllAssessmentInvoices();
  for (var i = 0; i < invoices.length; i++) {
    var inv = invoices[i];
    if (!inv.locked) continue;
    if (inv.year !== year || inv.month !== month) continue;
    if (inv.contract_id && inv.contract_id !== assessment.contract_id) continue;
    return inv;
  }
  return null;
}

function getActualMinutesByAssessmentId() {
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return {};
  var headers = values[0];
  var assessmentIdx = headers.indexOf('assessment_id');
  var durationIdx = headers.indexOf('duration_minutes');
  var hourTypeIdx = headers.indexOf('hour_type_id');
  if (assessmentIdx === -1 || durationIdx === -1) return {};
  var workHourTypeId = '';
  try {
    workHourTypeId = resolveDefaultHourTypeId() || '';
  } catch (e) {
    workHourTypeId = '';
  }
  var map = {};
  for (var i = 1; i < values.length; i++) {
    var assessmentId = String(values[i][assessmentIdx] || '').trim();
    if (!assessmentId) continue;
    if (hourTypeIdx !== -1 && workHourTypeId && String(values[i][hourTypeIdx] || '') === workHourTypeId) {
      // Exclude the billable Work entry; we only want non-income hours the user logged manually.
      continue;
    }
    var minutes = Number(values[i][durationIdx]);
    if (!isFinite(minutes)) minutes = 0;
    map[assessmentId] = (map[assessmentId] || 0) + minutes;
  }
  return map;
}

function assessmentHasEntries(assessmentId) {
  if (!assessmentId) return false;
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return false;
  var headers = values[0];
  var idx = headers.indexOf('assessment_id');
  if (idx === -1) return false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idx] || '').trim() === String(assessmentId)) return true;
  }
  return false;
}

function countAssessmentsUsingType(typeId) {
  if (!typeId) return 0;
  var assessments = loadAllAssessments();
  var count = 0;
  for (var i = 0; i < assessments.length; i++) {
    if (assessments[i].assessment_type_id === typeId) count += 1;
  }
  return count;
}

function getAssessmentContractMap() {
  var contracts = api_getContracts();
  var map = {};
  contracts.forEach(function(c) { map[c.id] = c; });
  return map;
}

function getAssessmentTypeMap() {
  var types = loadAllAssessmentTypes();
  var map = {};
  types.forEach(function(t) { map[t.id] = t; });
  return map;
}

function decorateAssessmentForResponse(assessment, contractMap, typeMap, actualMinutesMap) {
  var contract = contractMap[assessment.contract_id] || null;
  var type = typeMap[assessment.assessment_type_id] || null;
  var resolved = resolveAssessmentLines(assessment, contract, type);
  var actualMinutes = actualMinutesMap[assessment.id] || 0;
  return {
    id: assessment.id,
    interview_date: assessment.interview_date,
    contract_id: assessment.contract_id,
    contract_name: contract ? contract.name : '',
    assessment_type_id: assessment.assessment_type_id,
    assessment_type_name: type ? type.name : '',
    interviewee_name: assessment.interviewee_name,
    interviewee_dob: assessment.interviewee_dob,
    surge_percentage: assessment.surge_percentage,
    notes: assessment.notes,
    effective_fee: resolved.total_amount,
    total_multiplier: resolved.total_multiplier,
    base_rate: resolved.base_rate,
    lines: resolved.lines,
    actual_minutes: actualMinutes,
    actual_hours: Math.round((actualMinutes / 60) * 100) / 100,
    created_at: assessment.created_at,
    updated_at: assessment.updated_at
  };
}

/* ---------- type APIs ---------- */

function api_listAssessmentTypes() {
  var cacheKey = ASSESSMENT_CACHE_PREFIX + 'types';
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var types = loadAllAssessmentTypes();
  cacheSet(cacheKey, types);
  return types;
}

function api_upsertAssessmentType(type) {
  if (!type) throw new Error('Assessment type payload is required.');
  var normalised = normalizeAssessmentTypeObject(type);
  if (!normalised.name) throw new Error('Assessment type name is required.');
  if (!normalised.lines.length) throw new Error('At least one line definition is required.');
  for (var i = 0; i < normalised.lines.length; i++) {
    var ln = normalised.lines[i];
    if (!ln.template) throw new Error('Each line needs a description template.');
    if (!isFinite(ln.multiplier) || ln.multiplier <= 0) throw new Error('Each line needs a positive multiplier.');
  }
  var sh = getAssessmentTypeSheet();
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var createdIdx = headers.indexOf('created_at');
  var isBuiltInIdx = headers.indexOf('is_built_in');
  if (normalised.id) {
    for (var r = 1; r < values.length; r++) {
      if (values[r][idIdx] === normalised.id) {
        var rowCreated = createdIdx !== -1 ? values[r][createdIdx] : '';
        // Preserve is_built_in flag — clients cannot toggle it.
        normalised.is_built_in = isBuiltInIdx !== -1 ? assessmentParseBoolean(values[r][isBuiltInIdx]) : normalised.is_built_in;
        normalised.created_at = toIsoDateTime(rowCreated);
        var row = buildAssessmentTypeRow(normalised, normalised.created_at);
        sh.getRange(r + 1, 1, 1, row.length).setValues([row]);
        cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
        return { success: true, type: normalizeAssessmentTypeObject(rowToObject(headers, row)) };
      }
    }
    throw new Error('Assessment type not found.');
  }
  normalised.id = Utilities.getUuid();
  normalised.is_built_in = false;
  normalised.created_at = toIsoDateTime(new Date());
  var newRow = buildAssessmentTypeRow(normalised, normalised.created_at);
  sh.appendRow(newRow);
  cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
  return { success: true, type: normalizeAssessmentTypeObject(rowToObject(headers, newRow)) };
}

function api_deleteAssessmentType(id) {
  if (!id) throw new Error('Assessment type id is required.');
  var sh = getAssessmentTypeSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('Assessment type not found.');
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var builtInIdx = headers.indexOf('is_built_in');
  for (var i = 1; i < values.length; i++) {
    if (values[i][idIdx] === id) {
      if (builtInIdx !== -1 && assessmentParseBoolean(values[i][builtInIdx])) {
        throw new Error('Built-in assessment types cannot be deleted.');
      }
      var usage = countAssessmentsUsingType(id);
      if (usage > 0) {
        throw new Error('Cannot delete: ' + usage + ' assessment(s) reference this type.');
      }
      sh.deleteRow(i + 1);
      cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
      return { success: true };
    }
  }
  throw new Error('Assessment type not found.');
}

/* ---------- assessment APIs ---------- */

function api_getAssessmentsForMonth(year, month) {
  var y = Number(year);
  var m = Number(month);
  if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) {
    throw new Error('Year and month (1-12) are required.');
  }
  var cacheKey = ASSESSMENT_CACHE_PREFIX + 'month_' + y + '_' + m;
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var assessments = loadAllAssessments();
  var monthIso = y + '-' + (m < 10 ? '0' + m : String(m));
  var inMonth = assessments.filter(function(a) {
    return a.interview_date && a.interview_date.indexOf(monthIso + '-') === 0;
  });
  inMonth.sort(function(a, b) {
    if (a.interview_date === b.interview_date) {
      return (a.interviewee_name || '').localeCompare(b.interviewee_name || '');
    }
    return (a.interview_date || '').localeCompare(b.interview_date || '');
  });
  var contractMap = getAssessmentContractMap();
  var typeMap = getAssessmentTypeMap();
  var actualMinutes = getActualMinutesByAssessmentId();
  var decorated = inMonth.map(function(a) {
    return decorateAssessmentForResponse(a, contractMap, typeMap, actualMinutes);
  });
  var totalFee = decorated.reduce(function(sum, a) { return sum + (a.effective_fee || 0); }, 0);
  var totalActualMinutes = decorated.reduce(function(sum, a) { return sum + (a.actual_minutes || 0); }, 0);
  var payload = {
    year: y,
    month: m,
    assessments: decorated,
    summary: {
      count: decorated.length,
      total_fee: Math.round(totalFee * 100) / 100,
      total_actual_minutes: totalActualMinutes,
      total_actual_hours: Math.round((totalActualMinutes / 60) * 100) / 100
    }
  };
  cacheSet(cacheKey, payload);
  return payload;
}

function api_upsertAssessment(assessment) {
  if (!assessment) throw new Error('Assessment payload is required.');
  var normalised = normalizeAssessmentObject(assessment);
  if (!normalised.interview_date) throw new Error('Interview date is required.');
  if (!normalised.contract_id) throw new Error('Contract is required.');
  if (!normalised.assessment_type_id) throw new Error('Assessment type is required.');
  if (!normalised.interviewee_name) throw new Error('Interviewee name is required.');
  var contractMap = getAssessmentContractMap();
  if (!contractMap[normalised.contract_id]) throw new Error('Contract not found.');
  var typeMap = getAssessmentTypeMap();
  if (!typeMap[normalised.assessment_type_id]) throw new Error('Assessment type not found.');
  if (normalised.surge_percentage !== '' && normalised.surge_percentage < 0) {
    throw new Error('Surge percentage cannot be negative.');
  }
  var sh = getAssessmentSheet();
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var createdIdx = headers.indexOf('created_at');
  if (normalised.id) {
    for (var r = 1; r < values.length; r++) {
      if (values[r][idIdx] === normalised.id) {
        var existing = normalizeAssessmentObject(rowToObject(headers, values[r]));
        var sourceLock = findLockingInvoiceForAssessment(existing);
        if (sourceLock) {
          throw new Error('Invoice ' + sourceLock.invoice_number + ' is locked. Unlock the invoice before editing this assessment.');
        }
        var destinationLock = findLockingInvoiceForAssessment(normalised);
        if (destinationLock) {
          throw new Error('Invoice ' + destinationLock.invoice_number + ' is locked. The target month or contract cannot receive new assessments until it is unlocked.');
        }
        normalised.created_at = toIsoDateTime(createdIdx !== -1 ? values[r][createdIdx] : new Date());
        var row = buildAssessmentRow(normalised, normalised.created_at);
        sh.getRange(r + 1, 1, 1, row.length).setValues([row]);
        var billable = syncAssessmentBillableEntry(normalised, contractMap[normalised.contract_id], typeMap[normalised.assessment_type_id]);
        markRelatedInvoicesAsStale(existing);
        markRelatedInvoicesAsStale(normalised);
        cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
        var decorated = decorateAssessmentForResponse(normalizeAssessmentObject(rowToObject(headers, row)), contractMap, typeMap, getActualMinutesByAssessmentId());
        return { success: true, assessment: decorated, billable_entry: billable || null };
      }
    }
    throw new Error('Assessment not found.');
  }
  var newLock = findLockingInvoiceForAssessment(normalised);
  if (newLock) {
    throw new Error('Invoice ' + newLock.invoice_number + ' is locked. Unlock it before adding new assessments to that month or contract.');
  }
  normalised.id = Utilities.getUuid();
  normalised.created_at = toIsoDateTime(new Date());
  var newRow = buildAssessmentRow(normalised, normalised.created_at);
  sh.appendRow(newRow);
  var billableNew = syncAssessmentBillableEntry(normalised, contractMap[normalised.contract_id], typeMap[normalised.assessment_type_id]);
  markRelatedInvoicesAsStale(normalised);
  cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
  var decoratedNew = decorateAssessmentForResponse(normalizeAssessmentObject(rowToObject(headers, newRow)), contractMap, typeMap, getActualMinutesByAssessmentId());
  return { success: true, assessment: decoratedNew, billable_entry: billableNew || null };
}

function api_deleteAssessment(id) {
  if (!id) throw new Error('Assessment id is required.');
  var sh = getAssessmentSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('Assessment not found.');
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (values[i][idIdx] === id) {
      var existing = normalizeAssessmentObject(rowToObject(headers, values[i]));
      var lockBlocker = findLockingInvoiceForAssessment(existing);
      if (lockBlocker) {
        throw new Error('Invoice ' + lockBlocker.invoice_number + ' is locked. Unlock the invoice before deleting this assessment.');
      }
      sh.deleteRow(i + 1);
      var deletedEntryIds = cascadeDeleteEntriesForAssessment(id);
      markRelatedInvoicesAsStale(existing);
      cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
      cacheClearPrefix(ENTRY_CACHE_PREFIX);
      return { success: true, deleted_entry_ids: deletedEntryIds };
    }
  }
  throw new Error('Assessment not found.');
}

function markRelatedInvoicesAsStale(assessment) {
  if (!assessment || !assessment.interview_date) return;
  var parts = assessment.interview_date.split('-');
  if (parts.length !== 3) return;
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var sh = getAssessmentInvoiceSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0];
  var yearIdx = headers.indexOf('year');
  var monthIdx = headers.indexOf('month');
  var contractIdx = headers.indexOf('contract_id');
  var statusIdx = headers.indexOf('status');
  var lockedIdx = headers.indexOf('locked');
  var updatedIdx = headers.indexOf('updated_at');
  if (statusIdx === -1) return;
  var nowIso = toIsoDateTime(new Date());
  for (var i = 1; i < values.length; i++) {
    if (Number(values[i][yearIdx]) !== year || Number(values[i][monthIdx]) !== month) continue;
    var rowContract = String(values[i][contractIdx] || '');
    if (rowContract && rowContract !== String(assessment.contract_id || '')) continue;
    if (lockedIdx !== -1 && assessmentParseBoolean(values[i][lockedIdx])) continue;
    var currentStatus = String(values[i][statusIdx] || 'draft');
    if (currentStatus === 'draft') continue;
    sh.getRange(i + 1, statusIdx + 1).setValue('draft');
    if (updatedIdx !== -1) {
      sh.getRange(i + 1, updatedIdx + 1).setValue(nowIso);
    }
  }
}

function cascadeDeleteEntriesForAssessment(assessmentId) {
  if (!assessmentId) return [];
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var assessmentIdx = headers.indexOf('assessment_id');
  var idIdx = headers.indexOf('id');
  if (assessmentIdx === -1) return [];
  var deletedIds = [];
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][assessmentIdx] || '').trim() === String(assessmentId)) {
      if (idIdx !== -1) deletedIds.push(String(values[i][idIdx] || ''));
      sh.deleteRow(i + 1);
    }
  }
  return deletedIds;
}

/* ---------- hour type bootstrap ---------- */

function getOrCreateAssessmentWorkHourTypeId() {
  var sh = getOrCreateSheet('hour_types');
  var values = sh.getDataRange().getValues();
  if (values.length >= 2) {
    var headers = values[0];
    var idIdx = headers.indexOf('id');
    var slugIdx = headers.indexOf('slug');
    if (idIdx !== -1 && slugIdx !== -1) {
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][slugIdx] || '') === 'assessment_work') {
          return String(values[i][idIdx] || '');
        }
      }
    }
  }
  var created = api_createHourType({
    name: 'Assessment work',
    slug: 'assessment_work',
    color: '#8b5cf6',
    contributes_to_income: false,
    requires_contract: false,
    is_default: false,
    use_for_rate_calculation: false
  });
  return created ? created.id : '';
}

function api_getAssessmentWorkHourTypeId() {
  return getOrCreateAssessmentWorkHourTypeId();
}

/* ---------- billable entry sync (Stage 6) ---------- */

function minutesToHHMM(minutes) {
  var total = Math.max(0, Math.round(Number(minutes) || 0));
  // Cap display at 99:59 — assessment-derived durations are tiny in practice.
  if (total >= 100 * 60) total = (100 * 60) - 1;
  var hh = Math.floor(total / 60);
  var mm = total % 60;
  return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
}

function syncAssessmentBillableEntry(assessment, contract, type) {
  if (!assessment || !contract || !type) return null;
  var resolved = resolveAssessmentLines(assessment, contract, type);
  var totalMultiplier = Number(resolved.total_multiplier) || 0;
  if (totalMultiplier <= 0) return null;
  var surge = Number(assessment.surge_percentage) || 0;
  var rawMinutes = 60 * totalMultiplier * (1 + surge);
  var roundInterval = resolveRoundInterval();
  var durationMinutes = applyRoundInterval(rawMinutes, roundInterval);
  if (durationMinutes <= 0) durationMinutes = Math.max(1, Math.round(rawMinutes));
  var workHourTypeId = resolveDefaultHourTypeId();
  if (!workHourTypeId) return null;

  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (!values.length) return null;
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var assessmentIdx = headers.indexOf('assessment_id');
  var hourTypeIdx = headers.indexOf('hour_type_id');
  var createdIdx = headers.indexOf('created_at');

  var existingRowIndex = -1;
  var existingId = '';
  var existingCreated = '';
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][assessmentIdx] || '') === String(assessment.id) &&
        String(values[i][hourTypeIdx] || '') === String(workHourTypeId)) {
      existingRowIndex = i;
      existingId = values[i][idIdx];
      existingCreated = createdIdx !== -1 ? values[i][createdIdx] : '';
      break;
    }
  }

  var nowIso = toIsoDateTime(new Date());
  var punches = [{ 'in': '00:00', out: minutesToHHMM(durationMinutes) }];
  var payload = {
    id: existingId || Utilities.getUuid(),
    date: assessment.interview_date,
    contract_id: assessment.contract_id,
    duration_minutes: durationMinutes,
    hour_type_id: workHourTypeId,
    assessment_id: assessment.id,
    entry_type: 'basic',
    punches: punches,
    punches_json: JSON.stringify(punches),
    created_at: toIsoDateTime(existingCreated) || nowIso,
    recurrence_id: ''
  };
  var row = buildEntryRow(payload, payload.created_at);
  if (existingRowIndex >= 0) {
    sh.getRange(existingRowIndex + 1, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  cacheClearPrefix(ENTRY_CACHE_PREFIX);
  return payload;
}

/* ---------- actual-hours time entries (Stage 5) ---------- */

function findAssessmentById(assessmentId) {
  if (!assessmentId) return null;
  var sh = getAssessmentSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return null;
  var headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '') === String(assessmentId)) {
      return normalizeAssessmentObject(rowToObject(headers, values[i]));
    }
  }
  return null;
}

function api_listAssessmentTimeEntries(assessmentId) {
  if (!assessmentId) return [];
  var workHourTypeId = resolveDefaultHourTypeId();
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var dateIdx = headers.indexOf('date');
  var durationIdx = headers.indexOf('duration_minutes');
  var contractIdx = headers.indexOf('contract_id');
  var assessmentIdx = headers.indexOf('assessment_id');
  var hourTypeIdx = headers.indexOf('hour_type_id');
  var entries = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][assessmentIdx] || '') !== String(assessmentId)) continue;
    if (workHourTypeId && String(values[i][hourTypeIdx] || '') === String(workHourTypeId)) continue;
    entries.push({
      id: values[i][idIdx] || '',
      date: toIsoDate(values[i][dateIdx]),
      duration_minutes: Number(values[i][durationIdx]) || 0,
      hour_type_id: hourTypeIdx !== -1 ? String(values[i][hourTypeIdx] || '') : '',
      contract_id: contractIdx !== -1 ? String(values[i][contractIdx] || '') : '',
      assessment_id: String(assessmentId)
    });
  }
  entries.sort(function(a, b) {
    if (a.date === b.date) return 0;
    return (a.date || '').localeCompare(b.date || '');
  });
  return entries;
}

function resolveAssessmentActualHourTypeId(requestedId) {
  if (requestedId) {
    var sh = getOrCreateSheet('hour_types');
    var values = sh.getDataRange().getValues();
    if (values.length >= 2) {
      var headers = values[0];
      var idIdx = headers.indexOf('id');
      for (var i = 1; i < values.length; i++) {
        if (idIdx !== -1 && String(values[i][idIdx] || '') === String(requestedId)) {
          return String(requestedId);
        }
      }
    }
  }
  // Fall back to the configured default in user settings.
  try {
    var settings = (typeof api_getSettings === 'function') ? (api_getSettings() || {}) : {};
    if (settings && settings.assessment_default_actual_hour_type_id) {
      return String(settings.assessment_default_actual_hour_type_id);
    }
  } catch (e) {}
  // Final fallback: the auto-created "Assessment work" hour type.
  return getOrCreateAssessmentWorkHourTypeId();
}

function api_upsertAssessmentTimeEntry(payload) {
  if (!payload) throw new Error('Time entry payload is required.');
  var assessmentId = payload.assessment_id || payload.assessmentId || '';
  if (!assessmentId) throw new Error('assessment_id is required.');
  var assessment = findAssessmentById(assessmentId);
  if (!assessment) throw new Error('Assessment not found.');
  var lockBlocker = findLockingInvoiceForAssessment(assessment);
  if (lockBlocker) {
    throw new Error('Invoice ' + lockBlocker.invoice_number + ' is locked. Unlock it before logging hours against this assessment.');
  }
  var dateIso = toIsoDate(payload.date);
  if (!dateIso) throw new Error('Date is required.');
  var rawMinutes = Number(payload.duration_minutes != null ? payload.duration_minutes : payload.durationMinutes);
  if (!isFinite(rawMinutes) || rawMinutes <= 0) throw new Error('Duration must be greater than zero.');
  var roundInterval = resolveRoundInterval();
  var durationMinutes = applyRoundInterval(rawMinutes, roundInterval);
  if (durationMinutes <= 0) durationMinutes = Math.max(1, Math.round(rawMinutes));
  var requestedHourTypeId = payload.hour_type_id || payload.hourTypeId || '';
  var hourTypeId = resolveAssessmentActualHourTypeId(requestedHourTypeId);
  if (!hourTypeId) throw new Error('Unable to resolve an hour type for the entry.');
  // Refuse if the chosen hour type is income-bearing — the assessment's billable entry already covers income.
  if (typeof api_getHourTypes === 'function') {
    try {
      var hourTypes = api_getHourTypes();
      var match = (Array.isArray(hourTypes) ? hourTypes : []).find(function(t) { return String(t.id) === String(hourTypeId); });
      if (match && match.contributes_to_income === true) {
        throw new Error('Choose a non-income hour type for assessment time tracking.');
      }
    } catch (e) {
      if (e && e.message && e.message.indexOf('non-income') !== -1) throw e;
      // Otherwise ignore lookup failures and continue.
    }
  }
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (!values.length) throw new Error('Entries sheet is not initialised.');
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var createdIdx = headers.indexOf('created_at');
  var existingId = payload.id || '';
  var nowIso = toIsoDateTime(new Date());
  var punches = [{ 'in': '00:00', out: minutesToHHMM(durationMinutes) }];
  var entry = {
    id: existingId || Utilities.getUuid(),
    date: dateIso,
    contract_id: assessment.contract_id,
    duration_minutes: durationMinutes,
    hour_type_id: hourTypeId,
    assessment_id: assessmentId,
    entry_type: 'basic',
    punches: punches,
    punches_json: JSON.stringify(punches),
    created_at: nowIso,
    recurrence_id: ''
  };
  if (existingId) {
    for (var i = 1; i < values.length; i++) {
      if (values[i][idIdx] === existingId) {
        if (String(values[i][headers.indexOf('assessment_id')] || '') !== String(assessmentId)) {
          throw new Error('That entry does not belong to this assessment.');
        }
        entry.created_at = toIsoDateTime(createdIdx !== -1 ? values[i][createdIdx] : new Date());
        var updatedRow = buildEntryRow(entry, entry.created_at);
        sh.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
        cacheClearPrefix(ENTRY_CACHE_PREFIX);
        cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
        return { success: true, entry: entry };
      }
    }
    throw new Error('Time entry not found.');
  }
  var newRow = buildEntryRow(entry, entry.created_at);
  sh.appendRow(newRow);
  cacheClearPrefix(ENTRY_CACHE_PREFIX);
  cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
  return { success: true, entry: entry };
}

function api_deleteAssessmentTimeEntry(entryId) {
  if (!entryId) throw new Error('Entry id is required.');
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('Entry not found.');
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var assessmentIdx = headers.indexOf('assessment_id');
  for (var i = 1; i < values.length; i++) {
    if (values[i][idIdx] === entryId) {
      var assessmentId = String(values[i][assessmentIdx] || '').trim();
      if (!assessmentId) {
        throw new Error('That entry is not associated with an assessment.');
      }
      var assessment = findAssessmentById(assessmentId);
      if (assessment) {
        var lockBlocker = findLockingInvoiceForAssessment(assessment);
        if (lockBlocker) {
          throw new Error('Invoice ' + lockBlocker.invoice_number + ' is locked. Unlock it before deleting this entry.');
        }
      }
      sh.deleteRow(i + 1);
      cacheClearPrefix(ENTRY_CACHE_PREFIX);
      cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
      return { success: true };
    }
  }
  throw new Error('Entry not found.');
}

/* ---------- monthly invoice generation (Stage 7) ---------- */

var ASSESSMENT_INVOICE_GST_RATE = 0.1;

function decorateAssessmentInvoice(invoice, contractMap) {
  if (!invoice) return invoice;
  var clone = {};
  for (var k in invoice) { if (invoice.hasOwnProperty(k)) clone[k] = invoice[k]; }
  clone.contract_name = invoice.contract_id && contractMap[invoice.contract_id]
    ? contractMap[invoice.contract_id].name
    : '';
  return clone;
}

function api_listAssessmentInvoicesForMonth(year, month) {
  var y = Number(year);
  var m = Number(month);
  if (!isFinite(y) || !isFinite(m)) return [];
  var contractMap = getAssessmentContractMap();
  return loadAllAssessmentInvoices()
    .filter(function(inv) { return inv.year === y && inv.month === m; })
    .map(function(inv) { return decorateAssessmentInvoice(inv, contractMap); })
    .sort(function(a, b) { return (a.invoice_number || '').localeCompare(b.invoice_number || ''); });
}

function generateNextInvoiceNumberForMonth(year, month, existingInvoices) {
  var pad = function(n, width) { var s = String(n); while (s.length < width) s = '0' + s; return s; };
  var prefix = pad(Number(year) % 100, 2) + pad(Number(month), 2);
  var maxSeq = 0;
  (existingInvoices || []).forEach(function(inv) {
    if (Number(inv.year) !== Number(year) || Number(inv.month) !== Number(month)) return;
    var num = String(inv.invoice_number || '');
    if (num.indexOf(prefix) === 0) {
      var tail = num.substring(prefix.length);
      var seq = parseInt(tail, 10);
      if (isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  });
  return prefix + pad(maxSeq + 1, 3);
}

function formatAssessmentCurrencyAud(amount) {
  var num = Number(amount) || 0;
  return '$' + num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatAssessmentInvoiceDateAu(date) {
  var d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'dd/MM/yyyy');
}

function buildAssessmentInvoiceLines(assessmentsInScope, contractMap, typeMap) {
  var lines = [];
  assessmentsInScope.forEach(function(assessment) {
    var contract = contractMap[assessment.contract_id];
    var type = typeMap[assessment.assessment_type_id];
    if (!contract || !type) return;
    var resolved = resolveAssessmentLines(assessment, contract, type);
    var lineDate = formatAssessmentInvoiceDateAu(assessment.interview_date);
    resolved.lines.forEach(function(line, idx) {
      lines.push({
        lineDate: idx === 0 ? lineDate : '',
        description: line.description,
        amount: line.amount,
        contractName: contract.name || '',
        assessmentId: assessment.id || ''
      });
    });
  });
  return lines;
}

function loadAssessmentSettings() {
  var settings = {};
  try {
    if (typeof api_getSettings === 'function') settings = api_getSettings() || {};
  } catch (e) {
    settings = {};
  }
  return {
    grouping: (settings.assessment_invoice_grouping === 'per_org') ? 'per_org' : 'combined',
    templateReference: settings.assessment_invoice_template_reference || '',
    outputFolderReference: settings.assessment_invoice_output_folder_reference || '',
    lineLimit: Math.max(1, Number(settings.assessment_invoice_line_limit) || 18)
  };
}

function resolveAssessmentTemplate(reference) {
  if (!reference) throw new Error('Set the assessment invoice template in Settings before generating invoices.');
  return resolveInvoiceTemplate(looksLikeDriveId(reference) ? reference : '', reference);
}

function resolveAssessmentOutputFolder(reference) {
  if (!reference) throw new Error('Set the assessment invoice output folder in Settings before generating invoices.');
  return resolveInvoiceOutputFolder(looksLikeDriveId(reference) ? reference : '', reference);
}

function api_generateAssessmentInvoices(year, month) {
  var y = Number(year);
  var m = Number(month);
  if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) {
    throw new Error('Year and month (1-12) are required.');
  }
  if (typeof getFeatureFlag === 'function') {
    // Server-side feature flag isn't strictly required, but keeps the API self-protecting if called directly.
  }
  var monthIso = y + '-' + (m < 10 ? '0' + m : String(m));
  var allAssessments = loadAllAssessments().filter(function(a) {
    return a.interview_date && a.interview_date.indexOf(monthIso + '-') === 0;
  });
  if (!allAssessments.length) {
    throw new Error('No assessments recorded for that month.');
  }
  var contractMap = getAssessmentContractMap();
  var typeMap = getAssessmentTypeMap();
  var settingsBundle = loadAssessmentSettings();
  var templateResolution = resolveAssessmentTemplate(settingsBundle.templateReference);
  var folderResolution = resolveAssessmentOutputFolder(settingsBundle.outputFolderReference);

  var groups = [];
  if (settingsBundle.grouping === 'per_org') {
    var perOrg = {};
    allAssessments.forEach(function(a) {
      var key = a.contract_id || '';
      if (!perOrg[key]) perOrg[key] = { contract_id: key, assessments: [] };
      perOrg[key].assessments.push(a);
    });
    Object.keys(perOrg).forEach(function(key) { groups.push(perOrg[key]); });
  } else {
    groups.push({ contract_id: '', assessments: allAssessments });
  }

  var existingInvoices = loadAllAssessmentInvoices();
  var generatedInvoices = [];
  groups.forEach(function(group) {
    var generated = generateOrRegenerateAssessmentInvoice({
      year: y,
      month: m,
      contractId: group.contract_id,
      assessments: group.assessments,
      contractMap: contractMap,
      typeMap: typeMap,
      settingsBundle: settingsBundle,
      templateResolution: templateResolution,
      folderResolution: folderResolution,
      existingInvoices: existingInvoices
    });
    if (generated) generatedInvoices.push(generated);
  });
  cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
  return {
    success: true,
    invoices: generatedInvoices.map(function(inv) { return decorateAssessmentInvoice(inv, contractMap); })
  };
}

function generateOrRegenerateAssessmentInvoice(args) {
  var sh = getAssessmentInvoiceSheet();
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  var yearIdx = headers.indexOf('year');
  var monthIdx = headers.indexOf('month');
  var contractIdx = headers.indexOf('contract_id');
  var invoiceNumberIdx = headers.indexOf('invoice_number');
  var invoiceDateIdx = headers.indexOf('invoice_date');
  var statusIdx = headers.indexOf('status');
  var lockedIdx = headers.indexOf('locked');
  var docIdIdx = headers.indexOf('generated_doc_id');
  var docUrlIdx = headers.indexOf('generated_doc_url');
  var generatedAtIdx = headers.indexOf('generated_at');
  var templateDocIdIdx = headers.indexOf('template_doc_id');
  var outputFolderIdIdx = headers.indexOf('output_folder_id');
  var createdAtIdx = headers.indexOf('created_at');
  var updatedAtIdx = headers.indexOf('updated_at');

  var existingRowIdx = -1;
  var existingRow = null;
  for (var i = 1; i < values.length; i++) {
    if (Number(values[i][yearIdx]) !== args.year || Number(values[i][monthIdx]) !== args.month) continue;
    var rowContractId = String(values[i][contractIdx] || '');
    if (rowContractId !== String(args.contractId || '')) continue;
    existingRowIdx = i;
    existingRow = values[i];
    break;
  }

  if (existingRow && lockedIdx !== -1 && assessmentParseBoolean(existingRow[lockedIdx])) {
    throw new Error('Invoice ' + existingRow[invoiceNumberIdx] + ' is locked and cannot be regenerated. Unlock it first.');
  }

  var lines = buildAssessmentInvoiceLines(args.assessments, args.contractMap, args.typeMap);
  if (lines.length > args.settingsBundle.lineLimit) {
    throw new Error('Generated ' + lines.length + ' lines but the template limit is ' + args.settingsBundle.lineLimit + '. Increase the limit in Settings or split the month.');
  }
  var subtotal = lines.reduce(function(sum, line) { return sum + (Number(line.amount) || 0); }, 0);
  subtotal = Math.round(subtotal * 100) / 100;
  var gst = Math.round(subtotal * ASSESSMENT_INVOICE_GST_RATE * 100) / 100;
  var total = Math.round((subtotal + gst) * 100) / 100;

  var invoiceNumber = existingRow ? existingRow[invoiceNumberIdx] : '';
  if (!invoiceNumber) {
    invoiceNumber = generateNextInvoiceNumberForMonth(args.year, args.month, args.existingInvoices);
    args.existingInvoices.push({ year: args.year, month: args.month, invoice_number: invoiceNumber });
  }
  var nowIso = toIsoDateTime(new Date());
  var todayIso = toIsoDate(new Date());

  var fileName = 'Invoice ' + invoiceNumber + ' - ' + (function() {
    var mm = ('0' + args.month).slice(-2);
    var yy = String(args.year).slice(-2);
    return mm + '-' + yy;
  })();

  // Remove any prior copy with the same name so regeneration replaces in place.
  var existingDocId = existingRow ? existingRow[docIdIdx] : '';
  if (existingDocId) {
    try {
      var prior = DriveApp.getFileById(existingDocId);
      if (prior) prior.setTrashed(true);
    } catch (e) {}
  } else {
    try {
      var dupes = args.folderResolution.folder.getFilesByName(fileName);
      while (dupes.hasNext()) {
        dupes.next().setTrashed(true);
      }
    } catch (e) {}
  }

  var newFile = args.templateResolution.file.makeCopy(fileName, args.folderResolution.folder);
  var doc = DocumentApp.openById(newFile.getId());

  replacePlaceholderAcrossDoc(doc, 'invoiceNumber', invoiceNumber);
  replacePlaceholderAcrossDoc(doc, 'date', formatAssessmentInvoiceDateAu(new Date()));
  for (var li = 0; li < args.settingsBundle.lineLimit; li++) {
    var line = lines[li] || null;
    replacePlaceholderAcrossDoc(doc, 'date' + (li + 1), line ? line.lineDate : '');
    replacePlaceholderAcrossDoc(doc, 'serviceDescription' + (li + 1), line ? line.description : '');
    replacePlaceholderAcrossDoc(doc, 'amount' + (li + 1), line ? formatAssessmentCurrencyAud(line.amount) : '');
  }
  replacePlaceholderAcrossDoc(doc, 'subtotal', formatAssessmentCurrencyAud(subtotal));
  replacePlaceholderAcrossDoc(doc, 'gst', formatAssessmentCurrencyAud(gst));
  replacePlaceholderAcrossDoc(doc, 'total', formatAssessmentCurrencyAud(total));
  doc.saveAndClose();

  var docId = newFile.getId();
  var docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';

  if (existingRowIdx === -1) {
    // Insert a new invoice row.
    var newRow = headers.map(function(name) {
      switch (name) {
        case 'id': return Utilities.getUuid();
        case 'year': return args.year;
        case 'month': return args.month;
        case 'contract_id': return args.contractId || '';
        case 'invoice_number': return invoiceNumber;
        case 'invoice_date': return todayIso;
        case 'status': return 'generated';
        case 'locked': return 'FALSE';
        case 'generated_doc_id': return docId;
        case 'generated_doc_url': return docUrl;
        case 'generated_at': return nowIso;
        case 'template_doc_id': return args.templateResolution.id || '';
        case 'output_folder_id': return args.folderResolution.id || '';
        case 'created_at': return nowIso;
        case 'updated_at': return nowIso;
        default: return '';
      }
    });
    sh.appendRow(newRow);
    return rowToInvoiceObject(headers, newRow);
  }
  // Update existing row.
  if (invoiceNumberIdx !== -1) sh.getRange(existingRowIdx + 1, invoiceNumberIdx + 1).setValue(invoiceNumber);
  if (invoiceDateIdx !== -1) sh.getRange(existingRowIdx + 1, invoiceDateIdx + 1).setValue(todayIso);
  if (statusIdx !== -1) sh.getRange(existingRowIdx + 1, statusIdx + 1).setValue('generated');
  if (docIdIdx !== -1) sh.getRange(existingRowIdx + 1, docIdIdx + 1).setValue(docId);
  if (docUrlIdx !== -1) sh.getRange(existingRowIdx + 1, docUrlIdx + 1).setValue(docUrl);
  if (generatedAtIdx !== -1) sh.getRange(existingRowIdx + 1, generatedAtIdx + 1).setValue(nowIso);
  if (templateDocIdIdx !== -1) sh.getRange(existingRowIdx + 1, templateDocIdIdx + 1).setValue(args.templateResolution.id || '');
  if (outputFolderIdIdx !== -1) sh.getRange(existingRowIdx + 1, outputFolderIdIdx + 1).setValue(args.folderResolution.id || '');
  if (updatedAtIdx !== -1) sh.getRange(existingRowIdx + 1, updatedAtIdx + 1).setValue(nowIso);
  // Re-read the row for the response.
  var freshRow = sh.getRange(existingRowIdx + 1, 1, 1, headers.length).getValues()[0];
  return rowToInvoiceObject(headers, freshRow);
}

function rowToInvoiceObject(headers, row) {
  var raw = rowToObject(headers, row);
  return {
    id: raw.id || '',
    year: assessmentParseNumber(raw.year, 0),
    month: assessmentParseNumber(raw.month, 0),
    contract_id: raw.contract_id || '',
    invoice_number: raw.invoice_number || '',
    invoice_date: toIsoDate(raw.invoice_date),
    status: raw.status || 'draft',
    locked: assessmentParseBoolean(raw.locked),
    generated_doc_id: raw.generated_doc_id || '',
    generated_doc_url: raw.generated_doc_url || '',
    generated_at: toIsoDateTime(raw.generated_at),
    pdf_file_id: raw.pdf_file_id || '',
    pdf_file_url: raw.pdf_file_url || '',
    sent_at: toIsoDateTime(raw.sent_at),
    template_doc_id: raw.template_doc_id || '',
    output_folder_id: raw.output_folder_id || '',
    notes: raw.notes || '',
    created_at: toIsoDateTime(raw.created_at),
    updated_at: toIsoDateTime(raw.updated_at)
  };
}

/* ---------- send invoice (Stage 8) ---------- */

function loadAssessmentInvoiceById(invoiceId) {
  if (!invoiceId) return null;
  var sh = getAssessmentInvoiceSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return null;
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIdx] || '') === String(invoiceId)) {
      return { rowIndex: i, headers: headers, row: values[i], object: rowToInvoiceObject(headers, values[i]) };
    }
  }
  return null;
}

function loadContractRowById(contractId) {
  if (!contractId) return null;
  var sh = getContractsSheet();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return null;
  var headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '') === String(contractId)) {
      return normalizeContractObject(rowToObject(headers, values[i]));
    }
  }
  return null;
}

function buildInvoiceMonthYear(year, month) {
  var mm = ('0' + Number(month)).slice(-2);
  var yy = String(Number(year)).slice(-2);
  return mm + '-' + yy;
}

function substituteInvoiceEmailPlaceholders(template, context) {
  if (!template) return '';
  return String(template)
    .split('{invoiceNumber}').join(context.invoiceNumber || '')
    .split('{monthYear}').join(context.monthYear || '')
    .split('{org}').join(context.org || '')
    .split('{total}').join(context.total || '');
}

function computeInvoiceTotalsForInvoice(invoiceObj, contractMap, typeMap) {
  var monthIso = invoiceObj.year + '-' + (invoiceObj.month < 10 ? '0' + invoiceObj.month : String(invoiceObj.month));
  var assessments = loadAllAssessments().filter(function(a) {
    if (!a.interview_date || a.interview_date.indexOf(monthIso + '-') !== 0) return false;
    if (invoiceObj.contract_id && a.contract_id !== invoiceObj.contract_id) return false;
    return true;
  });
  var lines = buildAssessmentInvoiceLines(assessments, contractMap, typeMap);
  var subtotal = lines.reduce(function(sum, line) { return sum + (Number(line.amount) || 0); }, 0);
  subtotal = Math.round(subtotal * 100) / 100;
  var gst = Math.round(subtotal * ASSESSMENT_INVOICE_GST_RATE * 100) / 100;
  var total = Math.round((subtotal + gst) * 100) / 100;
  return { subtotal: subtotal, gst: gst, total: total };
}

function resolveSendRecipients(invoiceObj, contract, settings) {
  var to = '';
  var cc = '';
  var bcc = '';
  var subjectTpl = '';
  var bodyTpl = '';
  if (contract && invoiceObj.contract_id) {
    to = contract.invoice_email_to || '';
    cc = contract.invoice_email_cc || '';
    bcc = contract.invoice_email_bcc || '';
    subjectTpl = contract.invoice_email_subject_template || '';
    bodyTpl = contract.invoice_email_body_template || '';
  }
  if (!to) to = settings.assessment_invoice_default_email_to || '';
  if (!cc) cc = settings.assessment_invoice_default_email_cc || '';
  if (!bcc) bcc = settings.assessment_invoice_default_email_bcc || '';
  if (!subjectTpl) subjectTpl = settings.assessment_invoice_default_email_subject || 'Invoice {invoiceNumber} - {monthYear}';
  if (!bodyTpl) bodyTpl = settings.assessment_invoice_default_email_body || 'Please see attached invoice {invoiceNumber} for {monthYear}.';
  return { to: to, cc: cc, bcc: bcc, subjectTpl: subjectTpl, bodyTpl: bodyTpl };
}

function api_sendAssessmentInvoice(invoiceId) {
  var found = loadAssessmentInvoiceById(invoiceId);
  if (!found) throw new Error('Invoice not found.');
  var invoiceObj = found.object;
  if (invoiceObj.locked) throw new Error('Invoice is already locked. Unlock it first if you need to re-send.');
  if (invoiceObj.status !== 'generated' || !invoiceObj.generated_doc_id) {
    throw new Error('Generate (or regenerate) the document before sending.');
  }
  var contractMap = getAssessmentContractMap();
  var typeMap = getAssessmentTypeMap();
  var contract = invoiceObj.contract_id ? loadContractRowById(invoiceObj.contract_id) : null;
  var settings = {};
  try { settings = (typeof api_getSettings === 'function') ? (api_getSettings() || {}) : {}; } catch (e) { settings = {}; }
  var recipients = resolveSendRecipients(invoiceObj, contract, settings);
  if (!recipients.to) {
    throw new Error('No "To" recipient configured. Set one on the contract or in Settings → Default invoice email.');
  }
  var totals = computeInvoiceTotalsForInvoice(invoiceObj, contractMap, typeMap);
  var monthYear = buildInvoiceMonthYear(invoiceObj.year, invoiceObj.month);
  var orgName = contract ? (contract.name || '') : '';
  var ctx = {
    invoiceNumber: invoiceObj.invoice_number || '',
    monthYear: monthYear,
    org: orgName,
    total: formatAssessmentCurrencyAud(totals.total)
  };
  var subject = substituteInvoiceEmailPlaceholders(recipients.subjectTpl, ctx);
  var body = substituteInvoiceEmailPlaceholders(recipients.bodyTpl, ctx);

  // Export the Doc as PDF into the cached output folder.
  var folder = null;
  if (invoiceObj.output_folder_id) {
    try { folder = DriveApp.getFolderById(invoiceObj.output_folder_id); } catch (e) { folder = null; }
  }
  if (!folder) {
    var folderRef = settings.assessment_invoice_output_folder_reference || '';
    var resolution = folderRef ? resolveAssessmentOutputFolder(folderRef) : null;
    folder = resolution ? resolution.folder : null;
  }
  if (!folder) throw new Error('Unable to resolve the output folder for the PDF.');
  var srcFile = DriveApp.getFileById(invoiceObj.generated_doc_id);
  var pdfName = 'LPham Invoice ' + invoiceObj.invoice_number + ' - ' + monthYear + '.pdf';
  // Replace any prior PDF with the same name.
  try {
    var dupes = folder.getFilesByName(pdfName);
    while (dupes.hasNext()) {
      dupes.next().setTrashed(true);
    }
  } catch (e) {}
  var pdfBlob = srcFile.getAs('application/pdf').setName(pdfName);
  var pdfFile = folder.createFile(pdfBlob);

  // Send via Gmail with the PDF attached.
  var emailOptions = { attachments: [pdfFile.getBlob()] };
  if (recipients.cc) emailOptions.cc = recipients.cc;
  if (recipients.bcc) emailOptions.bcc = recipients.bcc;
  GmailApp.sendEmail(recipients.to, subject, body, emailOptions);

  // Persist sent state.
  var sh = getAssessmentInvoiceSheet();
  var headers = found.headers;
  var nowIso = toIsoDateTime(new Date());
  var statusIdx = headers.indexOf('status');
  var lockedIdx = headers.indexOf('locked');
  var sentAtIdx = headers.indexOf('sent_at');
  var pdfIdIdx = headers.indexOf('pdf_file_id');
  var pdfUrlIdx = headers.indexOf('pdf_file_url');
  var updatedIdx = headers.indexOf('updated_at');
  if (statusIdx !== -1) sh.getRange(found.rowIndex + 1, statusIdx + 1).setValue('sent');
  if (lockedIdx !== -1) sh.getRange(found.rowIndex + 1, lockedIdx + 1).setValue('TRUE');
  if (sentAtIdx !== -1) sh.getRange(found.rowIndex + 1, sentAtIdx + 1).setValue(nowIso);
  if (pdfIdIdx !== -1) sh.getRange(found.rowIndex + 1, pdfIdIdx + 1).setValue(pdfFile.getId());
  if (pdfUrlIdx !== -1) sh.getRange(found.rowIndex + 1, pdfUrlIdx + 1).setValue(pdfFile.getUrl());
  if (updatedIdx !== -1) sh.getRange(found.rowIndex + 1, updatedIdx + 1).setValue(nowIso);
  cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
  var freshRow = sh.getRange(found.rowIndex + 1, 1, 1, headers.length).getValues()[0];
  return { success: true, invoice: decorateAssessmentInvoice(rowToInvoiceObject(headers, freshRow), contractMap) };
}

function api_unlockAssessmentInvoice(invoiceId) {
  var found = loadAssessmentInvoiceById(invoiceId);
  if (!found) throw new Error('Invoice not found.');
  if (!found.object.locked) return { success: true, invoice: found.object };
  var sh = getAssessmentInvoiceSheet();
  var headers = found.headers;
  var lockedIdx = headers.indexOf('locked');
  var updatedIdx = headers.indexOf('updated_at');
  if (lockedIdx !== -1) sh.getRange(found.rowIndex + 1, lockedIdx + 1).setValue('FALSE');
  if (updatedIdx !== -1) sh.getRange(found.rowIndex + 1, updatedIdx + 1).setValue(toIsoDateTime(new Date()));
  cacheClearPrefix(ASSESSMENT_CACHE_PREFIX);
  var contractMap = getAssessmentContractMap();
  var freshRow = sh.getRange(found.rowIndex + 1, 1, 1, headers.length).getValues()[0];
  return { success: true, invoice: decorateAssessmentInvoice(rowToInvoiceObject(headers, freshRow), contractMap) };
}
