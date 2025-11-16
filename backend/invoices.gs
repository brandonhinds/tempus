/** Invoices API */
var INVOICE_SHEET_NAME = 'invoices';
var INVOICE_LINE_ITEM_SHEET_NAME = 'invoice_line_items';
var INVOICE_CACHE_PREFIX = 'invoices_v1_';
var INVOICE_DEFAULT_CACHE_KEY = 'invoice_defaults_v1';
var INVOICE_LINE_ITEM_HEADERS = [
  'id',
  'invoice_id',
  'is_default',
  'default_label',
  'position',
  'line_date',
  'description',
  'hours',
  'hour_type_id',
  'hour_type_name_snapshot',
  'amount',
  'amount_mode',
  'contract_id',
  'contract_name_snapshot',
  'timesheet_entry_id',
  'entry_snapshot_json',
  'last_synced_at',
  'source_default_id',
  'created_at',
  'updated_at'
];
var INVOICE_SHEET_TZ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
var INVOICE_HOUR_TYPE_LOOKUP_CACHE = 'invoice_hour_type_lookup';
var INVOICE_CONTRACT_LOOKUP_CACHE = 'invoice_contract_lookup';
var INVOICE_GST_RATE = 0.1;

function invoiceParseBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === null || value === undefined) return false;
  var str = String(value).trim().toLowerCase();
  return str === 'true' || str === '1' || str === 'yes' || str === 'y';
}

function invoiceParseNumber(value, defaultValue) {
  if (value === null || value === undefined || value === '') {
    return defaultValue === undefined ? 0 : defaultValue;
  }
  var num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue === undefined ? 0 : defaultValue;
  }
  return num;
}

function invoiceToIsoDate(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, INVOICE_SHEET_TZ, 'yyyy-MM-dd');
  }
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (trimmed === '') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    var parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, INVOICE_SHEET_TZ, 'yyyy-MM-dd');
    }
    return '';
  }
  var asDate = new Date(value);
  if (!isNaN(asDate.getTime())) {
    return Utilities.formatDate(asDate, INVOICE_SHEET_TZ, 'yyyy-MM-dd');
  }
  return '';
}

function invoiceToIsoDateTime(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  }
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (trimmed === '') return '';
    var parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
    }
    return '';
  }
  var asDate = new Date(value);
  if (!isNaN(asDate.getTime())) {
    return Utilities.formatDate(asDate, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  }
  return '';
}

function getInvoiceSheet() {
  return getOrCreateSheet(INVOICE_SHEET_NAME);
}

function ensureInvoiceLineItemSchema(sh) {
  ensureInvoiceLineItemSchemaInternal(sh, false);
}

function ensureInvoiceLineItemSchemaInternal(sh, attemptedRepair) {
  if (!sh) return;

  var expectedHeaders = INVOICE_LINE_ITEM_HEADERS;
  var expectedColumnCount = expectedHeaders.length;

  function resetHeaders() {
    var maxColumns = sh.getMaxColumns();
    if (maxColumns < expectedColumnCount) {
      sh.insertColumnsAfter(maxColumns, expectedColumnCount - maxColumns);
    } else if (maxColumns > expectedColumnCount) {
      sh.deleteColumns(expectedColumnCount + 1, maxColumns - expectedColumnCount);
    }
    sh.getRange(1, 1, 1, expectedColumnCount).setValues([expectedHeaders]);
  }

  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    resetHeaders();
    return;
  }

  var headerRange = sh.getRange(1, 1, 1, lastColumn);
  var headers = headerRange.getValues()[0];
  var normalizedHeaders = headers.map(function(value) {
    return String(value || '').trim();
  });
  Logger.log('[Invoice Schema] Current headers: ' + JSON.stringify(normalizedHeaders));
  var headerOrderMatches = expectedHeaders.every(function(name, idx) {
    return normalizedHeaders[idx] === name;
  });
  var hasHeaderContent = normalizedHeaders.some(function(value) { return value !== ''; });

  if (!hasHeaderContent) {
    resetHeaders();
    return;
  }

  var hasDataRows = lastRow > 1;
  var amountIndex = normalizedHeaders.indexOf('amount');
  var amountModeIndex = normalizedHeaders.indexOf('amount_mode');

  if (amountIndex === -1 && amountModeIndex !== -1) {
    sh.insertColumnBefore(amountModeIndex + 1);
    amountIndex = amountModeIndex;
    amountModeIndex = amountModeIndex + 1;
    sh.getRange(1, amountIndex + 1).setValue('amount');
    var dataRowsToFill = sh.getLastRow() - 1;
    if (dataRowsToFill > 0) {
      var zeroRows = [];
      for (var z = 0; z < dataRowsToFill; z++) {
        zeroRows.push([0]);
      }
      sh.getRange(2, amountIndex + 1, dataRowsToFill, 1).setValues(zeroRows);
    }
    headerRange = sh.getRange(1, 1, 1, sh.getLastColumn());
    headers = headerRange.getValues()[0];
    normalizedHeaders = headers.map(function(value) {
      return String(value || '').trim();
    });
  }

  if (amountIndex !== -1 && amountModeIndex === -1) {
    var insertPosition = amountIndex + 1; // 1-based column for amount
    sh.insertColumnAfter(insertPosition);
    var amountModeColumn = insertPosition + 1;
    sh.getRange(1, amountModeColumn).setValue('amount_mode');
    var dataRows = sh.getLastRow() - 1;
    if (dataRows > 0) {
      var defaultValues = [];
      for (var i = 0; i < dataRows; i++) {
        defaultValues.push(['hours']);
      }
      sh.getRange(2, amountModeColumn, dataRows, 1).setValues(defaultValues);
    }
    headerRange = sh.getRange(1, 1, 1, sh.getLastColumn());
    headers = headerRange.getValues()[0];
    normalizedHeaders = headers.map(function(value) {
      return String(value || '').trim();
    });
  }

  var headerSet = {};
  var hasDuplicates = false;
  normalizedHeaders.forEach(function(header) {
    if (!header) return;
    if (headerSet[header]) {
      hasDuplicates = true;
    } else {
      headerSet[header] = true;
    }
  });
  var missingHeaders = expectedHeaders.filter(function(header) {
    return normalizedHeaders.indexOf(header) === -1;
  });

  var hasExtraColumns = lastColumn > expectedColumnCount;

  if ((missingHeaders.length || hasDuplicates || hasExtraColumns) && !hasDataRows) {
    resetHeaders();
    return;
  }

  if (missingHeaders.length || hasDuplicates || hasExtraColumns || (!headerOrderMatches && hasDataRows)) {
    if (!attemptedRepair && hasDataRows) {
      rebuildInvoiceLineItemSheet(sh, expectedHeaders, normalizedHeaders);
      ensureInvoiceLineItemSchemaInternal(sh, true);
      return;
    }
    throw new Error('SCHEMA ERROR: invoice_line_items sheet is corrupted. Please delete the sheet and refresh the page to recreate it with the correct schema.');
  }
}

function rebuildInvoiceLineItemSheet(sh, expectedHeaders, normalizedHeaders) {
  var values = sh.getDataRange().getValues();
  var expectedColumnCount = expectedHeaders.length;
  if (!values.length) {
    ensureInvoiceLineItemSheetCapacity(sh, 1, expectedColumnCount);
    sh.clearContents();
    sh.getRange(1, 1, 1, expectedColumnCount).setValues([expectedHeaders]);
    return;
  }

  var headerMap = {};
  for (var i = 0; i < normalizedHeaders.length; i++) {
    var key = normalizedHeaders[i];
    if (!key) continue;
    if (headerMap.hasOwnProperty(key)) continue;
    headerMap[key] = i;
  }

  var rebuilt = [];
  rebuilt.push(expectedHeaders);
  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    var row = values[rowIndex];
    var newRow = expectedHeaders.map(function(header) {
      var sourceIdx = headerMap.hasOwnProperty(header) ? headerMap[header] : -1;
      if (sourceIdx === -1) {
        return header === 'amount_mode' ? 'hours' : '';
      }
      var value = row[sourceIdx];
      if (value === null || value === undefined || value === '') {
        return header === 'amount_mode' ? 'hours' : '';
      }
      return value;
    });
    rebuilt.push(newRow);
  }

  ensureInvoiceLineItemSheetCapacity(sh, rebuilt.length, expectedColumnCount);
  var currentMaxColumns = sh.getMaxColumns();
  if (currentMaxColumns > expectedColumnCount) {
    sh.deleteColumns(expectedColumnCount + 1, currentMaxColumns - expectedColumnCount);
  }
  sh.clearContents();
  sh.getRange(1, 1, rebuilt.length, expectedColumnCount).setValues(rebuilt);
}

