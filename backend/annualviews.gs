/** Annual Views API - Aggregates yearly data for comprehensive reporting */

/**
 * Get annual summary data
 * @param {Object} payload - { yearType: 'financial'|'calendar', startYear: 2024, contractIds: [] }
 * @returns {Object} Annual summary with monthly breakdowns
 */
function api_getAnnualSummary(payload) {
  var yearType = payload.yearType || 'financial';
  var startYear = Number(payload.startYear) || financialYearStartYear(new Date());
  var contractIds = payload.contractIds || [];

  var cacheKey = 'annual_' + yearType + '_' + startYear + '_' + (contractIds.length > 0 ? contractIds.sort().join(',') : 'all');
  var cached = cacheGet(cacheKey);
  if (cached) {
    Logger.log('Returning cached annual summary for ' + cacheKey);
    return cached;
  }

  var months = yearType === 'financial'
    ? getFinancialYearMonths(startYear)
    : getCalendarYearMonths(startYear);

  var sheet = getOrCreateSheet('timesheet_entries');
  var contractsSheet = getOrCreateSheet('contracts');
  var deductionsSheet = getOrCreateSheet('deductions');
  var hourTypesSheet = getOrCreateSheet('hour_types');

  // Build lookup maps
  var contractMap = {};
  var contractsData = contractsSheet.getDataRange().getValues();
  for (var i = 1; i < contractsData.length; i++) {
    var row = contractsData[i];
    contractMap[row[0]] = {
      id: row[0],
      name: row[1],
      hourly_rate: Number(row[4]) || 0
    };
  }

  var hourTypeMap = {};
  var hourTypesData = hourTypesSheet.getDataRange().getValues();
  for (var i = 1; i < hourTypesData.length; i++) {
    var row = hourTypesData[i];
    hourTypeMap[row[0]] = {
      id: row[0],
      name: row[1],
      slug: row[2],
      color: row[3],
      contributes_to_income: row[4] === 'TRUE' || row[4] === true
    };
  }

  // Get all entries
  var entriesData = sheet.getDataRange().getValues();
  var allEntries = [];
  for (var i = 1; i < entriesData.length; i++) {
    var row = entriesData[i];
    allEntries.push({
      id: row[0],
      date: row[1],
      duration_minutes: Number(row[2]) || 0,
      contract_id: row[3],
      hour_type_id: row[7]  // Column 7, not 6 (entry_type is in column 6)
    });
  }

  // Filter entries by contract if specified (for income calculations)
  var filteredEntries = allEntries;
  if (contractIds.length > 0) {
    filteredEntries = allEntries.filter(function(entry) {
      return contractIds.indexOf(entry.contract_id) >= 0;
    });
  }

  // Build monthly summaries
  var monthlyData = [];
  var yearTotals = {
    grossIncome: 0,
    superGuarantee: 0,
    superLost: 0,
    extraSuper: 0,
    otherDeductions: 0,
    tax: 0,
    netIncome: 0,
    totalHours: 0,
    companyIncome: 0,
    companyExpenses: 0,
    invoiceTotal: 0
  };

  var contractGrossIncome = {};
  var hourTypeHours = {};

  for (var m = 0; m < months.length; m++) {
    var month = months[m];
    var monthSummary = buildMonthlySummaryForAnnual(month.year, month.month, filteredEntries, allEntries, contractMap, hourTypeMap, deductionsSheet);
    monthlyData.push(monthSummary);

    // Accumulate year totals
    yearTotals.grossIncome += monthSummary.grossIncome;
    yearTotals.superGuarantee += monthSummary.superGuarantee;
    yearTotals.superLost += monthSummary.superLost;
    yearTotals.extraSuper += monthSummary.extraSuper;
    yearTotals.otherDeductions += monthSummary.otherDeductions;
    yearTotals.tax += monthSummary.tax;
    yearTotals.netIncome += monthSummary.netIncome;
    yearTotals.totalHours += monthSummary.totalHours;
    yearTotals.companyIncome += monthSummary.companyIncome;
    yearTotals.companyExpenses += monthSummary.companyExpenses;
    yearTotals.invoiceTotal += monthSummary.invoiceTotal;

    // Accumulate contract-level gross income
    for (var contractId in monthSummary.contractIncome) {
      if (!contractGrossIncome[contractId]) {
        contractGrossIncome[contractId] = 0;
      }
      contractGrossIncome[contractId] += monthSummary.contractIncome[contractId];
    }

    // Accumulate hour type hours (from unfiltered entries to include all hour types)
    for (var hourTypeId in monthSummary.hourTypeHours) {
      if (!hourTypeHours[hourTypeId]) {
        hourTypeHours[hourTypeId] = 0;
      }
      hourTypeHours[hourTypeId] += monthSummary.hourTypeHours[hourTypeId];
    }
  }

  // Build contract breakdown array
  var contractBreakdown = [];
  for (var cid in contractGrossIncome) {
    var contract = contractMap[cid];
    if (contract) {
      contractBreakdown.push({
        contractId: cid,
        contractName: contract.name,
        grossIncome: contractGrossIncome[cid]
      });
    }
  }

  // Build hour type breakdown array
  var hourTypeBreakdown = [];
  for (var htid in hourTypeHours) {
    var hourType = hourTypeMap[htid];
    var hourTypeId = htid;
    var hourTypeName = 'Unknown';
    var hourTypeColor = '#94a3b8';

    if (hourType) {
      // Use hour type from map
      hourTypeId = hourType.id;
      hourTypeName = hourType.name;
      hourTypeColor = hourType.color;
    } else if (!htid || htid === '' || htid === 'work') {
      // Default to 'work' for empty or 'work' hour type IDs
      hourTypeId = 'work';
      hourTypeName = 'Work';
      hourTypeColor = '#3b82f6';
    } else {
      // Use the ID as the name for unknown hour types
      hourTypeId = htid;
      hourTypeName = htid.charAt(0).toUpperCase() + htid.slice(1); // Capitalize first letter
      hourTypeColor = '#94a3b8'; // Gray color for unknown types
    }

    hourTypeBreakdown.push({
      hourTypeId: hourTypeId,
      hourTypeName: hourTypeName,
      hourTypeColor: hourTypeColor,
      hours: hourTypeHours[htid] / 60
    });
  }

  var result = {
    yearType: yearType,
    startYear: startYear,
    monthlyData: monthlyData,
    yearTotals: yearTotals,
    contractBreakdown: contractBreakdown,
    hourTypeBreakdown: hourTypeBreakdown
  };

  cacheSet(cacheKey, result);
  return result;
}

