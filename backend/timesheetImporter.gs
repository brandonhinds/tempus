var TIMESHEET1_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
var TIMESHEET1_MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
var TIMESHEET1_IMPORT_TIME_BUDGET_MS = (5 * 60 * 1000) - 30000; // leave buffer under Apps Script 6 minute cap

function buildPunchesForDuration(durationMinutes) {
  var mins = Math.max(0, Math.round(Number(durationMinutes) || 0));
  if (!mins) return [];
  var capped = Math.min(mins, (24 * 60) - 1); // keep within a single day
  var hours = Math.floor(capped / 60);
  var minutesPart = capped % 60;
  var pad = function(n) { return (n < 10 ? '0' : '') + n; };
  var end = pad(hours) + ':' + pad(minutesPart);
  return [{ 'in': '00:00', out: end }];
}

function normalizeSheetDate(value) {
  if (!value && value !== 0) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    return value;
  }
  if (typeof value === 'number' && !isNaN(value)) {
    // Google Sheets serial date (days since 1899-12-30)
    var epoch = new Date(Date.UTC(1899, 11, 30));
    var millis = value * 24 * 60 * 60 * 1000;
    var date = new Date(epoch.getTime() + millis);
    if (!isNaN(date.getTime())) return date;
  }
  var str = String(value).trim();
  if (!str) return null;
  var match = str.match(TIMESHEET1_DATE_REGEX);
  if (match) {
    var day = Number(match[1]);
    var month = Number(match[2]);
    var yearPart = match[3];
    var year = Number(yearPart.length === 2 ? '20' + yearPart : yearPart);
    var dateObj = new Date(year, month - 1, day);
    if (!isNaN(dateObj.getTime())) return dateObj;
  }
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

function parseTimesheet1Sheets(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is required');
  }

  Logger.log('[Timesheet1] Opening spreadsheet %s', spreadsheetId);
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheets = ss.getSheets();
  var monthSheets = sheets.filter(function(sh) {
    var name = String(sh.getName() || '').trim().toLowerCase();
    return TIMESHEET1_MONTH_NAMES.indexOf(name) !== -1;
  });

  Logger.log('[Timesheet1] Found %s month sheets: %s', monthSheets.length, monthSheets.map(function(s) { return s.getName(); }).join(', '));
  var parsed = [];
  monthSheets.forEach(function(sh) {
    var values = sh.getDataRange().getValues();
    var sheetResult = parseTimesheet1SheetValues(values);
    sheetResult.sheetName = sh.getName();
    Logger.log('[Timesheet1] Sheet %s produced %s entries across %s hour type labels (%s)', sh.getName(), sheetResult.entries.length, sheetResult.hourTypeLabels.length, sheetResult.hourTypeLabels.join(', '));
    parsed.push(sheetResult);
  });

  return parsed;
}

function parseTimesheet1SheetValues(values) {
  var entries = [];
  var hourTypeLabels = {};
  Logger.log('[Timesheet1] Parsing sheet values with %s rows', values.length);

  for (var r = 0; r < values.length; r++) {
    var row = values[r] || [];
    var dateCells = [];
    for (var c = 0; c < row.length; c++) {
      // Dates only live in the Monday-Sunday columns (B-G range) on these sheets.
      if (c > 8) continue;
      var cell = row[c];
      var dateObj = normalizeSheetDate(cell);
      if (dateObj) {
        var year = dateObj.getFullYear();
        if (year < 2000 || year > 2100) continue; // avoid mis-parsing numeric amounts as dates
        var iso = Utilities.formatDate(dateObj, ENTRY_SHEET_TZ, 'yyyy-MM-dd');
        dateCells.push({ col: c, iso: iso });
      }
    }

    // Treat rows with at least one date as a date row; allow short rows for months starting on Sunday
    if (!dateCells.length) continue;
    Logger.log('[Timesheet1] Row %s has %s date cells at columns: %s', r + 1, dateCells.length, dateCells.map(function(d){ return d.col + 1; }).join(','));

    // Next four rows carry hour type labels and values
    for (var offset = 1; offset <= 4 && (r + offset) < values.length; offset++) {
      var hourRow = values[r + offset] || [];
      var label = hourRow[0];
      if (!label) continue;
      var normalizedLabel = String(label).trim();
      if (!normalizedLabel) continue;

      hourTypeLabels[normalizedLabel] = true;

      dateCells.forEach(function(dc) {
        var raw = hourRow[dc.col];
        if (raw === null || raw === undefined || raw === '') return;
        var num = Number(raw);
        if (isNaN(num)) return;
        if (num <= 0) return;
        entries.push({
          date: dc.iso,
          hours: num,
          hourTypeLabel: normalizedLabel
        });
      });
    }
  }

  var monthKey = '';
  if (entries.length) {
    var firstDate = entries[0].date;
    if (firstDate) {
      monthKey = firstDate.slice(0, 7);
    }
  }

  Logger.log('[Timesheet1] Finished parsing sheet: %s entries, monthKey=%s, hourTypeLabels=%s', entries.length, monthKey, Object.keys(hourTypeLabels).join(', '));
  return {
    month: monthKey,
    entries: entries,
    hourTypeLabels: Object.keys(hourTypeLabels)
  };
}

