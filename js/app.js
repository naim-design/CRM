// ============================================================
// APP.JS — Auth guard, nav, data entry (Firestore realtime)
// ============================================================
let currentUser = null;
let currentProfile = null;
let unsubEntries = null;
let unsubTodos = null;
let unsubPosters = null;
let allEntries = [];
let allTodos = [];
let todoPendingImages = [];
let allPosters = [];
let allTemplateLibrary = [];
let unsubTemplateLibrary = null;
let allFeedback = [];
let unsubFeedback = null;
let allCampaignMappings = [];
let unsubCampaignMappings = null;
let allTikTokLeads = [];
let unsubTikTokLeads = null;
let editingTikTokLeadId = null;
let tikTokLeadImageData = '';
let allPackageAnalysis = [];
let unsubPackageAnalysis = null;
let editingPackageId = null;
let packageImageData = '';
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
// ---- Kos blasting (auto-kira dari jumlah Sent) ----
const RATE_EUR_PER_SENT = 0.0116;   // kos setiap mesej dihantar, dalam EUR
const EUR_TO_MYR = 4.73;            // kadar tukaran EUR -> RM
function costEUR(sent) { return (sent || 0) * RATE_EUR_PER_SENT; }
function costRM(sent) { return costEUR(sent) * EUR_TO_MYR; }
// ---- Wabot Control: official number + Meta mapping ----
const WABOT_OFFICIALS = [
  { key:'601111920528', label:'Mamariam Sdn Bhd 5', phone:'601111920528', dailyLimit:100000, wabot:'Naim — Account 1', meta:'Kak Nur Mariam - Ibu Hamil Bahagia', wabaId:'1249739500433660', login:'kaknorycloud@gmail.com', chrome:'kaknor', templateUrl:'https://business.facebook.com/latest/whatsapp_manager/phone_numbers/?asset_id=951135334630199&business_id=1116453605586355&ir_qe_exposed=1' },
  {key:'hq_official', label:'MAMARIAM HQ OFFICIAL', phone:'601111920587', dailyLimit:10000, wabot:'Naim — Account 1', meta:'Jus Ibu Hamil by Alia', wabaId:'1744157189944013', login:'mamariam.marketingm9f@gmail.com', chrome:'Naim Alpha', templateUrl:'https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=261929100345166&tab=message-templates&filters=%7B%22date_range%22%3A7%2C%22language%22%3A[]%2C%22quality%22%3A[]%2C%22search_text%22%3A%22%22%2C%22status%22%3A[%22APPROVED%22%2C%22IN_APPEAL%22%2C%22PAUSED%22%2C%22PENDING%22%2C%22REJECTED%22]%2C%22tag%22%3A[]%7D&nav_ref=whatsapp_manager&asset_id=1744157189944013'},
  {key:'mamariam8', label:'Mamariam Sdn Bhd 8', phone:'601111920523', dailyLimit:10000, wabot:'Naim — Account 1', meta:'Jus Ibu Hamil by Alia', wabaId:'1320319290309736', login:'mamariam.marketingm9f@gmail.com', chrome:'Naim Alpha', templateUrl:'https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=261929100345166&tab=message-templates&filters=%7B%22date_range%22%3A7%2C%22language%22%3A[]%2C%22quality%22%3A[]%2C%22search_text%22%3A%22%22%2C%22status%22%3A[%22APPROVED%22%2C%22IN_APPEAL%22%2C%22PAUSED%22%2C%22PENDING%22%2C%22REJECTED%22]%2C%22tag%22%3A[]%7D&nav_ref=whatsapp_manager&asset_id=1320319290309736'},
  { key:'60148769013', label:'Mamariam Sdn Bhd 3', phone:'60148769013', dailyLimit:100000, wabot:'Naim — Account 2', meta:'Kak Nur Mariam - Ibu Hamil Bahagia', wabaId:'951135334630199', login:'kaknorycloud@gmail.com', chrome:'kaknor', templateUrl:'https://business.facebook.com/latest/whatsapp_manager/phone_numbers/?asset_id=951135334630199&business_id=1116453605586355&ir_qe_exposed=1' },
  { key:'60142881728', label:'Fathiah Biz 1728', phone:'60142881728', dailyLimit:250, wabot:'Naim — Account 2', meta:'Fathiah Biz', wabaId:'937507759346753', login:'niamamariam1821@gmail.com', chrome:'fani', templateUrl:'https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=174456364884123&tab=message-templates&nav_ref=whatsapp_manager&asset_id=1428338965717585' },
  { key:'601121001339', label:'Fathiah Biz 1339', phone:'601121001339', dailyLimit:250, wabot:'Naim — Account 2', meta:'Fathiah Biz', wabaId:'1428338965717585', login:'niamamariam1821@gmail.com', chrome:'fani', templateUrl:'https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=174456364884123&tab=message-templates&nav_ref=whatsapp_manager&asset_id=1428338965717585' }
];
function digitsOnly(v){ return String(v||'').replace(/\D/g,''); }
function officialForValue(v){
  const d=digitsOnly(v); if(!d) return null;
  return WABOT_OFFICIALS.find(x=>d.includes(x.phone)||x.phone.includes(d)) || null;
}
function entryOfficial(en){ return officialForValue(en.wabotAccount||''); }
function topupDateStr(t){
  if(t.topupDate) return t.topupDate;
  if(t.createdAt && t.createdAt.toDate) return t.createdAt.toDate().toISOString().slice(0,10);
  return '';
}
function initWabotControlInputs(){
  const sel=document.getElementById('topup-phone');
  if(sel && !sel.options.length) sel.innerHTML='<option value="">-- Pilih nombor Official --</option>'+WABOT_OFFICIALS.map(x=>`<option value="${x.key}">${x.label} — ${x.phone}</option>`).join('');
  const d=document.getElementById('topup-date'); if(d && !d.value) d.value=todayStr();
}
function initWalletTransferInputs(){
  const from=document.getElementById('transfer-from');
  const to=document.getElementById('transfer-to');
  const d=document.getElementById('transfer-date');
  const opts='<option value="">-- Pilih nombor --</option>'+
    WABOT_OFFICIALS.map(x=>`<option value="${x.key}">${x.label} — ${x.phone}</option>`).join('');
  if(from && !from.options.length) from.innerHTML=opts;
  if(to && !to.options.length) to.innerHTML=opts;
  if(d && !d.value) d.value=todayStr();
}
function walletTransferRows(){
  return (allTopups||[]).filter(t =>
    String(t.transactionType || t.type || '').toLowerCase() === 'transfer'
  );
}
function walletTopupRows(){
  return (allTopups||[]).filter(t=>t.transactionType!=='transfer');
}
function walletReadiness(acc, stats){
  const dailyLimit=Number(acc.dailyLimit||0);
  const targetSent=Math.min(1000,dailyLimit||1000);
  const neededEUR=costEUR(targetSent);
  const shortfallEUR=Math.max(0,neededEUR-Math.max(0,stats.balanceEUR));
  const ready=shortfallEUR<=0;
  return {dailyLimit,targetSent,neededEUR,shortfallEUR,ready};
}
