/** Sheets accessors and bootstrap */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === 'timesheet_entries') {
      sh.getRange(1,1,1,8).setValues([['id','date','start_time','end_time','duration_minutes','break_minutes','project','created_at']]);
    } else if (name === 'user_settings') {
      sh.getRange(1,1,1,3).setValues([['key','value','type']]);
    } else if (name === 'projects') {
      sh.getRange(1,1,1,4).setValues([['id','name','color','active']]);
    }
  }
  if (name === 'timesheet_entries') {
    const expectedHeaders = ['id','date','start_time','end_time','duration_minutes','break_minutes','project','created_at'];
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
    const sanitizedHeaders = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), expectedHeaders.length)).getValues()[0];
    if (expectedHeaders.some((header, idx) => sanitizedHeaders[idx] !== header)) {
      sh.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    }
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('C:D').setNumberFormat('@');
    sh.getRange('F:F').setNumberFormat('0');
    sh.getRange('H:H').setNumberFormat('@');
  }
  return sh;
}
