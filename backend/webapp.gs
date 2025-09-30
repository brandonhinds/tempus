/** Web entry + HTML includes */
function doGet(e) {
  var tpl = HtmlService.createTemplateFromFile('views/index');
  var html = tpl.evaluate()
    .setTitle('Timesheet App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
