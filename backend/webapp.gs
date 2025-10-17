/** Web entry + HTML includes */
function doGet(e) {
  var tpl = HtmlService.createTemplateFromFile('views/index');
  // TODO: Update favicon URL to real Tempus logo once hosted
  var html = tpl.evaluate()
    .setFaviconUrl('https://www.google.com/favicon.ico')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
