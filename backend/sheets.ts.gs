/** Sheets accessors and bootstrap */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === 'timesheet_entries') {
      sh.getRange(1,1,1,9).setValues([['id','date','duration_minutes','contract_id','created_at','punches_json','entry_type','hour_type_id','recurrence_id']]);
    } else if (name === 'user_settings') {
      sh.getRange(1,1,1,3).setValues([['key','value','type']]);
    } else if (name === 'contracts') {
      sh.getRange(1,1,1,6).setValues([['id','name','start_date','end_date','hourly_rate','created_at']]);
    } else if (name === 'feature_flags') {
      sh.getRange(1,1,1,4).setValues([['feature','enabled','name','description']]);
    } else if (name === 'hour_types') {
      sh.getRange(1,1,1,11).setValues([[
        'id',
        'name',
        'slug',
        'color',
        'contributes_to_income',
        'requires_contract',
        'is_default',
        'auto_populate_public_holidays',
        'auto_populate_hours',
        'created_at',
        'display_order'
      ]]);
    } else if (name === 'deductions') {
      sh.getRange(1,1,1,17).setValues([[
        'id',
        'name',
        'category_id',
        'company_expense',
        'deduction_type',
        'amount_type',
        'amount_value',
        'gst_inclusive',
        'gst_amount',
        'frequency',
        'start_date',
        'end_date',
        'notes',
        'active',
        'created_at',
        'updated_at',
        'display_order'
      ]]);
    } else if (name === 'deduction_categories') {
      sh.getRange(1,1,1,5).setValues([[
        'id',
        'name',
        'color',
        'created_at',
        'updated_at'
      ]]);
    } else if (name === 'deduction_occurrence_exceptions') {
      sh.getRange(1,1,1,8).setValues([[
        'id',
        'deduction_id',
        'original_date',
        'exception_type',
        'new_date',
        'new_amount',
        'notes',
        'created_at',
        'updated_at'
      ]]);
    } else if (name === 'invoices') {
      sh.getRange(1,1,1,17).setValues([[
        'id',
        'year',
        'month',
        'sequence',
        'invoice_number',
        'invoice_date',
        'status',
        'generated_doc_id',
        'generated_doc_url',
        'generated_at',
        'template_doc_id',
        'template_doc_path',
        'output_folder_id',
        'output_folder_path',
        'notes',
        'created_at',
        'updated_at'
      ]]);
    } else if (name === 'invoice_line_items') {
      sh.getRange(1,1,1,19).setValues([[
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
        'contract_id',
        'contract_name_snapshot',
        'timesheet_entry_id',
        'entry_snapshot_json',
        'last_synced_at',
        'source_default_id',
        'created_at',
        'updated_at'
      ]]);
    } else if (name === 'recurring_time_entries') {
      sh.getRange(1,1,1,19).setValues([[
        'id',
        'label',
        'recurrence_type',
        'weekly_interval',
        'weekly_weekdays_json',
        'monthly_interval',
        'monthly_mode',
        'monthly_day',
        'monthly_week',
        'monthly_weekday',
        'duration_minutes',
        'hour_type_id',
        'contract_id',
        'start_date',
        'end_date',
        'generated_until',
        'warning_message',
        'created_at',
        'updated_at'
      ]]);
    } else if (name === 'bulk_time_entries') {
      sh.getRange(1,1,1,14).setValues([[
        'id',
        'label',
        'duration_minutes',
        'hour_type_id',
        'contract_id',
        'start_date',
        'end_date',
        'include_weekends',
        'skip_public_holidays',
        'last_synced_at',
        'last_synced_count',
        'warning_message',
        'created_at',
        'updated_at'
      ]]);
    } else if (name === 'bas_submissions') {
      sh.getRange(1,1,1,15).setValues([[
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
      ]]);
    }
  }
  if (name === 'deduction_categories') {
    sh.getRange('A:C').setNumberFormat('@');
    sh.getRange('D:E').setNumberFormat('@');
  }
  if (name === 'deduction_occurrence_exceptions') {
    sh.getRange('A:B').setNumberFormat('@'); // id, deduction_id
    sh.getRange('C:C').setNumberFormat('@'); // original_date
    sh.getRange('D:D').setNumberFormat('@'); // exception_type
    sh.getRange('E:E').setNumberFormat('@'); // new_date
    sh.getRange('F:F').setNumberFormat('0.00'); // new_amount
    sh.getRange('G:G').setNumberFormat('@'); // notes
    sh.getRange('H:I').setNumberFormat('@'); // created_at, updated_at
  }
  if (name === 'timesheet_entries') {
    const expectedHeaders = ['id','date','duration_minutes','contract_id','created_at','punches_json','entry_type','hour_type_id','recurrence_id'];
    const lastColumn = Math.max(sh.getLastColumn(), expectedHeaders.length);
    const headerRange = sh.getRange(1, 1, 1, lastColumn);
    const headers = headerRange.getValues()[0];
    const projectIndex = headers.indexOf('project');
    const hasContract = headers.indexOf('contract_id') !== -1;
    if (!hasContract) {
      if (projectIndex !== -1) {
        sh.getRange(1, projectIndex + 1).setValue('contract_id');
      } else {
        const durationIndex = headers.indexOf('duration_minutes');
        const insertBefore = durationIndex === -1 ? expectedHeaders.length : durationIndex + 2;
        sh.insertColumnBefore(insertBefore);
        sh.getRange(1, insertBefore).setValue('contract_id');
      }
    }
    const punchesIndex = headers.indexOf('punches_json');
    if (punchesIndex === -1) {
      const lastCol = sh.getLastColumn();
      sh.insertColumnAfter(lastCol);
      sh.getRange(1, lastCol + 1).setValue('punches_json');
      const rowCount = sh.getLastRow();
      if (rowCount > 1) {
        sh.getRange(2, lastCol + 1, rowCount - 1, 1).setValue('[]');
      }
    }
    const entryTypeIndex = headers.indexOf('entry_type');
    if (entryTypeIndex === -1) {
      const lastCol = sh.getLastColumn();
      sh.insertColumnAfter(lastCol);
      sh.getRange(1, lastCol + 1).setValue('entry_type');
      const rowCount = sh.getLastRow();
      if (rowCount > 1) {
        sh.getRange(2, lastCol + 1, rowCount - 1, 1).setValue('basic');
      }
    }
    const hourTypeIndex = headers.indexOf('hour_type_id');
    if (hourTypeIndex === -1) {
      const lastCol = sh.getLastColumn();
      sh.insertColumnAfter(lastCol);
      sh.getRange(1, lastCol + 1).setValue('hour_type_id');
      const rowCount = sh.getLastRow();
      if (rowCount > 1) {
        sh.getRange(2, lastCol + 1, rowCount - 1, 1).setValue('');
      }
    }
    const recurrenceIndex = headers.indexOf('recurrence_id');
    if (recurrenceIndex === -1) {
      const lastCol = sh.getLastColumn();
      sh.insertColumnAfter(lastCol);
      sh.getRange(1, lastCol + 1).setValue('recurrence_id');
      const rowCount = sh.getLastRow();
      if (rowCount > 1) {
        sh.getRange(2, lastCol + 1, rowCount - 1, 1).setValue('');
      }
    }
    const sanitizedHeaders = sh.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
    if (expectedHeaders.some((header, idx) => sanitizedHeaders[idx] !== header)) {
      sh.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    }
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('E:E').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('@');
    sh.getRange('G:G').setNumberFormat('@');
    sh.getRange('H:H').setNumberFormat('@');
    sh.getRange('I:I').setNumberFormat('@');
  }
  if (name === 'invoices') {
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('B:C').setNumberFormat('0');
    sh.getRange('D:D').setNumberFormat('0');
    sh.getRange('E:E').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('@');
    sh.getRange('G:G').setNumberFormat('@');
    sh.getRange('H:H').setNumberFormat('@');
    sh.getRange('I:I').setNumberFormat('@');
    sh.getRange('J:J').setNumberFormat('@');
    sh.getRange('K:M').setNumberFormat('@');
    sh.getRange('N:N').setNumberFormat('@');
    sh.getRange('O:Q').setNumberFormat('@');
  }
  if (name === 'invoice_line_items') {
    const expectedInvoiceLineHeaders = [
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
      'contract_id',
      'contract_name_snapshot',
      'timesheet_entry_id',
      'entry_snapshot_json',
      'last_synced_at',
      'source_default_id',
      'created_at',
      'updated_at'
    ];
    const existingLastCol = Math.max(sh.getLastColumn(), expectedInvoiceLineHeaders.length);
    if (existingLastCol > 0) {
      const existingHeaders = sh.getRange(1, 1, 1, existingLastCol).getValues()[0];
      const rateIdx = existingHeaders.indexOf('rate');
      if (rateIdx !== -1) {
        sh.deleteColumn(rateIdx + 1);
      }
    }
    sh.getRange(1, 1, 1, expectedInvoiceLineHeaders.length).setValues([expectedInvoiceLineHeaders]);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('C:C').setNumberFormat('@');
    sh.getRange('D:D').setNumberFormat('@');
    sh.getRange('E:E').setNumberFormat('0');
    sh.getRange('F:F').setNumberFormat('@');
    sh.getRange('G:G').setNumberFormat('@');
    sh.getRange('H:H').setNumberFormat('0.00');
    sh.getRange('I:I').setNumberFormat('@');
    sh.getRange('J:J').setNumberFormat('@');
    sh.getRange('K:K').setNumberFormat('0.00');
    sh.getRange('L:L').setNumberFormat('@');
    sh.getRange('M:M').setNumberFormat('@');
    sh.getRange('N:N').setNumberFormat('@');
    sh.getRange('O:O').setNumberFormat('@');
    sh.getRange('P:P').setNumberFormat('@');
    sh.getRange('Q:Q').setNumberFormat('@');
    sh.getRange('R:R').setNumberFormat('@');
    sh.getRange('S:S').setNumberFormat('@');
  }
  if (name === 'contracts') {
    sh.getRange('C:D').setNumberFormat('@');
    sh.getRange('E:E').setNumberFormat('0.00');
    sh.getRange('F:F').setNumberFormat('@');
  }
  if (name === 'feature_flags') {
    const expectedFlagHeaders = ['feature', 'enabled'];
    let lastColumn = sh.getLastColumn();
    if (lastColumn < expectedFlagHeaders.length) {
      sh.insertColumnsAfter(lastColumn, expectedFlagHeaders.length - lastColumn);
      lastColumn = sh.getLastColumn();
    }
    if (lastColumn > expectedFlagHeaders.length) {
      sh.deleteColumns(expectedFlagHeaders.length + 1, lastColumn - expectedFlagHeaders.length);
    }
    const headerRange = sh.getRange(1, 1, 1, expectedFlagHeaders.length);
    const headers = headerRange.getValues()[0];
    const needsUpdate = expectedFlagHeaders.some((header, idx) => headers[idx] !== header);
    if (needsUpdate) {
      headerRange.setValues([expectedFlagHeaders]);
    }
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('B:B').setNumberFormat('@');
  }
  if (name === 'hour_types') {
    const expectedHourTypeHeaders = [
      'id',
      'name',
      'slug',
      'color',
      'contributes_to_income',
      'requires_contract',
      'is_default',
      'use_for_rate_calculation',
      'auto_populate_public_holidays',
      'auto_populate_hours',
      'created_at'
    ];
    const headerRange = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), expectedHourTypeHeaders.length));
    let headers = headerRange.getValues()[0];
    const rowCount = sh.getLastRow();

    function ensureHourTypeColumn(headerName, defaultValue, insertBeforeHeader) {
      headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), expectedHourTypeHeaders.length)).getValues()[0];
      if (headers.indexOf(headerName) !== -1) return;
      let insertPosition = headers.indexOf(insertBeforeHeader);
      if (insertPosition === -1) {
        insertPosition = headers.length;
        sh.insertColumnAfter(insertPosition);
        sh.getRange(1, insertPosition + 1).setValue(headerName);
      } else {
        sh.insertColumnBefore(insertPosition + 1);
        sh.getRange(1, insertPosition + 1).setValue(headerName);
      }
      if (rowCount > 1 && defaultValue !== undefined) {
        sh.getRange(2, insertPosition + 1, rowCount - 1, 1).setValue(defaultValue);
      }
    }

    ensureHourTypeColumn('auto_populate_public_holidays', 'FALSE', 'created_at');
    ensureHourTypeColumn('auto_populate_hours', 7.5, 'created_at');

    sh.getRange(1, 1, 1, expectedHourTypeHeaders.length).setValues([expectedHourTypeHeaders]);

    const idColumn = expectedHourTypeHeaders.indexOf('id') + 1;
    sh.getRange(1, idColumn, sh.getMaxRows(), 1).setNumberFormat('@');
    const textColumns = ['name', 'slug', 'color'];
    textColumns.forEach(function(header) {
      const col = expectedHourTypeHeaders.indexOf(header) + 1;
      sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
    });
    ['contributes_to_income', 'requires_contract', 'is_default', 'use_for_rate_calculation', 'auto_populate_public_holidays'].forEach(function(header) {
      const col = expectedHourTypeHeaders.indexOf(header) + 1;
      sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
    });
    const autoHoursCol = expectedHourTypeHeaders.indexOf('auto_populate_hours') + 1;
    sh.getRange(1, autoHoursCol, sh.getMaxRows(), 1).setNumberFormat('0.00');
    const createdAtCol = expectedHourTypeHeaders.indexOf('created_at') + 1;
    sh.getRange(1, createdAtCol, sh.getMaxRows(), 1).setNumberFormat('@');
  }
  if (name === 'deductions') {
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('B:D').setNumberFormat('@');
    sh.getRange('E:F').setNumberFormat('@');
    sh.getRange('G:G').setNumberFormat('0.00');
    sh.getRange('H:H').setNumberFormat('@');
    sh.getRange('I:I').setNumberFormat('0.00');
    sh.getRange('J:J').setNumberFormat('@');
    sh.getRange('K:L').setNumberFormat('@');
    sh.getRange('M:M').setNumberFormat('@');
    sh.getRange('N:N').setNumberFormat('@');
    sh.getRange('O:P').setNumberFormat('@');
  }
  if (name === 'bas_submissions') {
    sh.getRange('A:A').setNumberFormat('@'); // id
    sh.getRange('B:B').setNumberFormat('0'); // financial_year
    sh.getRange('C:C').setNumberFormat('@'); // period_type
    sh.getRange('D:E').setNumberFormat('0'); // quarter, month
    sh.getRange('F:F').setNumberFormat('0.00'); // g1_total_sales
    sh.getRange('G:G').setNumberFormat('@'); // g1_includes_gst
    sh.getRange('H:J').setNumberFormat('0.00'); // field_1a, field_1b, t1
    sh.getRange('K:K').setNumberFormat('0.0000'); // t2_instalment_rate
    sh.getRange('L:L').setNumberFormat('@'); // submitted
    sh.getRange('M:O').setNumberFormat('@'); // submitted_at, created_at, updated_at
  }
  return sh;
}

function applyDisplayOrderToSheet(name, orderIds) {
  if (!name) return [];
  var sh = getOrCreateSheet(name);
  var values = sh.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  var headers = values[0];
  var idIndex = headers.indexOf('id');
  var orderIndex = headers.indexOf('display_order');
  if (idIndex === -1 || orderIndex === -1) return [];
  var normalizedOrder = Array.isArray(orderIds) ? orderIds : [];
  var map = {};
  var next = normalizedOrder.length + 1;
  normalizedOrder.forEach(function(id, idx) {
    if (id || id === 0) {
      map[String(id)] = idx + 1;
    }
  });
  for (var i = 1; i < values.length; i++) {
    var rowId = String(values[i][idIndex] || '');
    var desired = map[rowId];
    if (!desired) {
      desired = next++;
      map[rowId] = desired;
    }
    var current = Number(values[i][orderIndex]);
    if (current !== desired) {
      sh.getRange(i + 1, orderIndex + 1).setValue(desired);
    }
  }
  return map;
}