/**
 * Build monthly summary for annual view
 * @param {number} year - Year to process
 * @param {number} month - Month to process (0-indexed)
 * @param {Array} filteredEntries - Entries filtered by contract (for income calculations)
 * @param {Array} allEntries - All entries (for hour type tracking)
 * @param {Object} contractMap - Contract lookup
 * @param {Object} hourTypeMap - Hour type lookup
 * @param {Object} deductionsSheet - Deductions sheet
 */
function buildMonthlySummaryForAnnual(year, month, filteredEntries, allEntries, contractMap, hourTypeMap, deductionsSheet) {
  // Filter entries for this month (contract-filtered for income)
  var monthEntries = filteredEntries.filter(function(entry) {
    var entryDate = new Date(entry.date);
    return entryDate.getFullYear() === year && entryDate.getMonth() === month;
  });

  // Filter ALL entries for this month (for hour types, regardless of contract)
  var allMonthEntries = allEntries.filter(function(entry) {
    var entryDate = new Date(entry.date);
    return entryDate.getFullYear() === year && entryDate.getMonth() === month;
  });

  // Get settings
  var settingsSheet = getOrCreateSheet('user_settings');
  var settingsData = settingsSheet.getDataRange().getValues();
  var superRate = 0.12; // default 12%
  for (var i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0] === 'superannuation_rate') {
      superRate = Number(settingsData[i][1]) / 100;
      break;
    }
  }

  // Calculate income by contract (using contract-filtered entries)
  var contractIncome = {};
  var totalHours = 0;

  for (var i = 0; i < monthEntries.length; i++) {
    var entry = monthEntries[i];
    var hours = entry.duration_minutes / 60;
    totalHours += hours;

    // Calculate income (only for income-contributing hour types)
    var hourTypeId = entry.hour_type_id || 'work';
    var hourType = hourTypeMap[hourTypeId];
    var contributesToIncome = hourType ? hourType.contributes_to_income : true;

    if (contributesToIncome) {
      var contract = contractMap[entry.contract_id];
      if (contract) {
        var income = hours * contract.hourly_rate;
        if (!contractIncome[entry.contract_id]) {
          contractIncome[entry.contract_id] = 0;
        }
        contractIncome[entry.contract_id] += income;
      }
    }
  }

  // Track hour type hours across ALL entries (not filtered by contract)
  var hourTypeHours = {};
  for (var i = 0; i < allMonthEntries.length; i++) {
    var entry = allMonthEntries[i];
    var hourTypeId = entry.hour_type_id || 'work';
    if (!hourTypeHours[hourTypeId]) {
      hourTypeHours[hourTypeId] = 0;
    }
    hourTypeHours[hourTypeId] += entry.duration_minutes;
  }

  // Sum up gross income
  var grossIncome = 0;
  for (var cid in contractIncome) {
    grossIncome += contractIncome[cid];
  }

  // Get deductions for this month
  var deductionsData = deductionsSheet.getDataRange().getValues();
  var extraSuper = 0;
  var otherDeductions = 0;
  var companyExpenses = 0;
  var companyExpensesGst = 0;
  var categoryTotals = {};
  var categoryDeductionMap = {};

  var periodStart = new Date(year, month, 1);
  var periodEnd = new Date(year, month + 1, 0);

  for (var i = 1; i < deductionsData.length; i++) {
    var row = deductionsData[i];
    var active = row[13] === 'TRUE' || row[13] === true;
    if (!active) continue;

    var deductionId = row[0] ? String(row[0]) : '';
    var deductionName = row[1] ? String(row[1]) : '';
    var categoryId = row[2] ? String(row[2]) : '';
    var companyExpense = row[3] === 'TRUE' || row[3] === true;
    var deductionType = row[4];
    var amountType = row[5];
    var amountValue = Number(row[6]) || 0;
    var gstInclusive = row[7] === 'TRUE' || row[7] === true;
    var gstAmount = Number(row[8]) || 0;
    var frequency = row[9];
    var startDate = row[10] ? new Date(row[10]) : null;
    var endDate = row[11] && String(row[11]).trim() !== '' ? new Date(row[11]) : null;

    if (!startDate) continue;

    // Check if deduction applies to this month
    if (startDate > periodEnd) continue;
    if (endDate && endDate < periodStart) continue;

    // Calculate occurrences in month
    var occurrences = calculateDeductionOccurrences(frequency, startDate, endDate, periodStart, periodEnd);
    if (!occurrences) continue;

    var monthlyAmount = 0;
    if (amountType === 'percent') {
      monthlyAmount = grossIncome * amountValue * occurrences;
    } else {
      monthlyAmount = amountValue * occurrences;
    }

    if (deductionType === 'extra_super') {
      extraSuper += monthlyAmount;
      continue;
    }

    if (amountType === 'percent') {
      // Percentage-based standard deductions are not supported; skip for safety.
      continue;
    }

    var netAmount = monthlyAmount;
    if (companyExpense && gstInclusive) {
      netAmount = monthlyAmount / (1 + GST_RATE);
      companyExpensesGst += gstAmount * occurrences;
    }

    if (companyExpense) {
      companyExpenses += netAmount;
    } else {
      otherDeductions += netAmount;
    }

    if (Math.abs(netAmount) < 0.0000001) {
      continue;
    }

    var categoryKey = categoryId || '';
    if (!categoryTotals.hasOwnProperty(categoryKey)) {
      categoryTotals[categoryKey] = 0;
    }
    categoryTotals[categoryKey] += netAmount;

    if (!categoryDeductionMap[categoryKey]) {
      categoryDeductionMap[categoryKey] = {};
    }
    if (!categoryDeductionMap[categoryKey][deductionId]) {
      categoryDeductionMap[categoryKey][deductionId] = {
        deductionId: deductionId,
        name: deductionName,
        amount: 0,
        company_expense: companyExpense
      };
    }
    categoryDeductionMap[categoryKey][deductionId].amount += netAmount;
  }

  // Calculate super
  var superGuarantee = grossIncome * superRate;
  var superLost = otherDeductions * superRate;

  // Calculate company income and invoice total
  var companyIncome = grossIncome;
  var invoiceTotal = companyIncome * 1.1; // Add GST

  // Adjust gross income for employee (subtract company expenses)
  var employeeGrossIncome = companyIncome - companyExpenses;

  // Calculate taxable income
  var taxableIncome = employeeGrossIncome - superGuarantee - superLost - extraSuper - otherDeductions;

  // Estimate tax (using existing tax function)
  var tax = 0;
  if (taxableIncome > 0) {
    try {
      tax = estimateTax(employeeGrossIncome, periodStart.toISOString());
    } catch (e) {
      Logger.log('Tax estimation failed: ' + e.message);
      tax = 0;
    }
  }

  // Calculate net income
  var netIncome = Math.max(0, taxableIncome - tax);

  var categoryBreakdown = Object.keys(categoryTotals).map(function(key) {
    var total = Math.round(categoryTotals[key] * 100) / 100;
    var deductionList = [];
    var deductionMap = categoryDeductionMap[key] || {};
    Object.keys(deductionMap).forEach(function(dId) {
      var entry = deductionMap[dId];
      deductionList.push({
        deductionId: entry.deductionId,
        name: entry.name,
        amount: Math.round(entry.amount * 100) / 100,
        company_expense: entry.company_expense
      });
    });
    deductionList.sort(function(a, b) { return b.amount - a.amount; });
    return {
      categoryId: key,
      total: total,
      deductions: deductionList
    };
  });

  return {
    year: year,
    month: month,
    label: Utilities.formatDate(periodStart, Session.getScriptTimeZone(), 'MMM yyyy'),
    grossIncome: grossIncome,
    superGuarantee: superGuarantee,
    superLost: superLost,
    extraSuper: extraSuper,
    otherDeductions: otherDeductions,
    taxableIncome: taxableIncome,
    tax: tax,
    netIncome: netIncome,
    totalHours: totalHours,
    companyIncome: companyIncome,
    companyExpenses: companyExpenses,
    companyExpensesGst: companyExpensesGst,
    invoiceTotal: invoiceTotal,
    contractIncome: contractIncome,
    hourTypeHours: hourTypeHours,
    categoryBreakdown: {
      categories: categoryBreakdown
    }
  };
}

