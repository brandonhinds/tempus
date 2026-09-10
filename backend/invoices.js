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
  'gst_code',
  'gst_rate',
  'gst_amount',
  'source_type',
  'source_id',
  'source_line_id',
  'created_at',
  'updated_at'
];
var INVOICE_SHEET_TZ = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
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
  if (!sh) return;
  var values = sh.getDataRange().getValues();
  if (!values.length) return;
  var headers = normalizeSheetHeaders_(values[0]);
  validateSheetHeaders_(INVOICE_LINE_ITEM_SHEET_NAME, headers, values.slice(1));
  INVOICE_LINE_ITEM_HEADERS.forEach(function(header) {
    if (headers.indexOf(header) === -1) throw new Error('SCHEMA ERROR: invoice_line_items is missing "' + header + '". Run the Tempus upgrade.');
  });
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
  var hasHeaderContent = normalizedHeaders.some(function(value) { return value !== ''; });

  if (!hasHeaderContent) {
    resetHeaders();
    return;
  }

  var hasDataRows = lastRow > 1;
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
  var orderMatches = expectedHeaders.every(function(name, idx) {
    return normalizedHeaders[idx] === name;
  });

  if ((missingHeaders.length || hasDuplicates || hasExtraColumns) && !hasDataRows) {
    resetHeaders();
    return;
  }

  if (missingHeaders.length || hasDuplicates || hasExtraColumns || (!orderMatches && hasDataRows)) {
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
    kind: cell('kind') || 'standard',
    source_month: cell('source_month') || '',
    content_hash: cell('content_hash') || '',
    generation_request_id: cell('generation_request_id') || '',
    pending_request_id: cell('pending_request_id') || '',
    pending_started_at: cell('pending_started_at') || '',
    pending_doc_id: cell('pending_doc_id') || '',
    retired_doc_ids_json: cell('retired_doc_ids_json') || '',
    migration_warning: cell('migration_warning') || '',
    financial_snapshot_json: cell('financial_snapshot_json') || '',
    year: invoiceParseNumber(cell('year')),
    month: invoiceParseNumber(cell('month')),
    sequence: invoiceParseNumber(cell('sequence')),
    invoice_number: cell('invoice_number') || '',
    invoice_date: invoiceToIsoDate(cell('invoice_date')),
    status: String(cell('status') || 'draft').toLowerCase() === 'generated' ? 'issued' : (cell('status') || 'draft'),
    revision_of_invoice_id: cell('revision_of_invoice_id') || '',
    generated_doc_id: cell('generated_doc_id') || '',
    generated_doc_url: cell('generated_doc_url') || '',
    generated_at: invoiceToIsoDateTime(cell('generated_at')),
    template_doc_id: cell('template_doc_id') || '',
    template_doc_path: cell('template_doc_path') || '',
    output_folder_id: cell('output_folder_id') || '',
    output_folder_path: cell('output_folder_path') || '',
    notes: cell('notes') || '',
    issued_at: invoiceToIsoDateTime(cell('issued_at')),
    sent_at: invoiceToIsoDateTime(cell('sent_at')),
    voided_at: invoiceToIsoDateTime(cell('voided_at')),
    void_reason: cell('void_reason') || '',
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
    gst_code: cell('gst_code') || 'taxable',
    gst_rate: invoiceParseNumber(cell('gst_rate'), 0.1),
    gst_amount: invoiceParseNumber(cell('gst_amount'), Math.round(amount * 0.1 * 100) / 100),
    source_type: cell('source_type') || 'manual',
    source_id: cell('source_id') || '',
    source_line_id: cell('source_line_id') || '',
    generation_id: cell('generation_id') || '',
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
  }).filter(function(item) {
    if (!item.id) return false;
    var invoice = item.invoice_id ? findInvoiceById(item.invoice_id) : null;
    return !invoice || invoice.kind !== 'lil_assessment' || String(item.generation_id || '') === String(invoice.generation_request_id || '');
  });
  cacheSet(cacheKey, normalized);
  return normalized;
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
    totals.gstAmount += invoiceParseNumber(items[i].gst_amount, Math.round(invoiceParseNumber(items[i].amount, 0) * invoiceParseNumber(items[i].gst_rate, 0.1) * 100) / 100);
  }
  totals.totalAmount = Math.round(totals.totalAmount * 100) / 100;
  totals.totalHours = Math.round(totals.totalHours * 10000) / 10000;
  totals.gstAmount = Math.round(totals.gstAmount * 100) / 100;
  totals.totalWithGst = Math.round((totals.totalAmount + totals.gstAmount) * 100) / 100;
  return totals;
}

