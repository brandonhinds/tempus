/** Sheets accessors and bootstrap */
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (name === 'timesheet_entries') {
      sh.getRange(1,1,1,8).setValues([['id','date','start_time','end_time','duration_minutes','description','project','created_at']]);
    } else if (name === 'user_settings') {
      sh.getRange(1,1,1,3).setValues([['key','value','type']]);
    } else if (name === 'projects') {
      sh.getRange(1,1,1,4).setValues([['id','name','color','active']]);
    }
  }
  if (name === 'timesheet_entries') {
    sh.getRange('B:B').setNumberFormat('@');
    sh.getRange('C:D').setNumberFormat('@');
    sh.getRange('H:H').setNumberFormat('@');
  }
  return sh;
}
