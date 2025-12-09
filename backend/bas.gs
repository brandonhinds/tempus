var BAS_SUBMISSIONS_SHEET_NAME = 'bas_submissions';
var BAS_SUBMISSIONS_HEADERS = [
  'id',
  'financial_year',
  'period_type',
  'quarter',
  'month',
  'g1_total_sales',
  'g1_includes_gst',
  'field_1a_gst_on_sales',
  'field_1b_gst_on_purchases',
  't1_payg_income',
  't2_instalment_rate',
  'submitted',
  'submitted_at',
  'created_at',
  'updated_at'
];
var BAS_SUBMISSIONS_CACHE_KEY = 'bas_submissions_v1';

function getBasSubmissionsSheet() {
  var sh = getOrCreateSheet(BAS_SUBMISSIONS_SHEET_NAME);
  ensureBasSubmissionsSchema(sh);
  return sh;
}

function ensureBasSubmissionsSchema(sh) {
  var lastColumn = Math.max(sh.getLastColumn(), BAS_SUBMISSIONS_HEADERS.length);
  var headerRange = sh.getRange(1, 1, 1, lastColumn);
  var headers = headerRange.getValues()[0];
  var needsRewrite = false;
  for (var i = 0; i < BAS_SUBMISSIONS_HEADERS.length; i++) {
    if (headers[i] !== BAS_SUBMISSIONS_HEADERS[i]) {
      needsRewrite = true;
      break;
    }
  }
  if (needsRewrite) {
    sh.getRange(1, 1, 1, BAS_SUBMISSIONS_HEADERS.length).setValues([BAS_SUBMISSIONS_HEADERS]);
  }
}

function normalizeBasSubmissionRow(row, headers) {
  if (!row) return null;
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[headers[i]] = row[i];
  }
  var id = map.id ? String(map.id) : '';
  if (!id) return null;

  var periodType = map.period_type ? String(map.period_type) : 'quarterly';
  var quarter = map.quarter !== '' && map.quarter != null ? Number(map.quarter) : null;
  var month = map.month !== '' && map.month != null ? Number(map.month) : null;

  return {
    id: id,
    financial_year: Number(map.financial_year) || 0,
    period_type: periodType === 'monthly' ? 'monthly' : 'quarterly',
    quarter: quarter,
    month: month,
    g1_total_sales: Number(map.g1_total_sales) || 0,
    g1_includes_gst: parseBoolean(map.g1_includes_gst),
    field_1a_gst_on_sales: Number(map.field_1a_gst_on_sales) || 0,
    field_1b_gst_on_purchases: Number(map.field_1b_gst_on_purchases) || 0,
    t1_payg_income: Number(map.t1_payg_income) || 0,
    t2_instalment_rate: Number(map.t2_instalment_rate) || 0,
    submitted: parseBoolean(map.submitted),
    submitted_at: toIsoDateTime(map.submitted_at || ''),
    created_at: toIsoDateTime(map.created_at || ''),
    updated_at: toIsoDateTime(map.updated_at || '')
  };
}

function listBasSubmissionsInternal() {
  var cached = cacheGet(BAS_SUBMISSIONS_CACHE_KEY);
  if (cached) return cached;
  var sh = getBasSubmissionsSheet();
  var values = sh.getDataRange().getValues();
  if (values.length <= 1) {
    cacheSet(BAS_SUBMISSIONS_CACHE_KEY, []);
    return [];
  }
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var normalized = normalizeBasSubmissionRow(values[i], headers);
    if (normalized) result.push(normalized);
  }
  cacheSet(BAS_SUBMISSIONS_CACHE_KEY, result);
  return result;
}

function api_getBasSubmissions() {
  return listBasSubmissionsInternal();
}