function clearInvoiceCaches() {
  cacheClearPrefix(INVOICE_CACHE_PREFIX);
  cacheClearPrefix(INVOICE_DEFAULT_CACHE_KEY);
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
  var paymentSummary = invoicePaymentSummaryByInvoice_();
  cloned.forEach(function(invoice) {
    var paid = paymentSummary[invoice.id] || 0;
    var total = invoiceLedgerTotal_(invoice.id);
    invoice.paid_amount = paid;
    invoice.balance_due = Math.max(0, roundMoney_(total - paid));
    invoice.payment_state = paid <= 0 ? 'unpaid' : (paid + 0.005 >= total ? 'paid' : 'part_paid');
  });

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
      return normalizeEntryForRead(row);
    }
  }
  return null;
}

function getInvoiceHeaders() {
  var sh = getInvoiceSheet();
  var lastColumn = Math.max(1, sh.getLastColumn());
  return sh.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function buildInvoiceRow(headers, invoice) {
  return headers.map(function(header) {
    switch (header) {
      case 'id':
        return invoice.id || '';
      case 'kind':
        return invoice.kind || 'standard';
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
      case 'revision_of_invoice_id':
        return invoice.revision_of_invoice_id || '';
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
      case 'issued_at':
        return invoice.issued_at || '';
      case 'sent_at':
        return invoice.sent_at || '';
      case 'voided_at':
        return invoice.voided_at || '';
      case 'void_reason':
        return invoice.void_reason || '';
      case 'created_at':
        return invoice.created_at || '';
      case 'updated_at':
        return invoice.updated_at || '';
      default:
        return invoice[header] != null ? invoice[header] : '';
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

/** "Invoice 2608001 - 08-26" — the number, then the month it covers. A dash, not a slash: Drive
 * accepts a slash in a name but downloads and desktop sync rewrite it. The period comes from
 * source_month where the invoice has one, so a document generated in September for August still reads
 * as August. */
var INVOICE_LINE_SLOT_PREFIXES = ['serviceDescription', 'lineDescription'];

/** The highest line slot the template actually contains, in either placeholder vocabulary. The
 * configured limit is what a month may not exceed; this is what the document physically has. */
function invoiceTemplateLineCapacity_(text) {
  var max = 0;
  INVOICE_LINE_SLOT_PREFIXES.forEach(function(prefix) {
    var pattern = new RegExp('\\{\\{' + prefix + '(\\d+)\\}\\}', 'g'), match;
    while ((match = pattern.exec(String(text || '')))) max = Math.max(max, Number(match[1]));
  });
  return max;
}

function invoiceAncestorRow_(element) {
  var node = element;
  while (node && node.getType) {
    if (node.getType() === DocumentApp.ElementType.TABLE_ROW) return node;
    if (node.getType() === DocumentApp.ElementType.BODY_SECTION) return null;
    node = node.getParent ? node.getParent() : null;
  }
  return null;
}

/** Delete the template's unused line rows instead of blanking them, so a three-line month is not
 * padded out with the remaining empty rows and pushed onto a second page. Only a row that still holds
 * an unused slot placeholder is removed, so the header row, the totals row and any hand-written rows
 * are left alone. Works from the highest index down, so removing a row cannot move one that has not
 * been considered yet. */
function removeUnusedInvoiceLineRows_(doc, usedLines, capacity) {
  var body = doc.getBody();
  if (!body || !body.findText) return 0;
  var removed = 0;
  for (var index = capacity; index > usedLines; index--) {
    for (var p = 0; p < INVOICE_LINE_SLOT_PREFIXES.length; p++) {
      var found = null;
      try { found = body.findText('\\{\\{' + INVOICE_LINE_SLOT_PREFIXES[p] + index + '\\}\\}'); } catch (error) { found = null; }
      if (!found) continue;
      var row = invoiceAncestorRow_(found.getElement());
      if (!row) continue;
      var table = row.getParent();
      // A table has to keep at least one row; Docs throws on removing the last.
      if (table && table.getNumRows && table.getNumRows() <= 1) continue;
      row.removeFromParent();
      removed++;
      break;
    }
  }
  return removed;
}

function buildInvoiceFilename(invoice) {
  if (!invoice) return 'Invoice';
  var period = String(invoice.source_month || '');
  var year = /^\d{4}-\d{2}$/.test(period) ? period.slice(0, 4) : String(invoice.year || '');
  var month = /^\d{4}-\d{2}$/.test(period) ? period.slice(5, 7) : ('0' + invoice.month).slice(-2);
  var number = invoice.invoice_number || (year && month ? year.slice(2) + month + ('00' + (Number(invoice.sequence) || 1)).slice(-3) : '');
  var suffix = year && month ? ' - ' + month + '-' + year.slice(2) : '';
  return ('Invoice ' + number + suffix).trim();
}

/** "$1,234.56" — the format the legacy assessment-invoice templates were built around, where the
 * placeholder supplies the dollar sign rather than the document. */
function formatCurrencyAudForTemplate(amount) {
  var num = invoiceParseNumber(amount, 0);
  return '$' + num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** dd/MM/yyyy from an ISO date, as a string transform so no timezone can shift the day. */
function formatDateAuForTemplate(value) {
  var iso = invoiceToIsoDate(value);
  return iso ? iso.split('-').reverse().join('/') : '';
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
      invoiceNotes: invoice.notes || '',
      // Legacy assessment-template names. These templates predate the generic invoice placeholders and
      // are what Lil's document is built from, so both vocabularies are filled and either style works.
      date: formatDateAuForTemplate(invoice.invoice_date),
      subtotal: formatCurrencyAudForTemplate(summary.totalAmount),
      gst: formatCurrencyAudForTemplate(summary.gstAmount),
      total: formatCurrencyAudForTemplate(summary.totalWithGst)
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
    // The legacy templates print the date on the first line of an assessment only, so a two-line
    // Enhanced or Reval reads as one dated entry rather than the same date twice.
    var previous = i > 0 ? lineItems[i - 1] : null;
    var continuesAssessment = !!previous && String(previous.source_id || '') !== '' && String(previous.source_id) === String(item.source_id || '');
    replacements.lines.push({
      index: i + 1,
      lineDateAu: continuesAssessment ? '' : formatDateAuForTemplate(item.line_date),
      lineAmountAud: formatCurrencyAudForTemplate(lineAmountValue),
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
  // Clear every slot the template has, not just the configured limit: a template with more rows than
  // the limit would otherwise keep literal {{serviceDescription9}} text in the extras.
  var clearThrough = Math.max(Number(data.clearThrough) || 0, Number(data.limit) || 0);
  for (var i = 1; i <= clearThrough; i++) {
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
    // Legacy assessment-template slots (see buildInvoiceReplacementData). Unused slots blank out, which
    // is what lets one template carry more rows than a given month needs.
    replacePlaceholderAcrossDoc(doc, 'date' + i, info ? info.lineDateAu : '');
    replacePlaceholderAcrossDoc(doc, 'serviceDescription' + i, info ? info.lineDescription : '');
    replacePlaceholderAcrossDoc(doc, 'amount' + i, info ? info.lineAmountAud : '');
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

function renderInvoiceDocument_(invoice, lines, template, onCopy) {
  var source = resolveInvoiceTemplate(template.template_doc_id, template.template_doc_path);
  var folder = resolveInvoiceOutputFolder(template.output_folder_id, template.output_folder_path);
  var limit = Number(template.line_limit);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Set the invoice template line limit in Settings before generating.');
  var data = buildInvoiceReplacementData(invoice, lines, limit);
  data.single.assessmentPeriod = invoice.source_month || '';
  var summary = summarizeInvoiceLineItems(lines);
  data.single.invoiceGst = formatCurrencyForTemplate(summary.gstAmount);
  data.single.invoiceTotalWithGst = formatCurrencyForTemplate(summary.totalWithGst);
  var copy = source.file.makeCopy(buildInvoiceFilename(invoice), folder.folder);
  if (onCopy) onCopy(copy);
  var doc = DocumentApp.openById(copy.getId());
  // Check actual placeholders too: a configured limit cannot make an undersized template safe.
  var body = doc.getBody(), text = body.getText();
  for (var i = 1; i <= lines.length; i++) {
    var generic = text.indexOf('{{lineDescription' + i + '}}') !== -1 && text.indexOf('{{lineAmount' + i + '}}') !== -1;
    var legacy = text.indexOf('{{serviceDescription' + i + '}}') !== -1 && text.indexOf('{{amount' + i + '}}') !== -1;
    if (!generic && !legacy) throw new Error('The template has no description/amount slot for line ' + i + '. It needs either {{lineDescription' + i + '}} and {{lineAmount' + i + '}}, or {{serviceDescription' + i + '}} and {{amount' + i + '}}. Increase the template capacity before generating.');
  }
  data.clearThrough = Math.max(limit, invoiceTemplateLineCapacity_(text));
  // Drop the leftover rows before filling the rest, so the document shrinks to the month it describes.
  removeUnusedInvoiceLineRows_(doc, lines.length, data.clearThrough);
  applyInvoiceReplacements(doc, data);
  doc.saveAndClose();
  return { generated_doc_id: copy.getId(), generated_doc_url: copy.getUrl(), template_doc_id: source.id, template_doc_path: source.path, output_folder_id: folder.id, output_folder_path: folder.path };
}
