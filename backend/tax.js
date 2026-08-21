/**
 * Versioned PAYG withholding estimates for monthly taxable income.
 *
 * Scale 2 is used (Australian resident, tax-free threshold claimed). The
 * coefficients are snapshots, not fetched at runtime, so a deployment remains
 * reproducible. Call api_getTaxTableStatus() to surface the support boundary.
 */
var PAYG_SCALE_2_TABLES = {
  '2020-21': {
    source: 'ATO NAT 1004 (effective 13 October 2020)',
    rows: [[359, 0, 0], [438, 0.1900, 68.3462], [548, 0.2900, 112.1942], [721, 0.2100, 68.3465], [865, 0.2190, 74.8369], [1282, 0.3477, 186.2119], [2307, 0.3450, 182.7504], [3461, 0.3900, 286.5965], [Infinity, 0.4700, 563.5196]]
  },
  '2024-25': {
    source: 'ATO NAT 1004 (effective 1 July 2024)',
    rows: [[361, 0, 0], [500, 0.1600, 57.8462], [625, 0.2600, 107.8462], [721, 0.1800, 57.8462], [865, 0.1890, 64.3365], [1282, 0.3227, 180.0385], [2596, 0.3200, 176.5769], [3653, 0.3900, 358.3077], [Infinity, 0.4700, 650.6154]]
  },
  '2025-26': {
    source: 'ATO NAT 1004 (effective 1 July 2025)',
    rows: [[361, 0, 0], [500, 0.1600, 57.8462], [625, 0.2600, 107.8462], [721, 0.1800, 57.8462], [865, 0.1890, 64.3365], [1282, 0.3227, 180.0385], [2596, 0.3200, 176.5769], [3653, 0.3900, 358.3077], [Infinity, 0.4700, 650.6154]]
  },
  '2026-27': {
    source: 'ATO NAT 1004 (effective 1 July 2026, published 19 May 2026)',
    rows: [[362, 0, 0], [538, 0.1500, 54.3462], [673, 0.2500, 108.2135], [721, 0.1700, 54.3473], [865, 0.1790, 60.8377], [1282, 0.3227, 185.1935], [2596, 0.3200, 181.7319], [3653, 0.3900, 363.4627], [Infinity, 0.4700, 655.7704]]
  }
};
var PAYG_LATEST_SUPPORTED_YEAR = '2026-27';

function paygDateParts_(value) {
  var date = value instanceof Date ? value : new Date(value || new Date());
  if (isNaN(date.getTime())) throw new Error('A valid date is required for the tax estimate.');
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function paygFinancialYear_(value) {
  var parts = paygDateParts_(value);
  var start = parts.month >= 7 ? parts.year : parts.year - 1;
  return start + '-' + String((start + 1) % 100).padStart(2, '0');
}

function paygResolveTable_(value) {
  var requested = paygFinancialYear_(value);
  var table = PAYG_SCALE_2_TABLES[requested];
  if (table) return { requested: requested, applied: requested, table: table, stale: false };
  var requestedStart = Number(requested.substring(0, 4));
  var supported = Object.keys(PAYG_SCALE_2_TABLES).sort();
  var applied = requestedStart > Number(PAYG_LATEST_SUPPORTED_YEAR.substring(0, 4))
    ? PAYG_LATEST_SUPPORTED_YEAR
    : supported[0];
  return { requested: requested, applied: applied, table: PAYG_SCALE_2_TABLES[applied], stale: true };
}

function estimateTaxDetails(taxableIncome, currentDate) {
  var monthlyIncome = Math.max(0, Number(taxableIncome) || 0);
  var resolved = paygResolveTable_(currentDate);
  var weeklyIncome = Math.floor(monthlyIncome * (3 / 13)) + 0.99;
  var row = resolved.table.rows[resolved.table.rows.length - 1];
  for (var index = 0; index < resolved.table.rows.length; index++) {
    if (weeklyIncome < resolved.table.rows[index][0]) { row = resolved.table.rows[index]; break; }
  }
  var weeklyTax = Math.max(0, row[1] * weeklyIncome - row[2]);
  return {
    tax: Math.max(0, Math.round(weeklyTax * (13 / 3))),
    taxable_income: monthlyIncome,
    requested_financial_year: resolved.requested,
    applied_financial_year: resolved.applied,
    stale: resolved.stale,
    warning: resolved.stale ? 'PAYG coefficients are only bundled through ' + PAYG_LATEST_SUPPORTED_YEAR + '; this estimate uses the newest available table.' : '',
    source: resolved.table.source
  };
}

function estimateTax(taxableIncome, currentDate) {
  return estimateTaxDetails(taxableIncome, currentDate).tax;
}

function api_getTaxTableStatus(currentDate) {
  var details = estimateTaxDetails(0, currentDate || new Date());
  return {
    requested_financial_year: details.requested_financial_year,
    applied_financial_year: details.applied_financial_year,
    latest_supported_financial_year: PAYG_LATEST_SUPPORTED_YEAR,
    stale: details.stale,
    warning: details.warning,
    source: details.source
  };
}

/** Kept for one release for callers that used the old helper directly. */
function estimateHELP() {
  return 0;
}