function normalizeHourTypeLabel(label) {
  if (!label) return '';
  return String(label).trim().toLowerCase();
}

function buildHourTypeMapping(foundLabels, hourTypes, providedMapping) {
  var mapping = {};
  var hourTypeByLabel = {};
  hourTypes.forEach(function(ht) {
    hourTypeByLabel[normalizeHourTypeLabel(ht.name)] = ht;
    hourTypeByLabel[normalizeHourTypeLabel(ht.slug)] = ht;
  });

  (foundLabels || []).forEach(function(label) {
    var key = normalizeHourTypeLabel(label);
    var providedId = providedMapping && providedMapping[label];
    var resolved = null;

    if (providedId) {
      resolved = hourTypes.find(function(ht) { return ht.id === providedId; }) || null;
    } else if (hourTypeByLabel[key]) {
      resolved = hourTypeByLabel[key];
    }

    mapping[label] = {
      label: label,
      hour_type_id: resolved ? resolved.id : '',
      status: resolved ? 'matched' : 'unmapped'
    };
  });

  return mapping;
}

function contractIsValidForDate(contract, isoDate) {
  if (!contract || !isoDate) return false;
  var start = contract.start_date || '';
  var end = contract.end_date || '';
  if (!start) return false;
  if (isoDate < start) return false;
  if (end && isoDate > end) return false;
  return true;
}

function contractsCoveringAllDates(contracts, dates) {
  if (!Array.isArray(dates) || !dates.length) return [];
  return (contracts || []).filter(function(contract) {
    return dates.every(function(dateIso) { return contractIsValidForDate(contract, dateIso); });
  });
}

function buildImportWorkItemsFromPreview(preview, contractSelections, hourTypeMap) {
  var selections = contractSelections || {};
  var work = [];
  (preview.months || []).forEach(function(month) {
    (month.entries || []).forEach(function(entry) {
      var hourTypeId = entry.hourTypeId;
      var hourType = hourTypeMap[hourTypeId];
      var contractId = '';
      if (hourType && hourType.requires_contract) {
        var selectionKey = month.month + '|' + hourTypeId;
        contractId = selections[selectionKey] || '';
      }
      work.push({
        month: month.month,
        sheetName: month.sheetName || '',
        date: entry.date,
        hourTypeId: hourTypeId,
        hourTypeName: hourType ? hourType.name : hourTypeId,
        contractId: contractId,
        durationMinutes: Math.round(Number(entry.hours || 0) * 60)
      });
    });
  });
  return work;
}

function mergeImportSummaryMap(map, workItem) {
  var key = (workItem.month || '') + '|' + workItem.hourTypeId;
  if (!map[key]) {
    map[key] = {
      hourTypeId: workItem.hourTypeId,
      hourTypeName: workItem.hourTypeName,
      entries: 0,
      minutes: 0,
      month: workItem.month || '',
      sheetName: workItem.sheetName || ''
    };
  }
  map[key].entries += 1;
  map[key].minutes += workItem.durationMinutes;
}

