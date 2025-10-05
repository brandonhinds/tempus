/** Sheets accessors and bootstrap */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === 'timesheet_entries') {
      sh.getRange(1,1,1,10).setValues([['id','date','start_time','end_time','duration_minutes','break_minutes','contract_id','created_at','punches_json','entry_type']]);
    } else if (name === 'user_settings') {
      sh.getRange(1,1,1,3).setValues([['key','value','type']]);
    } else if (name === 'contracts') {
      sh.getRange(1,1,1,6).setValues([['id','name','start_date','end_date','hourly_rate','created_at']]);
    } else if (name === 'feature_flags') {
      sh.getRange(1,1,1,4).setValues([['feature','enabled','name','description']]);
    }
  }
  if (name === 'timesheet_entries') {
    const expectedHeaders = ['id','date','start_time','end_time','duration_minutes','break_minutes','contract_id','created_at','punches_json','entry_type'];
    const lastColumn = Math.max(sh.getLastColumn(), expectedHeaders.length);
    const headerRange = sh.getRange(1, 1, 1, lastColumn);
    const headers = headerRange.getValues()[0];
    const descriptionIndex = headers.indexOf('description');
    const hasBreak = headers.indexOf('break_minutes') !== -1;
    if (!hasBreak) {
      if (descriptionIndex !== -1) {
        sh.getRange(1, descriptionIndex + 1).setValue('break_minutes');
        const lastRow = sh.getLastRow();
        if (lastRow > 1) {
          sh.getRange(2, descriptionIndex + 1, lastRow - 1, 1).setValue(0);
        }
      } else {
        const durationIndex = headers.indexOf('duration_minutes');
        const insertPosition = durationIndex === -1 ? expectedHeaders.length : durationIndex + 2;
        sh.insertColumnBefore(insertPosition);
        sh.getRange(1, insertPosition).setValue('break_minutes');
        const rowCount = sh.getLastRow();
        if (rowCount > 1) {
          sh.getRange(2, insertPosition, rowCount - 1, 1).setValue(0);
        }
      }
    }
    const projectIndex = headers.indexOf('project');
    const hasContract = headers.indexOf('contract_id') !== -1;
    if (!hasContract) {
      if (projectIndex !== -1) {
        sh.getRange(1, projectIndex + 1).setValue('contract_id');
      } else {
        const insertPositionForContract = headers.indexOf('break_minutes');
        const insertBefore = insertPositionForContract === -1 ? expectedHeaders.length : insertPositionForContract + 2;
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
    const sanitizedHeaders = sh.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
    if (expectedHeaders.some((header, idx) => sanitizedHeaders[idx] !== header)) {
      sh.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    }
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('C:D').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('0');
    sh.getRange('H:H').setNumberFormat('@');
    sh.getRange('I:I').setNumberFormat('@');
    sh.getRange('J:J').setNumberFormat('@');
  }
  if (name === 'contracts') {
    sh.getRange('C:D').setNumberFormat('@');
    sh.getRange('E:E').setNumberFormat('0.00');
    sh.getRange('F:F').setNumberFormat('@');
  }
  if (name === 'feature_flags') {
    const expectedFlagHeaders = ['feature','enabled','name','description'];
    const headerRange = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), expectedFlagHeaders.length));
    const headers = headerRange.getValues()[0];
    const hasName = headers.indexOf('name') !== -1;
    if (!hasName) {
      const descIndex = headers.indexOf('description');
      if (descIndex !== -1) {
        sh.insertColumnBefore(descIndex + 1);
        sh.getRange(1, descIndex + 1).setValue('name');
      } else {
        const lastCol = sh.getLastColumn();
        if (lastCol < expectedFlagHeaders.length) {
          sh.insertColumnAfter(lastCol);
        }
        sh.getRange(1, 3).setValue('name');
      }
    }
    const sanitized = sh.getRange(1, 1, 1, expectedFlagHeaders.length).getValues()[0];
    if (expectedFlagHeaders.some((header, idx) => sanitized[idx] !== header)) {
      sh.getRange(1, 1, 1, expectedFlagHeaders.length).setValues([expectedFlagHeaders]);
    }
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('C:D').setNumberFormat('@');
  }
  return sh;
}
