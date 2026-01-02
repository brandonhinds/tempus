/** Web entry + HTML includes */
function doGet(e) {
  var view = e && e.parameter && e.parameter.view ? String(e.parameter.view).toLowerCase() : '';
  var templateName = view === 'mobile' ? 'views/mobile' : 'views/index';
  var tpl = HtmlService.createTemplateFromFile(templateName);
  var html = tpl.evaluate()
    .setFaviconUrl('https://raw.githubusercontent.com/brandonhinds/tempus/refs/heads/main/images/favicon.ico')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function api_getWebAppUrl() {
  var url = '';
  try {
    url = ScriptApp.getService().getUrl() || '';
  } catch (e) {
    Logger.log('Error getting service URL: ' + e.toString());
  }
  return url;
}

/**
 * Adds a custom menu to the spreadsheet when it opens.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Tempus')
    .addItem('Get Web App URL', 'getTempusWebAppUrl')
    .addToUi();
}

/**
 * Gets the Tempus web app URL and displays it, or shows setup instructions.
 */
function getTempusWebAppUrl() {
  var ui = SpreadsheetApp.getUi();
  var url = null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetSheetName = 'INTRO';
  var targetCell = 'B12';
  var instructionsCell = 'M2';
  var linkLabel = 'Open Tempus';
  var settings = {};
  var storedUrl = '';

  try {
    url = ScriptApp.getService().getUrl();
  } catch (e) {
    Logger.log('Error getting service URL: ' + e.toString());
  }

  try {
    settings = api_getSettings ? api_getSettings() : {};
    storedUrl = settings && settings.tempus_url ? String(settings.tempus_url) : '';
  } catch (e) {
    Logger.log('Error loading settings: ' + e.toString());
  }

  var targetSheet = ss.getSheetByName(targetSheetName);
  var clearIntroInstructions = function() {
    if (!targetSheet) return;
    targetSheet.getRange(instructionsCell).setValue('');
  };

  if (storedUrl) {
    clearIntroInstructions();
    Logger.log('getTempusWebAppUrl: opening stored Tempus URL: ' + storedUrl);
    var html = HtmlService.createHtmlOutput(
      '<html><body style="font-family:Arial, sans-serif; padding:16px;">' +
      '<p style="margin:0 0 12px;">Opening Tempus in a new tab.<br><br>If your browser blocks the pop-up, click the button below.</p>' +
      '<button id="open-tempus" style="padding:6px 10px; font-size:12px;">Open Tempus</button>' +
      '<script>' +
      'var opened = window.open("' + storedUrl + '", "_blank", "noopener");' +
      'document.getElementById("open-tempus").addEventListener("click", function(){' +
      '  window.open("' + storedUrl + '", "_blank", "noopener");' +
      '});' +
      '</script>' +
      '</body></html>'
    ).setWidth(360).setHeight(150);
    ui.showModelessDialog(html, 'Opening Tempus');
    return storedUrl;
  }

  var message = '';

  // Check if we have a test deployment URL (contains /dev)
  if (url && url.indexOf('/dev') !== -1) {
    if (!targetSheet) {
      message = 'Your Tempus Web App URL:\n\n' +
                url + '\n\n' +
                'Note: The "' + targetSheetName + '" sheet was not found, so the link could not be written.';
    } else {
      var hyperlinkFormula = '=HYPERLINK("' + url + '","' + linkLabel + '")';
      targetSheet.getRange(targetCell).setFormula(hyperlinkFormula);
      clearIntroInstructions();
      message = 'Your Tempus Web App URL:\n\n' +
                url + '\n\n' +
                'Saved as a clickable link in ' + targetSheetName + '!' + targetCell + '.';
    }
  } else {
    var instructions = 'Unable to retrieve the test deployment.\n\n' +
                       'To create a test deployment, or get an existing URL that the script cannot find:\n\n' +
                       '1. Click "Extensions" → "Apps Script" in the toolbar above\n' +
                       '2. In Apps Script Editor, click "Deploy" → "Test deployments"\n' +
                       '3. Click the "Copy" button under the URL\n\n' +
                       'Bookmark this URL for easy access.\n\n' +
                       'The test deployment URL automatically updates when you push updates to Tempus, so this is a one-time process.\n\n' +
                       'To share access with others:\n' +
                       '1. Share your Google Sheet with them (Editor or Viewer)\n' +
                       '2. Give them the URL\n';
    if (targetSheet) {
      targetSheet.getRange(instructionsCell).setValue(instructions);
      message = 'To get the URL for the Tempus frontend follow the instructions that have been posted in the INTRO sheet.';
    } else {
      message = instructions + '\n' +
                'Note: The "' + targetSheetName + '" sheet was not found, so the instructions could not be written.';
    }
  }

  ui.alert('Tempus Web App URL', message, ui.ButtonSet.OK);

  return url;
}

/**
 * ⚠️ DANGER: Deletes all sheets except 'INTRO' to reset dev environment.
 *
 * This function is ONLY for development/testing purposes.
 * It will permanently delete all data sheets (timesheet_entries, contracts, etc.)
 * while preserving only the INTRO sheet.
 *
 * MANUAL EXECUTION ONLY - Do NOT create buttons or UI triggers for this function.
 * Run from Apps Script Editor: Select function → Run
 *
 * Use case: Resetting dev environment to factory settings for testing.
 */
function DANGER_resetToFactorySettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // First confirmation
  var response1 = ui.alert(
    '⚠️ DANGER: Reset to Factory Settings',
    'This will PERMANENTLY DELETE all sheets except INTRO.\n\n' +
    'ALL DATA WILL BE LOST:\n' +
    '- timesheet_entries\n' +
    '- contracts\n' +
    '- user_settings\n' +
    '- feature_flags\n' +
    '- projects\n' +
    '- And any other sheets\n\n' +
    'Are you absolutely sure you want to continue?',
    ui.ButtonSet.YES_NO
  );

  if (response1 !== ui.Button.YES) {
    Logger.log('Reset cancelled by user at first confirmation');
    return { success: false, message: 'Reset cancelled' };
  }

  // Second confirmation
  var response2 = ui.alert(
    '⚠️ FINAL WARNING',
    'This action CANNOT BE UNDONE.\n\n' +
    'All your time entries, contracts, and settings will be permanently deleted.\n\n' +
    'Click YES to proceed with deletion.',
    ui.ButtonSet.YES_NO
  );

  if (response2 !== ui.Button.YES) {
    Logger.log('Reset cancelled by user at second confirmation');
    return { success: false, message: 'Reset cancelled' };
  }

  // Proceed with deletion
  var sheets = ss.getSheets();
  var deletedSheets = [];
  var errors = [];

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();

    if (sheetName !== 'INTRO') {
      try {
        ss.deleteSheet(sheet);
        deletedSheets.push(sheetName);
        Logger.log('Deleted sheet: ' + sheetName);
      } catch (e) {
        errors.push(sheetName + ': ' + e.toString());
        Logger.log('Error deleting sheet ' + sheetName + ': ' + e.toString());
      }
    }
  }

  var resultMessage = 'Factory reset complete!\n\n' +
                      'Deleted ' + deletedSheets.length + ' sheets:\n' +
                      deletedSheets.join(', ') + '\n\n' +
                      'Preserved: INTRO';

  if (errors.length > 0) {
    resultMessage += '\n\nErrors:\n' + errors.join('\n');
  }

  ui.alert('Reset Complete', resultMessage, ui.ButtonSet.OK);

  Logger.log('Factory reset complete. Deleted: ' + deletedSheets.length + ' sheets');

  return {
    success: true,
    deletedSheets: deletedSheets,
    errors: errors
  };
}
