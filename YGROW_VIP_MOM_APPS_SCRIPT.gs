/**
 * V120 YGROW VIP MOM. Paste into the Apps Script bound to the RESPONSE SPREADSHEET.
 * Apps Script > Project Settings > Script properties:
 * YGROW_SYNC_URL = https://crm-xjd6.vercel.app/api/ygrow-vip-mom
 * YGROW_SYNC_SECRET = same random secret as Vercel YGROW_FORM_SYNC_SECRET
 * Run installYgrowVipMomTrigger ONCE to authorize the installable trigger.
 * Do NOT publish as web app. Do NOT put Firebase private key here.
 */
function ygrowVipMomOnSubmit(e) {
  if (!e || !e.namedValues) throw new Error('Use installed spreadsheet On form submit trigger');
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('YGROW_SYNC_URL');
  var secret = p.getProperty('YGROW_SYNC_SECRET');
  if (!url || !secret) throw new Error('Missing YGROW_SYNC_URL / YGROW_SYNC_SECRET');
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {'x-ygrow-sync-secret': secret},
    payload: JSON.stringify({answers: e.namedValues}),
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  if (status !== 200) throw new Error('CRM sync HTTP ' + status + ': ' + response.getContentText());
  console.log('YGROW VIP MOM sync: ' + response.getContentText());
}
function installYgrowVipMomTrigger() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open Apps Script from the Google Sheets response spreadsheet');
  ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='ygrowVipMomOnSubmit';}).forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('ygrowVipMomOnSubmit').forSpreadsheet(spreadsheet).onFormSubmit().create();
  console.log('YGROW VIP MOM trigger installed for: '+spreadsheet.getName());
}
