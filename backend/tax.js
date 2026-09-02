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

/**
 * Annual individual income tax, for sole trader provisioning.
 *
 * Distinct from the PAYG tables above, and not interchangeable with them. PAYG withholding annualises a
 * single pay period, which is right for an employee on even pay and wrong for a sole trader with lumpy
 * income: a busy month is taxed as though every month were that busy. These are the annual marginal rates,
 * applied to year-to-date profit, so uneven months converge on the correct annual figure.
 *
 * Snapshots, not fetched at runtime, so a deployment stays reproducible. The 2026-27 second-bracket rate of
 * 15% (down from 16%) matches the legislated reduction and is corroborated by the bundled 2026-27 PAYG
 * coefficients above, whose second segment is also 0.15.
 *
 * Brackets are [upper_threshold, marginal_rate] and apply progressively. Medicare levy uses the shade-in
 * formula: the lesser of `rate x income` and `shade_in_rate x (income - lower_threshold)`. Above roughly
 * $34k the shading is irrelevant and the levy is a flat 2%, so the indexed threshold barely moves a
 * provisioning estimate at Lil's income level.
 */
var INDIVIDUAL_INCOME_TAX_TABLES = {
  '2024-25': {
    source: 'ATO individual income tax rates (effective 1 July 2024)',
    brackets: [[18200, 0], [45000, 0.16], [135000, 0.30], [190000, 0.37], [Infinity, 0.45]],
    medicare: { rate: 0.02, lower_threshold: 27222, shade_in_rate: 0.10 }
  },
  '2025-26': {
    source: 'ATO individual income tax rates (effective 1 July 2025)',
    brackets: [[18200, 0], [45000, 0.16], [135000, 0.30], [190000, 0.37], [Infinity, 0.45]],
    medicare: { rate: 0.02, lower_threshold: 27222, shade_in_rate: 0.10 }
  },
  '2026-27': {
    source: 'ATO individual income tax rates (effective 1 July 2026; 16% bracket reduced to 15%)',
    brackets: [[18200, 0], [45000, 0.15], [135000, 0.30], [190000, 0.37], [Infinity, 0.45]],
    medicare: { rate: 0.02, lower_threshold: 27222, shade_in_rate: 0.10 }
  }
};
var INDIVIDUAL_TAX_LATEST_SUPPORTED_YEAR = '2026-27';

/** Accepts a Date, an ISO string, a 'yyyy-yy' label, or a financial-year START year such as 2026. */
function individualTaxFinancialYear_(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value;
  var numeric = Number(value);
  if (isFinite(numeric) && numeric >= 1990 && numeric <= 2200 && String(value).indexOf('-') === -1) {
    return numeric + '-' + String((numeric + 1) % 100).padStart(2, '0');
  }
  return paygFinancialYear_(value);
}

function individualTaxResolveTable_(value) {
  var requested = individualTaxFinancialYear_(value);
  var table = INDIVIDUAL_INCOME_TAX_TABLES[requested];
  if (table) return { requested: requested, applied: requested, table: table, stale: false };
  var supported = Object.keys(INDIVIDUAL_INCOME_TAX_TABLES).sort();
  var applied = Number(requested.substring(0, 4)) > Number(INDIVIDUAL_TAX_LATEST_SUPPORTED_YEAR.substring(0, 4))
    ? INDIVIDUAL_TAX_LATEST_SUPPORTED_YEAR
    : supported[0];
  return { requested: requested, applied: applied, table: INDIVIDUAL_INCOME_TAX_TABLES[applied], stale: true };
}

/**
 * Optional full override so the current year's figures can be corrected from Settings without a redeploy.
 * Shape matches a table entry: { brackets: [[upper, rate], ...], medicare: { ... } }.
 */
function individualTaxOverride_() {
  try {
    var raw = String((api_getSettings() || {}).individual_tax_table_override || '').trim();
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.brackets) || !parsed.brackets.length) return null;
    parsed.brackets = parsed.brackets.map(function(bracket) {
      return [bracket[0] === null || bracket[0] === 'Infinity' ? Infinity : Number(bracket[0]), Number(bracket[1])];
    });
    return parsed;
  } catch (error) {
    return null;
  }
}