function ensureInvoiceLineItemSheetCapacity(sh, minRows, minColumns) {
  var currentRows = sh.getMaxRows();
  if (currentRows < minRows) {
    sh.insertRowsAfter(currentRows, minRows - currentRows);
  }
  var currentColumns = sh.getMaxColumns();
  if (currentColumns < minColumns) {
    sh.insertColumnsAfter(currentColumns, minColumns - currentColumns);
  }
}

function getInvoiceLineItemSheet() {
  var sh = getOrCreateSheet(INVOICE_LINE_ITEM_SHEET_NAME);
  ensureInvoiceLineItemSchema(sh);
  return sh;
}

function normalizeInvoiceRow(headers, row) {
  if (!headers || !row) return {};
  function cell(header) {
    var idx = headers.indexOf(header);
    return idx === -1 ? '' : row[idx];
  }
  return {
    id: cell('id'),
    year: invoiceParseNumber(cell('year')),
    month: invoiceParseNumber(cell('month')),
    sequence: invoiceParseNumber(cell('sequence')),
    invoice_number: cell('invoice_number') || '',
    invoice_date: invoiceToIsoDate(cell('invoice_date')),
    status: cell('status') || 'draft',
    generated_doc_id: cell('generated_doc_id') || '',
    generated_doc_url: cell('generated_doc_url') || '',
    generated_at: invoiceToIsoDateTime(cell('generated_at')),
    template_doc_id: cell('template_doc_id') || '',
    template_doc_path: cell('template_doc_path') || '',
    output_folder_id: cell('output_folder_id') || '',
    output_folder_path: cell('output_folder_path') || '',
    notes: cell('notes') || '',
    created_at: invoiceToIsoDateTime(cell('created_at')),
    updated_at: invoiceToIsoDateTime(cell('updated_at'))
  };
}

function normalizeLineItemRow(headers, row) {
  if (!headers || !row) return {};
  function cell(header) {
    var idx = headers.indexOf(header);
    return idx === -1 ? '' : row[idx];
  }
  var hours = invoiceParseNumber(cell('hours'), 0);
  var amount = invoiceParseNumber(cell('amount'), 0);
  return {
    id: cell('id'),
    invoice_id: cell('invoice_id') || '',
    is_default: invoiceParseBoolean(cell('is_default')),
    default_label: cell('default_label') || '',
    position: invoiceParseNumber(cell('position')),
    line_date: invoiceToIsoDate(cell('line_date')),
    description: cell('description') || '',
    hours: hours,
    hour_type_id: cell('hour_type_id') || '',
    hour_type_name_snapshot: cell('hour_type_name_snapshot') || '',
    amount: amount,
    amount_mode: cell('amount_mode') || 'hours',
    contract_id: cell('contract_id') || '',
    contract_name_snapshot: cell('contract_name_snapshot') || '',
    timesheet_entry_id: cell('timesheet_entry_id') || '',
    entry_snapshot_json: cell('entry_snapshot_json') || '',
    last_synced_at: invoiceToIsoDateTime(cell('last_synced_at')),
    source_default_id: cell('source_default_id') || '',
    created_at: invoiceToIsoDateTime(cell('created_at')),
    updated_at: invoiceToIsoDateTime(cell('updated_at'))
  };
}

function loadInvoicesRaw() {
  var sh = getInvoiceSheet();
  var values = sh.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  return { headers: values[0], rows: values.slice(1) };
}

function loadInvoiceLineItemsRaw() {
  var sh = getInvoiceLineItemSheet();
  var values = sh.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  return { headers: values[0], rows: values.slice(1) };
}

function listInvoicesInternal() {
  var cacheKey = INVOICE_CACHE_PREFIX + 'all';
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var raw = loadInvoicesRaw();
  var normalized = raw.rows.map(function(row) {
    return normalizeInvoiceRow(raw.headers, row);
  }).filter(function(inv) { return inv.id; });
  cacheSet(cacheKey, normalized);
  return normalized;
}

function listInvoiceLineItemsInternal() {
  var cacheKey = INVOICE_CACHE_PREFIX + 'line_items';
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var raw = loadInvoiceLineItemsRaw();
  var normalized = raw.rows.map(function(row) {
    return normalizeLineItemRow(raw.headers, row);
  }).filter(function(item) { return item.id; });
  cacheSet(cacheKey, normalized);
  return normalized;
}

function findLineItemById(id) {
  if (!id) return null;
  var items = listInvoiceLineItemsInternal();
  for (var i = 0; i < items.length; i++) {
    if (items[i].id === id) {
      return items[i];
    }
  }
  return null;
}

function findInvoiceById(id) {
  if (!id) return null;
  var invoices = listInvoicesInternal();
  for (var i = 0; i < invoices.length; i++) {
    if (invoices[i].id === id) {
      return invoices[i];
    }
  }
  return null;
}

function listInvoiceLineItemsByInvoiceId(invoiceId) {
  if (!invoiceId) return [];
  var items = listInvoiceLineItemsInternal();
  return items.filter(function(item) {
    return !item.is_default && item.invoice_id === invoiceId;
  }).sort(function(a, b) {
    if (a.position === b.position) {
      return String(a.created_at).localeCompare(String(b.created_at));
    }
    return a.position - b.position;
  });
}

function listDefaultInvoiceLineItems() {
  var cacheKey = INVOICE_DEFAULT_CACHE_KEY;
  var cached = cacheGet(cacheKey);
  if (cached) return cached;
  var items = listInvoiceLineItemsInternal().filter(function(item) {
    return item.is_default;
  }).sort(function(a, b) {
    if (a.position === b.position) {
      return String(a.default_label).localeCompare(String(b.default_label));
    }
    return a.position - b.position;
  });
  cacheSet(cacheKey, items);
  return items;
}

function summarizeInvoiceLineItems(items) {
  var totals = {
    totalAmount: 0,
    totalHours: 0,
    lineCount: items.length,
    gstAmount: 0,
    totalWithGst: 0
  };
  for (var i = 0; i < items.length; i++) {
    totals.totalAmount += invoiceParseNumber(items[i].amount, 0);
    totals.totalHours += invoiceParseNumber(items[i].hours, 0);
  }
  totals.totalAmount = Math.round(totals.totalAmount * 100) / 100;
  totals.totalHours = Math.round(totals.totalHours * 10000) / 10000;
  totals.gstAmount = Math.round(totals.totalAmount * INVOICE_GST_RATE * 100) / 100;
  totals.totalWithGst = Math.round((totals.totalAmount + totals.gstAmount) * 100) / 100;
  return totals;
}

function clearInvoiceCaches() {
  cacheClearPrefix(INVOICE_CACHE_PREFIX);
  cacheClearPrefix(INVOICE_DEFAULT_CACHE_KEY);
}

function api_clearInvoiceCaches() {
  clearInvoiceCaches();
  return { success: true };
}

function api_listInvoices(filters) {
  var includeSummary = filters && invoiceParseBoolean(filters.include_summary);
  var invoices = listInvoicesInternal();
  if (filters && filters.year) {
    var yearNum = invoiceParseNumber(filters.year);
    invoices = invoices.filter(function(inv) { return inv.year === yearNum; });
  }
  if (filters && filters.month) {
    var monthNum = invoiceParseNumber(filters.month);
    invoices = invoices.filter(function(inv) { return inv.month === monthNum; });
  }
  invoices.sort(function(a, b) {
    if (a.year === b.year) {
      if (a.month === b.month) {
        return a.sequence - b.sequence;
      }
      return a.month - b.month;
    }
    return a.year - b.year;
  });

  function cloneInvoice(inv) {
    var copy = {};
    for (var key in inv) {
      if (Object.prototype.hasOwnProperty.call(inv, key)) {
        copy[key] = inv[key];
      }
    }
    return copy;
  }

  var cloned = invoices.map(cloneInvoice);

  if (includeSummary) {
    var allItems = listInvoiceLineItemsInternal().filter(function(item) {
      return item && item.invoice_id && !item.is_default;
    });
    var grouped = allItems.reduce(function(acc, item) {
      var invoiceId = item.invoice_id;
      if (!acc[invoiceId]) acc[invoiceId] = [];
      acc[invoiceId].push(item);
      return acc;
    }, {});
    cloned.forEach(function(inv) {
      var items = grouped[inv.id] || [];
      inv.summary = summarizeInvoiceLineItems(items);
    });
  }

  return cloned;
}