function normalizeBasSubmissionPayload(payload, existing) {
  if (!payload) throw new Error('BAS submission payload is required.');

  var financialYear = Number(payload.financial_year);
  if (!Number.isFinite(financialYear) || financialYear < 2000 || financialYear > 2100) {
    throw new Error('Valid financial year is required (2000-2100).');
  }

  var periodType = payload.period_type ? String(payload.period_type) : 'quarterly';
  if (periodType !== 'monthly' && periodType !== 'quarterly') {
    throw new Error('Period type must be "monthly" or "quarterly".');
  }

  var quarter = payload.quarter !== null && payload.quarter !== undefined ? Number(payload.quarter) : null;
  var month = payload.month !== null && payload.month !== undefined ? Number(payload.month) : null;

  if (periodType === 'quarterly') {
    if (quarter === null || !Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
      throw new Error('Quarter must be between 1 and 4 for quarterly periods.');
    }
  } else {
    if (month === null || !Number.isFinite(month) || month < 0 || month > 11) {
      throw new Error('Month must be between 0 and 11 for monthly periods.');
    }
  }

  var g1TotalSales = Number(payload.g1_total_sales);
  if (!Number.isFinite(g1TotalSales) || g1TotalSales < 0) {
    throw new Error('G1 Total Sales must be a non-negative number.');
  }

  var field1aGstOnSales = Number(payload.field_1a_gst_on_sales);
  if (!Number.isFinite(field1aGstOnSales) || field1aGstOnSales < 0) {
    throw new Error('1A GST on Sales must be a non-negative number.');
  }

  var field1bGstOnPurchases = Number(payload.field_1b_gst_on_purchases);
  if (!Number.isFinite(field1bGstOnPurchases) || field1bGstOnPurchases < 0) {
    throw new Error('1B GST on Purchases must be a non-negative number.');
  }

  var t1PaygIncome = Number(payload.t1_payg_income);
  if (!Number.isFinite(t1PaygIncome) || t1PaygIncome < 0) {
    throw new Error('T1 PAYG Income must be a non-negative number.');
  }

  var t2InstalmentRate = Number(payload.t2_instalment_rate);
  if (!Number.isFinite(t2InstalmentRate) || t2InstalmentRate < 0 || t2InstalmentRate > 1) {
    throw new Error('T2 Instalment Rate must be between 0 and 1 (as a decimal).');
  }

  var g1IncludesGst = payload.g1_includes_gst === undefined ? true : parseBoolean(payload.g1_includes_gst);
  var submitted = parseBoolean(payload.submitted);

  return {
    id: existing && existing.id ? existing.id : (payload.id ? String(payload.id) : ''),
    financial_year: financialYear,
    period_type: periodType,
    quarter: quarter,
    month: month,
    g1_total_sales: g1TotalSales,
    g1_includes_gst: g1IncludesGst,
    field_1a_gst_on_sales: field1aGstOnSales,
    field_1b_gst_on_purchases: field1bGstOnPurchases,
    t1_payg_income: t1PaygIncome,
    t2_instalment_rate: t2InstalmentRate,
    submitted: submitted
  };
}

function buildBasSubmissionRow(payload, timestamps) {
  return [
    payload.id,
    payload.financial_year,
    payload.period_type,
    payload.quarter !== null && payload.quarter !== undefined ? payload.quarter : '',
    payload.month !== null && payload.month !== undefined ? payload.month : '',
    Number(payload.g1_total_sales),
    payload.g1_includes_gst ? 'TRUE' : 'FALSE',
    Number(payload.field_1a_gst_on_sales),
    Number(payload.field_1b_gst_on_purchases),
    Number(payload.t1_payg_income),
    Number(payload.t2_instalment_rate),
    payload.submitted ? 'TRUE' : 'FALSE',
    timestamps.submitted_at,
    timestamps.created_at,
    timestamps.updated_at
  ];
}

function api_upsertBasSubmission(payload) {
  var list = listBasSubmissionsInternal();
  var existing = null;

  // Find existing submission by financial_year + period_type + (quarter or month)
  if (payload && payload.financial_year) {
    var periodType = payload.period_type || 'quarterly';
    existing = list.find(function(item) {
      if (item.financial_year !== Number(payload.financial_year)) return false;
      if (item.period_type !== periodType) return false;
      if (periodType === 'quarterly') {
        return item.quarter === Number(payload.quarter);
      } else {
        return item.month === Number(payload.month);
      }
    });
  }

  var normalizedPayload = normalizeBasSubmissionPayload(payload, existing);

  var sh = getBasSubmissionsSheet();
  var values = sh.getDataRange().getValues();
  var headers = values.length ? values[0] : BAS_SUBMISSIONS_HEADERS;

  var idIndex = headers.indexOf('id');
  var targetRow = -1;

  // If we found existing by financial_year+quarter, use its ID
  if (existing && existing.id) {
    normalizedPayload.id = existing.id;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idIndex]) === existing.id) {
        targetRow = i + 1;
        break;
      }
    }
  }

  var nowIso = toIsoDateTime(new Date());
  var submittedAtIso = normalizedPayload.submitted ? nowIso : '';

  var timestamps = {
    created_at: existing ? existing.created_at : nowIso,
    updated_at: nowIso,
    submitted_at: normalizedPayload.submitted ? (existing && existing.submitted_at ? existing.submitted_at : nowIso) : ''
  };

  if (!normalizedPayload.id) {
    normalizedPayload.id = Utilities.getUuid();
  }

  if (!timestamps.created_at) {
    timestamps.created_at = nowIso;
  }

  var row = buildBasSubmissionRow(normalizedPayload, timestamps);

  if (targetRow === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);
  }

  cacheClearPrefix(BAS_SUBMISSIONS_CACHE_KEY);

  var updated = listBasSubmissionsInternal().find(function(item) {
    return item.id === normalizedPayload.id;
  });

  return updated;
}
