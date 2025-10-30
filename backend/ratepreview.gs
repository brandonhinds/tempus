function roundToTwo(num) {
  if (!isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function roundToThree(num) {
  if (!isFinite(num)) return 0;
  return Math.round(num * 1000) / 1000;
}

function deriveGrossFromPackage(packageAmount, superRate) {
  var total = Number(packageAmount);
  if (!isFinite(total) || total <= 0) return 0;
  var rate = Number(superRate);
  if (!isFinite(rate) || rate < 0) {
    rate = 0;
  }
  if (rate === 0) return Math.max(0, total);
  var denominator = 1 + rate;
  if (!isFinite(denominator) || denominator <= 0) return Math.max(0, total);
  return total / denominator;
}

function parseIsoDateLoose(iso) {
  if (!iso || typeof iso !== 'string') return null;
  var parts = iso.split('-');
  if (parts.length !== 3) return null;
  var year = Number(parts[0]);
  var month = Number(parts[1]) - 1;
  var day = Number(parts[2]);
  if (!isFinite(year) || !isFinite(month) || !isFinite(day)) return null;
  var date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatMonthKey(date) {
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM');
}

function formatMonthLabel(key) {
  if (!key || key.length < 7) return key;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var parts = key.split('-');
  var monthIndex = Number(parts[1]) - 1;
  var year = parts[0];
  if (monthIndex < 0 || monthIndex > 11) return key;
  return months[monthIndex] + ' ' + year;
}

function safeNumber(value) {
  var num = Number(value);
  return isFinite(num) ? num : null;
}

function getSuperRateFromSettings() {
  var defaultRate = 0.12;
  try {
    var sh = getOrCreateSheet('user_settings');
    if (!sh) return defaultRate;
    var values = sh.getDataRange().getValues();
    if (!values || !values.length) return defaultRate;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === 'superannuation_rate') {
        var raw = Number(values[i][1]);
        if (isFinite(raw) && raw >= 0) {
          return raw / 100;
        }
      }
    }
  } catch (err) {
    Logger.log('Rate preview: failed to read super rate - ' + err);
  }
  return defaultRate;
}

function calculateMonthlyTax(grossIncome, isoDate) {
  grossIncome = Number(grossIncome) || 0;
  if (grossIncome <= 0) return 0;
  try {
    var tax = estimateTax(grossIncome, isoDate);
    return roundToTwo(tax);
  } catch (err) {
    Logger.log('Rate preview: tax estimation failed - ' + err);
    return 0;
  }
}

function computeScenarioRate(baseRate, payload) {
  var percentChange = safeNumber(payload && payload.percentChange);
  var requestedRate = safeNumber(payload && payload.newRate);
  var rate = baseRate;
  if (requestedRate != null && requestedRate >= 0) {
    rate = requestedRate;
  } else if (percentChange != null) {
    rate = baseRate * (1 + percentChange / 100);
  }
  if (rate < 0) rate = 0;
  return roundToTwo(rate);
}

function normalizePercentChange(baseRate, scenarioRate) {
  if (!isFinite(baseRate) || baseRate === 0) return null;
  var delta = scenarioRate - baseRate;
  return Math.round((delta / baseRate) * 10000) / 100;
}

function aggregateContractEntries(contract, entries) {
  var monthHours = {};
  var totalHours = 0;
  var earliest = null;
  var latest = null;
  var entryCount = 0;
  if (!entries || !entries.length) {
    return { monthHours: monthHours, totalHours: 0, earliest: null, latest: null, entryCount: 0 };
  }
  var start = contract && contract.start_date ? contract.start_date : '';
  var end = contract && contract.end_date ? contract.end_date : '';
  entries.forEach(function(entry) {
    if (!entry || entry.contract_id !== contract.id) return;
    var date = entry.date || '';
    if (!date) return;
    if (start && date < start) return;
    if (end && date > end) return;
    var hours = safeNumber(entry.duration_minutes);
    if (hours == null) hours = 0;
    hours = hours / 60;
    if (!isFinite(hours) || hours < 0) return;
    var key = date.substring(0, 7);
    if (!monthHours[key]) monthHours[key] = 0;
    monthHours[key] += hours;
    totalHours += hours;
    entryCount += 1;
    if (!earliest || date < earliest) earliest = date;
    if (!latest || date > latest) latest = date;
  });
  return {
    monthHours: monthHours,
    totalHours: totalHours,
    earliest: earliest,
    latest: latest,
    entryCount: entryCount
  };
}

function buildMonthRange(contract, earliest, latest) {
  var startIso = contract && contract.start_date ? contract.start_date : earliest;
  var endIso = contract && contract.end_date ? contract.end_date : latest;
  var startDate = parseIsoDateLoose(startIso);
  var endDate = parseIsoDateLoose(endIso);
  if (!startDate && endDate) {
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  }
  if (!endDate && startDate) {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  }
  if (!startDate && !endDate) {
    var today = new Date();
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }
  var startCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  var endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  if (startCursor > endCursor) {
    var tmp = startCursor;
    startCursor = endCursor;
    endCursor = tmp;
  }
  var months = [];
  var cursor = new Date(startCursor.getTime());
  while (cursor <= endCursor) {
    months.push(formatMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (!months.length) {
    months.push(formatMonthKey(startCursor));
  }
  return months;
}

function api_getContractRatePreview(payload) {
  var contractId = payload && payload.contractId ? String(payload.contractId).trim() : '';
  if (!contractId) {
    throw new Error('Contract id is required.');
  }
  var contracts = api_getContracts();
  var contract = null;
  for (var i = 0; i < contracts.length; i++) {
    if (contracts[i] && contracts[i].id === contractId) {
      contract = contracts[i];
      break;
    }
  }
  if (!contract) {
    throw new Error('Contract not found.');
  }
  var baseRate = roundToTwo(Number(contract.hourly_rate || 0));
  var scenarioRate = computeScenarioRate(baseRate, payload);
  var percentChange = normalizePercentChange(baseRate, scenarioRate);

  var entries = api_getEntries({});
  var aggregation = aggregateContractEntries(contract, entries);
  var totalHours = aggregation.totalHours || 0;
  var months = buildMonthRange(contract, aggregation.earliest, aggregation.latest);

  var monthlyBreakdown = [];
  var currentTotal = 0;
  var scenarioTotal = 0;
  var currentSuperTotal = 0;
  var scenarioSuperTotal = 0;
  var currentTaxTotal = 0;
  var scenarioTaxTotal = 0;
  var currentNetTotal = 0;
  var scenarioNetTotal = 0;
  months.forEach(function(monthKey) {
    var hours = aggregation.monthHours[monthKey] || 0;
    var roundedHours = roundToThree(hours);
    var currentPackage = roundToTwo(roundedHours * baseRate);
    var scenarioPackage = roundToTwo(roundedHours * scenarioRate);
    var monthIso = monthKey + '-01';
    // Get super rate for this specific month
    var superRate = getSuperGuaranteeRate(monthIso);
    var currentGrossRaw = deriveGrossFromPackage(currentPackage, superRate);
    var scenarioGrossRaw = deriveGrossFromPackage(scenarioPackage, superRate);
    var currentGross = roundToTwo(currentGrossRaw);
    var scenarioGross = roundToTwo(scenarioGrossRaw);
    var variance = roundToTwo(scenarioGross - currentGross);
    var variancePct = currentGross !== 0 ? Math.round((variance / currentGross) * 10000) / 100 : null;
    var currentSuper = roundToTwo(currentGross * superRate);
    var scenarioSuper = roundToTwo(scenarioGross * superRate);
    var currentTax = calculateMonthlyTax(currentGross, monthIso);
    var scenarioTax = calculateMonthlyTax(scenarioGross, monthIso);
    var currentNet = roundToTwo(Math.max(0, currentGross - currentTax));
    var scenarioNet = roundToTwo(Math.max(0, scenarioGross - scenarioTax));
    var superVariance = roundToTwo(scenarioSuper - currentSuper);
    var taxVariance = roundToTwo(scenarioTax - currentTax);
    var netVariance = roundToTwo(scenarioNet - currentNet);
    var superVariancePct = currentSuper !== 0 ? Math.round((superVariance / currentSuper) * 10000) / 100 : null;
    var taxVariancePct = currentTax !== 0 ? Math.round((taxVariance / currentTax) * 10000) / 100 : null;
    var netVariancePct = currentNet !== 0 ? Math.round((netVariance / currentNet) * 10000) / 100 : null;
    currentTotal += currentGross;
    scenarioTotal += scenarioGross;
    currentSuperTotal += currentSuper;
    scenarioSuperTotal += scenarioSuper;
    currentTaxTotal += currentTax;
    scenarioTaxTotal += scenarioTax;
    currentNetTotal += currentNet;
    scenarioNetTotal += scenarioNet;
    monthlyBreakdown.push({
      month: monthKey,
      label: formatMonthLabel(monthKey),
      hours: roundedHours,
      currentEarnings: currentGross,
      scenarioEarnings: scenarioGross,
      variance: variance,
      variancePercent: variancePct,
      currentSuper: currentSuper,
      scenarioSuper: scenarioSuper,
      superVariance: superVariance,
      superVariancePercent: superVariancePct,
      currentTax: currentTax,
      scenarioTax: scenarioTax,
      taxVariance: taxVariance,
      taxVariancePercent: taxVariancePct,
      currentNet: currentNet,
      scenarioNet: scenarioNet,
      netVariance: netVariance,
      netVariancePercent: netVariancePct
    });
  });

  var totalHoursRounded = roundToThree(totalHours);
  var currentTotalRounded = roundToTwo(currentTotal);
  var scenarioTotalRounded = roundToTwo(scenarioTotal);
  var totalVariance = roundToTwo(scenarioTotalRounded - currentTotalRounded);
  var totalVariancePct = currentTotalRounded !== 0
    ? Math.round((totalVariance / currentTotalRounded) * 10000) / 100
    : null;
  var currentSuperRounded = roundToTwo(currentSuperTotal);
  var scenarioSuperRounded = roundToTwo(scenarioSuperTotal);
  var superVarianceTotal = roundToTwo(scenarioSuperRounded - currentSuperRounded);
  var superVariancePctTotal = currentSuperRounded !== 0
    ? Math.round((superVarianceTotal / currentSuperRounded) * 10000) / 100
    : null;
  var currentTaxRounded = roundToTwo(currentTaxTotal);
  var scenarioTaxRounded = roundToTwo(scenarioTaxTotal);
  var taxVarianceTotal = roundToTwo(scenarioTaxRounded - currentTaxRounded);
  var taxVariancePctTotal = currentTaxRounded !== 0
    ? Math.round((taxVarianceTotal / currentTaxRounded) * 10000) / 100
    : null;
  var currentNetRounded = roundToTwo(currentNetTotal);
  var scenarioNetRounded = roundToTwo(scenarioNetTotal);
  var netVarianceTotal = roundToTwo(scenarioNetRounded - currentNetRounded);
  var netVariancePctTotal = currentNetRounded !== 0
    ? Math.round((netVarianceTotal / currentNetRounded) * 10000) / 100
    : null;

  var contractCap = safeNumber(contract.total_hours) || 0;
  if (contractCap < 0) contractCap = 0;
  var potentialHoursRounded = contractCap > 0 ? roundToThree(contractCap) : 0;
  var potentialPackageCurrent = null;
  var potentialPackageScenario = null;
  var potentialGrossCurrent = null;
  var potentialGrossScenario = null;
  var potentialGrossVariance = null;
  var potentialGrossVariancePct = null;
  var potentialSuperCurrent = null;
  var potentialSuperScenario = null;
  var potentialSuperVariance = null;
  var potentialSuperVariancePct = null;
  var potentialTaxCurrent = null;
  var potentialTaxScenario = null;
  var potentialTaxVariance = null;
  var potentialTaxVariancePct = null;
  var potentialNetCurrent = null;
  var potentialNetScenario = null;
  var potentialNetVariance = null;
  var potentialNetVariancePct = null;
  var todayIso = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');

  if (contractCap > 0) {
    // Get super rate for today for potential calculations
    var potentialSuperRate = getSuperGuaranteeRate(todayIso);
    potentialPackageCurrent = roundToTwo(contractCap * baseRate);
    potentialPackageScenario = roundToTwo(contractCap * scenarioRate);
    potentialGrossCurrent = roundToTwo(deriveGrossFromPackage(potentialPackageCurrent, potentialSuperRate));
    potentialGrossScenario = roundToTwo(deriveGrossFromPackage(potentialPackageScenario, potentialSuperRate));
    potentialGrossVariance = roundToTwo(potentialGrossScenario - potentialGrossCurrent);
    potentialGrossVariancePct = potentialGrossCurrent !== 0
      ? Math.round((potentialGrossVariance / potentialGrossCurrent) * 10000) / 100
      : null;

    potentialSuperCurrent = roundToTwo(potentialGrossCurrent * potentialSuperRate);
    potentialSuperScenario = roundToTwo(potentialGrossScenario * potentialSuperRate);
    potentialSuperVariance = roundToTwo(potentialSuperScenario - potentialSuperCurrent);
    potentialSuperVariancePct = potentialSuperCurrent !== 0
      ? Math.round((potentialSuperVariance / potentialSuperCurrent) * 10000) / 100
      : null;

    potentialTaxCurrent = calculateMonthlyTax(potentialGrossCurrent, todayIso);
    potentialTaxScenario = calculateMonthlyTax(potentialGrossScenario, todayIso);
    potentialTaxVariance = roundToTwo(potentialTaxScenario - potentialTaxCurrent);
    potentialTaxVariancePct = potentialTaxCurrent !== 0
      ? Math.round((potentialTaxVariance / potentialTaxCurrent) * 10000) / 100
      : null;

    potentialNetCurrent = roundToTwo(Math.max(0, potentialGrossCurrent - potentialTaxCurrent));
    potentialNetScenario = roundToTwo(Math.max(0, potentialGrossScenario - potentialTaxScenario));
    potentialNetVariance = roundToTwo(potentialNetScenario - potentialNetCurrent);
    potentialNetVariancePct = potentialNetCurrent !== 0
      ? Math.round((potentialNetVariance / potentialNetCurrent) * 10000) / 100
      : null;
  }

  return {
    contract: contract,
    inputs: {
      percentChange: safeNumber(payload && payload.percentChange),
      newRate: safeNumber(payload && payload.newRate)
    },
    current: {
      hourlyRate: baseRate,
      totalHours: totalHoursRounded,
      totalEarnings: currentTotalRounded,
      remainingHours: potentialHoursRounded,
      remainingEarnings: potentialGrossCurrent,
      super: currentSuperRounded,
      tax: currentTaxRounded,
      net: currentNetRounded,
      remainingSuper: potentialSuperCurrent,
      remainingTax: potentialTaxCurrent,
      remainingNet: potentialNetCurrent
    },
    scenario: {
      hourlyRate: scenarioRate,
      percentChange: percentChange,
      totalEarnings: scenarioTotalRounded,
      remainingEarnings: potentialGrossScenario,
      super: scenarioSuperRounded,
      tax: scenarioTaxRounded,
      net: scenarioNetRounded,
      remainingSuper: potentialSuperScenario,
      remainingTax: potentialTaxScenario,
      remainingNet: potentialNetScenario
    },
    variance: {
      hourlyRateDelta: roundToTwo(scenarioRate - baseRate),
      totalEarnings: totalVariance,
      totalEarningsPercent: totalVariancePct,
      remainingEarnings: potentialGrossVariance,
      remainingEarningsPercent: potentialGrossVariancePct,
      super: superVarianceTotal,
      superPercent: superVariancePctTotal,
      tax: taxVarianceTotal,
      taxPercent: taxVariancePctTotal,
      net: netVarianceTotal,
      netPercent: netVariancePctTotal,
      remainingSuper: potentialSuperVariance,
      remainingSuperPercent: potentialSuperVariancePct,
      remainingTax: potentialTaxVariance,
      remainingTaxPercent: potentialTaxVariancePct,
      remainingNet: potentialNetVariance,
      remainingNetPercent: potentialNetVariancePct
    },
    monthly: monthlyBreakdown,
    metadata: {
      baseRate: baseRate,
      entryCount: aggregation.entryCount,
      monthCount: months.length
    }
  };
}