function api_getInvoice(id) {
  if (!id) throw new Error('Invoice id is required');
  var invoice = findInvoiceById(id);
  if (!invoice) throw new Error('Invoice not found');
  var invoiceLocked = String(invoice.status || 'draft').toLowerCase() === 'generated';
  recalculateInvoiceLineAmounts(invoice, { lock: invoiceLocked });
  var items = listInvoiceLineItemsByInvoiceId(id);
  var defaults = listDefaultInvoiceLineItems();
  var enrichedItems = enrichLineItemsWithEntryState(items);
  return {
    invoice: invoice,
    lineItems: enrichedItems,
    defaults: defaults,
    summary: summarizeInvoiceLineItems(enrichedItems)
  };
}

function enrichLineItemsWithEntryState(items) {
  return items.map(function(item) {
    return enrichLineItemWithEntryState(item);
  });
}

function enrichLineItemWithEntryState(item) {
  if (!item || !item.timesheet_entry_id) {
    item.entry_modified = false;
    item.entry_state = null;
    return item;
  }
  var entry = findTimesheetEntryById(item.timesheet_entry_id);
  if (!entry) {
    item.entry_modified = true;
    item.entry_state = null;
    return item;
  }
  var snapshot = parseEntrySnapshot(item.entry_snapshot_json);
  var currentSnapshot = buildEntrySnapshot(entry);
  item.entry_state = {
    snapshot: snapshot,
    current: currentSnapshot
  };
  item.entry_modified = snapshot.signature !== currentSnapshot.signature;
  return item;
}

function buildEntrySnapshot(entry) {
  if (!entry) {
    return {
      id: '',
      date: '',
      duration_minutes: 0,
      hour_type_id: '',
      contract_id: '',
      signature: ''
    };
  }
  var payload = {
    id: entry.id || '',
    date: entry.date || '',
    duration_minutes: invoiceParseNumber(entry.duration_minutes, 0),
    hour_type_id: entry.hour_type_id || '',
    contract_id: entry.contract_id || ''
  };
  payload.signature = [payload.id, payload.date, payload.duration_minutes, payload.hour_type_id, payload.contract_id].join('#');
  return payload;
}

function parseEntrySnapshot(snapshotJson) {
  if (!snapshotJson) {
    return {
      id: '',
      date: '',
      duration_minutes: 0,
      hour_type_id: '',
      contract_id: '',
      signature: ''
    };
  }
  try {
    var parsed = JSON.parse(snapshotJson);
    if (!parsed.signature) {
      parsed.signature = [parsed.id || '', parsed.date || '', invoiceParseNumber(parsed.duration_minutes, 0), parsed.hour_type_id || '', parsed.contract_id || ''].join('#');
    }
    parsed.duration_minutes = invoiceParseNumber(parsed.duration_minutes, 0);
    return parsed;
  } catch (e) {
    return {
      id: '',
      date: '',
      duration_minutes: 0,
      hour_type_id: '',
      contract_id: '',
      signature: ''
    };
  }
}

function serializeEntrySnapshot(snapshot) {
  if (!snapshot) return '';
  var payload = {
    id: snapshot.id || '',
    date: snapshot.date || '',
    duration_minutes: invoiceParseNumber(snapshot.duration_minutes, 0),
    hour_type_id: snapshot.hour_type_id || '',
    contract_id: snapshot.contract_id || ''
  };
  payload.signature = [payload.id, payload.date, payload.duration_minutes, payload.hour_type_id, payload.contract_id].join('#');
  return JSON.stringify(payload);
}

function findTimesheetEntryById(id) {
  if (!id) return null;
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (!values.length) return null;
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  if (idIdx === -1) return null;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === id) {
      var row = {};
      headers.forEach(function(header, idx) {
        row[header] = values[i][idx];
      });
      return normalizeEntryObject(row);
    }
  }
  return null;
}

function getInvoiceHeaders() {
  var sh = getInvoiceSheet();
  var lastColumn = Math.max(1, sh.getLastColumn());
  return sh.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function getInvoiceLineItemHeaders() {
  var sh = getInvoiceLineItemSheet();
  var lastColumn = Math.max(1, sh.getLastColumn());
  return sh.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function buildInvoiceRow(headers, invoice) {
  return headers.map(function(header) {
    switch (header) {
      case 'id':
        return invoice.id || '';
      case 'year':
        return invoiceParseNumber(invoice.year);
      case 'month':
        return invoiceParseNumber(invoice.month);
      case 'sequence':
        return invoiceParseNumber(invoice.sequence);
      case 'invoice_number':
        return invoice.invoice_number || '';
      case 'invoice_date':
        return invoice.invoice_date || '';
      case 'status':
        return invoice.status || 'draft';
      case 'generated_doc_id':
        return invoice.generated_doc_id || '';
      case 'generated_doc_url':
        return invoice.generated_doc_url || '';
      case 'generated_at':
        return invoice.generated_at || '';
      case 'template_doc_id':
        return invoice.template_doc_id || '';
      case 'template_doc_path':
        return invoice.template_doc_path || '';
      case 'output_folder_id':
        return invoice.output_folder_id || '';
      case 'output_folder_path':
        return invoice.output_folder_path || '';
      case 'notes':
        return invoice.notes || '';
      case 'created_at':
        return invoice.created_at || '';
      case 'updated_at':
        return invoice.updated_at || '';
      default:
        return invoice[header] != null ? invoice[header] : '';
    }
  });
}

function buildInvoiceLineItemRow(headers, item) {
  var headerList = INVOICE_LINE_ITEM_HEADERS;
  var matching = Array.isArray(headers) && headers.length === headerList.length && headers.every(function(h, idx) {
    return String(h || '').trim() === headerList[idx];
  });
  var headersToUse = matching ? headers : headerList;
  return headersToUse.map(function(header) {
    switch (header) {
      case 'id':
        return item.id || '';
      case 'invoice_id':
        return item.invoice_id || '';
      case 'is_default':
        return item.is_default ? 'TRUE' : 'FALSE';
      case 'default_label':
        return item.default_label || '';
      case 'position':
        return invoiceParseNumber(item.position);
      case 'line_date':
        return item.line_date || '';
      case 'description':
        return item.description || '';
      case 'hours':
        return invoiceParseNumber(item.hours, 0);
      case 'hour_type_id':
        return item.hour_type_id || '';
      case 'hour_type_name_snapshot':
        return item.hour_type_name_snapshot || '';
      case 'amount':
        return invoiceParseNumber(item.amount, 0);
      case 'amount_mode':
        return item.amount_mode || 'hours';
      case 'contract_id':
        return item.contract_id || '';
      case 'contract_name_snapshot':
        return item.contract_name_snapshot || '';
      case 'timesheet_entry_id':
        return item.timesheet_entry_id || '';
      case 'entry_snapshot_json':
        return item.entry_snapshot_json || '';
      case 'last_synced_at':
        return item.last_synced_at || '';
      case 'source_default_id':
        return item.source_default_id || '';
      case 'created_at':
        return item.created_at || '';
      case 'updated_at':
        return item.updated_at || '';
      default:
        return item[header] != null ? item[header] : '';
    }
  });
}

function getInvoiceRowIndexById(id) {
  if (!id) return -1;
  var sh = getInvoiceSheet();
  var values = sh.getDataRange().getValues();
  if (!values.length) return -1;
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  if (idIdx === -1) return -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === id) {
      return i + 1;
    }
  }
  return -1;
}