function buildTimesheet1Preview(payload, dryRun) {
  var spreadsheetId = payload && payload.spreadsheetId;
  if (!spreadsheetId) throw new Error('Spreadsheet ID is required');

  Logger.log('[Timesheet1] Preview start (dryRun=%s) spreadsheet=%s', !!dryRun, spreadsheetId);
  var skipPublicHolidays = !!(payload && payload.skipPublicHolidays);
  var hourTypes = api_getHourTypes();
  var hourTypeMap = {};
  hourTypes.forEach(function(ht) { hourTypeMap[ht.id] = ht; });

  var contracts = api_getContracts();
  var contractMap = {};
  contracts.forEach(function(c) { contractMap[c.id] = c; });

  var parsedSheets = parseTimesheet1Sheets(spreadsheetId);
  var allHourTypeLabels = {};
  parsedSheets.forEach(function(sheetResult) {
    (sheetResult.hourTypeLabels || []).forEach(function(label) {
      allHourTypeLabels[label] = true;
    });
  });
  var foundLabels = Object.keys(allHourTypeLabels);

  var mapping = buildHourTypeMapping(foundLabels, hourTypes, payload && payload.hourTypeMapping);

  var existingEntries = api_getEntries({});
  var existingIndex = existingEntries.reduce(function(acc, entry) {
    var hourTypeId = entry.hour_type_id || getDefaultHourTypeId();
    var contractId = entry.contract_id || '';
    var key = entry.date + '|' + hourTypeId + '|' + contractId;
    acc[key] = true;
    return acc;
  }, {});

  var monthSummaries = [];
  var totalImportable = 0;
  var totalDuplicates = 0;
  var totalUnmapped = 0;
  var contractIssues = [];
  var totalSkippedHolidays = 0;

  var holidayDateSet = {};
  if (skipPublicHolidays) {
    var yearsToFetch = {};
    parsedSheets.forEach(function(sheetResult) {
      (sheetResult.entries || []).forEach(function(entry) {
        if (entry.date && entry.date.length >= 4) {
          var year = entry.date.substring(0, 4);
          yearsToFetch[year] = true;
        }
      });
    });
    Object.keys(yearsToFetch).forEach(function(yearStr) {
      var yearNum = parseInt(yearStr, 10);
      if (!isNaN(yearNum)) {
        var holidays = api_getPublicHolidays({ year: yearNum }) || [];
        holidays.forEach(function(h) {
          if (h && h.date) holidayDateSet[h.date] = true;
        });
      }
    });
    Logger.log('[Timesheet1] Loaded public holidays for years %s; total dates=%s', Object.keys(yearsToFetch).join(','), Object.keys(holidayDateSet).length);
  }

  parsedSheets.forEach(function(sheetResult) {
    var monthEntries = sheetResult.entries || [];
    var monthKey = sheetResult.month || '';
    var byHourType = {};
    var duplicateExamples = [];
    var unmapped = [];
    var missingContracts = [];
    var needsSelection = [];
    var resolvedEntries = [];

    var entriesByHourType = {};
    monthEntries.forEach(function(entry) {
      if (skipPublicHolidays && holidayDateSet[entry.date]) {
        totalSkippedHolidays += 1;
        return;
      }
      var mapInfo = mapping[entry.hourTypeLabel] || { hour_type_id: '' };
      var hourTypeId = mapInfo.hour_type_id || '';
      if (!hourTypeId) {
        totalUnmapped += 1;
        unmapped.push({ label: entry.hourTypeLabel, date: entry.date, hours: entry.hours });
        return;
      }

      resolvedEntries.push({
        date: entry.date,
        hours: entry.hours,
        hourTypeId: hourTypeId,
        hourTypeLabel: entry.hourTypeLabel
      });

      if (!entriesByHourType[hourTypeId]) entriesByHourType[hourTypeId] = [];
      entriesByHourType[hourTypeId].push(entry);
    });

    Object.keys(entriesByHourType).forEach(function(hourTypeId) {
      var hourType = hourTypeMap[hourTypeId];
      var label = hourType ? hourType.name : hourTypeId;
      var list = entriesByHourType[hourTypeId];
      var dates = list.map(function(e) { return e.date; });
      var totalMinutes = list.reduce(function(acc, e) { return acc + Math.round(Number(e.hours || 0) * 60); }, 0);

      var keyCount = 0;
      list.forEach(function(e) {
        var contractId = '';
        if (hourType && hourType.requires_contract) {
          var selectionKey = monthKey + '|' + hourTypeId;
          contractId = (payload && payload.contractSelections && payload.contractSelections[selectionKey]) || '';
        }
        var key = e.date + '|' + hourTypeId + '|' + contractId;
        if (existingIndex[key]) {
          totalDuplicates += 1;
          duplicateExamples.push({ date: e.date, hourTypeId: hourTypeId, hourTypeName: label });
          return;
        }
        keyCount += 1;
      });

      byHourType[hourTypeId] = {
        hourTypeId: hourTypeId,
        hourTypeName: label,
        entries: keyCount,
        minutes: totalMinutes
      };

      // Contract checks
      if (hourType && hourType.requires_contract) {
        var covering = contractsCoveringAllDates(contracts, dates);
        if (!covering.length) {
          missingContracts.push({ hourTypeId: hourTypeId, hourTypeName: label, dates: dates });
        } else {
          var selectionKey = monthKey + '|' + hourTypeId;
          var selectedId = payload && payload.contractSelections ? payload.contractSelections[selectionKey] : '';
          var selected = selectedId ? covering.find(function(c) { return c.id === selectedId; }) : null;
          if (!selected) {
            needsSelection.push({
              hourTypeId: hourTypeId,
              hourTypeName: label,
              selectionKey: selectionKey,
              options: covering.map(function(c) {
                return {
                  id: c.id,
                  name: c.name,
                  start_date: c.start_date,
                  end_date: c.end_date
                };
              })
            });
          }
        }
      }
    });

    var importableCount = Object.keys(byHourType).reduce(function(acc, key) {
      return acc + (byHourType[key].entries || 0);
    }, 0);

    totalImportable += importableCount;
    if (missingContracts.length) contractIssues = contractIssues.concat(missingContracts);

    Logger.log('[Timesheet1] Month %s (sheet %s): entries=%s importable=%s duplicates=%s unmapped=%s missingContracts=%s needsSelection=%s', monthKey || sheetResult.sheetName, sheetResult.sheetName || '', monthEntries.length, importableCount, duplicateExamples.length, unmapped.length, missingContracts.length, needsSelection.length);
    monthSummaries.push({
      sheetName: sheetResult.sheetName || '',
      month: monthKey,
      totalsByHourType: Object.keys(byHourType).map(function(key) { return byHourType[key]; }),
      duplicateExamples: duplicateExamples,
      unmapped: unmapped,
      missingContracts: missingContracts,
      needsContractSelection: needsSelection,
      entries: resolvedEntries
    });
  });

  return {
    success: true,
    dryRun: !!dryRun,
    spreadsheetId: spreadsheetId,
    skipPublicHolidays: skipPublicHolidays,
    mapping: mapping,
    months: monthSummaries,
    totals: {
      importable: totalImportable,
      duplicates: totalDuplicates,
      unmapped: totalUnmapped,
      skippedPublicHolidays: totalSkippedHolidays
    },
    contractIssues: contractIssues
  };
}