function annualIncomeTaxDetails(taxableIncome, financialYear) {
  var income = Math.max(0, Number(taxableIncome) || 0);
  var resolved = individualTaxResolveTable_(financialYear);
  var override = individualTaxOverride_();
  var table = override || resolved.table;
  var tax = 0;
  var lower = 0;
  for (var index = 0; index < table.brackets.length; index++) {
    var upper = table.brackets[index][0];
    var rate = Number(table.brackets[index][1]) || 0;
    if (income <= lower) break;
    tax += (Math.min(income, upper) - lower) * rate;
    lower = upper;
  }
  var medicare = 0;
  var levy = table.medicare;
  if (levy && income > Number(levy.lower_threshold || 0)) {
    var full = income * (Number(levy.rate) || 0);
    var shaded = (income - Number(levy.lower_threshold || 0)) * (Number(levy.shade_in_rate) || 0);
    medicare = Math.min(full, shaded);
  }
  return {
    tax: roundMoney_(tax + medicare),
    income_tax: roundMoney_(tax),
    medicare_levy: roundMoney_(medicare),
    taxable_income: roundMoney_(income),
    requested_financial_year: resolved.requested,
    applied_financial_year: override ? 'settings_override' : resolved.applied,
    stale: override ? false : resolved.stale,
    warning: override ? '' : (resolved.stale ? 'Annual tax rates are only bundled through ' + INDIVIDUAL_TAX_LATEST_SUPPORTED_YEAR + '; this estimate uses the newest available table. Confirm the current brackets with your accountant or set individual_tax_table_override.' : ''),
    source: override ? 'Settings override (individual_tax_table_override)' : table.source
  };
}

function annualIncomeTax(taxableIncome, financialYear) {
  return annualIncomeTaxDetails(taxableIncome, financialYear).tax;
}

function api_getIndividualTaxTableStatus(financialYear) {
  var details = annualIncomeTaxDetails(0, financialYear || new Date());
  return {
    requested_financial_year: details.requested_financial_year,
    applied_financial_year: details.applied_financial_year,
    latest_supported_financial_year: INDIVIDUAL_TAX_LATEST_SUPPORTED_YEAR,
    stale: details.stale,
    warning: details.warning,
    source: details.source
  };
}

/**
 * The configured PAYG instalment rate, as a decimal. The ATO derives this rate from the last lodged return
 * (tax payable divided by instalment income), which is why it applies to GROSS business income and not to
 * profit. An explicit setting wins; otherwise the most recent BAS submission carrying a T2 rate is used.
 * Returns null when neither exists, which puts the provision on the cumulative method.
 */
function resolvePaygInstalmentRate_() {
  var configured = null;
  try {
    var raw = (api_getSettings() || {}).payg_instalment_rate;
    if (raw !== '' && raw != null) configured = Number(raw);
  } catch (error) { configured = null; }
  if (configured === null || !isFinite(configured) || configured < 0) {
    configured = null;
    try {
      var submissions = listBasSubmissionsInternal().filter(function(item) { return Number(item.t2_instalment_rate) > 0; });
      if (submissions.length) configured = Number(submissions[submissions.length - 1].t2_instalment_rate);
    } catch (error) { configured = null; }
  }
  if (configured === null || !isFinite(configured) || configured <= 0) return null;
  // Accept either a percentage (5.5) or a decimal (0.055).
  return configured > 1 ? configured / 100 : configured;
}

/**
 * Tax to set aside for one month of a sole trader's year.
 *
 * `instalment_rate` method: the ATO's own rate method, rate x this period's gross business income. Linear,
 * so lumpy income does not distort it.
 *
 * `cumulative` fallback when no rate is known: tax the year-to-date profit at the annual rates and set aside
 * the difference from what earlier months already provisioned. So the balance always holds the true tax on
 * income actually received to date, and the twelve months sum to the exact annual tax on the actual profit
 * no matter how unevenly the income arrived.
 *
 * Note what this deliberately does NOT do: annualise. Projecting year-to-date profit out to a full year
 * reproduces the very flaw that makes PAYG withholding wrong here — in month one a $60k month is indexed as
 * a $720k year — and because a set-aside cannot be clawed back once clamped at zero, the over-provision
 * would never unwind. Taxing the actual year-to-date figure needs no such guess.
 *
 * The monthly amount may be NEGATIVE, releasing money back when a loss month lowers year-to-date profit.
 * That is what keeps the annual total exact; clamping it at zero would strand the over-provision.
 */
function soleTraderTaxProvision_(input) {
  var monthsElapsed = Math.max(1, Number(input && input.months_elapsed) || 1);
  var alreadyProvisioned = Number(input && input.already_provisioned) || 0;
  var rate = input && input.instalment_rate != null ? Number(input.instalment_rate) : null;
  if (rate !== null && isFinite(rate) && rate > 0) {
    var periodIncome = Math.max(0, Number(input.period_instalment_income) || 0);
    return {
      method: 'instalment_rate',
      amount: roundMoney_(periodIncome * rate),
      instalment_rate: rate,
      basis_amount: roundMoney_(periodIncome),
      stale: false,
      warning: '',
      source: 'PAYG instalment rate method (ATO option 2)'
    };
  }
  var ytdProfit = Number(input && input.ytd_taxable_profit) || 0;
  var details = annualIncomeTaxDetails(ytdProfit, input && input.financial_year);
  var cumulative = details.tax;
  return {
    method: 'cumulative',
    amount: roundMoney_(cumulative - alreadyProvisioned),
    ytd_taxable_profit: roundMoney_(ytdProfit),
    months_elapsed: monthsElapsed,
    cumulative_provision: roundMoney_(cumulative),
    already_provisioned: roundMoney_(alreadyProvisioned),
    stale: details.stale,
    warning: details.warning,
    source: details.source
  };
}