function updateInvoiceRecord(invoiceId, updates) {
  if (!invoiceId) throw new Error('Invoice id is required');
  var rowIndex = getInvoiceRowIndexById(invoiceId);
  if (rowIndex === -1) throw new Error('Invoice row not found');
  var headers = getInvoiceHeaders();
  var sh = getInvoiceSheet();
  var currentRow = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var currentInvoice = normalizeInvoiceRow(headers, currentRow);
  var merged = {};
  for (var key in currentInvoice) {
    if (currentInvoice.hasOwnProperty(key)) {
      merged[key] = currentInvoice[key];
    }
  }
  for (var updateKey in updates) {
    if (updates.hasOwnProperty(updateKey)) {
      merged[updateKey] = updates[updateKey];
    }
  }
  if (!merged.created_at) {
    merged.created_at = invoiceToIsoDateTime(new Date());
  }
  merged.updated_at = updates && updates.updated_at ? updates.updated_at : invoiceToIsoDateTime(new Date());
  var newRow = buildInvoiceRow(headers, merged);
  sh.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  clearInvoiceCaches();
  return merged;
}

function getLineItemRowIndexById(id) {
  if (!id) return -1;
  var sh = getInvoiceLineItemSheet();
  var values = sh.getDataRange().getValues();
  if (!values.length) return -1;
  var headers = values[0];
  var idIdx = headers.indexOf('id');
  if (idIdx === -1) return -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === id) {
      return i + 1;
    }
  }
  return -1;
}

function updateLineItemRecord(lineItemId, updates) {
  if (!lineItemId) throw new Error('Line item id is required');
  var rowIndex = getLineItemRowIndexById(lineItemId);
  if (rowIndex === -1) throw new Error('Invoice line item row not found');
  var headers = getInvoiceLineItemHeaders();
  Logger.log('[Backend] invoice_line_items headers: ' + JSON.stringify(headers));
  var sh = getInvoiceLineItemSheet();
  var currentRow = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var currentItem = normalizeLineItemRow(headers, currentRow);
  var merged = {};
  for (var key in currentItem) {
    if (currentItem.hasOwnProperty(key)) {
      merged[key] = currentItem[key];
    }
  }
  for (var updateKey in updates) {
    if (updates.hasOwnProperty(updateKey)) {
      merged[updateKey] = updates[updateKey];
    }
  }
  if (!merged.created_at) merged.created_at = invoiceToIsoDateTime(new Date());
  merged.updated_at = updates && updates.updated_at ? updates.updated_at : invoiceToIsoDateTime(new Date());
  var newRow = buildInvoiceLineItemRow(headers, merged);
  sh.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  clearInvoiceCaches();
  return merged;
}

function getNextInvoiceSequence(year, month) {
  var invoices = listInvoicesInternal();
  var maxSeq = 0;
  for (var i = 0; i < invoices.length; i++) {
    if (invoices[i].year === year && invoices[i].month === month) {
      maxSeq = Math.max(maxSeq, invoiceParseNumber(invoices[i].sequence));
    }
  }
  return maxSeq + 1;
}

function getNextLineItemPosition(invoiceId, isDefault) {
  var items = listInvoiceLineItemsInternal().filter(function(item) {
    if (isDefault) {
      return item.is_default;
    }
    return !item.is_default && item.invoice_id === invoiceId;
  });
  var maxPos = 0;
  for (var i = 0; i < items.length; i++) {
    maxPos = Math.max(maxPos, invoiceParseNumber(items[i].position));
  }
  return maxPos + 1;
}

function getHourTypeNameById(id) {
  if (!id) return '';
  var cacheKey = INVOICE_HOUR_TYPE_LOOKUP_CACHE;
  var cached = cacheGet(cacheKey);
  if (!cached) {
    cached = {};
    try {
      var sh = getHourTypesSheet();
      var values = sh.getDataRange().getValues();
      if (values.length > 1) {
        var headers = values[0];
        var idIdx = headers.indexOf('id');
        var nameIdx = headers.indexOf('name');
        for (var i = 1; i < values.length; i++) {
          var rowId = values[i][idIdx];
          if (!rowId) continue;
          cached[rowId] = values[i][nameIdx] || '';
        }
      }
      cacheSet(cacheKey, cached);
    } catch (e) {
      cached = {};
    }
  }
  return cached[id] || '';
}

function getContractNameById(id) {
  if (!id) return '';
  var cacheKey = INVOICE_CONTRACT_LOOKUP_CACHE;
  var cached = cacheGet(cacheKey);
  if (!cached) {
    cached = {};
    try {
      var sh = getOrCreateSheet('contracts');
      var values = sh.getDataRange().getValues();
      if (values.length > 1) {
        var headers = values[0];
        var idIdx = headers.indexOf('id');
        var nameIdx = headers.indexOf('name');
        var rateIdx = headers.indexOf('hourly_rate');
        for (var i = 1; i < values.length; i++) {
          var rowId = values[i][idIdx];
          if (!rowId) continue;
          cached[rowId] = {
            name: values[i][nameIdx] || '',
            rate: invoiceParseNumber(rateIdx === -1 ? 0 : values[i][rateIdx], 0)
          };
        }
      }
      cacheSet(cacheKey, cached);
    } catch (e) {
      cached = {};
    }
  }
  var record = cached[id];
  if (!record) return '';
  if (typeof record === 'string') return record;
  return record.name || '';
}

function getContractRateById(id) {
  if (!id) return 0;
  var cacheKey = INVOICE_CONTRACT_LOOKUP_CACHE;
  var cached = cacheGet(cacheKey);
  if (!cached) {
    getContractNameById(id);
    cached = cacheGet(cacheKey) || {};
  }
  var record = cached[id];
  if (!record) return 0;
  if (typeof record === 'number') return record;
  if (typeof record === 'string') {
    cacheClearPrefix(INVOICE_CONTRACT_LOOKUP_CACHE);
    return getContractRateById(id);
  }
  return invoiceParseNumber(record.rate, 0);
}

function api_upsertInvoice(payload) {
  if (!payload) throw new Error('Invoice payload is required');
  var now = new Date();
  var nowIso = invoiceToIsoDateTime(now);
  var isUpdate = payload.id ? !!findInvoiceById(payload.id) : false;
  var headers = getInvoiceHeaders();
  var invoiceDate = invoiceToIsoDate(payload.invoice_date);
  var derivedYear = '';
  var derivedMonth = '';
  if (invoiceDate) {
    var parts = invoiceDate.split('-');
    if (parts.length >= 2) {
      derivedYear = invoiceParseNumber(parts[0]);
      derivedMonth = invoiceParseNumber(parts[1]);
    }
  }
  var targetYear = invoiceParseNumber(payload.year || derivedYear, invoiceParseNumber(Utilities.formatDate(now, INVOICE_SHEET_TZ, 'yyyy')));
  var targetMonth = invoiceParseNumber(payload.month || derivedMonth, invoiceParseNumber(Utilities.formatDate(now, INVOICE_SHEET_TZ, 'M')));
  var invoiceNumber = payload.invoice_number != null ? String(payload.invoice_number).trim() : '';
  if (!invoiceNumber) {
    invoiceNumber = targetYear + '-' + ('0' + targetMonth).slice(-2) + '-' + Utilities.getUuid().slice(0, 8);
  }

  if (!invoiceDate) {
    var constructedDate = new Date(targetYear, Math.max(0, targetMonth - 1), 1);
    invoiceDate = invoiceToIsoDate(constructedDate);
  }

  var sequence = invoiceParseNumber(payload.sequence);
  var templateDocId = payload.template_doc_id || '';
  var templateDocPath = payload.template_doc_path || '';
  var outputFolderId = payload.output_folder_id || '';
  var outputFolderPath = payload.output_folder_path || '';
  var notes = payload.notes || '';
  var status = payload.status || 'draft';

  var sh = getInvoiceSheet();
  var invoiceId = payload && payload.id ? payload.id : '';
  var previousStatus = 'draft';
  var rowValues;
  if (isUpdate) {
    var existing = findInvoiceById(payload.id);
    if (!existing) throw new Error('Invoice not found');
    previousStatus = String(existing.status || 'draft');
    if (!sequence || sequence <= 0 || existing.year !== targetYear || existing.month !== targetMonth) {
      sequence = getNextInvoiceSequence(targetYear, targetMonth);
    }
    var rowIndex = getInvoiceRowIndexById(existing.id);
    if (rowIndex === -1) throw new Error('Invoice row not found');
    var invoice = {
      id: existing.id,
      year: targetYear,
      month: targetMonth,
      sequence: sequence,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      status: status,
      generated_doc_id: existing.generated_doc_id || '',
      generated_doc_url: existing.generated_doc_url || '',
      generated_at: existing.generated_at || '',
      template_doc_id: templateDocId || existing.template_doc_id || '',
      template_doc_path: templateDocPath || existing.template_doc_path || '',
      output_folder_id: outputFolderId || existing.output_folder_id || '',
      output_folder_path: outputFolderPath || existing.output_folder_path || '',
      notes: notes,
      created_at: existing.created_at || nowIso,
      updated_at: nowIso
    };
    invoiceId = invoice.id;
    rowValues = buildInvoiceRow(headers, invoice);
    sh.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    if (!sequence || sequence <= 0) {
      sequence = getNextInvoiceSequence(targetYear, targetMonth);
    }
    var newInvoice = {
      id: payload.id || Utilities.getUuid(),
      year: targetYear,
      month: targetMonth,
      sequence: sequence,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      status: status,
      generated_doc_id: '',
      generated_doc_url: '',
      generated_at: '',
      template_doc_id: templateDocId,
      template_doc_path: templateDocPath,
      output_folder_id: outputFolderId,
      output_folder_path: outputFolderPath,
      notes: notes,
      created_at: nowIso,
      updated_at: nowIso
    };
    invoiceId = newInvoice.id;
    rowValues = buildInvoiceRow(headers, newInvoice);
    sh.appendRow(rowValues);
  }

  clearInvoiceCaches();
  var savedInvoice = findInvoiceById(invoiceId);
  var savedStatus = String(savedInvoice && savedInvoice.status ? savedInvoice.status : 'draft');
  if (savedInvoice && savedStatus.toLowerCase() === 'generated' && savedStatus.toLowerCase() !== String(previousStatus || 'draft').toLowerCase()) {
    recalculateInvoiceLineAmounts(savedInvoice, { lock: true });
    savedInvoice = findInvoiceById(invoiceId);
  }
  return savedInvoice;
}