function api_previewTimesheet1Import(payload) {
  try {
    Logger.log('[Timesheet1] api_previewTimesheet1Import payload mapping keys=%s contractSelection keys=%s skipHolidays=%s', Object.keys(payload && payload.hourTypeMapping || {}).length, Object.keys(payload && payload.contractSelections || {}).length, payload && payload.skipPublicHolidays);
    return buildTimesheet1Preview(payload || {}, true);
  } catch (e) {
    Logger.log('[Timesheet1] Preview error: %s', e && e.message ? e.message : e);
    return { success: false, error: 'preview_failed', message: e && e.message ? e.message : 'Preview failed' };
  }
}

function api_runTimesheet1Import(payload) {
  var start = Date.now();
  var hourTypeMap = {};
  api_getHourTypes().forEach(function(ht) { hourTypeMap[ht.id] = ht; });

  var spreadsheetId = payload && payload.spreadsheetId;
  var skipPublicHolidays = !!(payload && payload.skipPublicHolidays);
  var contractSelections = (payload && payload.contractSelections) || {};
  var mapping = (payload && payload.hourTypeMapping) || {};
  var continuation = payload && payload.continuation;
  var preview = null;
  var workItems = [];
  var progress = {
    imported: 0,
    skippedDuplicates: 0,
    importSummary: {}
  };

  if (continuation) {
    Logger.log('[Timesheet1] Import continuation received with %s work items', (continuation.workItems || []).length);
    workItems = continuation.workItems || [];
    contractSelections = continuation.contractSelections || contractSelections;
    mapping = continuation.hourTypeMapping || mapping;
    spreadsheetId = continuation.spreadsheetId || spreadsheetId;
    skipPublicHolidays = continuation.skipPublicHolidays != null ? !!continuation.skipPublicHolidays : skipPublicHolidays;
    if (continuation.progress) {
      progress.imported = continuation.progress.imported || 0;
      progress.skippedDuplicates = continuation.progress.skippedDuplicates || 0;
      progress.importSummary = continuation.progress.importSummary || {};
    }
    preview = continuation.preview || payload.preview || null;
  } else {
    var providedPreview = payload && payload.preview;
    var canReusePreview = providedPreview && providedPreview.success && providedPreview.spreadsheetId === spreadsheetId && providedPreview.skipPublicHolidays === skipPublicHolidays;
    try {
      preview = canReusePreview ? providedPreview : buildTimesheet1Preview(payload || {}, false);
      if (preview) {
        preview.dryRun = false;
        preview.success = true;
      }
    } catch (e) {
      Logger.log('[Timesheet1] Import preview error: %s', e && e.message ? e.message : e);
      return { success: false, error: 'preview_failed', message: e && e.message ? e.message : 'Import preview failed' };
    }

    // Abort if there are unmapped hour types or missing contract selections
    var blockingMissing = [];
    var blockingUnmapped = [];

    (preview.months || []).forEach(function(month) {
      if (month.unmapped && month.unmapped.length) {
        blockingUnmapped = blockingUnmapped.concat(month.unmapped);
      }
      if (month.missingContracts && month.missingContracts.length) {
        blockingMissing = blockingMissing.concat(month.missingContracts);
      }
      if (month.needsContractSelection && month.needsContractSelection.length) {
        blockingMissing = blockingMissing.concat(month.needsContractSelection);
      }
    });

    if (blockingUnmapped.length) {
      return {
        success: false,
        error: 'unmapped_hour_types',
        details: blockingUnmapped
      };
    }
    if (blockingMissing.length) {
      return {
        success: false,
        error: 'missing_contract_selection',
        details: blockingMissing
      };
    }

    workItems = buildImportWorkItemsFromPreview(preview, contractSelections, hourTypeMap);
  }

  var existingEntries = api_getEntries({});
  var existingIndex = existingEntries.reduce(function(acc, entry) {
    var hourTypeId = entry.hour_type_id || getDefaultHourTypeId();
    var contractId = entry.contract_id || '';
    var key = entry.date + '|' + hourTypeId + '|' + contractId;
    acc[key] = true;
    return acc;
  }, {});

  var batchEntries = [];
  var remaining = [];
  for (var i = 0; i < workItems.length; i++) {
    if ((Date.now() - start) > TIMESHEET1_IMPORT_TIME_BUDGET_MS) {
      remaining = workItems.slice(i);
      break;
    }
    var item = workItems[i];
    var key = item.date + '|' + item.hourTypeId + '|' + (item.contractId || '');
    if (existingIndex[key]) {
      progress.skippedDuplicates += 1;
      continue;
    }
    existingIndex[key] = true;
    batchEntries.push({
      date: item.date,
      duration_minutes: item.durationMinutes,
      contract_id: item.contractId || '',
      hour_type_id: item.hourTypeId,
      entry_type: 'basic',
      punches: buildPunchesForDuration(item.durationMinutes)
    });
    mergeImportSummaryMap(progress.importSummary, item);
  }

  if (batchEntries.length) {
    var bulkRes = api_addEntriesBulk({ entries: batchEntries });
    progress.imported += bulkRes && bulkRes.added ? bulkRes.added : 0;
    progress.skippedDuplicates += bulkRes && bulkRes.duplicates ? bulkRes.duplicates : 0;
  }

  var response = {
    success: true,
    imported: progress.imported,
    skippedDuplicates: progress.skippedDuplicates,
    importSummary: Object.keys(progress.importSummary).map(function(key) { return progress.importSummary[key]; }),
    preview: preview
  };

  if (remaining.length) {
    response.partial = true;
    response.continuation = {
      spreadsheetId: spreadsheetId,
      skipPublicHolidays: skipPublicHolidays,
      workItems: remaining,
      contractSelections: contractSelections,
      hourTypeMapping: mapping,
      progress: progress,
      preview: preview
    };
  } else {
    Logger.log('[Timesheet1] Import finished: imported=%s skippedDuplicates=%s', progress.imported, progress.skippedDuplicates);
    if (preview) {
      preview.imported = progress.imported;
      preview.skippedDuplicates = progress.skippedDuplicates;
      preview.importSummary = response.importSummary;
      preview.success = true;
      preview.dryRun = false;
    }
  }

  return response;
}