/**
 * Calculate deduction occurrences in a period
 */
function calculateDeductionOccurrences(frequency, startDate, endDate, periodStart, periodEnd) {
  if (!startDate) return 0;
  if (frequency === 'once') {
    return (startDate >= periodStart && startDate <= periodEnd) ? 1 : 0;
  }

  var current = new Date(startDate.getTime());
  var upperBound = endDate ? new Date(Math.min(endDate.getTime(), periodEnd.getTime())) : periodEnd;
  if (current > upperBound) return 0;

  while (current < periodStart) {
    current = advanceDateByFrequency(current, frequency);
    if (!current || current > upperBound) return 0;
  }

  var occurrences = 0;
  while (current && current >= periodStart && current <= upperBound) {
    occurrences++;
    current = advanceDateByFrequency(current, frequency);
  }

  return occurrences;
}

function advanceDateByFrequency(date, frequency) {
  var next = new Date(date.getTime());
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'fortnightly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return next;
}

/**
 * Get financial year months (Jul-Jun)
 */
function getFinancialYearMonths(startYear) {
  var FINANCIAL_YEAR_START_MONTH = 6; // July is month 6 (0-indexed)
  var months = [];
  for (var i = 0; i < 12; i++) {
    var monthIndex = (FINANCIAL_YEAR_START_MONTH + i) % 12;
    var yearOffset = Math.floor((FINANCIAL_YEAR_START_MONTH + i) / 12);
    months.push({ year: startYear + yearOffset, month: monthIndex });
  }
  return months;
}

/**
 * Get calendar year months (Jan-Dec)
 */
function getCalendarYearMonths(year) {
  var months = [];
  for (var m = 0; m < 12; m++) {
    months.push({ year: year, month: m });
  }
  return months;
}

/**
 * Helper to get financial year start year from a date
 */
function financialYearStartYear(date) {
  var year = date.getFullYear();
  var month = date.getMonth();
  // Financial year starts in July (month 6)
  if (month < 6) {
    return year - 1;
  }
  return year;
}