function api_deleteInvoice(id, options) {
  if (!id) throw new Error('Invoice id is required');
  var invoice = findInvoiceById(id);
  if (!invoice) throw new Error('Invoice not found');
  var deleteEntries = options && invoiceParseBoolean(options.deleteEntries);
  var sh = getInvoiceSheet();
  var rowIndex = getInvoiceRowIndexById(id);
  if (rowIndex === -1) throw new Error('Invoice row not found');
  var items = listInvoiceLineItemsByInvoiceId(id);
  var lineSheet = getInvoiceLineItemSheet();
  var lineValues = lineSheet.getDataRange().getValues();
  var headers = lineValues.length ? lineValues[0] : [];
  var idIdx = headers.indexOf('id');
  var rowsToDelete = [];
  if (items.length && idIdx !== -1) {
    var itemIds = {};
    items.forEach(function(item) { itemIds[item.id] = true; });
    for (var i = 1; i < lineValues.length; i++) {
      if (itemIds[String(lineValues[i][idIdx])]) {
        rowsToDelete.push(i + 1);
      }
    }
  }
  sh.deleteRow(rowIndex);
  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(r) {
    lineSheet.deleteRow(r);
  });
  if (deleteEntries) {
    items.forEach(function(item) {
      if (item.timesheet_entry_id) {
        try {
          api_deleteEntry(item.timesheet_entry_id);
        } catch (e) {
          // Ignore missing entries
        }
      }
    });
  }
  clearInvoiceCaches();
  return { success: true };
}

function api_listInvoiceDefaultLineItems() {
  return listDefaultInvoiceLineItems();
}

function api_upsertInvoiceDefaultLineItem(payload) {
  var data = payload || {};
  data.is_default = true;
  data.invoice_id = '';
  return api_upsertInvoiceLineItem(data);
}

function api_deleteInvoiceDefaultLineItem(id) {
  return api_deleteInvoiceLineItem(id, { preserveEntry: true });
}

function invoiceEscapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePlaceholderAcrossDoc(doc, placeholder, value) {
  var pattern = '\\{\\{' + invoiceEscapeRegExp(placeholder) + '\\}\\}';
  var replacement = value != null ? String(value) : '';
  var body = doc.getBody();
  if (body) body.replaceText(pattern, replacement);
  try {
    var header = doc.getHeader();
    if (header) header.replaceText(pattern, replacement);
  } catch (e) {}
  try {
    var footer = doc.getFooter();
    if (footer) footer.replaceText(pattern, replacement);
  } catch (e) {}
}

function buildInvoiceFilename(invoice) {
  if (!invoice) return 'Invoice';
  if (invoice.invoice_number) return invoice.invoice_number;
  var month = ('0' + invoice.month).slice(-2);
  return 'Invoice ' + invoice.year + '-' + month + '-' + invoice.sequence;
}

function formatCurrencyForTemplate(amount) {
  var num = invoiceParseNumber(amount, 0);
  return num.toFixed(2);
}

function formatHoursForTemplate(hours) {
  var num = invoiceParseNumber(hours, 0);
  var formatted = num.toFixed(4);
  formatted = formatted.replace(/\.?0+$/, '');
  return formatted === '' ? '0' : formatted;
}

function buildInvoiceReplacementData(invoice, lineItems, lineLimit) {
  if (!invoice) throw new Error('Invoice is required for template generation');
  var limit = lineLimit && lineLimit > 0 ? lineLimit : lineItems.length;
  if (lineItems.length > limit) {
    throw new Error('Invoice has ' + lineItems.length + ' line items which exceeds the template limit of ' + limit + '.');
  }
  var summary = summarizeInvoiceLineItems(lineItems);
  var replacements = {
    single: {
      invoiceNumber: invoice.invoice_number || '',
      invoiceDate: invoice.invoice_date || '',
      invoiceYear: invoice.year || '',
      invoiceMonth: invoice.month || '',
      invoiceSequence: invoice.sequence || '',
      invoiceTotal: formatCurrencyForTemplate(summary.totalAmount),
      invoiceTotalHours: formatHoursForTemplate(summary.totalHours),
      invoiceNotes: invoice.notes || ''
    },
    lines: []
  };
  for (var i = 0; i < lineItems.length; i++) {
    var item = lineItems[i];
    var lineHoursValue = invoiceParseNumber(item.hours, 0);
    var lineAmountValue = invoiceParseNumber(item.amount, 0);
    var derivedRate = 0;
    if (lineHoursValue > 0) {
      derivedRate = Math.round((lineAmountValue / lineHoursValue) * 100) / 100;
    }
    var lineHoursDisplay = lineHoursValue > 0 ? formatHoursForTemplate(lineHoursValue) : '';
    var lineRateDisplay = lineHoursValue > 0 ? formatCurrencyForTemplate(derivedRate) : '';
    replacements.lines.push({
      index: i + 1,
      lineDate: item.line_date || '',
      lineDescription: item.description || '',
      lineHours: lineHoursDisplay,
      lineHourType: item.hour_type_name_snapshot || '',
      lineRate: lineRateDisplay,
      lineAmount: formatCurrencyForTemplate(lineAmountValue),
      lineContract: item.contract_name_snapshot || '',
      lineSourceDefault: item.source_default_id || ''
    });
  }
  replacements.limit = limit;
  return replacements;
}

function applyInvoiceReplacements(doc, data) {
  var single = data.single || {};
  for (var key in single) {
    if (single.hasOwnProperty(key)) {
      replacePlaceholderAcrossDoc(doc, key, single[key]);
    }
  }
  var lines = data.lines || [];
  for (var i = 1; i <= data.limit; i++) {
    var info = null;
    if (i <= lines.length) {
      info = lines[i - 1];
    }
    replacePlaceholderAcrossDoc(doc, 'lineDate' + i, info ? info.lineDate : '');
    replacePlaceholderAcrossDoc(doc, 'lineDescription' + i, info ? info.lineDescription : '');
    replacePlaceholderAcrossDoc(doc, 'lineHours' + i, info ? info.lineHours : '');
    replacePlaceholderAcrossDoc(doc, 'lineHourType' + i, info ? info.lineHourType : '');
    replacePlaceholderAcrossDoc(doc, 'lineRate' + i, info ? info.lineRate : '');
    replacePlaceholderAcrossDoc(doc, 'lineAmount' + i, info ? info.lineAmount : '');
    replacePlaceholderAcrossDoc(doc, 'lineContract' + i, info ? info.lineContract : '');
  }
}

function looksLikeDriveId(value) {
  if (!value) return false;
  return /^[a-zA-Z0-9_-]{20,}$/.test(String(value).trim());
}

