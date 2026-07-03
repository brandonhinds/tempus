/** Expense Report (Stage 9)
 *
 * Builds a CSV breakdown of company-expense deductions for a financial year (Australian FY, Jul-Jun).
 * Recurring deductions are expanded into one row per occurrence, with exceptions applied.
 */

function expenseReportFinancialYearBounds(financialYear) {
  var startYear = Number(financialYear);
  if (!isFinite(startYear) || startYear <= 0) {
    throw new Error('Financial year is required (the calendar year the FY begins, e.g. 2024 for FY 2024/2025).');
  }
  var tz = Session.getScriptTimeZone();
  var startDate = new Date(startYear, 6, 1); // Jul 1
  var endDate = new Date(startYear + 1, 5, 30); // Jun 30
  return {
    startYear: startYear,
    startIso: Utilities.formatDate(startDate, tz, 'yyyy-MM-dd'),
    endIso: Utilities.formatDate(endDate, tz, 'yyyy-MM-dd'),
    startDate: startDate,
    endDate: endDate
  };
}

function expenseReportSplitGstInclusiveAmount(amount, gstInclusive) {
  var raw = Number(amount) || 0;
  if (!gstInclusive) {
    return { ex_gst: Math.round(raw * 100) / 100, gst: 0, inc_gst: Math.round(raw * 100) / 100 };
  }
  // GST-inclusive: ex_gst = inc / 1.1, gst = inc - ex_gst
  var inc = Math.round(raw * 100) / 100;
  var exGst = Math.round((inc / 1.1) * 100) / 100;
  var gst = Math.round((inc - exGst) * 100) / 100;
  return { ex_gst: exGst, gst: gst, inc_gst: inc };
}

function expenseReportCsvEscape(value) {
  if (value === null || value === undefined) return '';
  var str = String(value);
  if (str.indexOf('"') !== -1 || str.indexOf(',') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function expenseReportListOccurrencesForDeduction(deduction, periodStart, periodEnd) {
  if (!deduction || !deduction.start_date) return [];
  var frequency = deduction.frequency || 'once';
  if (frequency === 'once') {
    var iso = toIsoDate(deduction.start_date);
    if (!iso) return [];
    if (periodStart && iso < periodStart) return [];
    if (periodEnd && iso > periodEnd) return [];
    return [{ date: iso, amount: null }];
  }
  if (typeof generateDeductionOccurrenceDates !== 'function') return [];
  var startDate = new Date(deduction.start_date + 'T00:00:00');
  var endDate = deduction.end_date ? new Date(deduction.end_date + 'T00:00:00') : null;
  var periodStartDate = new Date(periodStart + 'T00:00:00');
  var periodEndDate = new Date(periodEnd + 'T00:00:00');
  var rawDates = generateDeductionOccurrenceDates(frequency, startDate, endDate, periodStartDate, periodEndDate);
  var exceptions = (typeof listDeductionExceptionsInternal === 'function') ? listDeductionExceptionsInternal(deduction.id) : [];
  if (typeof applyExceptionsToOccurrences === 'function') {
    return applyExceptionsToOccurrences(rawDates, exceptions, periodStart, periodEnd);
  }
  return rawDates.map(function(date) { return { date: date, amount: null }; });
}

function buildExpenseReportRows(financialYear) {
  var bounds = expenseReportFinancialYearBounds(financialYear);
  var deductions = (typeof api_getDeductions === 'function') ? api_getDeductions() : [];
  var categories = (typeof api_getDeductionCategories === 'function') ? api_getDeductionCategories() : [];
  var categoryMap = {};
  (Array.isArray(categories) ? categories : []).forEach(function(cat) {
    if (cat && cat.id) categoryMap[String(cat.id)] = cat;
  });
  var rows = [];
  (Array.isArray(deductions) ? deductions : []).forEach(function(deduction) {
    if (!deduction || !deduction.company_expense) return;
    if (deduction.amount_type === 'percent') return; // Only flat-amount company expenses make sense in this report.
    if (deduction.active === false) return;
    var occurrences = expenseReportListOccurrencesForDeduction(deduction, bounds.startIso, bounds.endIso);
    occurrences.forEach(function(occ) {
      if (!occ || !occ.date) return;
      if (occ.date < bounds.startIso || occ.date > bounds.endIso) return;
      var amount = (occ.amount != null) ? Number(occ.amount) : Number(deduction.amount_value) || 0;
      var split = expenseReportSplitGstInclusiveAmount(amount, !!deduction.gst_inclusive);
      var cat = deduction.category_id ? categoryMap[String(deduction.category_id)] : null;
      rows.push({
        date: occ.date,
        category: cat ? cat.name : 'Uncategorised',
        name: deduction.name || '',
        notes: deduction.notes || '',
        amount_ex_gst: split.ex_gst,
        gst: split.gst,
        amount_inc_gst: split.inc_gst
      });
    });
  });
  rows.sort(function(a, b) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || '');
  });
  return { bounds: bounds, rows: rows };
}

function api_buildExpenseReportCsv(financialYear) {
  var built = buildExpenseReportRows(financialYear);
  var lines = ['date,category,name,notes,amount_ex_gst,gst,amount_inc_gst'];
  built.rows.forEach(function(row) {
    lines.push([
      expenseReportCsvEscape(row.date),
      expenseReportCsvEscape(row.category),
      expenseReportCsvEscape(row.name),
      expenseReportCsvEscape(row.notes),
      row.amount_ex_gst.toFixed(2),
      row.gst.toFixed(2),
      row.amount_inc_gst.toFixed(2)
    ].join(','));
  });
  // Totals footer
  if (built.rows.length) {
    var totalEx = 0, totalGst = 0, totalInc = 0;
    built.rows.forEach(function(row) {
      totalEx += row.amount_ex_gst;
      totalGst += row.gst;
      totalInc += row.amount_inc_gst;
    });
    lines.push([
      '"TOTAL"', '', '', '',
      totalEx.toFixed(2),
      totalGst.toFixed(2),
      totalInc.toFixed(2)
    ].join(','));
  }
  var fyLabel = built.bounds.startYear + '-' + (built.bounds.startYear + 1);
  return {
    success: true,
    financial_year_label: 'FY ' + fyLabel,
    period_start: built.bounds.startIso,
    period_end: built.bounds.endIso,
    row_count: built.rows.length,
    csv: lines.join('\n'),
    rows: built.rows
  };
}