function resolveInvoiceTemplate(preferredId, preferredPath) {
  var refId = preferredId || '';
  var refPath = preferredPath || '';
  var errors = [];
  if (refId) {
    try {
      var file = DriveApp.getFileById(refId);
      return {
        file: file,
        id: file.getId(),
        name: file.getName(),
        path: refPath || refId
      };
    } catch (e) {
      errors.push('Template document id "' + refId + '" was not accessible.');
    }
  }
  if (refPath) {
    var fileFromPath = resolveDriveFileByPath(refPath);
    if (fileFromPath) {
      return fileFromPath;
    }
    errors.push('Template path "' + refPath + '" was not found.');
  }
  throw new Error(errors.length ? errors.join(' ') : 'Template document could not be resolved.');
}

function resolveInvoiceOutputFolder(preferredId, preferredPath) {
  var refId = preferredId || '';
  var refPath = preferredPath || '';
  var errors = [];
  if (refId) {
    try {
      var folder = DriveApp.getFolderById(refId);
      return {
        folder: folder,
        id: folder.getId(),
        name: folder.getName(),
        path: refPath || folder.getName()
      };
    } catch (e) {
      errors.push('Output folder id "' + refId + '" was not accessible.');
    }
  }
  if (refPath) {
    var folderFromPath = resolveDriveFolderByPath(refPath);
    if (folderFromPath) {
      return folderFromPath;
    }
    errors.push('Output folder path "' + refPath + '" was not found.');
  }
  throw new Error(errors.length ? errors.join(' ') : 'Output folder could not be resolved.');
}

function resolveDriveFileByPath(path) {
  if (!path) return null;
  var parts = path.split('/').map(function(part) { return part.trim(); }).filter(function(part) { return part && part !== '.'; });
  if (!parts.length) return null;
  var fileName = parts.pop();
  var folder = navigateToFolder(parts);
  if (!folder) return null;
  var files = folder.getFilesByName(fileName);
  if (!files.hasNext()) return null;
  var file = files.next();
  return {
    file: file,
    id: file.getId(),
    name: file.getName(),
    path: path
  };
}

function resolveDriveFolderByPath(path) {
  if (!path) return null;
  var parts = path.split('/').map(function(part) { return part.trim(); }).filter(function(part) { return part && part !== '.'; });
  if (!parts.length) return null;
  var folder = navigateToFolder(parts);
  if (!folder) return null;
  return {
    folder: folder,
    id: folder.getId(),
    name: folder.getName(),
    path: path
  };
}

function navigateToFolder(parts) {
  var folders = parts.slice();
  if (folders.length && folders[0].toLowerCase() === 'my drive') {
    folders.shift();
  }
  var current = DriveApp.getRootFolder();
  for (var i = 0; i < folders.length; i++) {
    var targetName = folders[i];
    var iterator = current.getFoldersByName(targetName);
    if (!iterator.hasNext()) {
      return null;
    }
    current = iterator.next();
  }
  return current;
}

function api_generateInvoiceDocument(payload) {
  if (!payload || !payload.invoice_id) {
    throw new Error('invoice_id is required to generate an invoice document.');
  }
  var invoice = findInvoiceById(payload.invoice_id);
  if (!invoice) {
    throw new Error('Invoice not found.');
  }
  var settings = api_getSettings();
  var templateId = payload.template_doc_id || invoice.template_doc_id || settings.invoice_template_doc_id || settings.invoice_template_reference || '';
  var templatePath = payload.template_doc_path || invoice.template_doc_path || settings.invoice_template_path || '';
  var outputFolderId = payload.output_folder_id || invoice.output_folder_id || settings.invoice_output_folder_id || '';
  var outputFolderPath = payload.output_folder_path || invoice.output_folder_path || settings.invoice_output_folder_path || '';
  if (!templateId && !templatePath) {
    throw new Error('An invoice template reference or path is required before generating documents.');
  }
  if (!outputFolderId && !outputFolderPath) {
    throw new Error('An invoice output folder path or id is required before generating documents.');
  }
  var templateResolution = resolveInvoiceTemplate(templateId, templatePath);
  var folderResolution = resolveInvoiceOutputFolder(outputFolderId, outputFolderPath);
  recalculateInvoiceLineAmounts(invoice, { lock: true });
  var lineItems = listInvoiceLineItemsByInvoiceId(invoice.id);
  var lineLimitSetting = payload.line_item_limit || settings.invoice_line_item_limit;
  var lineLimit = invoiceParseNumber(lineLimitSetting, lineItems.length);
  if (lineLimit <= 0) {
    lineLimit = lineItems.length;
  }
  var replacementData = buildInvoiceReplacementData(invoice, lineItems, lineLimit);
  var filename = payload.output_file_name || buildInvoiceFilename(invoice);
  var copy = templateResolution.file.makeCopy(filename, folderResolution.folder);
  var doc = DocumentApp.openById(copy.getId());
  applyInvoiceReplacements(doc, replacementData);
  doc.saveAndClose();

  var metadataUpdates = {
    generated_doc_id: copy.getId(),
    generated_doc_url: copy.getUrl(),
    generated_at: invoiceToIsoDateTime(new Date()),
    template_doc_id: templateResolution.id,
    template_doc_path: templateResolution.path,
    output_folder_id: folderResolution.id,
    output_folder_path: folderResolution.path,
    status: 'generated'
  };
  updateInvoiceRecord(invoice.id, metadataUpdates);
  return {
    success: true,
    document_id: copy.getId(),
    document_url: copy.getUrl(),
    file_name: copy.getName()
  };
}

function api_refreshInvoiceLineItemEntry(id) {
  if (!id) throw new Error('Line item id is required');
  var item = findLineItemById(id);
  if (!item) throw new Error('Line item not found');
  if (item.is_default) return item;
  if (!item.timesheet_entry_id) {
    updateLineItemRecord(id, {
      entry_snapshot_json: '',
      last_synced_at: '',
      updated_at: invoiceToIsoDateTime(new Date())
    });
    var updatedItem = findLineItemById(id);
    if (updatedItem && !updatedItem.is_default) {
      updatedItem = enrichLineItemWithEntryState(updatedItem);
    }
    return updatedItem;
  }
  var entry = findTimesheetEntryById(item.timesheet_entry_id);
  if (!entry) {
    updateLineItemRecord(id, {
      entry_snapshot_json: '',
      last_synced_at: invoiceToIsoDateTime(new Date()),
      updated_at: invoiceToIsoDateTime(new Date())
    });
    var normalizedCleared = findLineItemById(id);
    return normalizedCleared ? enrichLineItemWithEntryState(normalizedCleared) : null;
  }
  var snapshot = buildEntrySnapshot(entry);
  updateLineItemRecord(id, {
    entry_snapshot_json: serializeEntrySnapshot(snapshot),
    last_synced_at: invoiceToIsoDateTime(new Date())
  });
  var refreshed = findLineItemById(id);
  if (refreshed) {
    refreshed = enrichLineItemWithEntryState(refreshed);
  }
  return refreshed;
}

function syncTimesheetEntryForLineItem(lineItem, invoice, existing) {
  if (!lineItem || !invoice) {
    return {
      id: '',
      snapshotJson: '',
      lastSyncedAt: ''
    };
  }
  var hours = invoiceParseNumber(lineItem.hours, 0);
  var hourTypeId = lineItem.hour_type_id || '';
  var contractId = lineItem.contract_id || '';
  var existingEntryId = existing ? existing.timesheet_entry_id : '';

  if (hours <= 0) {
    if (existingEntryId) {
      try {
        api_deleteEntry(existingEntryId);
      } catch (e) {
        // Ignore deletion failure
      }
    }
    return {
      id: '',
      snapshotJson: '',
      lastSyncedAt: ''
    };
  }

  if (!hourTypeId) {
    hourTypeId = getDefaultHourTypeId();
    if (hourTypeId && typeof hourTypeId === 'object') {
      hourTypeId = hourTypeId.id || '';
    }
    lineItem.hour_type_id = hourTypeId;
  }

  var entryDate = lineItem.line_date || invoice.invoice_date || invoiceToIsoDate(new Date());
  var durationMinutes = Math.max(0, Math.round(hours * 60));
  var payload = {
    id: existingEntryId,
    date: entryDate,
    duration_minutes: durationMinutes,
    hour_type_id: hourTypeId,
    entry_type: 'basic',
    contract_id: contractId
  };

  var entry;
  try {
    if (existingEntryId) {
      entry = api_updateEntry(payload).entry;
    } else {
      var result = api_addEntry(payload);
      entry = result.entry;
      existingEntryId = entry.id;
    }
  } catch (e) {
    if (existingEntryId) {
      try {
        var recreated = api_addEntry({
          date: entryDate,
          duration_minutes: durationMinutes,
          hour_type_id: hourTypeId,
          entry_type: 'basic',
          contract_id: contractId
        });
        entry = recreated.entry;
        existingEntryId = entry.id;
      } catch (addErr) {
        throw addErr;
      }
    } else {
      throw e;
    }
  }

  var snapshot = buildEntrySnapshot(entry);
  return {
    id: existingEntryId,
    snapshotJson: serializeEntrySnapshot(snapshot),
    lastSyncedAt: invoiceToIsoDateTime(new Date())
  };
}

function calculateMonthlyHourTypeTotal(year, month, hourTypeId, contractId) {
  if (!hourTypeId) return 0;
  var sh = getOrCreateSheet('timesheet_entries');
  var values = sh.getDataRange().getValues();
  if (!values.length) return 0;
  var headers = values[0];
  var dateIdx = headers.indexOf('date');
  var durationIdx = headers.indexOf('duration_minutes');
  var hourTypeIdx = headers.indexOf('hour_type_id');
  var contractIdx = headers.indexOf('contract_id');
  if (dateIdx === -1 || durationIdx === -1 || hourTypeIdx === -1) return 0;
  var totalMinutes = 0;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var entryDate = invoiceToIsoDate(row[dateIdx]);
    if (!entryDate) continue;
    var parts = entryDate.split('-');
    if (parts.length < 3) continue;
    var entryYear = invoiceParseNumber(parts[0]);
    var entryMonth = invoiceParseNumber(parts[1]);
    if (entryYear !== year || entryMonth !== month) continue;
    var entryHourTypeId = row[hourTypeIdx] || '';
    if (entryHourTypeId !== hourTypeId) continue;
    if (contractIdx !== -1 && contractId) {
      var entryContractId = row[contractIdx] || '';
      if (entryContractId !== contractId) continue;
    }
    var duration = invoiceParseNumber(row[durationIdx], 0);
    totalMinutes += duration;
  }
  return Math.round((totalMinutes / 60) * 10000) / 10000;
}

function recalculateInvoiceLineAmounts(invoiceOrId, options) {
  if (!invoiceOrId) return 0;
  var invoice = invoiceOrId;
  if (typeof invoiceOrId === 'string') {
    invoice = findInvoiceById(invoiceOrId);
  }
  if (!invoice || !invoice.id) return 0;
  var sh = getInvoiceLineItemSheet();
  var values = sh.getDataRange().getValues();
  if (!values.length) return 0;
  var headers = values[0];
  var expectedColumns = ['id', 'invoice_id', 'is_default', 'amount_mode', 'hours', 'hour_type_id', 'contract_id', 'amount', 'contract_name_snapshot'];
  var missingRequired = expectedColumns.some(function(name) {
    return headers.indexOf(name) === -1;
  });
  if (missingRequired) return 0;

  var lockRequested = options && invoiceParseBoolean(options.lock);
  var invoiceLocked = String(invoice.status || 'draft').toLowerCase() === 'generated';
  var shouldLock = lockRequested || invoiceLocked;
  var updatedCount = 0;

  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    var normalized = normalizeLineItemRow(headers, values[rowIndex]);
    if (!normalized.id) continue;
    if (normalized.is_default) continue;
    if (normalized.invoice_id !== invoice.id) continue;
    var changed = false;
    var contractId = normalized.contract_id || '';
    var originalAmountMode = normalized.amount_mode || '';
    var amountMode = originalAmountMode;
    var contractName = contractId ? getContractNameById(contractId) : '';
    if (contractName && contractName !== normalized.contract_name_snapshot) {
      normalized.contract_name_snapshot = contractName;
      changed = true;
    }
    var contractRate = contractId ? getContractRateById(contractId) : 0;
    var hoursValue = isFinite(normalized.hours) ? normalized.hours : 0;
    if (hoursValue < 0) {
      hoursValue = 0;
      if (normalized.hours !== hoursValue) {
        normalized.hours = hoursValue;
        changed = true;
      }
    }

    if (!amountMode) {
      if (normalized.hour_type_id && hoursValue === 0 && invoiceParseNumber(normalized.amount, 0) === 0) {
        amountMode = 'monthly_hour_type';
        normalized.amount_mode = amountMode;
        changed = true;
      } else {
        amountMode = 'hours';
        normalized.amount_mode = amountMode;
        changed = true;
      }
    }
    if (amountMode === 'hours' && normalized.hour_type_id && hoursValue === 0 && invoiceParseNumber(normalized.amount, 0) === 0) {
      amountMode = 'monthly_hour_type';
      normalized.amount_mode = amountMode;
      changed = true;
    }

    if (amountMode === 'hours' && hoursValue >= 0) {
      if (contractRate > 0) {
        var computedAmount = Math.round(hoursValue * contractRate * 100) / 100;
        if (Math.abs(computedAmount - invoiceParseNumber(normalized.amount, 0)) > 0.0001) {
          normalized.amount = computedAmount;
          changed = true;
        }
      }
    } else if (amountMode === 'monthly_hour_type' && contractRate > 0 && normalized.hour_type_id) {
      var invoiceYear = invoiceParseNumber(invoice.year);
      var invoiceMonth = invoiceParseNumber(invoice.month);
      var monthlyHours = calculateMonthlyHourTypeTotal(invoiceYear, invoiceMonth, normalized.hour_type_id, contractId);
      var computedMonthlyAmount = Math.round(monthlyHours * contractRate * 100) / 100;
      if (Math.abs(computedMonthlyAmount - invoiceParseNumber(normalized.amount, 0)) > 0.0001) {
        normalized.amount = computedMonthlyAmount;
        changed = true;
      }
      if (normalized.hours !== 0) {
        normalized.hours = 0;
        changed = true;
      }
    }

    if (shouldLock && amountMode !== 'amount') {
      normalized.amount_mode = 'amount';
      changed = true;
    }

    if (changed) {
      normalized.updated_at = invoiceToIsoDateTime(new Date());
      var updatedRow = buildInvoiceLineItemRow(headers, normalized);
      sh.getRange(rowIndex + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      Logger.log('[Invoice Line Recalc] invoice=%s row=%s mode:%s->%s hours:%s amount:%s contract:%s contractName:%s lock:%s', invoice.id, normalized.id, originalAmountMode || '(blank)', normalized.amount_mode, normalized.hours, normalized.amount, normalized.contract_id, normalized.contract_name_snapshot, shouldLock);
      updatedCount++;
    } else {
      Logger.log('[Invoice Line Recalc] invoice=%s row=%s unchanged mode:%s hours:%s amount:%s contract:%s contractName:%s lock:%s', invoice.id, normalized.id, amountMode || '(blank)', normalized.hours, normalized.amount, normalized.contract_id, normalized.contract_name_snapshot, shouldLock);
    }
  }

  if (updatedCount > 0) {
    clearInvoiceCaches();
  }
  return updatedCount;
}

function api_upsertInvoiceLineItem(payload) {
  Logger.log('[Backend] api_upsertInvoiceLineItem called with payload: ' + JSON.stringify(payload));
  if (!payload) throw new Error('Line item payload is required');
  var isDefault = invoiceParseBoolean(payload.is_default);
  var invoiceId = isDefault ? '' : (payload.invoice_id || '');
  Logger.log('[Backend] isDefault: ' + isDefault + ', invoiceId: ' + invoiceId);
  var invoice = null;
  if (!isDefault) {
    if (!invoiceId) {
      Logger.log('[Backend] ERROR: invoice_id is required but not provided');
      throw new Error('invoice_id is required for invoice line items');
    }
    invoice = findInvoiceById(invoiceId);
    Logger.log('[Backend] Invoice found: ' + (invoice ? 'yes' : 'no'));
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (String(invoice.status || 'draft').toLowerCase() === 'generated') {
      throw new Error('Generated invoices are read-only.');
    }
  }

  var now = new Date();
  var nowIso = invoiceToIsoDateTime(now);
  var headers = getInvoiceLineItemHeaders();
  var headerSnapshot = headers.slice();
  var sh = getInvoiceLineItemSheet();
  var isUpdate = payload.id ? getLineItemRowIndexById(payload.id) !== -1 : false;
  var existing = isUpdate ? findLineItemById(payload.id) : null;
  var lineId = isUpdate ? existing.id : (payload.id || Utilities.getUuid());
  var position = invoiceParseNumber(payload.position);
  if (!position || position <= 0) {
    position = getNextLineItemPosition(invoiceId, isDefault);
  }
  var lineDate = invoiceToIsoDate(payload.line_date);
  if (!lineDate && invoice && invoice.invoice_date) {
    lineDate = invoice.invoice_date;
  }
  var description = payload.description != null ? String(payload.description) : (existing ? existing.description : '');
  var hoursRaw = payload.hours != null ? payload.hours : (existing ? existing.hours : 0);
  var hours = Math.max(0, Math.round(invoiceParseNumber(hoursRaw, 0) * 10000) / 10000);
  var amountRaw = payload.amount != null ? payload.amount : (existing ? existing.amount : 0);
  var amount = invoiceParseNumber(amountRaw, 0);
  var amountProvided = invoiceParseBoolean(payload.amount_provided);
  var hourTypeId = payload.hasOwnProperty('hour_type_id') ? payload.hour_type_id : (existing ? existing.hour_type_id : '');
  hourTypeId = hourTypeId || '';
  var hourTypeName;
  if (payload.hasOwnProperty('hour_type_name_snapshot')) {
    hourTypeName = payload.hour_type_name_snapshot;
  } else {
    hourTypeName = existing ? existing.hour_type_name_snapshot : '';
  }
  if (!hourTypeId) {
    hourTypeName = '';
  } else if (!hourTypeName) {
    hourTypeName = getHourTypeNameById(hourTypeId);
  }
  var contractId = payload.contract_id || (existing ? existing.contract_id : '');
  var contractName = payload.contract_name_snapshot || (existing ? existing.contract_name_snapshot : '');
  if (!contractId) {
    throw new Error('Contract is required for invoice line items.');
  }
  var resolvedContractName = getContractNameById(contractId);
  if (resolvedContractName) {
    contractName = resolvedContractName;
  } else if (!contractName) {
    contractName = '';
  }
  var contractRate = contractId ? getContractRateById(contractId) : 0;
  var amountMode = payload.amount_mode || (existing ? existing.amount_mode : 'hours');

  var invoiceStatus = invoice ? (invoice.status || 'draft') : 'draft';
  var shouldRecalculate = invoiceStatus !== 'generated';

  if (amountMode === 'monthly_hour_type' && hourTypeId && invoice && shouldRecalculate) {
    var invoiceYear = invoiceParseNumber(invoice.year);
    var invoiceMonth = invoiceParseNumber(invoice.month);
    var monthlyHours = calculateMonthlyHourTypeTotal(invoiceYear, invoiceMonth, hourTypeId, contractId);
    amount = Math.round(monthlyHours * contractRate * 100) / 100;
    hours = 0;
  } else if (amountMode === 'monthly_hour_type' && !shouldRecalculate && existing) {
    amount = existing.amount || 0;
    hours = 0;
  } else if (!amountProvided && hours > 0 && contractRate > 0) {
    amount = Math.round(hours * contractRate * 100) / 100;
  }
  if (!amount && amount !== 0) amount = 0;
  var defaultLabel = payload.default_label != null ? String(payload.default_label).trim() : (existing ? existing.default_label : '');
  if (isDefault && defaultLabel === '') {
    throw new Error('Default line items require a label.');
  }
  var sourceDefaultId = payload.source_default_id || (existing ? existing.source_default_id : '');
  var createdAt = isUpdate ? (existing.created_at || nowIso) : nowIso;
  var updatedAt = nowIso;
  var timesheetEntryId = existing ? existing.timesheet_entry_id : '';
  var entrySnapshotJson = existing ? existing.entry_snapshot_json : '';
  var lastSyncedAt = existing ? existing.last_synced_at : '';

  if (isDefault) {
    invoiceId = '';
    timesheetEntryId = '';
    entrySnapshotJson = '';
    lastSyncedAt = '';
  } else {
    var sync = syncTimesheetEntryForLineItem({
      id: lineId,
      invoice_id: invoiceId,
      line_date: lineDate,
      hours: hours,
      hour_type_id: hourTypeId,
      contract_id: contractId
    }, invoice, existing);
    if (sync) {
      timesheetEntryId = sync.id || '';
      entrySnapshotJson = sync.snapshotJson || '';
      lastSyncedAt = sync.lastSyncedAt || '';
    }
  }

  var record = {
    id: lineId,
    invoice_id: invoiceId,
    is_default: isDefault,
    default_label: defaultLabel,
    position: position,
    line_date: lineDate,
    description: description,
    hours: hours,
    hour_type_id: hourTypeId,
    hour_type_name_snapshot: hourTypeName,
    amount: amount,
    amount_mode: amountMode,
    contract_id: contractId,
    contract_name_snapshot: contractName,
    timesheet_entry_id: timesheetEntryId,
    entry_snapshot_json: entrySnapshotJson,
    last_synced_at: lastSyncedAt,
    source_default_id: sourceDefaultId,
    created_at: createdAt,
    updated_at: updatedAt
  };

  var row = buildInvoiceLineItemRow(headers, record);
  Logger.log('[Backend] Row prepared, isUpdate: ' + isUpdate);
  if (isUpdate) {
    var rowIndex = getLineItemRowIndexById(lineId);
    Logger.log('[Backend] Update mode, rowIndex: ' + rowIndex);
    if (rowIndex === -1) throw new Error('Line item row not found');
    sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    Logger.log('[Backend] Row updated in sheet');
  } else {
    sh.appendRow(row);
    Logger.log('[Backend] Row appended to sheet');
  }

  clearInvoiceCaches();
  Logger.log('[Backend] Caches cleared');
  var refreshed = findLineItemById(lineId);
  Logger.log('[Backend] Line item refreshed from sheet: ' + (refreshed ? 'yes' : 'no'));

  var storedHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var storedRowRange = refreshed ? getLineItemRowIndexById(lineId) : -1;
  var storedRowValues = storedRowRange !== -1 ? sh.getRange(storedRowRange, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  var storedNormalized = (storedRowValues && storedRowValues.length) ? normalizeLineItemRow(storedHeaders, storedRowValues) : null;
  Logger.log('[Backend Debug] headerSnapshot=' + JSON.stringify(headerSnapshot) + ' storedHeaders=' + JSON.stringify(storedHeaders));
  Logger.log('[Backend Debug] storedRowValues=' + JSON.stringify(storedRowValues));
  Logger.log('[Backend Debug] storedNormalized=' + JSON.stringify(storedNormalized));

  if (refreshed && !refreshed.is_default) {
    refreshed = enrichLineItemWithEntryState(refreshed);
    Logger.log('[Backend] Line item enriched with entry state');
  }
  if (refreshed) {
    refreshed._debug_headers = storedHeaders;
    refreshed._debug_row_values = storedRowValues;
    refreshed._debug_normalized = storedNormalized;
  }
  Logger.log('[Backend] Returning line item: ' + JSON.stringify(refreshed));
  return refreshed;
}

function api_deleteInvoiceLineItem(id, options) {
  if (!id) throw new Error('Line item id is required');
  var item = findLineItemById(id);
  if (!item) throw new Error('Line item not found');
  if (!item.is_default && item.invoice_id) {
    var parentInvoice = findInvoiceById(item.invoice_id);
    if (parentInvoice && String(parentInvoice.status || 'draft').toLowerCase() === 'generated') {
      throw new Error('Generated invoices are read-only.');
    }
  }
  var sh = getInvoiceLineItemSheet();
  var rowIndex = getLineItemRowIndexById(id);
  if (rowIndex === -1) throw new Error('Line item row not found');
  sh.deleteRow(rowIndex);
  var preserveEntry = options && invoiceParseBoolean(options.preserveEntry);
  if (!item.is_default && item.timesheet_entry_id && !preserveEntry) {
    try {
      api_deleteEntry(item.timesheet_entry_id);
    } catch (e) {
      // Ignore delete failure
    }
  }
  clearInvoiceCaches();
  return { success: true };
}
