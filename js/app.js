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

function walletTransferRecommendations(){
  const accounts=WABOT_OFFICIALS.map(a=>{
    const s=wabotWalletStats(a);
    const r=walletReadiness(a,s);
    return {a,s,r};
  });

  // Fathiah perlu simpan cukup untuk kapasiti sendiri (250/hari).
  const donors=accounts
    .filter(x=>x.a.dailyLimit===250)
    .map(x=>({
      ...x,
      excess:Math.max(0,x.s.balanceEUR-x.r.neededEUR)
    }))
    .filter(x=>x.excess>0.01)
    .sort((a,b)=>b.excess-a.excess);

  // Receiver fokus akaun high-capacity yang belum cukup untuk target 1,000 sent.
  const receivers=accounts
    .filter(x=>x.a.dailyLimit>=10000 && x.r.shortfallEUR>0.01)
    .sort((a,b)=>{
      if(b.a.dailyLimit!==a.a.dailyLimit) return b.a.dailyLimit-a.a.dailyLimit;
      return b.r.shortfallEUR-a.r.shortfallEUR;
    });

  const out=[];
  donors.forEach(d=>{
    let available=d.excess;
    receivers.forEach(r=>{
      if(available<=0.01 || r.r.shortfallEUR<=0.01) return;
      const already=out.filter(x=>x.to===r.a.key).reduce((s,x)=>s+x.amount,0);
      const need=Math.max(0,r.r.shortfallEUR-already);
      const amount=Math.min(available,need);
      if(amount>0.01){
        out.push({
          from:d.a.key, fromLabel:d.a.label,
          to:r.a.key, toLabel:r.a.label,
          amount
        });
        available-=amount;
      }
    });
  });
  return out;
}

function renderTransferRecommendations(){
  const wrap=document.getElementById('wctrl-transfer-recommend');
  if(!wrap) return;
  const rows=walletTransferRecommendations();

  if(!rows.length){
    wrap.innerHTML='<div class="wctrl-rec-ok">✓ Tiada transfer diperlukan untuk capai readiness harian berdasarkan baki anggaran semasa.</div>';
    return;
  }

  wrap.innerHTML=rows.map(x=>`
    <div class="wctrl-rec-row">
      <div>
        <b>${wabotEsc(x.fromLabel)}</b>
        <span>→</span>
        <b>${wabotEsc(x.toLabel)}</b>
      </div>
      <div class="wctrl-rec-actions">
        <strong>€${x.amount.toFixed(2)}</strong>
        <button type="button" class="btn btn-ghost wctrl-use-rec" data-from="${x.from}" data-to="${x.to}" data-amount="${x.amount.toFixed(2)}">Guna Cadangan</button>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.wctrl-use-rec').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      await refreshWalletDataNow();

      // Selepas refresh, cari semula cadangan terkini untuk pasangan yang sama.
      const fresh=walletTransferRecommendations().find(x=>
        x.from===btn.dataset.from &&
        x.to===btn.dataset.to
      );

      const from=document.getElementById('transfer-from');
      const to=document.getElementById('transfer-to');
      const amount=document.getElementById('transfer-amount');

      if(from) from.value=btn.dataset.from;
      if(to) to.value=btn.dataset.to;

      if(amount){
        amount.value=fresh
          ? fresh.amount.toFixed(2)
          : '';
      }

      renderWabotControl();

      document.getElementById('transfer-form')?.scrollIntoView({
        behavior:'smooth',
        block:'center'
      });
    });
  });
}


window.editWalletTransfer = async function(id){
  const row=(allTopups||[]).find(t=>t.id===id);
  if(!row) return toast('Rekod transfer tak dijumpai.',true);

  const amountText=prompt(
    'Amaun transfer baru (€):',
    Number(row.amountEUR||0).toFixed(2)
  );
  if(amountText===null) return;

  const amountEUR=Number(amountText);
  if(!amountEUR || amountEUR<=0){
    return toast('Amaun tidak sah.',true);
  }

  const noteText=prompt('Nota transfer:',row.note||'');
  if(noteText===null) return;

  const from=WABOT_OFFICIALS.find(x=>
    x.key===row.fromOfficialKey ||
    digitsOnly(x.phone)===digitsOnly(row.fromOfficialPhone||'')
  );

  if(!from) return toast('Akaun asal tak dijumpai.',true);

  try{
    // Calculate sender balance as if old transfer is temporarily removed.
    const oldAmount=Number(row.amountEUR||0);
    const current=wabotWalletStats(from);
    const availableIfOldRestored=current.balanceEUR+oldAmount;

    if(amountEUR>Math.max(0,availableIfOldRestored)){
      return toast(
        `Baki tak cukup untuk amaun baru. Maksimum €${Math.max(0,availableIfOldRestored).toFixed(2)}.`,
        true
      );
    }

    await db.collection('topups').doc(id).update({
      amountEUR,
      amountRM:amountEUR*EUR_TO_MYR,
      note:noteText.trim(),
      editedAtMs:Date.now(),
      editedBy:currentProfile.name,
      editedAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    await refreshWalletDataNow();
    toast('Transfer berjaya diedit ✓');
  }catch(err){
    toast('Gagal edit transfer: '+err.message,true);
  }
};

window.deleteWalletTransfer = async function(id){
  const row=(allTopups||[]).find(t=>t.id===id);
  if(!row) return toast('Rekod transfer tak dijumpai.',true);

  const ok=confirm(
    `Buang transfer €${Number(row.amountEUR||0).toFixed(2)}\n`+
    `${row.fromOfficialLabel||''} → ${row.toOfficialLabel||''}?\n\n`+
    `Balance sender dan receiver akan dikira semula automatik.`
  );

  if(!ok) return;

  try{
    await db.collection('topups').doc(id).delete();
    await refreshWalletDataNow();
    toast('Transfer dibuang ✓');
  }catch(err){
    toast('Gagal buang transfer: '+err.message,true);
  }
};

function renderTransferHistory(){
  const body=document.getElementById('wctrl-transfer-body');
  if(!body) return;

  const rows=walletTransferRows();
  if(!rows.length){
    body.innerHTML='<tr><td colspan="7" class="empty-state">Belum ada transfer balance.</td></tr>';
    return;
  }

  body.innerHTML=rows.map(t=>`
    <tr>
      <td>${wabotEsc(t.transferDate || topupDateStr(t) || '-')}</td>
      <td><b>${wabotEsc(t.fromOfficialLabel || '-')}</b><br><span class="wctrl-table-sub">${wabotEsc(t.fromOfficialPhone || '')}</span></td>
      <td><b>${wabotEsc(t.toOfficialLabel || '-')}</b><br><span class="wctrl-table-sub">${wabotEsc(t.toOfficialPhone || '')}</span></td>
      <td class="num">€${Number(t.amountEUR||0).toFixed(2)}</td>
      <td>${wabotEsc(t.note || '-')}</td>
      <td>${wabotEsc(t.createdBy || '-')}</td>
      <td class="wctrl-history-actions">
        <button type="button" class="wctrl-edit-transfer" onclick="editWalletTransfer('${t.id}')">Edit</button>
        <button type="button" class="wctrl-delete-transfer" onclick="deleteWalletTransfer('${t.id}')">Buang</button>
      </td>
    </tr>`).join('');
}

function wabotWalletStats(acc){
  const baselineEUR = wabotOpeningBalanceEUR(acc.phone);
  const baselineDate = WABOT_OPENING_BALANCE_DATE;

  const tops=walletTopupRows().filter(t=>{
    if(String(t.officialKey||'')!==acc.key) return false;
    const d=topupDateStr(t);
    return !d || d > baselineDate;
  });

  const futureTopupEUR=tops.reduce(
    (s,t)=>s+Number(t.amountEUR||0),
    0
  );

  const transfers=walletTransferRows().filter(t=>{
    const d=t.transferDate || topupDateStr(t);
    return !d || d>=baselineDate;
  });

  const transferInEUR=transfers
    .filter(t =>
      String(t.toOfficialKey||'')===acc.key ||
      digitsOnly(t.toOfficialPhone||'')===digitsOnly(acc.phone)
    )
    .reduce((s,t)=>s+Number(t.amountEUR||0),0);

  const transferOutEUR=transfers
    .filter(t =>
      String(t.fromOfficialKey||'')===acc.key ||
      digitsOnly(t.fromOfficialPhone||'')===digitsOnly(acc.phone)
    )
    .reduce((s,t)=>s+Number(t.amountEUR||0),0);

  const rows=(allEntries||[]).filter(en=>{
    const a=entryOfficial(en);
    return a &&
      a.key===acc.key &&
      (!en.tarikh || en.tarikh>=baselineDate);
  });

  const sent=rows.reduce(
    (s,en)=>s+Number(en.sent||0),
    0
  );

  const usageEUR=costEUR(sent);
  const topupEUR=baselineEUR+futureTopupEUR;
  const fundsInEUR=topupEUR+transferInEUR;
  const balanceEUR=topupEUR+transferInEUR-transferOutEUR-usageEUR;

  return {
    topupEUR,
    baselineEUR,
    futureTopupEUR,
    transferInEUR,
    transferOutEUR,
    fundsInEUR,
    firstTopup:baselineDate,
    sent,
    usageEUR,
    balanceEUR,
    topups:(baselineEUR>0?1:0)+tops.length
  };
}
function renderWabotControl(){
  const grid=document.getElementById('wctrl-grid'); if(!grid) return;
  initWalletTransferInputs();

  const stats=WABOT_OFFICIALS.map(a=>({a,s:wabotWalletStats(a)}));
  const totalTop=stats.reduce((x,r)=>x+r.s.topupEUR,0);
  const totalUse=stats.reduce((x,r)=>x+r.s.usageEUR,0);
  const totalBal=stats.reduce((x,r)=>x+r.s.balanceEUR,0);
  const low=stats.filter(r=>r.s.topupEUR>0 && r.s.balanceEUR<5).length;

  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('wctrl-total-topup','€'+totalTop.toFixed(2));
  set('wctrl-total-usage','€'+totalUse.toFixed(2));
  set('wctrl-total-balance','€'+totalBal.toFixed(2));
  set('wctrl-low-count',String(low));

  grid.innerHTML=stats.map(({a,s})=>{
    const pct=s.fundsInEUR?Math.max(0,Math.min(100,s.balanceEUR/s.fundsInEUR*100)):0;
    const status=!s.fundsInEUR?'BELUM TOPUP':s.balanceEUR<0?'OVER USED':s.balanceEUR<5?'LOW BALANCE':'OK';
    const cls=!s.fundsInEUR?'neutral':s.balanceEUR<5?'danger':'ok';
    const ready=walletReadiness(a,s);
    const readinessClass=ready.ready?'ready':'shortfall';
    const limitLabel=a.dailyLimit>=1000?fmt(a.dailyLimit):String(a.dailyLimit);

    return `<article class="wctrl-card">
      <div class="wctrl-card-head">
        <div>
          <div class="wctrl-name">${wabotEsc(a.label)}</div>
          <div class="wctrl-phone">${a.phone}</div>
        </div>
        <span class="wctrl-status ${cls}">${status}</span>
      </div>

      <div class="wctrl-account"><span class="wctrl-dot"></span>${wabotEsc(a.wabot)}</div>

      <div class="wctrl-readiness ${readinessClass}">
        <div>
          <span>DAILY LIMIT</span>
          <b>${limitLabel}/hari</b>
        </div>
        <div>
          <span>TARGET READY</span>
          <b>${fmt(ready.targetSent)} sent · €${ready.neededEUR.toFixed(2)}</b>
        </div>
        <strong>${ready.ready?'READY':'SHORT €'+ready.shortfallEUR.toFixed(2)}</strong>
      </div>

      <div class="wctrl-money">
        <div class="wctrl-balance-main"><span>BAKI ANGGARAN</span><b>€${s.balanceEUR.toFixed(2)}</b></div>
        <div><span>TOPUP / OPENING</span><b>€${s.topupEUR.toFixed(2)}</b></div>
      </div>

      <div class="wctrl-balance-track"><span style="width:${pct.toFixed(1)}%"></span></div>

      <div class="wctrl-mini">
        <span><small>Usage</small> €${s.usageEUR.toFixed(2)}</span>
        <span><small>Transfer In</small> €${s.transferInEUR.toFixed(2)}</span>
        <span><small>Transfer Out</small> €${s.transferOutEUR.toFixed(2)}</span>
      </div>
      <div class="wctrl-mini">
        <span><small>Sent</small> ${fmt(s.sent)}</span>
        <span><small>Topup</small> ${s.topups}</span>
        <span><small>Target Cost</small> €${ready.neededEUR.toFixed(2)}</span>
      </div>

      <div class="wctrl-meta">
        <div class="wctrl-meta-title">${wabotEsc(a.meta)}</div>
        <div><span class="wctrl-meta-label">WABA</span>${wabotEsc(a.wabaId)}</div>
        <div><span class="wctrl-meta-label">Login</span>${wabotEsc(a.login)}</div>
        <div><span class="wctrl-meta-label">Chrome</span>${wabotEsc(a.chrome)}</div>
      </div>

      ${a.templateUrl
        ? `<a class="wctrl-template" href="${a.templateUrl}" target="_blank" rel="noopener"><span>Manage Template</span><b>↗</b></a>`
        : `<button class="wctrl-template disabled" disabled><span>Link Template Belum Diset</span></button>`}
    </article>`;
  }).join('');

  const body=document.getElementById('wctrl-meta-body');
  if(body) body.innerHTML=WABOT_OFFICIALS.map(a=>`
    <tr>
      <td><b>${wabotEsc(a.label)}</b><br><span class="wctrl-table-sub">${a.phone}</span></td>
      <td>${wabotEsc(a.wabot)}</td>
      <td class="num">${fmt(a.dailyLimit)}/hari</td>
      <td>${wabotEsc(a.meta)}<br><span class="wctrl-table-sub">${wabotEsc(a.wabaId)}</span></td>
      <td>${wabotEsc(a.login)}</td>
      <td>${wabotEsc(a.chrome)}</td>
      <td>${a.templateUrl?`<a class="wctrl-link" href="${a.templateUrl}" target="_blank" rel="noopener">Buka ↗</a>`:'<span class="wctrl-table-sub">Belum diset</span>'}</td>
    </tr>`).join('');

  renderTransferRecommendations();
  renderTransferHistory();
}
function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ---- Theme toggle (dark/light) ----
function applyThemeIcon() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const originalToggle = document.getElementById('theme-toggle');
  if (originalToggle) originalToggle.textContent = isLight ? '☀️' : '🌙';

  const visibleToggle = document.getElementById('crm-visible-theme-toggle');
  if (visibleToggle) visibleToggle.textContent = isLight ? '☀️' : '🌙';
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }
  applyThemeIcon();
});

// Visible topbar theme button uses the same theme logic.
document.getElementById('crm-visible-theme-toggle')?.addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }

  applyThemeIcon();
});

applyThemeIcon();

// ---- Auth guard ----
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  const snap = await db.collection('users').doc(user.uid).get();
  currentProfile = snap.exists ? snap.data() : { name: user.email, role: 'staff' };
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  document.getElementById('user-name').textContent = currentProfile.name;
  document.getElementById('user-avatar').textContent = (currentProfile.name || 'U').charAt(0).toUpperCase();
  const roleBadge = document.getElementById('user-role');
  roleBadge.textContent = currentProfile.role === 'admin' ? 'Admin' : 'Staff';
  roleBadge.classList.toggle('admin', currentProfile.role === 'admin');
  if (currentProfile.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  document.getElementById('entry-tarikh').value = todayStr();
  document.getElementById('todo-date').value = todayStr();
  document.getElementById('todo-filter-date').value = todayStr();
  populateStaffFilter();
  loadKnownSources();
  startListeners();
  startTopupListener();
  startPlanningListener();
  startPackageAnalysisListener();
  initWabotControlInputs();
  updateTopupVisibility();

  // V9.2: selepas login / browser refresh, jangan tunggu user klik apa-apa.
  // Load Wallet Ledger + Transfer History terus dari Firestore.
  await refreshWalletDataNow();
  // Listener boleh fire sebelum ledger selesai; render sekali lagi selepas tick pertama.
  setTimeout(()=>refreshWalletDataNow(),800);
});

document.getElementById('logout-btn').onclick = () => auth.signOut();

// ---- Nav ----
document.querySelectorAll('.app-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.app-nav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'contacts') { loadKnownSources(); loadContactStats(); loadContactsPage('first'); loadImportBatches(); }
    if (btn.dataset.view === 'filter') { buildTagCheckRow('seg-filter-tags', [], null); populateBatchSelect(); }
    if (btn.dataset.view === 'tiktokleads') { startTikTokLeadsListener(); initTikTokLeadsView(); renderTikTokLeads(); }
    if (btn.dataset.view === 'packageanalysis') { renderPackageAnalysis(); }
  });
});



// ============================================================
// PAKEJ ANALISIS — PRICE & OFFER COMPARISON
// ============================================================
function pkgNum(v){ return Number(v||0)||0; }
function pkgMoney(v){ return 'RM '+pkgNum(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pkgEsc(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function pkgRenderImagePreview(){
  const img=document.getElementById('pkg-image-preview');
  const empty=document.getElementById('pkg-image-empty');
  if(!img||!empty)return;
  if(packageImageData){
    img.src=packageImageData;
    img.style.display='block';
    empty.style.display='none';
  }else{
    img.removeAttribute('src');
    img.style.display='none';
    empty.style.display='block';
  }
}

function pkgCompressImage(file,maxW=900,maxH=900,quality=.78){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Gagal baca gambar.'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Format gambar tidak disokong.'));
      img.onload=()=>{
        let {width,height}=img;
        const scale=Math.min(1,maxW/width,maxH/height);
        width=Math.max(1,Math.round(width*scale));
        height=Math.max(1,Math.round(height*scale));
        const c=document.createElement('canvas');
        c.width=width;c.height=height;
        c.getContext('2d').drawImage(img,0,0,width,height);
        resolve(c.toDataURL('image/jpeg',quality));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function pkgChannelRows(r){
  return [
    {key:'WhatsApp',price:pkgNum(r.waPrice),qty:pkgNum(r.waQty),items:r.waItems||''},
    {key:'CRM',price:pkgNum(r.crmPrice),qty:pkgNum(r.crmQty),items:r.crmItems||''},
    {key:'TikTok',price:pkgNum(r.ttPrice),qty:pkgNum(r.ttQty),items:r.ttItems||''}
  ].filter(x=>x.price>0);
}

function pkgCheapest(r){
  const rows=pkgChannelRows(r);
  if(!rows.length)return {key:'–',price:0};
  return rows.sort((a,b)=>a.price-b.price)[0];
}

function pkgSaveVsWa(r){ return pkgNum(r.waPrice)-pkgNum(r.crmPrice); }
function pkgSaveVsTt(r){ return pkgNum(r.ttPrice)-pkgNum(r.crmPrice); }

function pkgValuePerMainItem(price,qty){
  return qty>0 ? price/qty : 0;
}


function pkgEntryMonth(e){
  const d=String(e.tarikh||'').slice(0,7);
  if(/^\d{4}-\d{2}$/.test(d)) return d;
  if(e.createdAt?.toDate){
    const dt=e.createdAt.toDate();
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  }
  return '';
}

function pkgContextText(e){
  return [e.kategori,e.source,e.template,e.poster,e.project,e.note].filter(Boolean).join(' ').toLowerCase();
}

function pkgCatalogCandidatesForEntry(e){
  const ctx=pkgContextText(e);
  let codes=Object.keys(CRM_PROMO_CATALOG).filter(k=>CRM_PROMO_CATALOG[k].price>0);

  // Use project/template words only to narrow equal-price family ambiguity.
  const hasYg=/ygrow|ygf|tinggi anak|tinggi badan/.test(ctx);
  const hasMilk=/mocha|hazelnut|susu/.test(ctx);
  const hasJus=/jus|mamariam|promo tiktok|crm/.test(ctx);

  if(hasYg && !hasMilk) codes=codes.filter(k=>/^YG/.test(k) || /^CRM/.test(k));
  else if(hasMilk && !hasYg) codes=codes.filter(k=>/^MILK/.test(k) || /^YG/.test(k) || /^CRM/.test(k));
  else if(hasJus && !hasMilk && !hasYg) codes=codes.filter(k=>/^CRM/.test(k));

  return codes;
}

function pkgInferOldEntry(e){
  const sales=pkgNum(e.sales), buyer=pkgNum(e.buyer);
  if(!sales) return {status:'none',label:'–',price:0,packages:0,confidence:'–',reason:'Tiada sales'};

  // Newer records already tagged: exact source of truth.
  if(e.promoCode){
    const info=crmPromoInfo(e.promoCode);
    const packages=info.price>0?sales/info.price:0;
    return {
      status:'tagged', code:e.promoCode,label:info.label,price:info.price,
      packages,confidence:'Tagged',reason:'Promo dipilih dalam Input Data'
    };
  }

  const candidates=[];
  pkgCatalogCandidatesForEntry(e).forEach(code=>{
    const info=CRM_PROMO_CATALOG[code];
    if(!info?.price)return;
    const q=sales/info.price;
    const rounded=Math.round(q);
    const exact=Math.abs(q-rounded)<0.001 && rounded>0;
    if(!exact)return;

    let score=60;
    let reasons=[`RM${sales} ÷ RM${info.price} = ${rounded}`];

    if(buyer>0 && buyer===rounded){ score+=30; reasons.push(`Buyer ${buyer} = ${rounded} pakej`); }
    else if(buyer>0 && buyer!==rounded){ score-=12; reasons.push(`Buyer ${buyer} tidak sama dengan ${rounded} pakej`); }

    const ctx=pkgContextText(e);
    if(/^YG/.test(code) && /ygrow|ygf/.test(ctx)){score+=15;reasons.push('Konteks YGROW');}
    if(/^MILK/.test(code) && /mocha|hazelnut|susu/.test(ctx)){score+=15;reasons.push('Konteks susu');}
    if(/^CRM/.test(code) && /jus|promo tiktok|crm|mamariam/.test(ctx)){score+=10;reasons.push('Konteks Jus/CRM');}

    candidates.push({code,label:info.label,price:info.price,packages:rounded,score,reasons});
  });

  if(!candidates.length){
    return {status:'review',label:'Tak dapat dikenal pasti',price:0,packages:0,confidence:'Perlu semak',reason:'Sales tidak padan tepat dengan harga promo yang diketahui'};
  }

  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  const sameTop=candidates.filter(x=>x.score===best.score);

  // Same price but different product family = deliberately ambiguous.
  const sameMath=candidates.filter(x=>x.price===best.price && x.packages===best.packages);
  if(sameTop.length>1 || sameMath.length>1){
    const labels=[...new Set((sameTop.length>1?sameTop:sameMath).map(x=>x.label))];
    return {
      status:'review',label:labels.join(' / '),price:best.price,packages:best.packages,
      confidence:'Perlu semak',reason:`Nilai sesuai dengan lebih daripada satu promo RM${best.price}`
    };
  }

  const confidence=best.score>=85?'Tinggi':'Sederhana';
  return {
    status:'inferred',code:best.code,label:best.label,price:best.price,packages:best.packages,
    confidence,reason:best.reasons.join(' • ')
  };
}

function pkgPopulateHistoryMonths(){
  const sel=document.getElementById('pkg-history-month'); if(!sel)return;
  const months=[...new Set((allEntries||[]).map(pkgEntryMonth).filter(Boolean))].sort().reverse();
  const prev=sel.value;
  sel.innerHTML=months.map(m=>{
    const [y,mo]=m.split('-').map(Number);
    const label=new Date(y,mo-1,1).toLocaleDateString('ms-MY',{month:'long',year:'numeric'});
    return `<option value="${m}">${label}</option>`;
  }).join('');
  if(prev && months.includes(prev)) sel.value=prev;
  else if(months.includes('2026-08')) sel.value='2026-08';
  else if(months.length) sel.value=months[0];
}

function renderHistoricalPackageAnalysis(){
  const sel=document.getElementById('pkg-history-month'); if(!sel)return;
  if(!sel.options.length) pkgPopulateHistoryMonths();
  const month=sel.value;
  const monthRows=(allEntries||[]).filter(e=>pkgEntryMonth(e)===month && pkgNum(e.sales)>0);
  const analyses=monthRows.map(e=>({e,a:pkgInferOldEntry(e)}));

  const totalSales=monthRows.reduce((s,e)=>s+pkgNum(e.sales),0);
  const known=analyses.filter(x=>x.a.status==='tagged'||x.a.status==='inferred');
  const knownSales=known.reduce((s,x)=>s+pkgNum(x.e.sales),0);
  const packages=known.reduce((s,x)=>s+pkgNum(x.a.packages),0);
  const review=analyses.filter(x=>x.a.status==='review').length;

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('pkg-hist-sales',pkgMoney(totalSales));
  set('pkg-hist-known-sales',pkgMoney(knownSales));
  set('pkg-hist-packages',Number.isInteger(packages)?fmt(packages):packages.toLocaleString('en-MY',{maximumFractionDigits:2}));
  set('pkg-hist-review',fmt(review));

  const grouped={};
  known.forEach(({e,a})=>{
    const key=a.code||a.label;
    if(!grouped[key])grouped[key]={label:a.label,price:a.price,sales:0,packages:0,buyer:0,entries:0,tagged:0,inferred:0};
    const g=grouped[key];
    g.sales+=pkgNum(e.sales);g.packages+=pkgNum(a.packages);g.buyer+=pkgNum(e.buyer);g.entries++;
    if(a.status==='tagged')g.tagged++; else g.inferred++;
  });

  const summary=document.getElementById('pkg-history-summary-body');
  if(summary){
    const groups=Object.values(grouped).sort((a,b)=>b.sales-a.sales);
    summary.innerHTML=groups.length?groups.map(g=>`<tr>
      <td class="tname"><b>${pkgEsc(g.label)}</b></td>
      <td class="num">${g.price?pkgMoney(g.price):'–'}</td>
      <td class="num"><b>${pkgMoney(g.sales)}</b></td>
      <td class="num">${Number.isInteger(g.packages)?fmt(g.packages):g.packages.toFixed(2)}</td>
      <td class="num">${fmt(g.buyer)}</td>
      <td class="num">${fmt(g.entries)}</td>
      <td><span class="pkg-confidence ${g.inferred?'medium':'tagged'}">${g.tagged&&g.inferred?'Tagged + Anggaran':g.inferred?'Anggaran':'Tagged'}</span></td>
    </tr>`).join(''):'<tr><td colspan="7" class="empty-state">Tiada pakej yang boleh dikenal pasti dengan yakin untuk bulan ini.</td></tr>';
  }

  const detail=document.getElementById('pkg-history-detail-body');
  if(detail){
    detail.innerHTML=analyses.length?analyses.map(({e,a})=>`<tr>
      <td>${pkgEsc(e.tarikh||'-')}</td>
      <td class="num">${pkgMoney(e.sales)}</td>
      <td class="num">${fmt(e.buyer||0)}</td>
      <td>${pkgEsc(e.kategori||e.source||'-')}</td>
      <td>${pkgEsc(a.label)}</td>
      <td class="num">${a.packages?pkgNum(a.packages).toLocaleString('en-MY',{maximumFractionDigits:2}):'–'}</td>
      <td><span class="pkg-confidence ${a.status==='review'?'review':a.status==='tagged'?'tagged':a.confidence==='Tinggi'?'high':'medium'}">${pkgEsc(a.confidence)}</span></td>
      <td class="pkg-reason">${pkgEsc(a.reason)}</td>
    </tr>`).join(''):'<tr><td colspan="8" class="empty-state">Tiada sales untuk bulan ini.</td></tr>';
  }
  if(typeof initSortableTables==='function')setTimeout(()=>initSortableTables(document),20);
}

function renderPackageAnalysis(){
  pkgPopulateHistoryMonths();
  renderHistoricalPackageAnalysis();
  const search=(document.getElementById('pkg-search')?.value||'').trim().toLowerCase();
  const rows=allPackageAnalysis.filter(r=>{
    if(!search)return true;
    return [r.name,r.waItems,r.crmItems,r.ttItems,r.note].some(v=>String(v||'').toLowerCase().includes(search));
  });

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('pkg-total-count',fmt(rows.length));

  const crmCheapest=rows.filter(r=>pkgCheapest(r).key==='CRM').length;
  set('pkg-crm-cheapest-count',fmt(crmCheapest));

  const waComparable=rows.filter(r=>pkgNum(r.waPrice)>0&&pkgNum(r.crmPrice)>0);
  const ttComparable=rows.filter(r=>pkgNum(r.ttPrice)>0&&pkgNum(r.crmPrice)>0);
  const avgWa=waComparable.length?waComparable.reduce((s,r)=>s+pkgSaveVsWa(r),0)/waComparable.length:0;
  const avgTt=ttComparable.length?ttComparable.reduce((s,r)=>s+pkgSaveVsTt(r),0)/ttComparable.length:0;
  set('pkg-avg-save-wa',pkgMoney(avgWa));
  set('pkg-avg-save-tt',pkgMoney(avgTt));

  const body=document.getElementById('pkg-table-body');
  if(body){
    if(!rows.length){
      body.innerHTML='<tr><td colspan="12" class="empty-state">Belum ada pakej direkod.</td></tr>';
    }else{
      body.innerHTML=rows.map(r=>{
        const cheapest=pkgCheapest(r);
        const saveWa=pkgSaveVsWa(r);
        const saveTt=pkgSaveVsTt(r);
        const waUnit=pkgValuePerMainItem(pkgNum(r.waPrice),pkgNum(r.waQty));
        const crmUnit=pkgValuePerMainItem(pkgNum(r.crmPrice),pkgNum(r.crmQty));
        const ttUnit=pkgValuePerMainItem(pkgNum(r.ttPrice),pkgNum(r.ttQty));
        return `<tr>
          <td class="pkg-thumb-cell">${r.imageData?`<img class="pkg-thumb" src="${r.imageData}" alt="${pkgEsc(r.name||'Pakej')}">`:'<span class="pkg-no-image">–</span>'}</td>
          <td class="tname"><b>${pkgEsc(r.name||'-')}</b>${r.note?`<small class="pkg-row-note">${pkgEsc(r.note)}</small>`:''}</td>
          <td class="num">${pkgMoney(r.waPrice)}${waUnit?`<small class="pkg-unit">≈ ${pkgMoney(waUnit)}/item utama</small>`:''}</td>
          <td class="pkg-items-cell">${pkgEsc(r.waItems||'-')}</td>
          <td class="num ${cheapest.key==='CRM'?'pkg-cheapest-cell':''}">${pkgMoney(r.crmPrice)}${crmUnit?`<small class="pkg-unit">≈ ${pkgMoney(crmUnit)}/item utama</small>`:''}</td>
          <td class="pkg-items-cell">${pkgEsc(r.crmItems||'-')}</td>
          <td class="num ${cheapest.key==='TikTok'?'pkg-cheapest-cell':''}">${pkgMoney(r.ttPrice)}${ttUnit?`<small class="pkg-unit">≈ ${pkgMoney(ttUnit)}/item utama</small>`:''}</td>
          <td class="pkg-items-cell">${pkgEsc(r.ttItems||'-')}</td>
          <td><span class="pkg-channel-pill ${cheapest.key.toLowerCase()}">${cheapest.key}</span></td>
          <td class="num ${saveWa>0?'pkg-positive':saveWa<0?'pkg-negative':''}">${saveWa===0?'RM 0.00':(saveWa>0?'+ ':'- ')+pkgMoney(Math.abs(saveWa))}</td>
          <td class="num ${saveTt>0?'pkg-positive':saveTt<0?'pkg-negative':''}">${saveTt===0?'RM 0.00':(saveTt>0?'+ ':'- ')+pkgMoney(Math.abs(saveTt))}</td>
          <td class="pkg-action-cell">
            <button type="button" class="pkg-action-btn" onclick="editPackageAnalysis('${r.id}')">Edit</button>
            <button type="button" class="pkg-action-btn danger" onclick="deletePackageAnalysis('${r.id}')">Padam</button>
          </td>
        </tr>`;
      }).join('');
      if(typeof initSortableTables==='function') setTimeout(()=>initSortableTables(document),20);
    }
  }


  const salesBody=document.getElementById('pkg-sales-body');
  if(salesBody){
    const tagged=(allEntries||[]).filter(e=>e.promoCode && pkgNum(e.sales)>0);
    const grouped={};
    tagged.forEach(e=>{
      const code=e.promoCode, info=crmPromoInfo(code);
      if(!grouped[code]) grouped[code]={code,label:info.label,price:info.price,sales:0,buyer:0,entries:0};
      grouped[code].sales+=pkgNum(e.sales);
      grouped[code].buyer+=pkgNum(e.buyer);
      grouped[code].entries+=1;
    });
    const groups=Object.values(grouped).sort((a,b)=>b.sales-a.sales);
    const totalPromoSales=groups.reduce((s,g)=>s+g.sales,0);
    if(!groups.length){
      salesBody.innerHTML='<tr><td colspan="7" class="empty-state">Belum ada sales yang ditag dengan promo.</td></tr>';
    }else{
      salesBody.innerHTML=groups.map(g=>{
        const exact=g.price>0?g.sales/g.price:0;
        const rounded=Math.round(exact);
        const exactEnough=g.price>0 && Math.abs(exact-rounded)<0.001;
        const unitText=g.price?(exactEnough?fmt(rounded):'≈ '+exact.toLocaleString('en-MY',{maximumFractionDigits:2})):'–';
        const share=totalPromoSales?g.sales/totalPromoSales*100:0;
        return `<tr>
          <td class="tname"><b>${pkgEsc(g.label)}</b></td>
          <td class="num">${g.price?pkgMoney(g.price):'–'}</td>
          <td class="num"><b>${pkgMoney(g.sales)}</b></td>
          <td class="num">${unitText}</td>
          <td class="num">${fmt(g.buyer)}</td>
          <td class="num">${fmt(g.entries)}</td>
          <td class="num">${share.toFixed(1)}%</td>
        </tr>`;
      }).join('');
      if(typeof initSortableTables==='function') setTimeout(()=>initSortableTables(document),20);
    }
  }

  const insight=document.getElementById('pkg-insight-grid');
  if(insight){
    if(!rows.length){
      insight.innerHTML='<div class="empty-state">Tambah pakej untuk hasilkan analisis.</div>';
    }else{
      insight.innerHTML=rows.map(r=>{
        const c=pkgCheapest(r), sw=pkgSaveVsWa(r), st=pkgSaveVsTt(r);
        const crmUnit=pkgValuePerMainItem(pkgNum(r.crmPrice),pkgNum(r.crmQty));
        const waUnit=pkgValuePerMainItem(pkgNum(r.waPrice),pkgNum(r.waQty));
        const ttUnit=pkgValuePerMainItem(pkgNum(r.ttPrice),pkgNum(r.ttQty));
        const unitPairs=[
          {k:'WhatsApp',v:waUnit},{k:'CRM',v:crmUnit},{k:'TikTok',v:ttUnit}
        ].filter(x=>x.v>0).sort((a,b)=>a.v-b.v);
        const bestUnit=unitPairs[0];
        return `<article class="pkg-insight-card">
          ${r.imageData?`<img class="pkg-insight-image" src="${r.imageData}" alt="${pkgEsc(r.name||'Pakej')}">`:''}
          <div class="pkg-insight-top"><span>${pkgEsc(r.name||'-')}</span><b class="pkg-channel-pill ${c.key.toLowerCase()}">${c.key} paling murah</b></div>
          <div class="pkg-insight-main">
            <strong>${pkgMoney(c.price)}</strong>
            <small>Harga terendah antara channel</small>
          </div>
          <div class="pkg-insight-lines">
            <div><span>CRM vs WhatsApp</span><b class="${sw>=0?'pkg-positive':'pkg-negative'}">${sw>=0?'Jimat ':'Lebih mahal '}${pkgMoney(Math.abs(sw))}</b></div>
            <div><span>CRM vs TikTok</span><b class="${st>=0?'pkg-positive':'pkg-negative'}">${st>=0?'Jimat ':'Lebih mahal '}${pkgMoney(Math.abs(st))}</b></div>
            <div><span>Value / item utama</span><b>${bestUnit?`${bestUnit.k} ${pkgMoney(bestUnit.v)}`:'Tiada qty'}</b></div>
          </div>
        </article>`;
      }).join('');
    }
  }
}

function startPackageAnalysisListener(){
  if(unsubPackageAnalysis)return;
  unsubPackageAnalysis=db.collection('packageAnalysis').orderBy('createdAt','desc').onSnapshot(snap=>{
    allPackageAnalysis=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderPackageAnalysis();
  },err=>toast('Ralat baca Pakej Analisis: '+err.message,true));
}

function updatePackageLiveComparison(){
  const wa=pkgNum(document.getElementById('pkg-wa-price')?.value);
  const crm=pkgNum(document.getElementById('pkg-crm-price')?.value);
  const tt=pkgNum(document.getElementById('pkg-tt-price')?.value);
  const fake={waPrice:wa,crmPrice:crm,ttPrice:tt};
  const sw=wa&&crm?wa-crm:0,st=tt&&crm?tt-crm:0,c=pkgCheapest(fake);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('pkg-live-wa',(sw>=0?'+ ':'- ')+pkgMoney(Math.abs(sw)));
  set('pkg-live-tt',(st>=0?'+ ':'- ')+pkgMoney(Math.abs(st)));
  set('pkg-live-cheapest',c.key==='–'?'–':`${c.key} • ${pkgMoney(c.price)}`);
}

function resetPackageForm(){
  editingPackageId=null;
  packageImageData='';
  document.getElementById('pkg-form')?.reset();
  pkgRenderImagePreview();
  ['pkg-wa-price','pkg-wa-qty','pkg-crm-price','pkg-crm-qty','pkg-tt-price','pkg-tt-qty'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='0';});
  const title=document.getElementById('pkg-form-title');if(title)title.textContent='Tambah Pakej';
  const save=document.getElementById('pkg-save-btn');if(save)save.textContent='Simpan Pakej';
  updatePackageLiveComparison();
}

function fillPackageExample(){
  const vals={
    'pkg-name':'Combo Koko',
    'pkg-wa-price':'199',
    'pkg-wa-qty':'4',
    'pkg-wa-items':'4 botol Jus Mamariam + 1 kotak Koko Zuriat',
    'pkg-crm-price':'179',
    'pkg-crm-qty':'4',
    'pkg-crm-items':'4 botol Jus Mamariam + FREE 1 shaker + 1 kotak Koko Zuriat',
    'pkg-tt-price':'196',
    'pkg-tt-qty':'3',
    'pkg-tt-items':'3 botol Jus Mamariam + FREE 1 kotak Koko Zuriat',
    'pkg-note':'Contoh comparison: CRM RM179, WhatsApp RM199, TikTok RM196.'
  };
  Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
  packageImageData=''; pkgRenderImagePreview();
  document.getElementById('pkg-modal-backdrop')?.classList.add('open');
  updatePackageLiveComparison();
  document.getElementById('pkg-entry-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function editPackageAnalysis(id){
  const r=allPackageAnalysis.find(x=>x.id===id);if(!r)return;
  editingPackageId=id;
  packageImageData=r.imageData||''; pkgRenderImagePreview();
  const vals={
    'pkg-name':r.name||'','pkg-wa-price':pkgNum(r.waPrice),'pkg-wa-qty':pkgNum(r.waQty),'pkg-wa-items':r.waItems||'',
    'pkg-crm-price':pkgNum(r.crmPrice),'pkg-crm-qty':pkgNum(r.crmQty),'pkg-crm-items':r.crmItems||'',
    'pkg-tt-price':pkgNum(r.ttPrice),'pkg-tt-qty':pkgNum(r.ttQty),'pkg-tt-items':r.ttItems||'','pkg-note':r.note||''
  };
  Object.entries(vals).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
  document.getElementById('pkg-form-title').textContent='Edit Pakej';
  document.getElementById('pkg-save-btn').textContent='Update Pakej';
  document.getElementById('pkg-modal-backdrop')?.classList.add('open');
  updatePackageLiveComparison();
  document.getElementById('pkg-entry-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function deletePackageAnalysis(id){
  const r=allPackageAnalysis.find(x=>x.id===id);
  if(!r||!confirm(`Padam pakej "${r.name||''}"?`))return;
  try{await db.collection('packageAnalysis').doc(id).delete();toast('Pakej dipadam ✓');}
  catch(err){toast('Gagal padam pakej: '+err.message,true);}
}

document.getElementById('pkg-open-form')?.addEventListener('click',()=>{
  resetPackageForm();
  document.getElementById('pkg-modal-backdrop')?.classList.add('open');
});
document.getElementById('pkg-close-form')?.addEventListener('click',()=>document.getElementById('pkg-modal-backdrop')?.classList.remove('open'));
document.getElementById('pkg-modal-backdrop')?.addEventListener('click',e=>{
  if(e.target===e.currentTarget)e.currentTarget.classList.remove('open');
});
document.getElementById('pkg-reset-btn')?.addEventListener('click',resetPackageForm);
document.getElementById('pkg-fill-example')?.addEventListener('click',fillPackageExample);
document.getElementById('pkg-search')?.addEventListener('input',renderPackageAnalysis);
document.getElementById('pkg-history-month')?.addEventListener('change',renderHistoricalPackageAnalysis);

document.getElementById('pkg-image-file')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  try{
    packageImageData=await pkgCompressImage(file);
    pkgRenderImagePreview();
  }catch(err){toast(err.message||'Gagal proses gambar',true);}
});
document.getElementById('pkg-remove-image')?.addEventListener('click',()=>{
  packageImageData='';
  const f=document.getElementById('pkg-image-file'); if(f)f.value='';
  pkgRenderImagePreview();
});
['pkg-wa-price','pkg-crm-price','pkg-tt-price'].forEach(id=>document.getElementById(id)?.addEventListener('input',updatePackageLiveComparison));

document.getElementById('pkg-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=document.getElementById('pkg-save-btn');if(btn)btn.disabled=true;
  try{
    const payload={
      name:document.getElementById('pkg-name').value.trim(),
      waPrice:pkgNum(document.getElementById('pkg-wa-price').value),
      waQty:pkgNum(document.getElementById('pkg-wa-qty').value),
      waItems:document.getElementById('pkg-wa-items').value.trim(),
      crmPrice:pkgNum(document.getElementById('pkg-crm-price').value),
      crmQty:pkgNum(document.getElementById('pkg-crm-qty').value),
      crmItems:document.getElementById('pkg-crm-items').value.trim(),
      ttPrice:pkgNum(document.getElementById('pkg-tt-price').value),
      ttQty:pkgNum(document.getElementById('pkg-tt-qty').value),
      ttItems:document.getElementById('pkg-tt-items').value.trim(),
      note:document.getElementById('pkg-note').value.trim(),
      imageData:packageImageData||'',
      updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy:currentUser?.email||''
    };
    if(!payload.name)throw new Error('Nama pakej diperlukan.');
    if(editingPackageId){
      await db.collection('packageAnalysis').doc(editingPackageId).update(payload);
      toast('Pakej dikemaskini ✓');
    }else{
      payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();
      payload.createdBy=currentUser?.email||'';
      await db.collection('packageAnalysis').add(payload);
      toast('Pakej disimpan ✓');
    }
    resetPackageForm();
    document.getElementById('pkg-modal-backdrop')?.classList.remove('open');
  }catch(err){toast('Gagal simpan pakej: '+err.message,true);}
  finally{if(btn)btn.disabled=false;}
});


// ============================================================
// TIKTOK LEADS — LEAD MAGNET PERFORMANCE DASHBOARD
// ============================================================
function ttNum(v){ return Number(v||0) || 0; }
function ttMoney(v){ return 'RM ' + ttNum(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function ttPct(v){ return ttNum(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}) + '%'; }
function ttEsc(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function ttDateStr(row){
  if(row.date) return String(row.date).slice(0,10);
  if(row.createdAt?.toDate) return row.createdAt.toDate().toISOString().slice(0,10);
  return '';
}

function ttMetrics(rows){
  const spend=rows.reduce((s,r)=>s+ttNum(r.spend),0);
  const impressions=rows.reduce((s,r)=>s+ttNum(r.impressions),0);
  const clicks=rows.reduce((s,r)=>s+ttNum(r.clicks),0);
  const results=rows.reduce((s,r)=>s+ttNum(r.results),0);
  const leads=rows.reduce((s,r)=>s+ttNum(r.leads),0);
  return {spend,impressions,clicks,results,leads,ctr:impressions?clicks/impressions*100:0,cpc:clicks?spend/clicks:0,cpl:leads?spend/leads:0,capture:results?leads/results*100:0};
}

function ttFilteredRows(){
  const from=document.getElementById('tt-filter-from')?.value||'';
  const to=document.getElementById('tt-filter-to')?.value||'';
  const campaign=document.getElementById('tt-filter-campaign')?.value||'';
  const creative=document.getElementById('tt-filter-creative')?.value||'';
  return allTikTokLeads.filter(r=>{
    const d=ttDateStr(r);
    if(from && d<from) return false;
    if(to && d>to) return false;
    if(campaign && r.campaign!==campaign) return false;
    if(creative && r.adName!==creative) return false;
    return true;
  });
}

function ttCreativeGroups(rows){
  const map=new Map();
  rows.forEach(r=>{
    const key=String(r.adName||'Tanpa Nama').trim()||'Tanpa Nama';
    if(!map.has(key)) map.set(key,[]);
    map.get(key).push(r);
  });
  const groups=[...map.entries()].map(([name,items])=>{
    const m=ttMetrics(items);
    const latest=[...items].sort((a,b)=>ttDateStr(b).localeCompare(ttDateStr(a)))[0]||{};
    return {name,items,...m,campaign:latest.campaign||'',hook:latest.hook||'',status:latest.status||'',postUrl:latest.postUrl||'',imageData:latest.imageData||''};
  });
  const maxLeads=Math.max(1,...groups.map(g=>g.leads));
  const cpls=groups.filter(g=>g.leads>0).map(g=>g.cpl);
  const medCpl=cpls.length ? [...cpls].sort((a,b)=>a-b)[Math.floor(cpls.length/2)] : 0;
  const ctrs=groups.map(g=>g.ctr).filter(Boolean);
  const medCtr=ctrs.length ? [...ctrs].sort((a,b)=>a-b)[Math.floor(ctrs.length/2)] : 0;
  groups.forEach(g=>{
    let score=(g.leads/maxLeads)*50;
    if(g.leads>0 && medCpl>0) score+=Math.min(30,(medCpl/Math.max(g.cpl,.01))*20);
    if(medCtr>0) score+=Math.min(20,(g.ctr/medCtr)*10);
    g.score=score;
  });
  groups.sort((a,b)=>b.score-a.score || b.leads-a.leads || a.cpl-b.cpl);
  groups.forEach((g,i)=>{
    if(i===0 && g.leads>0) g.performance='Winner';
    else if(g.leads>0 && (g.cpl<=medCpl || g.ctr>=medCtr)) g.performance='Okey';
    else if(g.leads>0) g.performance='Pantau';
    else g.performance='Belum Convert';
  });
  return groups;
}

function ttPerfClass(label){ return label==='Winner'?'winner':label==='Okey'?'good':label==='Pantau'?'watch':'weak'; }

function ttSetRange(kind){
  const today=new Date(), end=today.toISOString().slice(0,10);
  let start=new Date(today);
  if(kind==='today') start=today;
  else if(kind==='7') start.setDate(today.getDate()-6);
  else if(kind==='30') start.setDate(today.getDate()-29);
  else if(kind==='month') start=new Date(today.getFullYear(),today.getMonth(),1);
  const from=document.getElementById('tt-filter-from'), to=document.getElementById('tt-filter-to');
  if(from) from.value=start.toISOString().slice(0,10);
  if(to) to.value=end;
  renderTikTokLeads();
}

function ttPopulateFilters(){
  const campaignSel=document.getElementById('tt-filter-campaign'), creativeSel=document.getElementById('tt-filter-creative');
  if(!campaignSel||!creativeSel) return;
  const cc=campaignSel.value, cr=creativeSel.value;
  const campaigns=[...new Set(allTikTokLeads.map(r=>r.campaign).filter(Boolean))].sort();
  const creatives=[...new Set(allTikTokLeads.map(r=>r.adName).filter(Boolean))].sort();
  campaignSel.innerHTML='<option value="">Semua Campaign</option>'+campaigns.map(v=>`<option>${ttEsc(v)}</option>`).join('');
  creativeSel.innerHTML='<option value="">Semua Creative</option>'+creatives.map(v=>`<option>${ttEsc(v)}</option>`).join('');
  if(campaigns.includes(cc)) campaignSel.value=cc;
  if(creatives.includes(cr)) creativeSel.value=cr;
}

function ttTrendSvg(rows){
  const map=new Map();
  rows.forEach(r=>{
    const d=ttDateStr(r); if(!d)return;
    if(!map.has(d))map.set(d,{date:d,spend:0,leads:0});
    const x=map.get(d); x.spend+=ttNum(r.spend); x.leads+=ttNum(r.leads);
  });
  const pts=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(!pts.length)return '<div class="empty-state">Belum ada data untuk julat ini.</div>';
  const w=760,h=250,padL=46,padR=20,padT=22,padB=38,plotW=w-padL-padR,plotH=h-padT-padB;
  const maxLeads=Math.max(1,...pts.map(p=>p.leads)),maxSpend=Math.max(1,...pts.map(p=>p.spend));
  const x=i=>padL+(pts.length===1?plotW/2:(i/(pts.length-1))*plotW);
  const yL=v=>padT+plotH-(v/maxLeads)*plotH, yS=v=>padT+plotH-(v/maxSpend)*plotH;
  const lp=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+yL(p.leads).toFixed(1)).join(' ');
  const sp=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+yS(p.spend).toFixed(1)).join(' ');
  const grid=[0,.25,.5,.75,1].map(t=>{const yy=padT+plotH-t*plotH;return `<line x1="${padL}" y1="${yy}" x2="${w-padR}" y2="${yy}" class="tt-grid-line"/>`;}).join('');
  const labels=pts.map((p,i)=>{if(pts.length>10&&i%Math.ceil(pts.length/7)!==0&&i!==pts.length-1)return '';return `<text x="${x(i)}" y="${h-13}" text-anchor="middle" class="tt-axis-label">${p.date.slice(5)}</text>`;}).join('');
  const dots=pts.map((p,i)=>`<circle cx="${x(i)}" cy="${yL(p.leads)}" r="3.5" class="tt-lead-dot"><title>${p.date}: ${p.leads} leads | ${ttMoney(p.spend)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="tt-trend-svg">${grid}<path d="${sp}" class="tt-spend-line"/><path d="${lp}" class="tt-lead-line"/>${dots}${labels}<text x="${padL}" y="13" class="tt-legend spend">— Kos</text><text x="${padL+72}" y="13" class="tt-legend leads">— Leads</text></svg>`;
}

function renderTikTokLeads(){
  if(!document.getElementById('view-tiktokleads'))return;
  ttPopulateFilters();
  const rows=ttFilteredRows(),m=ttMetrics(rows),groups=ttCreativeGroups(rows),top=groups[0];
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  set('tt-kpi-cost',ttMoney(m.spend));set('tt-kpi-impressions',fmt(m.impressions));set('tt-kpi-clicks',fmt(m.clicks));set('tt-kpi-cpc','CPC '+ttMoney(m.cpc));
  set('tt-kpi-ctr',ttPct(m.ctr));set('tt-kpi-results',fmt(m.results));set('tt-kpi-leads',fmt(m.leads));set('tt-kpi-capture',ttPct(m.capture)+' daripada result');
  set('tt-kpi-cpl',ttMoney(m.cpl));set('tt-kpi-top-ad',top?.name||'–');set('tt-kpi-top-ad-meta',top?`${fmt(top.leads)} leads • CPL ${ttMoney(top.cpl)} • CTR ${ttPct(top.ctr)}`:'Belum ada data');
  const days=[...new Set(rows.map(ttDateStr).filter(Boolean))];set('tt-kpi-days',fmt(days.length)+' hari data');set('tt-trend-label',fmt(days.length)+' hari');set('tt-record-count',fmt(rows.length)+' rekod');
  const chart=document.getElementById('tt-trend-chart');if(chart)chart.innerHTML=ttTrendSvg(rows);

  const coach=document.getElementById('tt-coach-summary');
  if(coach){
    if(!rows.length)coach.innerHTML='<div class="empty-state">Masukkan data iklan untuk hasilkan ringkasan automatik.</div>';
    else{
      const winner=groups[0],weak=groups[groups.length-1];
      coach.innerHTML=`<div class="tt-summary-line"><span>Spend</span><b>${ttMoney(m.spend)}</b></div><div class="tt-summary-line"><span>Leads diperoleh</span><b>${fmt(m.leads)}</b></div><div class="tt-summary-line"><span>Purata CPL</span><b>${ttMoney(m.cpl)}</b></div><div class="tt-summary-line"><span>CTR keseluruhan</span><b>${ttPct(m.ctr)}</b></div><div class="tt-summary-callout"><span>Iklan terbaik setakat ini</span><strong>${ttEsc(winner?.name||'–')}</strong><small>${winner?`${fmt(winner.leads)} leads pada CPL ${ttMoney(winner.cpl)}.`:'Belum ada data.'}</small></div>${groups.length>1?`<p class="tt-summary-foot">Untuk pembentangan: scale / hasilkan variasi daripada <b>${ttEsc(winner.name)}</b>. Creative yang perlu diperhatikan: <b>${ttEsc(weak.name)}</b>.</p>`:''}`;
    }
  }

  const wrap=document.getElementById('tt-creative-cards');
  if(wrap)wrap.innerHTML=groups.length?groups.map((g,i)=>`<article class="tt-creative-card ${i===0&&g.leads>0?'top':''}"><div class="tt-creative-media">${g.imageData?`<img src="${g.imageData}" alt="${ttEsc(g.name)}">`:`<div class="tt-creative-placeholder">TikTok Ad<br><span>#${i+1}</span></div>`}</div><div class="tt-creative-body"><div class="tt-creative-rank"><span>#${i+1}</span><b class="tt-perf-pill ${ttPerfClass(g.performance)}">${g.performance}</b></div><h4>${ttEsc(g.name)}</h4><p>${ttEsc(g.hook||g.campaign||'Tiada hook direkod')}</p><div class="tt-creative-metrics"><span><small>Leads</small><b>${fmt(g.leads)}</b></span><span><small>CPL</small><b>${ttMoney(g.cpl)}</b></span><span><small>CTR</small><b>${ttPct(g.ctr)}</b></span><span><small>Spend</small><b>${ttMoney(g.spend)}</b></span></div>${g.postUrl?`<a href="${ttEsc(g.postUrl)}" target="_blank" rel="noopener" class="tt-post-link">Buka Iklan ↗</a>`:''}</div></article>`).join(''):'<div class="empty-state">Belum ada creative direkod.</div>';

  const body=document.getElementById('tt-record-body');
  if(body){
    const perfMap=new Map(groups.map(g=>[g.name,g.performance]));
    const sorted=[...rows].sort((a,b)=>ttDateStr(b).localeCompare(ttDateStr(a)));
    body.innerHTML=sorted.length?sorted.map(r=>{const rm=ttMetrics([r]),perf=perfMap.get(r.adName)||'Pantau';return `<tr><td>${ttEsc(ttDateStr(r)||'-')}</td><td class="tt-ad-cell"><b>${ttEsc(r.adName||'-')}</b><small>${ttEsc(r.hook||'')}</small>${r.postUrl?`<a href="${ttEsc(r.postUrl)}" target="_blank" rel="noopener">Lihat ↗</a>`:''}</td><td>${ttEsc(r.campaign||'-')}</td><td>${ttMoney(r.spend)}</td><td>${ttPct(rm.ctr)}</td><td>${fmt(r.clicks)}</td><td>${fmt(r.results)}</td><td><b>${fmt(r.leads)}</b></td><td>${ttMoney(rm.cpl)}</td><td><span class="tt-perf-pill ${ttPerfClass(perf)}">${perf}</span></td><td class="tt-actions-cell"><button type="button" class="tt-action-btn" onclick="editTikTokLead('${r.id}')">Edit</button><button type="button" class="tt-action-btn danger" onclick="deleteTikTokLead('${r.id}')">Padam</button></td></tr>`;}).join(''):'<tr><td colspan="11" class="empty-state">Belum ada data.</td></tr>';
  }
}

function startTikTokLeadsListener(){
  if(unsubTikTokLeads)return;
  unsubTikTokLeads=db.collection('tiktokLeads').onSnapshot(snap=>{allTikTokLeads=snap.docs.map(d=>({id:d.id,...d.data()}));allTikTokLeads.sort((a,b)=>ttDateStr(b).localeCompare(ttDateStr(a)));renderTikTokLeads();},err=>toast('Ralat baca TikTok Leads: '+err.message,true));
}

function initTikTokLeadsView(){
  const d=document.getElementById('tt-date');if(d&&!d.value)d.value=todayStr();
  const from=document.getElementById('tt-filter-from'),to=document.getElementById('tt-filter-to');
  if(from&&!from.value){const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1);from.value=start.toISOString().slice(0,10);}
  if(to&&!to.value)to.value=todayStr();
}

function ttUpdateLiveCalc(){
  const spend=ttNum(document.getElementById('tt-spend')?.value),impressions=ttNum(document.getElementById('tt-impressions')?.value),clicks=ttNum(document.getElementById('tt-clicks')?.value),leads=ttNum(document.getElementById('tt-leads')?.value);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('tt-live-ctr',ttPct(impressions?clicks/impressions*100:0));set('tt-live-cpc',ttMoney(clicks?spend/clicks:0));set('tt-live-cpl',ttMoney(leads?spend/leads:0));
}

function resetTikTokLeadForm(){
  editingTikTokLeadId=null;tikTokLeadImageData='';
  document.getElementById('tt-leads-form')?.reset();
  const d=document.getElementById('tt-date');if(d)d.value=todayStr();
  const st=document.getElementById('tt-status');if(st)st.value='Active';
  ['tt-spend','tt-impressions','tt-clicks','tt-results','tt-leads'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='0';});
  const title=document.getElementById('tt-form-title');if(title)title.textContent='Input Prestasi TikTok Leads';
  const save=document.getElementById('tt-save-btn');if(save)save.textContent='Simpan Data TikTok';
  ttUpdateLiveCalc();
}

async function editTikTokLead(id){
  const r=allTikTokLeads.find(x=>x.id===id);if(!r)return;
  editingTikTokLeadId=id;tikTokLeadImageData=r.imageData||'';
  const fields={'tt-date':ttDateStr(r),'tt-campaign':r.campaign||'','tt-ad-name':r.adName||'','tt-hook':r.hook||'','tt-spend':ttNum(r.spend),'tt-impressions':ttNum(r.impressions),'tt-clicks':ttNum(r.clicks),'tt-results':ttNum(r.results),'tt-leads':ttNum(r.leads),'tt-status':r.status||'Active','tt-post-url':r.postUrl||'','tt-note':r.note||''};
  Object.entries(fields).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
  document.getElementById('tt-form-title').textContent='Edit Prestasi TikTok Leads';document.getElementById('tt-save-btn').textContent='Update Data TikTok';document.getElementById('tt-entry-panel')?.classList.add('open');ttUpdateLiveCalc();document.getElementById('tt-entry-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function deleteTikTokLead(id){
  const r=allTikTokLeads.find(x=>x.id===id);if(!r||!confirm(`Padam rekod "${r.adName||'TikTok Lead'}" pada ${ttDateStr(r)}?`))return;
  try{await db.collection('tiktokLeads').doc(id).delete();toast('Rekod TikTok Leads dipadam ✓');}catch(err){toast('Gagal padam: '+err.message,true);}
}

async function ttCopySummary(){
  const rows=ttFilteredRows();if(!rows.length){toast('Tiada data TikTok Leads untuk diringkaskan',true);return;}
  const m=ttMetrics(rows),groups=ttCreativeGroups(rows),top=groups[0],from=document.getElementById('tt-filter-from')?.value||'-',to=document.getElementById('tt-filter-to')?.value||'-';
  const text=['TIKTOK LEADS — PERFORMANCE SUMMARY',`Tempoh: ${from} hingga ${to}`,`Total Spend: ${ttMoney(m.spend)}`,`Impressions: ${fmt(m.impressions)}`,`Clicks: ${fmt(m.clicks)}`,`CTR: ${ttPct(m.ctr)}`,`Result TikTok: ${fmt(m.results)}`,`Leads / Nombor Masuk: ${fmt(m.leads)}`,`Cost Per Lead: ${ttMoney(m.cpl)}`,`CPC: ${ttMoney(m.cpc)}`,top?`Top Creative: ${top.name} — ${fmt(top.leads)} leads, CPL ${ttMoney(top.cpl)}, CTR ${ttPct(top.ctr)}`:''].filter(Boolean).join('\n');
  try{await navigator.clipboard.writeText(text);toast('Ringkasan TikTok Leads disalin ✓');}catch(err){toast('Gagal salin ringkasan',true);}
}

document.getElementById('tt-open-entry')?.addEventListener('click',()=>{document.getElementById('tt-entry-panel')?.classList.add('open');document.getElementById('tt-entry-panel')?.scrollIntoView({behavior:'smooth',block:'start'});});
document.getElementById('tt-close-entry')?.addEventListener('click',()=>document.getElementById('tt-entry-panel')?.classList.remove('open'));
document.getElementById('tt-reset-btn')?.addEventListener('click',resetTikTokLeadForm);
document.getElementById('tt-copy-summary')?.addEventListener('click',ttCopySummary);
document.querySelectorAll('[data-tt-range]').forEach(btn=>btn.addEventListener('click',()=>ttSetRange(btn.dataset.ttRange)));
['tt-filter-from','tt-filter-to','tt-filter-campaign','tt-filter-creative'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderTikTokLeads));
['tt-spend','tt-impressions','tt-clicks','tt-leads'].forEach(id=>document.getElementById(id)?.addEventListener('input',ttUpdateLiveCalc));

document.getElementById('tt-image')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{tikTokLeadImageData=await compressImageToBase64(file,700,0.68);toast('Screenshot creative sedia untuk disimpan ✓');}catch(err){toast('Gagal proses gambar: '+err.message,true);}
});

document.getElementById('tt-leads-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const save=document.getElementById('tt-save-btn');if(save)save.disabled=true;
  try{
    const payload={date:document.getElementById('tt-date').value,campaign:document.getElementById('tt-campaign').value.trim(),adName:document.getElementById('tt-ad-name').value.trim(),hook:document.getElementById('tt-hook').value.trim(),spend:ttNum(document.getElementById('tt-spend').value),impressions:ttNum(document.getElementById('tt-impressions').value),clicks:ttNum(document.getElementById('tt-clicks').value),results:ttNum(document.getElementById('tt-results').value),leads:ttNum(document.getElementById('tt-leads').value),status:document.getElementById('tt-status').value,postUrl:document.getElementById('tt-post-url').value.trim(),note:document.getElementById('tt-note').value.trim(),imageData:tikTokLeadImageData||'',updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:currentUser?.email||''};
    if(!payload.date||!payload.campaign||!payload.adName)throw new Error('Tarikh, Campaign dan Nama Creative diperlukan.');
    if(editingTikTokLeadId){await db.collection('tiktokLeads').doc(editingTikTokLeadId).update(payload);toast('Data TikTok Leads dikemaskini ✓');}
    else{payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();payload.createdBy=currentUser?.email||'';await db.collection('tiktokLeads').add(payload);toast('Data TikTok Leads disimpan ✓');}
    resetTikTokLeadForm();document.getElementById('tt-entry-panel')?.classList.remove('open');
  }catch(err){toast('Gagal simpan TikTok Leads: '+err.message,true);}finally{if(save)save.disabled=false;}
});


// ============================================================
// V33 — UNIVERSAL TABLE SORTING (ASC / DESC)
// Applies to every table.tbl across Dashboard, Laporan and CRM reports.
// Click column header once = descending for numeric performance metrics,
// click again = ascending. Arrow shows current direction.
// ============================================================
const TABLE_SORT_STATE = new WeakMap();

function tableSortCleanText(v){
  return String(v ?? '')
    .replace(/[▲▼↕]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function tableSortValue(cell){
  if(!cell) return {type:'text',value:''};
  const raw=tableSortCleanText(cell.textContent);
  if(!raw || raw==='–' || raw==='-') return {type:'empty',value:null};

  // Common CRM numeric formats:
  // RM 30,000.50 / €12.20 / 7.08x / 50.2% / 38,622
  const numericCandidate=raw
    .replace(/RM\s*/ig,'')
    .replace(/€/g,'')
    .replace(/,/g,'')
    .replace(/%/g,'')
    .replace(/x$/i,'')
    .trim();

  if(/^[-+]?\d*\.?\d+$/.test(numericCandidate)){
    return {type:'number',value:Number(numericCandidate)};
  }

  // ISO / common date cells. Date ranges use first date only.
  const iso=raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if(iso){
    const t=Date.parse(iso[1]+'T12:00:00');
    if(!Number.isNaN(t)) return {type:'date',value:t};
  }

  // Malaysian presentation dates such as 1 Sep 2026.
  const msMonths={jan:0,feb:1,mac:2,apr:3,mei:4,jun:5,jul:6,ogo:7,sep:8,okt:9,nov:10,dis:11};
  const dm=raw.toLowerCase().match(/\b(\d{1,2})\s+(jan|feb|mac|apr|mei|jun|jul|ogo|sep|okt|nov|dis)\s+(\d{4})\b/);
  if(dm){
    return {type:'date',value:new Date(Number(dm[3]),msMonths[dm[2]],Number(dm[1]),12).getTime()};
  }

  return {type:'text',value:raw.toLowerCase()};
}

function tableSortDefaultDirection(headerText){
  const h=tableSortCleanText(headerText).toLowerCase();
  // Performance metrics normally make more sense highest-first.
  if(/sales|buyer|sent|reply|read|delivered|result|leads|click|impression|roi|roas|ctr|conversion|frequency|contact|cost|kos|spend|cpl|cpc|rate|jumlah|kapasiti|had 2x|bil\. blast|sesi/.test(h)){
    return 'desc';
  }
  // Dates / names default ascending.
  return 'asc';
}

function sortTableByColumn(table,colIndex,forcedDirection){
  const tbody=table?.tBodies?.[0];
  if(!tbody) return;

  const headers=[...(table.tHead?.rows?.[0]?.cells||[])];
  const th=headers[colIndex];
  if(!th) return;

  const prev=TABLE_SORT_STATE.get(table)||{col:-1,dir:null};
  const dir=forcedDirection || (prev.col===colIndex
    ? (prev.dir==='asc'?'desc':'asc')
    : tableSortDefaultDirection(th.textContent));

  const rows=[...tbody.rows];
  // Keep summary/total rows fixed at bottom.
  const fixed=rows.filter(r=>r.classList.contains('total-row'));
  const sortable=rows.filter(r=>!r.classList.contains('total-row') && !r.querySelector('.empty-state'));

  sortable.sort((a,b)=>{
    const av=tableSortValue(a.cells[colIndex]);
    const bv=tableSortValue(b.cells[colIndex]);

    if(av.type==='empty' && bv.type!=='empty') return 1;
    if(bv.type==='empty' && av.type!=='empty') return -1;

    let cmp=0;
    if((av.type==='number'||av.type==='date') && (bv.type==='number'||bv.type==='date')){
      cmp=(av.value??0)-(bv.value??0);
    }else{
      cmp=String(av.value??'').localeCompare(String(bv.value??''),'ms',{numeric:true,sensitivity:'base'});
    }
    return dir==='asc'?cmp:-cmp;
  });

  sortable.forEach(r=>tbody.appendChild(r));
  fixed.forEach(r=>tbody.appendChild(r));

  headers.forEach((h,i)=>{
    h.classList.remove('sort-asc','sort-desc');
    h.setAttribute('aria-sort','none');
    const old=h.querySelector('.sort-arrow');
    if(old) old.remove();
    if(i===colIndex){
      h.classList.add(dir==='asc'?'sort-asc':'sort-desc');
      h.setAttribute('aria-sort',dir==='asc'?'ascending':'descending');
      const arrow=document.createElement('span');
      arrow.className='sort-arrow';
      arrow.textContent=dir==='asc'?'▲':'▼';
      h.appendChild(arrow);
    }
  });

  TABLE_SORT_STATE.set(table,{col:colIndex,dir});
}

function initSortableTables(scope=document){
  scope.querySelectorAll('table.tbl').forEach(table=>{
    if(table.dataset.sortReady==='1') return;
    const headRow=table.tHead?.rows?.[0];
    if(!headRow) return;

    [...headRow.cells].forEach((th,i)=>{
      // Skip clearly non-data action columns.
      const label=tableSortCleanText(th.textContent).toLowerCase();
      if(/tindakan|action|aksi/.test(label)){
        th.classList.add('sort-disabled');
        return;
      }
      th.classList.add('sort-enabled');
      th.tabIndex=0;
      th.setAttribute('title','Klik untuk susun naik / turun');
      th.addEventListener('click',()=>sortTableByColumn(table,i));
      th.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          sortTableByColumn(table,i);
        }
      });
    });
    table.dataset.sortReady='1';
  });
}

// Re-run after dynamic report renderers replace tbody contents.
// Header listeners stay attached; this also catches tables created later.
const sortableTableObserver=new MutationObserver(()=>{
  window.clearTimeout(window.__crmSortInitTimer);
  window.__crmSortInitTimer=window.setTimeout(()=>initSortableTables(document),60);
});
sortableTableObserver.observe(document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',()=>initSortableTables(document));
setTimeout(()=>initSortableTables(document),150);


// ---- Realtime listeners ----
function startListeners() {
  // Jangan orderBy(createdAt) di Firestore.
  // Rekod CRM lama ada yang tiada field createdAt; Firestore akan mengecualikan
  // dokumen tersebut daripada query orderBy dan menyebabkan Senarai Entri nampak kosong.
  unsubEntries = db.collection('entries').onSnapshot(snap => {
    allEntries = snap.docs.map(d => {
      const row = { id: d.id, ...d.data() };

      // Backward compatibility: rekod lama Promo Jus dipaparkan sebagai Promo TikTok.
      if (row.kategori === 'Promo Jus') row.kategori = 'Promo TikTok';

      return row;
    });

    // Sort client-side supaya data lama + baru semua kekal dibaca.
    allEntries.sort((a,b) => {
      const ad = String(a.tarikh || '');
      const bd = String(b.tarikh || '');

      if (ad !== bd) return bd.localeCompare(ad);

      const at = a.createdAt && a.createdAt.toMillis
        ? a.createdAt.toMillis()
        : Number(a.createdAtMs || 0);

      const bt = b.createdAt && b.createdAt.toMillis
        ? b.createdAt.toMillis()
        : Number(b.createdAtMs || 0);

      return bt - at;
    });
    // Render Senarai Entri FIRST so old data stays editable even if
    // another report/view has a UI error.
    renderEntriesList();
      if(document.getElementById('view-packageanalysis')?.classList.contains('active')) renderPackageAnalysis();
    try{ renderReferenceDashboardWidgets(); }catch(e){ console.warn(e); }

    // Each secondary renderer is isolated. One broken/moved section
    // must never stop the rest of CRM from rendering.
    const safeRender = (name, fn) => {
      try {
        if (typeof fn === 'function') fn();
      } catch (err) {
        console.warn('[CRM render skipped] ' + name, err);
      }
    };

    safeRender('Dashboard', renderDashboard);
    safeRender('Wabot Control', renderWabotControl);

    // Old Dashboard Template Report was moved into the Template tab.
    // Do not call renderTemplateReport() here because its old DOM may no longer exist.
    safeRender('Daily Report', renderDailyReport);
    safeRender('Weekly Report', renderWeeklyReport);
    safeRender('Monthly Database Report', renderMonthlyDatabaseReport);
    safeRender('Poster Performance', renderPosterPerformance);
    safeRender('Template Library Report', renderTemplateLibraryReport);
    safeRender('Template Library', renderTemplateLibrary);
    safeRender('Poster Library Performance', renderPosterLibraryPerformance);
    safeRender('Wabot Performance', renderWabotPerformance);
    safeRender('Day of Week', renderDayOfWeek);
    safeRender('Hour of Day', renderHourOfDay);

    if (allTopups) safeRender('Topups', renderTopups);
  }, err => toast('Ralat baca data: ' + err.message, true));

  unsubTodos = db.collection('todos').orderBy('createdAt', 'desc').onSnapshot(snap => {
    allTodos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTodos();
  }, err => toast('Ralat baca to-do: ' + err.message, true));

  unsubPosters = db.collection('posters').orderBy('createdAt', 'desc').onSnapshot(snap => {
    allPosters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPosters();
    populatePosterSelect();
  }, err => toast('Ralat baca poster: ' + err.message, true));

  unsubTemplateLibrary = db.collection('templateLibrary').orderBy('createdAt','desc').onSnapshot(snap => {
    allTemplateLibrary = snap.docs.map(d => ({id:d.id,...d.data()}));
    renderTemplateLibrary();
    populateTemplateDatalist();
  }, err => toast('Ralat baca Template Library: ' + err.message, true));


  unsubFeedback = db.collection('feedback').orderBy('createdAt', 'desc').onSnapshot(snap => {
    allFeedback = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFeedback();
  }, err => toast('Ralat baca feedback: ' + err.message, true));

  unsubCampaignMappings = db.collection('campaignMappings').onSnapshot(snap => {
    allCampaignMappings = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderCampaignManager();
    populateCampaignLinker();
  }, err => toast('Ralat baca campaign mapping: ' + err.message, true));
}

// ============================================================
// LIVE PREVIEW — Kos & rate dikira terus semasa Input Data ditaip
// ============================================================
function updateEntryLivePreview() {
  const sent = Number(document.getElementById('entry-sent').value || 0);
  const read = Number(document.getElementById('entry-read').value || 0);
  const reply = Number(document.getElementById('entry-reply').value || 0);
  const buyer = Number(document.getElementById('entry-buyer').value || 0);
  const sales = Number(document.getElementById('entry-sales').value || 0);

  const eur = costEUR(sent);
  const rm = costRM(sent);

  const costPreview = document.getElementById('entry-cost-preview');
  if (costPreview) costPreview.textContent = `Kos: RM ${rm.toFixed(2)} (€${eur.toFixed(2)})`;

  const responRate = sent ? (read / sent * 100) : 0;
  const replyRate = sent ? (reply / sent * 100) : 0;
  const convRate = sent ? (buyer / sent * 100) : 0;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('input-summary-sales', 'RM ' + sales.toLocaleString('en-MY', {minimumFractionDigits:2, maximumFractionDigits:2}));
  setText('input-summary-sent', sent.toLocaleString('en-MY'));
  setText('input-summary-buyer', buyer.toLocaleString('en-MY'));
  setText('input-summary-cost', 'RM ' + rm.toFixed(2));
  setText('input-summary-cost-eur', '€' + eur.toFixed(2));

  setText('live-respon-rate', responRate.toFixed(1) + '% read rate');
  setText('live-reply-rate', replyRate.toFixed(1) + '%');
  setText('live-conv-rate', convRate.toFixed(2) + '%');
}
['entry-sent', 'entry-read', 'entry-reply', 'entry-buyer', 'entry-sales', 'entry-total-contact'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateEntryLivePreview);
});


const CRM_PROMO_CATALOG = {
  CRM169:{label:'Promo CRM RM169',price:169},
  CRM179:{label:'Promo CRM RM179',price:179},
  CRM185:{label:'Promo CRM RM185',price:185},
  YG59:{label:'YGROW / Hazelnut — 1 kotak RM59',price:59},
  YG99:{label:'YGROW / Hazelnut — 2 kotak RM99',price:99},
  YG199:{label:'YGROW / Hazelnut — 4 kotak + shaker RM199',price:199},
  MILK49:{label:'Susu Mocha / Hazelnut — 1 kotak RM49',price:49},
  MILK99:{label:'Susu Mocha / Hazelnut — 2 kotak RM99',price:99},
  OTHER:{label:'Lain-lain',price:0}
};
function crmPromoInfo(code){ return CRM_PROMO_CATALOG[code]||{label:code||'Tidak ditag',price:0}; }

// ============================================================
// INPUT DATA — Entry blast harian
// ============================================================
let editingEntryId = null;

document.getElementById('entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('entry-submit-btn');
  btn.disabled = true; btn.textContent = editingEntryId ? 'Mengemaskini...' : 'Menyimpan...';
  const payload = {
    tarikh: document.getElementById('entry-tarikh').value,
    masa: document.getElementById('entry-masa').value || '',
    source: document.getElementById('entry-source').value.trim() || 'Umum',
    template: document.getElementById('entry-template').value.trim() || 'Tanpa nama',
    kategori: document.getElementById('entry-kategori').value,
    wabotAccount: document.getElementById('entry-wabot').value,
    poster: document.getElementById('entry-poster').value || '',
    sent: Number(document.getElementById('entry-sent').value || 0),
    delivered: Number(document.getElementById('entry-delivered').value || 0),
    read: Number(document.getElementById('entry-read').value || 0),
    reply: Number(document.getElementById('entry-reply').value || 0),
    failed: Number(document.getElementById('entry-failed').value || 0),
    buyer: Number(document.getElementById('entry-buyer').value || 0),
    sales: Number(document.getElementById('entry-sales').value || 0),
    totalContact: Number(document.getElementById('entry-total-contact')?.value || 0),
    promoCode: document.getElementById('entry-promo')?.value || '',
  };
  try {
    if (editingEntryId) {
      await db.collection('entries').doc(editingEntryId).update(payload);
      toast('Entri dikemaskini ✓');
      cancelEditEntry();
    } else {
      payload.staffId = currentUser.uid;
      payload.staffName = currentProfile.name;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('entries').add(payload);
      toast('Entri disimpan ✓');
    }
    e.target.reset();
    document.getElementById('entry-tarikh').value = todayStr();
    updateEntryLivePreview();
  } catch (err) {
    toast('Gagal simpan: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = editingEntryId ? 'Kemaskini Entri' : 'Simpan Entri';
  }
});

function startEditEntry(id) {
  const entry = allEntries.find(en => en.id === id);
  if (!entry) return;
  editingEntryId = id;
  document.getElementById('entry-tarikh').value = entry.tarikh || todayStr();
  document.getElementById('entry-masa').value = entry.masa || '';
  document.getElementById('entry-source').value = entry.source || '';
  document.getElementById('entry-template').value = entry.template || '';
  document.getElementById('entry-kategori').value = entry.kategori || 'Projek Susu';
  document.getElementById('entry-wabot').value = entry.wabotAccount || document.querySelector('#entry-wabot option').value;
  document.getElementById('entry-poster').value = entry.poster || '';
  document.getElementById('entry-sent').value = entry.sent || 0;
  document.getElementById('entry-delivered').value = entry.delivered || 0;
  document.getElementById('entry-read').value = entry.read || 0;
  document.getElementById('entry-reply').value = entry.reply || 0;
  document.getElementById('entry-failed').value = entry.failed || 0;
  document.getElementById('entry-buyer').value = entry.buyer || 0;
  document.getElementById('entry-sales').value = entry.sales || 0;
  const tc=document.getElementById('entry-total-contact'); if(tc) tc.value = entry.totalContact || 0;
  const promo=document.getElementById('entry-promo'); if(promo) promo.value = entry.promoCode || '';
  updateEntryLivePreview();
  document.getElementById('entry-form-title').textContent = 'Edit Entri Blast';
  document.getElementById('entry-submit-btn').textContent = 'Kemaskini Entri';
  document.getElementById('entry-cancel-edit-btn').style.display = 'inline-flex';
  document.querySelector('.app-nav button[data-view="input"]').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditEntry() {
  editingEntryId = null;
  document.getElementById('entry-form-title').textContent = 'Input Entri Blast Harian';
  document.getElementById('entry-submit-btn').textContent = 'Simpan Entri';
  document.getElementById('entry-cancel-edit-btn').style.display = 'none';
  document.getElementById('entry-form').reset();
  document.getElementById('entry-tarikh').value = todayStr();
  updateEntryLivePreview();
}
document.getElementById('entry-cancel-edit-btn').addEventListener('click', cancelEditEntry);

async function deleteEntry(id) {
  if (!confirm('Padam entri ni? Tindakan ni tak boleh diundur.')) return;
  try {
    await db.collection('entries').doc(id).delete();
    toast('Entri dipadam ✓');
    if (editingEntryId === id) cancelEditEntry();
  } catch (err) {
    toast('Gagal padam: ' + err.message, true);
  }
}


// ============================================================
// STAFF DISPLAY ALIAS
// Display-only: Firestore original value is NOT changed.
// ============================================================
function displayStaffName(value){
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();

  if (
    lower === 'kaknorycloud@gmail.com' ||
    lower === 'kaknorylcloud@gmail.com' ||
    lower.includes('kaknorycloud@gmail.com') ||
    lower.includes('kaknorylcloud@gmail.com')
  ) return 'Fani';

  return raw || '-';
}

function renderEntriesList() {
  const sorted = [...allEntries].sort((a, b) => (b.tarikh || '').localeCompare(a.tarikh || ''));
  const body = document.getElementById('entries-list-body');
  if (!body) return;
  body.innerHTML = '';
  const LIMIT = 100;
  sorted.slice(0, LIMIT).forEach(en => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="tname">${en.tarikh || '-'}</td>
      <td style="font-size:12px;">${en.kategori || '-'}</td>
      <td style="font-size:12px; color:var(--muted);">${displayStaffName(en.staffName)}</td>
      <td style="font-size:12px;">${en.source || '-'}</td>
      <td style="font-size:12px;">${en.template || '-'}</td>
      <td style="font-size:11px; color:var(--muted);">${(en.wabotAccount || '-').split(' (')[0]}</td>
      <td class="num">${fmt(en.sent)}</td>
      <td class="num">${en.sales ? 'RM ' + fmt(en.sales) : '–'}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn-ghost entry-edit-btn" data-id="${en.id}" style="width:auto; padding:5px 10px; font-size:11px; margin-right:6px;">Edit</button>
        <button class="btn-ghost entry-del-btn" data-id="${en.id}" style="width:auto; padding:5px 10px; font-size:11px; color:var(--coral); border-color:rgba(255,122,104,0.3);">Padam</button>
      </td>`;
    body.appendChild(tr);
  });
  const countEl = document.getElementById('entries-list-count');
  if (countEl) {
    countEl.textContent = fmt(sorted.length) + ' entri' +
      (sorted.length > LIMIT ? ` (papar ${LIMIT} terkini)` : '');
  }
  document.querySelectorAll('.entry-edit-btn').forEach(b => b.onclick = () => startEditEntry(b.dataset.id));
  document.querySelectorAll('.entry-del-btn').forEach(b => b.onclick = () => deleteEntry(b.dataset.id));
  if (!sorted.length) body.innerHTML = '<tr><td colspan="9" class="empty-state">Tiada entri lagi.</td></tr>';
}

// ============================================================
// DASHBOARD — Kira & render stats dari data live
// ============================================================
function filteredEntries() {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const staff = document.getElementById('filter-staff').value;
  const kategori = document.getElementById('filter-kategori').value;
  return allEntries.filter(en => {
    if (from && en.tarikh < from) return false;
    if (to && en.tarikh > to) return false;
    if (staff && en.staffId !== staff) return false;
    if (kategori && en.kategori !== kategori) return false;
    return true;
  });
}

const DASH_TARGETS_DEFAULT = {
  sales: 30000,
  conversion: 1,
  reply: 50,
  roas: 10,
  roi: 7.08,
  cost: 1650,
  buyer: 100,
  sent: 10000
};

// Target khas ikut Projek (Kategori Laporan) — override nilai default di atas.
// Tambah entri baru di sini bila-bila untuk set target khas projek lain.
const DASH_TARGETS_BY_KATEGORI = {
  'Projek Leads Ikhtiar (NaimFani)': {
    sales: 1000,
    roi: 10,
    roas: 19,
    cost: 140,
    sent: 2500
  },
  'Projek Susu YGROW': {
    sales: 1000,
    roi: 8,
    buyer: 17
  }
};

function getDashTargets() {
  const kategori = document.getElementById('filter-kategori') ? document.getElementById('filter-kategori').value : '';
  const overrides = DASH_TARGETS_BY_KATEGORI[kategori] || {};
  return Object.assign({}, DASH_TARGETS_DEFAULT, overrides);
}

// V41 — target KHAS untuk kad KPI utama Dashboard sahaja.
// Sengaja diasingkan supaya section lain (contoh Database & Frequency Bulanan)
// tidak berubah.
const DASH_KPI_TARGETS_DEFAULT = {
  sales: 30000,
  conversion: 1,
  reply: 50,
  roas: 10,
  roi: 7,
  cost: 4380.16,
  buyer: 178,
  sent: 80000
};

function getDashKpiTargets() {
  const kategori = document.getElementById('filter-kategori') ? document.getElementById('filter-kategori').value : '';
  const overrides = DASH_TARGETS_BY_KATEGORI[kategori] || {};
  return Object.assign({}, DASH_KPI_TARGETS_DEFAULT, overrides);
}

function dashTotals(rows) {
  return rows.reduce((a, r) => {
    a.sent += Number(r.sent)||0; a.delivered += Number(r.delivered)||0; a.read += Number(r.read)||0;
    a.reply += Number(r.reply)||0; a.failed += Number(r.failed)||0; a.buyer += Number(r.buyer)||0; a.sales += Number(r.sales)||0;
    return a;
  }, {sent:0,delivered:0,read:0,reply:0,failed:0,buyer:0,sales:0});
}
function dashMetrics(rows) {
  const t = dashTotals(rows);
  const cost = costRM(t.sent);
  return {
    ...t, cost,
    roas: cost ? t.sales / cost : 0,
    roi: cost ? (t.sales - cost) / cost : 0,
    conversion: t.sent ? t.buyer / t.sent * 100 : 0,
    replyRate: t.sent ? t.reply / t.sent * 100 : 0,
    readRate: t.sent ? t.read / t.sent * 100 : 0
  };
}
function dashDateShift(iso, days) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function dashScopedRowsForDate(date, kategoriOverride) {
  const staff = document.getElementById('filter-staff').value;
  const selectedKategori = document.getElementById('filter-kategori').value;
  const kategori = kategoriOverride !== undefined ? kategoriOverride : selectedKategori;
  return allEntries.filter(en => {
    if (en.tarikh !== date) return false;
    if (staff && en.staffId !== staff) return false;
    if (kategori && en.kategori !== kategori) return false;
    return true;
  });
}
function dashSetDelta(id, current, previous, lowerIsBetter=false, suffix='') {
  const el = document.getElementById(id); if (!el) return;
  if (!previous && !current) { el.className='dash-delta neutral'; el.textContent='—'; return; }
  if (!previous) { el.className='dash-delta up'; el.textContent='▲ Baru'; return; }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const good = lowerIsBetter ? pct <= 0 : pct >= 0;
  el.className = 'dash-delta ' + (good ? 'up' : 'down');
  el.textContent = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%${suffix}`;
}
const TARGET_LABEL_FORMAT = {
  sales: t => `Target RM${fmt(t)}`,
  roi: t => `Target ${t}x`,
  roas: t => `Target ${t}x`,
  conv: t => `Target ${t}%`,
  reply: t => `Target ${t}%`,
  buyer: t => `Target ${fmt(t)}`,
  cost: t => `Had RM${fmt(t)}`,
  sent: t => `Target ${fmt(t)}`,
};
function dashSetTarget(key, value, target, lowerIsBetter=false) {
  const bar = document.getElementById(`target-${key}-bar`);
  const txt = document.getElementById(`target-${key}-text`);
  const label = document.getElementById(`target-${key}-label`);
  if (label && TARGET_LABEL_FORMAT[key]) label.textContent = TARGET_LABEL_FORMAT[key](target);
  if (!bar || !txt) return;
  const rawPct = target ? value / target * 100 : 0;
  const width = Math.min(Math.max(rawPct,0),100);
  bar.style.width = width + '%';
  bar.classList.toggle('over', lowerIsBetter && rawPct > 100);
  if (key === 'cost') txt.textContent = `${rawPct.toFixed(0)}% digunakan`;
  else txt.textContent = `${rawPct.toFixed(0)}%`;
}
function dashProjectRows(kategori) {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const staff = document.getElementById('filter-staff').value;
  return allEntries.filter(en => {
    if (from && en.tarikh < from) return false;
    if (to && en.tarikh > to) return false;
    if (staff && en.staffId !== staff) return false;
    return en.kategori === kategori;
  });
}
function dashDateList(from, to) {
  if (!from || !to) return [];
  const out=[]; let d=from, guard=0;
  while(d<=to && guard<370){ out.push(d); d=dashDateShift(d,1); guard++; }
  return out;
}
function dashSvgChart(points, activeKeys) {
  const W=760,H=250,L=52,R=18,T=22,B=42, pw=W-L-R, ph=H-T-B;
  const keys = activeKeys.length ? activeKeys : ['sales'];
  const vals=[];
  points.forEach(p => keys.forEach(k => vals.push(Number(p[k])||0)));
  const max=Math.max(...vals,1), min=0;
  const x=i => L + (points.length<=1 ? pw/2 : i*pw/(points.length-1));
  const y=v => T + ph - ((v-min)/(max-min||1))*ph;
  const palette={sales:'#00b98b',sent:'#3b82f6',reply:'#f59e0b',buyer:'#8b5cf6',cost:'#ef4444'};
  let grid='';
  for(let i=0;i<4;i++){ const yy=T+i*ph/3; const val=max-(i*max/3); grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="trend-grid-line"/><text x="${L-8}" y="${yy+4}" text-anchor="end" class="trend-axis-text">${val>=1000?(val/1000).toFixed(1)+'k':Math.round(val)}</text>`; }
  let lines='';
  keys.forEach(k=>{
    const pts=points.map((p,i)=>`${x(i)},${y(p[k]||0)}`).join(' ');
    lines+=`<polyline points="${pts}" fill="none" stroke="${palette[k]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    points.forEach((p,i)=>{lines+=`<circle cx="${x(i)}" cy="${y(p[k]||0)}" r="3.5" fill="${palette[k]}"><title>${p.date}: ${k} ${p[k]||0}</title></circle>`;});
  });
  let labels='';
  const step=Math.max(1,Math.ceil(points.length/7));
  points.forEach((p,i)=>{if(i%step===0 || i===points.length-1){const d=new Date(p.date+'T12:00:00'); labels+=`<text x="${x(i)}" y="${H-14}" text-anchor="middle" class="trend-axis-text">${d.getDate()}/${d.getMonth()+1}</text>`;}});
  return `<svg viewBox="0 0 ${W} ${H}" class="trend-svg" role="img">${grid}${lines}${labels}</svg>`;
}
function renderProjectTrends() {
  const grid=document.getElementById('project-trend-grid'); if(!grid) return;
  const from=document.getElementById('filter-from').value, to=document.getElementById('filter-to').value;
  const selectedKategori=document.getElementById('filter-kategori').value;
  const staff=document.getElementById('filter-staff').value;
  const dates=dashDateList(from,to);

  const projectLabelMap = {
    'Projek Susu':'Projek Susu',
    'Projek Susu YGROW':'Projek Susu YGROW',
    'Projek Leads Ikhtiar (NaimFani)':'Projek Leads Ikhtiar',
    'Promo TikTok':'Promo TikTok',
    'Database WS/Lead':'Database WS/Lead'
  };

  const trendKey = selectedKategori ? normalizeLoose(selectedKategori) || 'selected' : 'semua-projek';
  const trendLabel = selectedKategori ? (projectLabelMap[selectedKategori] || selectedKategori) : 'Semua Projek';

  const rows = allEntries.filter(en => {
    if (from && en.tarikh < from) return false;
    if (to && en.tarikh > to) return false;
    if (staff && en.staffId !== staff) return false;
    if (selectedKategori && en.kategori !== selectedKategori) return false;
    return true;
  });

  const m=dashMetrics(rows);
  const daily=dates.map(date=>{
    const x=dashMetrics(rows.filter(r=>r.tarikh===date));
    return {date,sales:x.sales,sent:x.sent,reply:x.reply,buyer:x.buyer,cost:+x.cost.toFixed(2)};
  });

  window.__dashTrendActive = window.__dashTrendActive || {};
  const active=window.__dashTrendActive[trendKey] || ['sales','sent'];
  const chips=[['sales','Sales'],['sent','Sent'],['reply','Reply'],['buyer','Buyer'],['cost','Kos']]
    .map(([k,l])=>`<button type="button" class="trend-chip ${active.includes(k)?'active':''}" data-project="${trendKey}" data-key="${k}"><span class="trend-dot ${k}"></span>${l}</button>`)
    .join('');

  const scopeText = selectedKategori
    ? `Trend berdasarkan ${trendLabel} sahaja`
    : 'Semua projek digabungkan mengikut hari';

  grid.innerHTML=`<article class="project-trend-card">
    <div class="project-trend-top">
      <div>
        <div class="project-trend-name">${wabotEsc(trendLabel)}</div>
        <div class="project-trend-summary">
          ${wabotEsc(scopeText)} · Sales <b>RM ${fmt(m.sales)}</b> · Buyer <b>${fmt(m.buyer)}</b> · Reply <b>${m.replyRate.toFixed(1)}%</b>
        </div>
      </div>
      <span class="hint-chip">${rows.length} entri</span>
    </div>
    <div class="trend-chip-row">${chips}</div>
    <div class="trend-chart-wrap">${daily.length?dashSvgChart(daily,active):'<div class="empty-state">Pilih julat tarikh untuk lihat trend.</div>'}</div>
  </article>`;

  grid.querySelectorAll('.trend-chip').forEach(btn=>btn.onclick=()=>{
    const p=btn.dataset.project,k=btn.dataset.key;
    const arr=window.__dashTrendActive[p] || ['sales','sent'];
    window.__dashTrendActive[p]=arr.includes(k)?arr.filter(x=>x!==k):[...arr,k];
    if(!window.__dashTrendActive[p].length) window.__dashTrendActive[p]=['sales'];
    renderProjectTrends();
  });
}


function weekStartMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0,10);
}
function weekEndSunday(startStr) {
  return dashDateShift(startStr, 6);
}
function monthBucketInfo(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  if(Number.isNaN(d.getTime())) return null;
  const y=d.getFullYear(), m=d.getMonth(), day=d.getDate();
  const weekNo = day<=7 ? 1 : day<=14 ? 2 : day<=21 ? 3 : day<=28 ? 4 : 5;
  const startDay = [1,1,8,15,22,29][weekNo];
  const lastDay = new Date(y,m+1,0).getDate();
  const endDay = weekNo<5 ? [0,7,14,21,28][weekNo] : lastDay;
  const start=`${y}-${String(m+1).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`;
  const end=`${y}-${String(m+1).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
  return {key:`${y}-${String(m+1).padStart(2,'0')}-W${weekNo}`,weekNo,start,end};
}
function weeklyGroups(rows) {
  const map = new Map();
  rows.forEach(r => {
    if (!r.tarikh) return;
    const info=monthBucketInfo(r.tarikh);
    if(!info) return;
    if (!map.has(info.key)) map.set(info.key, {info,items:[]});
    map.get(info.key).items.push(r);
  });
  return [...map.values()]
    .sort((a,b)=>b.info.start.localeCompare(a.info.start))
    .map(x=>[x.info.start,x.items,x.info]);
}
function weekLabelMs(startStr) {
  const info=monthBucketInfo(startStr);
  return info ? `Week ${info.weekNo}` : 'Week';
}
function prettyDateMs(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  return d.toLocaleDateString('ms-MY',{day:'numeric',month:'short',year:'numeric'});
}

function entryMonthKey(r){
  const d=String(r?.tarikh||'');
  return /^\d{4}-\d{2}/.test(d) ? d.slice(0,7) : '';
}
function monthLabelMs(key){
  if(!key) return '-';
  const d=new Date(key+'-01T12:00:00');
  return d.toLocaleDateString('ms-MY',{month:'long',year:'numeric'});
}
function latestMonthlyContact(rows){
  const candidates=rows
    .filter(r=>Number(r.totalContact||0)>0)
    .sort((a,b)=>{
      const ad=String(a.tarikh||''),bd=String(b.tarikh||'');
      if(ad!==bd) return bd.localeCompare(ad);
      const at=a.createdAt?.toMillis?a.createdAt.toMillis():Number(a.createdAtMs||0);
      const bt=b.createdAt?.toMillis?b.createdAt.toMillis():Number(b.createdAtMs||0);
      return bt-at;
    });
  return Number(candidates[0]?.totalContact||0);
}
function monthlyDatabaseGroups(rows){
  const map=new Map();
  (rows||[]).forEach(r=>{
    const key=entryMonthKey(r); if(!key)return;
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(r);
  });
  return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([key,items])=>{
    const totalContact=latestMonthlyContact(items);
    const totalSent=items.reduce((s,r)=>s+Number(r.sent||0),0);
    const frequency=totalContact?totalSent/totalContact:0;
    const maxSent=totalContact*2;
    const remaining=Math.max(0,maxSent-totalSent);
    return {key,items,totalContact,totalSent,frequency,maxSent,remaining,status:!totalContact?'Tiada Contact':frequency>2?'Lebih 2x':frequency>=1.7?'Hampir 2x':'Okey'};
  });
}
function renderMonthlyContactDashboard(){
  const totalEl=document.getElementById('monthly-total-contact');
  if(!totalEl)return;
  const rows=filteredEntries();
  const groups=monthlyDatabaseGroups(rows);
  // Dashboard follows selected end date month; fallback latest group.
  const to=document.getElementById('filter-to')?.value||'';
  const wanted=to?to.slice(0,7):'';
  const g=groups.find(x=>x.key===wanted)||groups[0];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  if(!g){
    set('monthly-total-contact','0');set('monthly-total-sent','0');set('monthly-frequency','0.00x');set('monthly-send-capacity','0');
    set('monthly-cost-2x','RM 0.00');
    set('monthly-capacity-note','Belum ada total contact');
    set('monthly-cost-2x-note','Kos jika seluruh database diblast 2 kali');
    set('monthly-contact-period','Bulan semasa');
    const monthlyTargets=getDashTargets();
    set('monthly-sales-target','RM '+Number(monthlyTargets.sales||30000).toLocaleString('en-MY'));
    set('monthly-roi-target',Number(monthlyTargets.roi||7.08).toFixed(2)+'x');
    const alert=document.getElementById('monthly-frequency-alert');
    if(alert){alert.className='monthly-frequency-alert neutral';alert.textContent='Masukkan Total Contact di Input Data untuk aktifkan kiraan frequency bulanan.';}
    return;
  }
  set('monthly-total-contact',fmt(g.totalContact));
  set('monthly-total-sent',fmt(g.totalSent));
  set('monthly-frequency',g.frequency.toFixed(2)+'x');
  set('monthly-send-capacity',fmt(g.remaining));
  set('monthly-capacity-note',g.totalContact?`Had 2x = ${fmt(g.maxSent)} mesej`:'Belum ada total contact');
  set('monthly-cost-2x','RM '+costRM(g.maxSent).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}));
  set('monthly-cost-2x-note',g.totalContact?`${fmt(g.maxSent)} mesej × €${RATE_EUR_PER_SENT.toFixed(4)} × RM${EUR_TO_MYR.toFixed(2)}`:'Kos jika seluruh database diblast 2 kali');
  set('monthly-contact-period',monthLabelMs(g.key));
  const monthlyTargets=getDashTargets();
  set('monthly-sales-target','RM '+Number(monthlyTargets.sales||30000).toLocaleString('en-MY'));
  set('monthly-roi-target',Number(monthlyTargets.roi||7.08).toFixed(2)+'x');
  const alert=document.getElementById('monthly-frequency-alert');
  if(alert){
    if(!g.totalContact){alert.className='monthly-frequency-alert neutral';alert.textContent='Total Contact bulan ini belum dimasukkan.';}
    else if(g.frequency>2){alert.className='monthly-frequency-alert danger';alert.textContent=`Frequency ${g.frequency.toFixed(2)}x — sudah melebihi sasaran 2x untuk 1 nombor bulan ini.`;}
    else if(g.frequency>=1.7){alert.className='monthly-frequency-alert warn';alert.textContent=`Frequency ${g.frequency.toFixed(2)}x — hampir capai had 2x. Baki kapasiti kira-kira ${fmt(g.remaining)} mesej.`;}
    else{alert.className='monthly-frequency-alert good';alert.textContent=`Frequency ${g.frequency.toFixed(2)}x masih dalam sasaran. Baki kapasiti sehingga 2x: ${fmt(g.remaining)} mesej.`;}
  }
}
function renderMonthlyDatabaseReport(){
  const body=document.getElementById('monthly-db-report-body');
  if(!body)return;
  const groups=monthlyDatabaseGroups(lapFilteredEntries());
  const count=document.getElementById('monthly-report-count');
  if(count)count.textContent=`${groups.length} bulan`;
  if(!groups.length){body.innerHTML='<tr><td colspan="8" class="empty-state">Tiada data bulanan lagi.</td></tr>';return;}
  body.innerHTML=groups.map(g=>{
    const cls=g.status==='Lebih 2x'?'danger':g.status==='Hampir 2x'?'warn':g.status==='Okey'?'good':'neutral';
    return `<tr>
      <td class="tname">${monthLabelMs(g.key)}</td>
      <td class="num">${fmt(g.totalContact)}</td>
      <td class="num">${fmt(g.totalSent)}</td>
      <td class="num"><b>${g.frequency.toFixed(2)}x</b></td>
      <td class="num">${fmt(g.maxSent)}</td>
      <td class="num">${fmt(g.remaining)}</td>
      <td class="num">RM ${costRM(g.maxSent).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td><span class="monthly-status-pill ${cls}">${g.status}</span></td>
    </tr>`;
  }).join('');
}

function renderDashboardWeekly() {
  const body=document.getElementById('dash-weekly-body');
  if(!body) return;
  const rows=filteredEntries();
  const groups=weeklyGroups(rows);
  const kategori=document.getElementById('filter-kategori')?.value||'';
  const strip=document.getElementById('ygrow-target-strip');
  if(strip) strip.style.display=kategori==='Projek Susu YGROW'?'grid':'none';
  const count=document.getElementById('dash-weekly-count');
  if(count) count.textContent=`${groups.length} minggu`;
  if(!groups.length){body.innerHTML='<tr><td colspan="11" class="empty-state">Tiada data mingguan lagi.</td></tr>';return;}
  body.innerHTML=groups.map(([start,items])=>{
    const m=dashMetrics(items), info=monthBucketInfo(start), end=info?.end||start;
    return `<tr>
      <td class="tname">${weekLabelMs(start)}</td>
      <td>${prettyDateMs(start)} – ${prettyDateMs(end)}</td>
      <td class="num">${items.length}</td>
      <td class="num">${fmt(m.sent)}</td>
      <td class="num">${fmt(m.reply)}</td>
      <td class="num">${m.replyRate.toFixed(1)}%</td>
      <td class="num">${fmt(m.buyer)}</td>
      <td class="num">RM ${fmt(m.sales)}</td>
      <td class="num">RM ${fmt(m.cost.toFixed(2))}</td>
      <td class="num">${m.roi.toFixed(2)}x</td>
      <td class="num">${m.roas.toFixed(2)}x</td>
    </tr>`;
  }).join('');
}

function renderDashboard() {
  renderMonthlyContactDashboard();
  const rows = filteredEntries();
  const m = dashMetrics(rows);

  document.getElementById('stat-sent').textContent = fmt(m.sent);
  document.getElementById('stat-buyer').textContent = fmt(m.buyer);
  document.getElementById('stat-sales').textContent = 'RM ' + fmt(m.sales);
  document.getElementById('stat-cost-rm').textContent = 'RM ' + fmt(m.cost.toFixed(2));
  document.getElementById('stat-cost-eur').textContent = '€' + costEUR(m.sent).toFixed(2);
  document.getElementById('stat-roi').textContent = m.roas.toFixed(2) + 'x';
  document.getElementById('stat-roi-real').textContent = m.roi.toFixed(2) + 'x';
  document.getElementById('stat-conv').textContent = m.conversion.toFixed(2) + '%';
  document.getElementById('stat-sessions').textContent = fmt(rows.length) + ' entri';
  document.getElementById('stat-respon-rate').textContent = m.readRate.toFixed(1) + '%';
  document.getElementById('stat-reply-rate').textContent = m.replyRate.toFixed(1) + '%';
  document.getElementById('stat-conv-rate').textContent = m.conversion.toFixed(2) + '%';

  const DASH_TARGETS = getDashKpiTargets();
  dashSetTarget('sales',m.sales,DASH_TARGETS.sales);
  dashSetTarget('roi',m.roi,DASH_TARGETS.roi);
  dashSetTarget('roas',m.roas,DASH_TARGETS.roas);
  dashSetTarget('conv',m.conversion,DASH_TARGETS.conversion);
  dashSetTarget('reply',m.replyRate,DASH_TARGETS.reply);
  dashSetTarget('buyer',m.buyer,DASH_TARGETS.buyer);
  dashSetTarget('cost',m.cost,DASH_TARGETS.cost,true);
  dashSetTarget('sent',m.sent,DASH_TARGETS.sent);

  // Perubahan hari terakhir dalam range berbanding sehari sebelumnya
  const lastDate=document.getElementById('filter-to').value || new Date().toISOString().slice(0,10);
  const prevDate=dashDateShift(lastDate,-1);
  const todayM=dashMetrics(dashScopedRowsForDate(lastDate));
  const prevM=dashMetrics(dashScopedRowsForDate(prevDate));
  dashSetDelta('delta-sales',todayM.sales,prevM.sales);
  dashSetDelta('delta-roi',todayM.roi,prevM.roi);
  dashSetDelta('delta-roas',todayM.roas,prevM.roas);
  dashSetDelta('delta-conv',todayM.conversion,prevM.conversion);
  dashSetDelta('delta-reply',todayM.replyRate,prevM.replyRate);
  dashSetDelta('delta-sent',todayM.sent,prevM.sent);
  dashSetDelta('delta-buyer',todayM.buyer,prevM.buyer);
  dashSetDelta('delta-cost',todayM.cost,prevM.cost,true);

  // Funnel
  const stages = [
    { label: 'Sent', value: m.sent, color: '#59646A' },
    { label: 'Delivered', value: m.delivered, color: '#5FA8E0' },
    { label: 'Read', value: m.read, color: '#35E0AC' },
    { label: 'Reply', value: m.reply, color: '#F0AC52' },
    { label: 'Jadi Buyer', value: m.buyer, color: '#FF7A68' },
  ];
  const funnelEl = document.getElementById('funnel');
  funnelEl.innerHTML = '';
  stages.forEach(s => {
    const pct = m.sent ? (s.value / m.sent * 100) : 0;
    const row = document.createElement('div');
    row.className = 'funnel-stage';
    row.innerHTML = `<div class="tick">${s.label}</div>
      <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:${Math.max(pct,1.2)}%; background:${s.color}"></div></div>
      <div class="nums"><span class="n">${fmt(s.value)}</span><span class="r">${pct.toFixed(1)}%</span></div>`;
    funnelEl.appendChild(row);
  });

  const bySrc = {};
  rows.forEach(r => {
    const k = r.source || 'Umum';
    bySrc[k] = bySrc[k] || { sent: 0, buyer: 0, sales: 0 };
    bySrc[k].sent += r.sent; bySrc[k].buyer += r.buyer; bySrc[k].sales += r.sales;
  });
  const srcGrid = document.getElementById('source-grid');
  srcGrid.innerHTML = '';
  Object.entries(bySrc).forEach(([name, s]) => {
    const card = document.createElement('div');
    card.className = 'source-card';
    const conv = s.sent ? (s.buyer / s.sent * 100).toFixed(2) : '0.00';
    card.innerHTML = `<div class="top-row"><div class="name">${name}</div><span class="tag pool">${fmt(s.sent)} sent</span></div>
      <div class="stats-line"><span>Buyer: <b style="color:#35E0AC">${fmt(s.buyer)}</b></span><span>${conv}% conv</span></div>
      <div class="stats-line"><span>Sales</span><b>RM ${fmt(s.sales)}</b></div>`;
    srcGrid.appendChild(card);
  });
  if (!Object.keys(bySrc).length) srcGrid.innerHTML = '<div class="empty-state">Tiada data lagi — isi entri di tab Input Data.</div>';

  renderProjectTrends();
  renderDashboardWeekly();
}

function renderTemplateReport() {
  // Legacy report: its table was moved out of Dashboard.
  // If old DOM does not exist, exit safely.
  if (!document.getElementById('tmpl-body') || !document.getElementById('tmpl-count')) return;

  const rows = filteredEntries();
  const byTmpl = {};
  rows.forEach(r => {
    const k = r.template || 'Tanpa nama';
    byTmpl[k] = byTmpl[k] || { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 };
    const t = byTmpl[k];
    t.sessions++; t.sent += r.sent; t.read += r.read; t.reply += r.reply; t.buyer += r.buyer; t.sales += r.sales;
  });
  const body = document.getElementById('tmpl-body');
  body.innerHTML = '';
  const entries = Object.entries(byTmpl).sort((a, b) => (b[1].reply / (b[1].sent || 1)) - (a[1].reply / (a[1].sent || 1)));
  entries.forEach(([name, t], i) => {
    const readRate = t.sent ? (t.read / t.sent * 100).toFixed(1) : '0.0';
    const replyRate = t.sent ? (t.reply / t.sent * 100).toFixed(1) : '0.0';
    const convRate = t.sent ? (t.buyer / t.sent * 100).toFixed(2) : '0.00';
    const tCostRM = costRM(t.sent);
    const roi = tCostRM ? (t.sales / tCostRM) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rank">${i + 1}</td><td class="tname">${name}</td>
      <td class="num">${t.sessions}</td><td class="num">${fmt(t.sent)}</td><td class="num">${readRate}%</td>
      <td class="num">${replyRate}%</td><td class="num">${convRate}%</td>
      <td class="num">${t.sales ? 'RM ' + fmt(t.sales) : '–'}</td>
      <td class="num">RM ${fmt(tCostRM.toFixed(2))}</td>
      <td class="num">${roi === null ? '–' : roi.toFixed(2) + 'x'}</td>`;
    body.appendChild(tr);
  });
  document.getElementById('tmpl-count').textContent = entries.length + ' template';
  if (!entries.length) { body.innerHTML = '<tr><td colspan="10" class="empty-state">Tiada data lagi</td></tr>'; return; }

  // Baris Jumlah keseluruhan
  const T = entries.reduce((a, [, t]) => {
    a.sessions += t.sessions; a.sent += t.sent; a.read += t.read; a.reply += t.reply; a.buyer += t.buyer; a.sales += t.sales;
    return a;
  }, { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 });
  const tReadRate = T.sent ? (T.read / T.sent * 100).toFixed(1) : '0.0';
  const tReplyRate = T.sent ? (T.reply / T.sent * 100).toFixed(1) : '0.0';
  const tConvRate = T.sent ? (T.buyer / T.sent * 100).toFixed(2) : '0.00';
  const tCostRMAll = costRM(T.sent);
  const tRoiAll = tCostRMAll ? (T.sales / tCostRMAll) : null;
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  totalTr.innerHTML = `<td></td><td class="tname">JUMLAH</td>
    <td class="num">${T.sessions}</td><td class="num">${fmt(T.sent)}</td><td class="num">${tReadRate}%</td>
    <td class="num">${tReplyRate}%</td><td class="num">${tConvRate}%</td>
    <td class="num">${T.sales ? 'RM ' + fmt(T.sales) : '–'}</td>
    <td class="num">RM ${fmt(tCostRMAll.toFixed(2))}</td>
    <td class="num">${tRoiAll === null ? '–' : tRoiAll.toFixed(2) + 'x'}</td>`;
  body.appendChild(totalTr);
}

['filter-from', 'filter-to', 'filter-staff', 'filter-kategori'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    renderDashboard(); renderTemplateReport(); updateTopupVisibility();
  });
});

document.querySelectorAll('[data-range]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.range;
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from = new Date(to);
    if (type === 'yesterday') {
      from.setDate(to.getDate() - 1);
      to.setDate(to.getDate() - 1);
    }
    else if (type === 'last7') from.setDate(to.getDate() - 6);
    else if (type === 'last30') from.setDate(to.getDate() - 29);
    else if (type === 'lastmonth') {
      from = new Date(to.getFullYear(), to.getMonth() - 1, 1);
      to.setFullYear(from.getFullYear(), from.getMonth() + 1, 0);
    }
    else if (type === 'month') from = new Date(to.getFullYear(), to.getMonth(), 1);
    const iso = d => {
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    };
    document.getElementById('filter-from').value = iso(from);
    document.getElementById('filter-to').value = iso(to);
    document.querySelectorAll('[data-range]').forEach(x=>x.classList.toggle('active',x===btn));
    renderDashboard(); renderTemplateReport(); updateTopupVisibility();
  });
});

function updateTopupVisibility() {
  const kategori = document.getElementById('filter-kategori')?.value || '';

  // Topup Wabot ialah fungsi operasi dan mesti sentiasa boleh diakses
  // walaupun Dashboard sedang ditapis kepada projek tertentu.
  const topupSection = document.getElementById('topup-section');
  if (topupSection) topupSection.style.display = 'block';

  // Backward compatibility untuk KPI lama jika elemen masih wujud.
  const roiTopup = document.getElementById('stat-roi-topup-wrap');
  if (roiTopup) roiTopup.style.display = kategori ? 'none' : 'block';

  const susuExtra = document.getElementById('kategori-susu-extra');
  if (susuExtra) susuExtra.style.display = (kategori === 'Projek Susu' || kategori === 'Projek Susu YGROW') ? 'block' : 'none';

  const ygrowFlow = document.getElementById('kategori-ygrow-flow');
  if (ygrowFlow) {
    const showYgrowFlow = kategori === 'Projek Susu YGROW';
    ygrowFlow.style.display = showYgrowFlow ? 'block' : 'none';
    if (showYgrowFlow) setTimeout(() => resizeYgrowFlowFrame(document.getElementById('ygrow-flow-dashboard-frame')), 120);
  }

  const leadsExtra = document.getElementById('kategori-naimfani-extra');
  if (leadsExtra) leadsExtra.style.display = kategori === 'Projek Leads Ikhtiar (NaimFani)' ? 'block' : 'none';
}


// ---- YGROW presentation flow embedded inside Dashboard ----
function resizeYgrowFlowFrame(frame) {
  if (!frame) return;
  try {
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;
    const h = Math.max(
      doc.body?.scrollHeight || 0,
      doc.documentElement?.scrollHeight || 0,
      900
    );
    frame.style.height = Math.min(Math.max(h + 8, 900), 6200) + 'px';
  } catch (err) {
    // Same-origin report should resize normally; fallback keeps presentation usable.
    frame.style.height = '1800px';
  }
}

// ---- Report full-view modal ----
function openReportModal(url, title) {
  document.getElementById('report-modal-title').textContent = title || 'Dashboard';
  document.getElementById('report-modal-iframe').src = url;
  document.getElementById('report-modal').classList.add('show');
}
function closeReportModal() {
  document.getElementById('report-modal').classList.remove('show');
  document.getElementById('report-modal-iframe').src = '';
}
document.getElementById('report-modal-close').addEventListener('click', closeReportModal);
document.getElementById('report-modal').addEventListener('click', (e) => {
  if (e.target.id === 'report-modal') closeReportModal();
});

// ---- Image lightbox modal ----
function openImageModal(src) {
  document.getElementById('image-modal-img').src = src;
  document.getElementById('image-modal').classList.add('show');
}
function closeImageModal() {
  document.getElementById('image-modal').classList.remove('show');
}
document.getElementById('image-modal-close').addEventListener('click', closeImageModal);
document.getElementById('image-modal').addEventListener('click', (e) => {
  if (e.target.id === 'image-modal') closeImageModal();
});

async function populateStaffFilter() {
  const sel = document.getElementById('filter-staff');
  const snap = await db.collection('users').get();
  snap.forEach(doc => {
    const u = doc.data();
    const opt = document.createElement('option');
    opt.value = doc.id; opt.textContent = u.name || u.email;
    sel.appendChild(opt);
  });
}

// ============================================================
// CONTACTS — scale untuk puluhan ribu rekod (server-side query,
// bukan load semua ke memori)
// ============================================================
const PAGE_SIZE = 50;
let contactCursors = [null]; // cursor stack ikut page
let contactPageIdx = 0;
let lastContactDocs = [];
let knownSources = [];

// ---- Dynamic source registry (sumber sekarang free-text, bukan senarai tetap) ----
async function registerSource(source) {
  if (!source) return;
  try {
    await db.collection('meta').doc('contactSources').set({
      sources: firebase.firestore.FieldValue.arrayUnion(source)
    }, { merge: true });
  } catch (e) { /* diam-diam gagal, tak kritikal */ }
}
async function loadKnownSources() {
  try {
    const snap = await db.collection('meta').doc('contactSources').get();
    knownSources = snap.exists ? (snap.data().sources || []) : [];
    const list = document.getElementById('source-suggestions');
    list.innerHTML = '';
    knownSources.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      list.appendChild(opt);
    });
  } catch (e) { /* diam-diam gagal */ }
}

document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const source = document.getElementById('contact-source').value.trim() || 'Lain-lain';
  if (!name || !phone) return;
  try {
    await db.collection('contacts').add({
      name, phone, source, status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    registerSource(source);
    e.target.reset();
    toast('Rekod ditambah ✓');
    loadContactStats();
    loadContactsPage('first');
    loadKnownSources();
  } catch (err) {
    toast('Gagal tambah rekod: ' + err.message, true);
  }
});

// ---- Stats (aggregation count queries — murah walaupun puluhan ribu rekod) ----
// getCount() cuba guna .count() (murah), tapi fallback ke .get() kalau SDK/browser tak sokong
async function getCount(query) {
  try {
    if (typeof query.count === 'function') {
      const snap = await query.count().get();
      return snap.data().count;
    }
  } catch (e) { /* fallback di bawah */ }
  const snap = await query.get();
  return snap.size;
}

async function loadContactStats() {
  try {
    // Total/Dah Blast/Belum Blast/Dah Reply/Jadi Buyer sekarang MANUAL (bukan auto-kira) — sebab isu quota/extract
    const manualSnap = await db.collection('meta').doc('manualDbStats').get();
    let manual = manualSnap.exists ? manualSnap.data() : null;
    if (!manual) {
      manual = { blasted: 32360, pending: 13175, replied: 723, buyer: 114, note: '' };
      await db.collection('meta').doc('manualDbStats').set(manual);
    }
    document.getElementById('cstat-blasted').textContent = fmt(manual.blasted || 0);
    document.getElementById('cstat-pending').textContent = fmt(manual.pending || 0);
    document.getElementById('cstat-total').textContent = fmt((manual.blasted || 0) + (manual.pending || 0));
    document.getElementById('cstat-replied').textContent = fmt(manual.replied || 0);
    document.getElementById('cstat-buyer').textContent = fmt(manual.buyer || 0);
    document.getElementById('cstat-note').textContent = manual.note || '';
    document.getElementById('cstat-input-blasted').value = manual.blasted || 0;
    document.getElementById('cstat-input-pending').value = manual.pending || 0;
    document.getElementById('cstat-input-replied').value = manual.replied || 0;
    document.getElementById('cstat-input-buyer').value = manual.buyer || 0;
    document.getElementById('cstat-input-note').value = manual.note || '';

    const col = db.collection('contacts');

    const body = document.getElementById('source-stat-body');
    body.innerHTML = '<tr><td colspan="4" class="empty-state">Mengira...</td></tr>';
    if (!knownSources.length) await loadKnownSources();
    const rows = await Promise.all(knownSources.map(async (src) => {
      const [t, p] = await Promise.all([
        getCount(col.where('source', '==', src)),
        getCount(col.where('source', '==', src).where('status', '==', 'pending')),
      ]);
      return { src, total: t, pending: p };
    }));
    body.innerHTML = '';
    rows.filter(r => r.total > 0).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="tname">${r.src}</td><td class="num">${fmt(r.total)}</td>
        <td class="num" style="color:#35E0AC;">${fmt(r.total - r.pending)}</td>
        <td class="num" style="color:#F0AC52;">${fmt(r.pending)}</td>`;
      body.appendChild(tr);
    });
    if (!rows.some(r => r.total > 0)) body.innerHTML = '<tr><td colspan="4" class="empty-state">Tiada data lagi</td></tr>';
  } catch (err) {
    toast('Gagal kira statistik: ' + err.message, true);
  }
}

// ---- Browse list (server-side cursor pagination) ----
function buildContactQuery() {
  let q = db.collection('contacts').orderBy('createdAt', 'desc');
  const status = document.getElementById('filter-contact-status').value;
  const source = document.getElementById('filter-contact-source').value.trim();
  if (status) q = q.where('status', '==', status);
  if (source) q = q.where('source', '==', source);
  return q;
}

async function loadContactsPage(dir) {
  const body = document.getElementById('contact-body');
  body.innerHTML = '<tr><td colspan="5" class="empty-state">Memuatkan...</td></tr>';
  try {
    if (dir === 'first') { contactCursors = [null]; contactPageIdx = 0; }
    else if (dir === 'next') contactPageIdx++;
    else if (dir === 'prev') contactPageIdx = Math.max(0, contactPageIdx - 1);

    let q = buildContactQuery().limit(PAGE_SIZE);
    const cursor = contactCursors[contactPageIdx];
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    lastContactDocs = snap.docs;
    if (snap.docs.length) contactCursors[contactPageIdx + 1] = snap.docs[snap.docs.length - 1];

    renderContactRows(snap.docs);
    document.getElementById('contact-count').textContent = fmt(snap.docs.length) + ' dipapar';
    document.getElementById('page-info').textContent = `Halaman ${contactPageIdx + 1}`;
    document.getElementById('prev-page').disabled = contactPageIdx === 0;
    document.getElementById('next-page').disabled = snap.docs.length < PAGE_SIZE;
    updateBulkButtonState();
  } catch (err) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Ralat: ' + err.message + '</td></tr>';
  }
}

function statusLabel(s) {
  return { pending: 'Belum Blast', blasted: 'Dah Blast', replied: 'Dah Reply', buyer: 'Jadi Buyer' }[s] || 'Belum Blast';
}

// ---- Tags pelanggan (boleh lebih dari satu serentak) ----
const CONTACT_TAGS = [
  { key: 'buyer', label: 'Buyer' },
  { key: 'stop', label: 'Stop / Tak Nak Iklan' },
  { key: 'hamil', label: 'Hamil' },
  { key: 'ikhtiar', label: 'Ikhtiar' },
  { key: 'reply', label: 'Dah Reply' },
];
function renderTagBadges(tags) {
  if (!tags || !tags.length) return '<span style="color:var(--muted-2); font-size:11px;">–</span>';
  return tags.map(t => {
    const def = CONTACT_TAGS.find(d => d.key === t);
    return `<span class="tag-badge ${t}">${def ? def.label : t}</span>`;
  }).join('');
}
function buildTagCheckRow(containerId, selectedTags, onChangeCb) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  CONTACT_TAGS.forEach(t => {
    const isChecked = (selectedTags || []).includes(t.key);
    const label = document.createElement('label');
    label.className = 'tag-check-item' + (isChecked ? ' active' : '');
    label.innerHTML = `<input type="checkbox" value="${t.key}" ${isChecked ? 'checked' : ''}> ${t.label}`;
    label.querySelector('input').addEventListener('change', (e) => {
      label.classList.toggle('active', e.target.checked);
      if (onChangeCb) onChangeCb();
    });
    el.appendChild(label);
  });
}
function getCheckedTags(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(cb => cb.value);
}

function renderContactRows(docs) {
  const body = document.getElementById('contact-body');
  body.innerHTML = '';
  docs.forEach(d => {
    const c = d.data();
    const tr = document.createElement('tr');
    tr.className = c.status === 'blasted' ? 'row-blasted' : 'row-pending';
    tr.innerHTML = `<td><input type="checkbox" class="row-check" data-id="${d.id}"></td>
      <td class="tname">${c.name}</td>
      <td style="font-family:'IBM Plex Mono';">${c.phone}</td>
      <td style="font-size:12px; color:var(--muted);">${c.source || '–'}</td>
      <td style="max-width:160px;">${renderTagBadges(c.tags)}</td>
      <td>
        <select class="status-select" data-id="${d.id}" style="background:var(--surface-raised); border:1px solid var(--line); border-radius:20px; padding:4px 10px; font-size:11px; font-family:'IBM Plex Mono'; color:var(--text); cursor:pointer;">
          <option value="pending" ${c.status === 'pending' || !c.status ? 'selected' : ''}>Belum Blast</option>
          <option value="blasted" ${c.status === 'blasted' ? 'selected' : ''}>Dah Blast</option>
          <option value="replied" ${c.status === 'replied' ? 'selected' : ''}>Dah Reply</option>
          <option value="buyer" ${c.status === 'buyer' ? 'selected' : ''}>Jadi Buyer</option>
        </select>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn-ghost contact-edit-btn" data-id="${d.id}" data-name="${(c.name||'').replace(/"/g,'&quot;')}" data-phone="${c.phone||''}" data-source="${(c.source||'').replace(/"/g,'&quot;')}" data-tags="${(c.tags||[]).join(',')}" style="width:auto; padding:5px 10px; font-size:11px; margin-right:6px;">Edit</button>
        <button class="btn-ghost contact-del-btn" data-id="${d.id}" style="width:auto; padding:5px 10px; font-size:11px; color:var(--coral); border-color:rgba(255,122,104,0.3);">Padam</button>
      </td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('.status-select').forEach(sel => {
    sel.onchange = async () => {
      await db.collection('contacts').doc(sel.dataset.id).update({ status: sel.value });
      loadContactStats();
    };
  });
  document.querySelectorAll('.contact-edit-btn').forEach(btn => {
    btn.onclick = () => openEditContactModal(btn.dataset.id, btn.dataset.name, btn.dataset.phone, btn.dataset.source, btn.dataset.tags ? btn.dataset.tags.split(',').filter(Boolean) : []);
  });
  document.querySelectorAll('.contact-del-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Padam rekod ni? Tindakan ni tak boleh diundur.')) return;
      try {
        await db.collection('contacts').doc(btn.dataset.id).delete();
        toast('Rekod dipadam ✓');
        reloadCurrentContactPage();
        loadContactStats();
      } catch (err) {
        toast('Gagal padam: ' + err.message, true);
      }
    };
  });
  document.querySelectorAll('.row-check').forEach(cb => cb.addEventListener('change', updateBulkButtonState));
  if (!docs.length) body.innerHTML = '<tr><td colspan="7" class="empty-state">Tiada rekod dijumpai.</td></tr>';
}

// ---- Edit contact modal ----
let editingContactId = null;
function openEditContactModal(id, name, phone, source, tags) {
  editingContactId = id;
  document.getElementById('edit-contact-name').value = name || '';
  document.getElementById('edit-contact-phone').value = phone || '';
  document.getElementById('edit-contact-source').value = source || '';
  buildTagCheckRow('edit-contact-tags', tags || []);
  document.getElementById('edit-contact-modal').classList.add('show');
}
function closeEditContactModal() {
  editingContactId = null;
  document.getElementById('edit-contact-modal').classList.remove('show');
}
document.getElementById('edit-contact-cancel').addEventListener('click', closeEditContactModal);
document.getElementById('edit-contact-modal').addEventListener('click', (e) => {
  if (e.target.id === 'edit-contact-modal') closeEditContactModal();
});
document.getElementById('edit-contact-save').addEventListener('click', async () => {
  if (!editingContactId) return;
  const name = document.getElementById('edit-contact-name').value.trim();
  const phone = document.getElementById('edit-contact-phone').value.trim();
  const source = document.getElementById('edit-contact-source').value.trim() || 'Lain-lain';
  const tags = getCheckedTags('edit-contact-tags');
  if (!name || !phone) { toast('Nama & nombor tak boleh kosong', true); return; }
  const btn = document.getElementById('edit-contact-save');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await db.collection('contacts').doc(editingContactId).update({ name, phone, source, tags });
    registerSource(source);
    toast('Rekod dikemaskini ✓');
    closeEditContactModal();
    reloadCurrentContactPage();
    loadContactStats();
    loadKnownSources();
  } catch (err) {
    toast('Gagal kemaskini: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
});

// reload semasa page tanpa gerakkan cursor (lepas toggle status)
async function reloadCurrentContactPage() {
  const q = buildContactQuery().limit(PAGE_SIZE);
  const cursor = contactCursors[contactPageIdx];
  const finalQ = cursor ? q.startAfter(cursor) : q;
  const snap = await finalQ.get();
  renderContactRows(snap.docs);
}

document.getElementById('filter-contact-status').addEventListener('change', () => loadContactsPage('first'));
let sourceFilterDebounce = null;
document.getElementById('filter-contact-source').addEventListener('input', () => {
  clearTimeout(sourceFilterDebounce);
  sourceFilterDebounce = setTimeout(() => loadContactsPage('first'), 500);
});
document.getElementById('contact-refresh-btn').addEventListener('click', () => { loadContactStats(); loadContactsPage('first'); });
document.getElementById('prev-page').addEventListener('click', () => loadContactsPage('prev'));
document.getElementById('next-page').addEventListener('click', () => loadContactsPage('next'));

document.getElementById('select-all-contacts').addEventListener('change', (e) => {
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = e.target.checked);
  updateBulkButtonState();
});
function updateBulkButtonState() {
  const anyChecked = document.querySelectorAll('.row-check:checked').length > 0;
  document.getElementById('bulk-blast-btn').disabled = !anyChecked;
}
document.getElementById('bulk-blast-btn').addEventListener('click', async () => {
  const ids = Array.from(document.querySelectorAll('.row-check:checked')).map(cb => cb.dataset.id);
  if (!ids.length) return;
  const btn = document.getElementById('bulk-blast-btn');
  btn.disabled = true; btn.textContent = 'Mengemaskini...';
  try {
    const batch = db.batch();
    ids.forEach(id => batch.update(db.collection('contacts').doc(id), { status: 'blasted' }));
    await batch.commit();
    toast(ids.length + ' rekod ditandakan Dah Blast ✓');
    loadContactStats();
    loadContactsPage('first');
  } catch (err) {
    toast('Gagal kemaskini: ' + err.message, true);
  } finally {
    btn.textContent = 'Tandakan dipilih (page ni): Dah Blast';
  }
});

// ---- Tandakan SEMUA hasil tapisan sebagai Dah Blast (bukan setakat 50/page) ----
document.getElementById('bulk-blast-all-btn').addEventListener('click', async () => {
  const source = document.getElementById('filter-contact-source').value.trim();
  const scopeLabel = source ? `sumber "${source}"` : 'SEMUA sumber';
  if (!confirm(`Ni akan tandakan SEMUA rekod BELUM BLAST dalam ${scopeLabel} sebagai Dah Blast (bukan setakat page semasa). Teruskan?`)) return;

  const btn = document.getElementById('bulk-blast-all-btn');
  const progressEl = document.getElementById('bulk-all-progress');
  btn.disabled = true;
  progressEl.style.display = 'block';
  let total = 0;
  try {
    while (true) {
      let q = db.collection('contacts').where('status', '==', 'pending');
      if (source) q = q.where('source', '==', source);
      q = q.limit(400);
      const snap = await q.get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { status: 'blasted' }));
      await batch.commit();
      total += snap.docs.length;
      progressEl.textContent = `${fmt(total)} rekod ditandakan Dah Blast setakat ni...`;
      if (snap.docs.length < 400) break;
    }
    toast(`${fmt(total)} rekod berjaya ditandakan Dah Blast ✓`);
    loadContactStats();
    loadContactsPage('first');
  } catch (err) {
    toast('Gagal kemaskini bulk: ' + err.message, true);
  } finally {
    btn.disabled = false;
    setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
  }
});

// ---- Padam SEMUA hasil tapisan (elak batch salah upload perlu padam satu-satu) ----
document.getElementById('bulk-delete-all-btn').addEventListener('click', async () => {
  const status = document.getElementById('filter-contact-status').value;
  const source = document.getElementById('filter-contact-source').value.trim();
  if (!status && !source) {
    if (!confirm('⚠️ Tiada tapisan status/sumber dipilih — ni akan PADAM SEMUA rekod dalam database (bukan setakat batch tertentu)! Betul-betul nak teruskan?')) return;
  }
  const scopeParts = [];
  if (status) scopeParts.push(status === 'blasted' ? 'Dah Blast' : 'Belum Blast');
  if (source) scopeParts.push(`sumber "${source}"`);
  const scopeLabel = scopeParts.length ? scopeParts.join(' + ') : 'SEMUA rekod';
  if (!confirm(`Ni akan PADAM SEMUA rekod (${scopeLabel}) secara kekal. Tindakan ni TAK BOLEH diundur. Teruskan?`)) return;

  const btn = document.getElementById('bulk-delete-all-btn');
  const progressEl = document.getElementById('bulk-all-progress');
  btn.disabled = true;
  progressEl.style.display = 'block';
  let total = 0;
  try {
    while (true) {
      let q = db.collection('contacts');
      if (status) q = q.where('status', '==', status);
      if (source) q = q.where('source', '==', source);
      q = q.limit(400);
      const snap = await q.get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      total += snap.docs.length;
      progressEl.textContent = `${fmt(total)} rekod dipadam setakat ni...`;
      if (snap.docs.length < 400) break;
    }
    toast(`${fmt(total)} rekod berjaya dipadam ✓`);
    loadContactStats();
    loadContactsPage('first');
  } catch (err) {
    toast('Gagal padam bulk: ' + err.message, true);
  } finally {
    btn.disabled = false;
    setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
  }
});

// ---- Quick lookup by phone ----
document.getElementById('lookup-btn').addEventListener('click', doLookup);
document.getElementById('lookup-phone').addEventListener('keydown', e => { if (e.key === 'Enter') doLookup(); });
async function doLookup() {
  const phone = document.getElementById('lookup-phone').value.trim();
  const resultEl = document.getElementById('lookup-result');
  if (!phone) return;
  resultEl.innerHTML = '<div class="empty-state">Mencari...</div>';
  try {
    const snap = await db.collection('contacts').where('phone', '==', phone).limit(5).get();
    if (snap.empty) {
      resultEl.innerHTML = '<div class="empty-state">Nombor ni tiada dalam database.</div>';
      return;
    }
    resultEl.innerHTML = '';
    snap.forEach(d => {
      const c = d.data();
      const wrap = document.createElement('div');
      wrap.style.cssText = 'background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:10px;';
      wrap.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
        <div>
          <div class="todo-text">${c.name} — ${c.phone}</div>
          <div class="todo-meta">Sumber: ${c.source || '–'}</div>
        </div>
        <span class="status-pill ${c.status}">${statusLabel(c.status)}</span>
      </div>
      <div class="tag-check-row" id="lookup-tags-${d.id}" style="margin-top:12px; margin-bottom:0;"></div>`;
      resultEl.appendChild(wrap);
      buildTagCheckRow(`lookup-tags-${d.id}`, c.tags || [], async () => {
        const newTags = getCheckedTags(`lookup-tags-${d.id}`);
        try {
          await db.collection('contacts').doc(d.id).update({ tags: newTags });
          toast('Tag dikemaskini ✓');
        } catch (err) {
          toast('Gagal kemaskini tag: ' + err.message, true);
        }
      });
    });
  } catch (err) {
    resultEl.innerHTML = '<div class="empty-state">Ralat: ' + err.message + '</div>';
  }
}

// ---- Import mode tabs (Bulk Paste / Upload CSV) ----
document.querySelectorAll('.import-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.import-mode').forEach(m => m.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('import-mode-' + tab.dataset.mode).classList.add('active');
  });
});

// Parser robust: cari lajur yang "kelihatan macam nombor telefon" (7-15 digit)
// dalam mana-mana kedudukan, tak kisah susunan nama/nombor atau bilangan lajur.
// Ni elak masalah "detect sikit sahaja" bila data sebenar tak konsisten formatnya.
function parseBulkRows(raw) {
  const lines = raw.split(/\r?\n/)
    .map(l => l.replace(/^\uFEFF/, '').trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim().replace(/^"+|"+$/g, ''));
    let phoneIdx = -1, phone = '';
    for (let j = 0; j < cols.length; j++) {
      const digits = cols[j].replace(/[^0-9]/g, '');
      if (digits.length >= 7 && digits.length <= 15) { phoneIdx = j; phone = digits; break; }
    }
    if (phoneIdx === -1) continue; // baris tanpa nombor sah (termasuk baris header) — skip
    const nameParts = cols.filter((_, j) => j !== phoneIdx).filter(Boolean);
    const name = nameParts.join(' ').trim() || 'Tanpa Nama';
    rows.push({ name, phone });
  }
  return rows;
}

// ---- Live count preview semasa bulk paste ----
document.getElementById('paste-data').addEventListener('input', () => {
  const raw = document.getElementById('paste-data').value;
  const count = raw.trim() ? parseBulkRows(raw).length : 0;
  document.getElementById('paste-count').textContent = fmt(count) + ' rekod dikesan';
});

// ---- Import (batched writes, chunks of 400) — terima Bulk Paste atau fail CSV ----
document.getElementById('csv-import-btn').addEventListener('click', async () => {
  const activeMode = document.querySelector('.import-tab.active').dataset.mode;
  const source = document.getElementById('csv-source').value.trim() || 'Lain-lain';
  const btn = document.getElementById('csv-import-btn');
  const wrap = document.getElementById('csv-progress-wrap');
  const bar = document.getElementById('csv-progress-bar');
  const text = document.getElementById('csv-progress-text');
  btn.disabled = true;
  wrap.style.display = 'block';
  text.textContent = 'Membaca data...';
  try {
    let rows = [];
    if (activeMode === 'paste') {
      const raw = document.getElementById('paste-data').value;
      if (!raw.trim()) throw new Error('Paste dulu data database dalam kotak tu');
      rows = parseBulkRows(raw);
    } else {
      const file = document.getElementById('csv-file').files[0];
      if (!file) throw new Error('Pilih fail CSV dulu');
      const raw = await file.text();
      rows = parseBulkRows(raw);
    }
    if (!rows.length) throw new Error('Tiada baris rekod yang sah dijumpai (perlukan sekurang-kurangnya satu nombor 7-15 digit setiap baris)');

    // Setiap import dapat satu batchId unik — supaya boleh padam SATU sesi import
    // penuh sekali klik lepas ni (tak payah cari satu-satu nombor).
    const batchRef = db.collection('importBatches').doc();
    const batchId = batchRef.id;

    const CHUNK = 400;
    let done = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const batch = db.batch();
      chunk.forEach(r => {
        const ref = db.collection('contacts').doc();
        batch.set(ref, {
          name: r.name, phone: r.phone, source, status: 'pending',
          importBatchId: batchId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      done += chunk.length;
      const pct = Math.round(done / rows.length * 100);
      bar.style.width = pct + '%';
      text.textContent = `${fmt(done)} / ${fmt(rows.length)} rekod diimport (${pct}%)`;
    }
    await batchRef.set({
      source, count: rows.length,
      createdBy: currentProfile.name,
      createdAtMs: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    registerSource(source);
    toast(fmt(rows.length) + ' rekod berjaya diimport ✓');
    document.getElementById('paste-data').value = '';
    document.getElementById('paste-count').textContent = '0 rekod dikesan';
    document.getElementById('csv-file').value = '';
    loadContactStats();
    loadContactsPage('first');
    loadKnownSources();
    loadImportBatches();
  } catch (err) {
    toast('Gagal import: ' + err.message, true);
  } finally {
    btn.disabled = false;
    setTimeout(() => { wrap.style.display = 'none'; bar.style.width = '0%'; }, 2000);
  }
});

// ============================================================
// SEJARAH IMPORT — padam satu sesi import penuh sekali klik
// ============================================================
async function loadImportBatches() {
  const body = document.getElementById('batch-body');
  body.innerHTML = '<tr><td colspan="5" class="empty-state">Memuatkan...</td></tr>';
  try {
    const snap = await db.collection('importBatches').orderBy('createdAt', 'desc').limit(50).get();
    body.innerHTML = '';
    document.getElementById('batch-count').textContent = fmt(snap.size) + ' batch';
    snap.forEach(d => {
      const b = d.data();
      const dateStr = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().toLocaleString('ms-MY') : '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="font-size:12px;">${dateStr}</td>
        <td class="tname">${b.source || '-'}</td>
        <td class="num">${fmt(b.count || 0)}</td>
        <td style="font-size:12px; color:var(--muted);">${displayStaffName(b.createdBy)}</td>
        <td style="text-align:right;">
          <button class="btn-ghost batch-del-btn" data-id="${d.id}" data-count="${b.count || 0}" style="width:auto; padding:5px 10px; font-size:11px; color:var(--coral); border-color:rgba(255,122,104,0.3);">🗑️ Padam Batch Ini</button>
        </td>`;
      body.appendChild(tr);
    });
    document.querySelectorAll('.batch-del-btn').forEach(btn => {
      btn.onclick = () => deleteImportBatch(btn.dataset.id, btn.dataset.count);
    });
    if (snap.empty) body.innerHTML = '<tr><td colspan="5" class="empty-state">Tiada sejarah import lagi (import lepas update ni akan muncul di sini).</td></tr>';
  } catch (err) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Ralat: ' + err.message + '</td></tr>';
  }
}

async function deleteImportBatch(batchId, count) {
  if (!confirm(`Ni akan padam SEMUA ${fmt(count)} rekod dari batch import ni secara kekal. Teruskan?`)) return;
  const progressEl = document.getElementById('bulk-all-progress');
  progressEl.style.display = 'block';
  let total = 0;
  try {
    while (true) {
      const snap = await db.collection('contacts').where('importBatchId', '==', batchId).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      total += snap.docs.length;
      progressEl.textContent = `${fmt(total)} rekod dipadam setakat ni...`;
      if (snap.docs.length < 400) break;
    }
    await db.collection('importBatches').doc(batchId).delete();
    toast(`Batch dipadam — ${fmt(total)} rekod dibuang ✓`);
    loadContactStats();
    loadContactsPage('first');
    loadImportBatches();
  } catch (err) {
    toast('Gagal padam batch: ' + err.message, true);
  } finally {
    setTimeout(() => { progressEl.style.display = 'none'; }, 3000);
  }
}

// ============================================================
// TO-DO HARIAN — CRUD
// ============================================================
document.getElementById('todo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('todo-text').value.trim();
  const date = document.getElementById('todo-date').value;
  if (!text || !date) return;
  try {
    await db.collection('todos').add({
      text, date, done: false,
      staffId: currentUser.uid, staffName: currentProfile.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    document.getElementById('todo-text').value = '';
    toast('Tugasan ditambah ✓');
  } catch (err) {
    toast('Gagal tambah tugasan: ' + err.message, true);
  }
});

document.getElementById('todo-filter-date').addEventListener('change', renderTodos);
document.getElementById('todo-view-all-btn').addEventListener('click', () => {
  document.getElementById('todo-filter-date').value = '';
  renderTodos();
});

function renderTodoItem(container, t) {
  const item = document.createElement('div');
  item.className = 'todo-item' + (t.done ? ' done' : '');
  item.innerHTML = `
    <div class="todo-check ${t.done ? 'checked' : ''}" data-id="${t.id}" data-done="${t.done}">${t.done ? '✓' : ''}</div>
    <div style="flex:1;">
      <div class="todo-text">${t.text}</div>
      <div class="todo-meta">${displayStaffName(t.staffName || '')}</div>
    </div>
    <button class="todo-del" data-id="${t.id}">✕</button>`;
  item.querySelector('.todo-check').onclick = async () => {
    await db.collection('todos').doc(t.id).update({ done: !t.done });
  };
  item.querySelector('.todo-del').onclick = async () => {
    if (confirm('Padam tugasan ni?')) await db.collection('todos').doc(t.id).delete();
  };
  container.appendChild(item);
}

function renderTodos() {
  const date = document.getElementById('todo-filter-date').value;
  const list = document.getElementById('todo-list');
  list.innerHTML = '';

  if (date) {
    const rows = allTodos.filter(t => t.date === date);
    document.getElementById('todo-count').textContent = fmt(rows.length) + ' tugasan';
    rows.forEach(t => renderTodoItem(list, t));
    if (!rows.length) list.innerHTML = '<div class="empty-state">Tiada tugasan untuk tarikh ni.</div>';
    return;
  }

  // Tiada tarikh dipilih — papar SEMUA hari, disusun ikut kumpulan tarikh (terkini dulu)
  document.getElementById('todo-count').textContent = fmt(allTodos.length) + ' tugasan (semua hari)';
  const byDate = {};
  allTodos.forEach(t => { (byDate[t.date] = byDate[t.date] || []).push(t); });
  const dates = Object.keys(byDate).sort().reverse();
  if (!dates.length) { list.innerHTML = '<div class="empty-state">Tiada tugasan lagi.</div>'; return; }
  dates.forEach(d => {
    const header = document.createElement('div');
    header.className = 'todo-date-header';
    header.textContent = d;
    list.appendChild(header);
    byDate[d].forEach(t => renderTodoItem(list, t));
  });
}

// ============================================================
// POSTER — Mampatkan gambar (canvas) & simpan terus dalam Firestore
// (Elak guna Firebase Storage sebab perlukan Blaze plan/kad kredit)
// ============================================================
function compressImageToBase64(file, maxDim = 700, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal baca fail'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Fail bukan gambar yang sah'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('poster-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('poster-submit-btn');
  const name = document.getElementById('poster-name').value.trim();
  const file = document.getElementById('poster-file').files[0];
  if (!name || !file) return;
  btn.disabled = true; btn.textContent = 'Memproses gambar...';
  try {
    const dataUrl = await compressImageToBase64(file);
    if (dataUrl.length > 900000) throw new Error('Gambar masih terlalu besar lepas dimampatkan. Cuba guna gambar lain.');
    btn.textContent = 'Menyimpan...';
    await db.collection('posters').add({
      name, imageData: dataUrl,
      createdBy: currentProfile.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    e.target.reset();
    toast('Poster berjaya disimpan ✓');
  } catch (err) {
    toast('Gagal simpan poster: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Upload Poster';
  }
});

function renderPosters() {
  const countEl=document.getElementById('poster-count');
  if(countEl) countEl.textContent = fmt(allPosters.length) + ' poster';

  const grid = document.getElementById('poster-grid');
  if(!grid) return;

  const q=String(document.getElementById('poster-library-search')?.value || '').trim().toLowerCase();
  const perf=posterLibraryPerformanceMap();

  const rows=(allPosters||[])
    .filter(p=>!q || String(p.name||'').toLowerCase().includes(q))
    .sort((a,b)=>(perf[b.name]?.sales||0)-(perf[a.name]?.sales||0));

  grid.innerHTML = '';

  rows.forEach(p => {
    const x=perf[p.name] || {sent:0,reply:0,buyer:0,sales:0};
    const conv=x.sent ? x.buyer/x.sent*100 : 0;
    const replyRate=x.sent ? x.reply/x.sent*100 : 0;

    const card = document.createElement('div');
    card.className = 'poster-card poster-performance-card';

    card.innerHTML = `
      <button type="button" class="poster-image-button" onclick="openImageModal('${p.imageData}')">
        <img src="${p.imageData}" alt="${escHtml(p.name)}">
      </button>

      <div class="poster-info poster-performance-info">
        <div class="poster-card-title-row">
          <span class="poster-name">${escHtml(p.name)}</span>
          <span class="poster-sales-chip">${x.sales ? 'RM '+fmt(x.sales) : 'Belum Sales'}</span>
        </div>

        <div class="poster-card-kpis">
          <div><span>Sent</span><b>${fmt(x.sent)}</b></div>
          <div><span>Buyer</span><b>${fmt(x.buyer)}</b></div>
          <div><span>Reply</span><b>${replyRate.toFixed(1)}%</b></div>
          <div><span>Conv.</span><b>${conv.toFixed(2)}%</b></div>
        </div>

        <div class="poster-card-actions">
          <button class="poster-del" data-id="${p.id}">Buang</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll('.poster-del').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Padam poster ni?')) return;

      try {
        await db.collection('posters').doc(btn.dataset.id).delete();
      } catch (err) {
        toast('Gagal padam: ' + err.message, true);
      }
    };
  });

  if (!rows.length){
    grid.innerHTML = '<div class="empty-state">Tiada poster lagi — upload di atas.</div>';
  }

  renderPosterLibraryPerformance();
}
function populatePosterSelect() {
  const sel = document.getElementById('entry-poster');
  const current = sel.value;
  sel.innerHTML = '<option value="">- Tiada / Tak Berkaitan -</option>';
  allPosters.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  sel.value = current;
}

// ============================================================
// FEEDBACK — kategori + ayat + gambar (dimampatkan, simpan dalam Firestore)
// ============================================================
document.getElementById('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('feedback-submit-btn');
  const kategori = document.getElementById('feedback-kategori').value;
  const text = document.getElementById('feedback-text').value.trim();
  const file = document.getElementById('feedback-file').files[0];
  if (!text || !file) return;
  btn.disabled = true; btn.textContent = 'Memproses gambar...';
  try {
    const dataUrl = await compressImageToBase64(file);
    if (dataUrl.length > 900000) throw new Error('Gambar masih terlalu besar lepas dimampatkan. Cuba guna gambar lain.');
    btn.textContent = 'Menyimpan...';
    await db.collection('feedback').add({
      kategori, text, imageData: dataUrl,
      createdBy: currentProfile.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    e.target.reset();
    toast('Feedback berjaya disimpan ✓');
  } catch (err) {
    toast('Gagal simpan feedback: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan Feedback';
  }
});

document.getElementById('feedback-filter-kategori').addEventListener('change', renderFeedback);

function renderFeedback() {
  const kategori = document.getElementById('feedback-filter-kategori').value;
  const rows = kategori ? allFeedback.filter(f => f.kategori === kategori) : allFeedback;
  document.getElementById('feedback-count').textContent = fmt(rows.length) + ' feedback';
  const grid = document.getElementById('feedback-grid');
  grid.innerHTML = '';
  rows.forEach(f => {
    const dateStr = f.createdAt && f.createdAt.toDate ? f.createdAt.toDate().toLocaleDateString('ms-MY') : '';
    const card = document.createElement('div');
    card.className = 'feedback-card';
    card.innerHTML = `<img src="${f.imageData}" alt="feedback">
      <div class="fb-body">
        <span class="fb-kategori">${f.kategori}</span>
        <div class="fb-text">${(f.text || '').replace(/</g, '&lt;')}</div>
        <div class="fb-foot"><span>${displayStaffName(f.createdBy || '')} · ${dateStr}</span>
        <button class="fb-del" data-id="${f.id}">✕</button></div>
      </div>`;
    grid.appendChild(card);
  });
  document.querySelectorAll('.fb-del').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Padam feedback ni?')) return;
      try {
        await db.collection('feedback').doc(btn.dataset.id).delete();
      } catch (err) {
        toast('Gagal padam: ' + err.message, true);
      }
    };
  });
  if (!rows.length) grid.innerHTML = '<div class="empty-state">Tiada feedback lagi — tambah di atas.</div>';
}

// ============================================================
// LAPORAN — Harian & Prestasi Poster
// ============================================================
function lapFilteredEntries() {
  const from = document.getElementById('lap-filter-from').value;
  const to = document.getElementById('lap-filter-to').value;
  const kategori = document.getElementById('lap-filter-kategori').value;
  return allEntries.filter(en => {
    if (from && en.tarikh < from) return false;
    if (to && en.tarikh > to) return false;
    if (kategori && en.kategori !== kategori) return false;
    return true;
  });
}

function renderDailyReport() {
  const rows = lapFilteredEntries();
  const byDate = {};
  rows.forEach(r => {
    const k = r.tarikh || '-';
    byDate[k] = byDate[k] || { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 };
    const d = byDate[k];
    d.sessions++; d.sent += r.sent; d.read += r.read; d.reply += r.reply; d.buyer += r.buyer; d.sales += r.sales;
  });
  const body = document.getElementById('daily-body');
  body.innerHTML = '';
  const dates = Object.keys(byDate).sort().reverse();
  dates.forEach(date => {
    const d = byDate[date];
    const readRate = d.sent ? (d.read / d.sent * 100).toFixed(1) : '0.0';
    const replyRate = d.sent ? (d.reply / d.sent * 100).toFixed(1) : '0.0';
    const convRate = d.sent ? (d.buyer / d.sent * 100).toFixed(2) : '0.00';
    const dCostEUR = costEUR(d.sent);
    const dCostRM = costRM(d.sent);
    const roi = dCostRM ? (d.sales / dCostRM) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="tname">${date}</td><td class="num">${d.sessions}</td><td class="num">${fmt(d.sent)}</td>
      <td class="num">${readRate}%</td><td class="num">${replyRate}%</td>
      <td class="num">${fmt(d.buyer)}</td><td class="num">${convRate}%</td>
      <td class="num">${d.sales ? 'RM ' + fmt(d.sales) : '–'}</td>
      <td class="num">€${dCostEUR.toFixed(2)}</td>
      <td class="num">RM ${fmt(dCostRM.toFixed(2))}</td>
      <td class="num">${roi === null ? '–' : roi.toFixed(2) + 'x'}</td>`;
    body.appendChild(tr);
  });
  if (!dates.length) { body.innerHTML = '<tr><td colspan="11" class="empty-state">Tiada data lagi</td></tr>'; return; }

  const T = dates.reduce((a, date) => {
    const d = byDate[date];
    a.sessions += d.sessions; a.sent += d.sent; a.read += d.read; a.reply += d.reply; a.buyer += d.buyer; a.sales += d.sales;
    return a;
  }, { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 });
  const tReadRate = T.sent ? (T.read / T.sent * 100).toFixed(1) : '0.0';
  const tReplyRate = T.sent ? (T.reply / T.sent * 100).toFixed(1) : '0.0';
  const tConvRate = T.sent ? (T.buyer / T.sent * 100).toFixed(2) : '0.00';
  const tCostEURAll = costEUR(T.sent);
  const tCostRMAll = costRM(T.sent);
  const tRoiAll = tCostRMAll ? (T.sales / tCostRMAll) : null;
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  totalTr.innerHTML = `<td class="tname">JUMLAH</td><td class="num">${T.sessions}</td><td class="num">${fmt(T.sent)}</td>
    <td class="num">${tReadRate}%</td><td class="num">${tReplyRate}%</td>
    <td class="num">${fmt(T.buyer)}</td><td class="num">${tConvRate}%</td>
    <td class="num">${T.sales ? 'RM ' + fmt(T.sales) : '–'}</td>
    <td class="num">€${tCostEURAll.toFixed(2)}</td>
    <td class="num">RM ${fmt(tCostRMAll.toFixed(2))}</td>
    <td class="num">${tRoiAll === null ? '–' : tRoiAll.toFixed(2) + 'x'}</td>`;
  body.appendChild(totalTr);
}


function renderWeeklyReport() {
  const body=document.getElementById('weekly-report-body');
  if(!body) return;
  const rows=lapFilteredEntries();
  const groups=weeklyGroups(rows);
  const count=document.getElementById('weekly-report-count');
  if(count) count.textContent=`${groups.length} minggu`;
  if(!groups.length){body.innerHTML='<tr><td colspan="12" class="empty-state">Tiada data mingguan lagi</td></tr>';return;}
  body.innerHTML=groups.map(([start,items])=>{
    const m=dashMetrics(items), info=monthBucketInfo(start), end=info?.end||start;
    return `<tr>
      <td class="tname">${weekLabelMs(start)}</td>
      <td>${prettyDateMs(start)} – ${prettyDateMs(end)}</td>
      <td class="num">${items.length}</td>
      <td class="num">${fmt(m.sent)}</td>
      <td class="num">${m.readRate.toFixed(1)}%</td>
      <td class="num">${m.replyRate.toFixed(1)}%</td>
      <td class="num">${fmt(m.buyer)}</td>
      <td class="num">${m.conversion.toFixed(2)}%</td>
      <td class="num">${m.sales?'RM '+fmt(m.sales):'–'}</td>
      <td class="num">RM ${fmt(m.cost.toFixed(2))}</td>
      <td class="num">${m.roi.toFixed(2)}x</td>
      <td class="num">${m.roas.toFixed(2)}x</td>
    </tr>`;
  }).join('');
}

function renderPosterPerformance() {
  if (!document.getElementById('poster-perf-body') || !document.getElementById('poster-perf-count')) return;

  const rows = lapFilteredEntries().filter(r => r.poster);
  const byPoster = {};
  rows.forEach(r => {
    const k = r.poster;
    byPoster[k] = byPoster[k] || { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 };
    const p = byPoster[k];
    p.sessions++; p.sent += r.sent; p.read += r.read; p.reply += r.reply; p.buyer += r.buyer; p.sales += r.sales;
  });
  const body = document.getElementById('poster-perf-body');
  body.innerHTML = '';
  const entries = Object.entries(byPoster).sort((a, b) => (b[1].buyer / (b[1].sent || 1)) - (a[1].buyer / (a[1].sent || 1)));
  entries.forEach(([name, p], i) => {
    const readRate = p.sent ? (p.read / p.sent * 100).toFixed(1) : '0.0';
    const replyRate = p.sent ? (p.reply / p.sent * 100).toFixed(1) : '0.0';
    const convRate = p.sent ? (p.buyer / p.sent * 100).toFixed(2) : '0.00';
    const pCostRM = costRM(p.sent);
    const roi = pCostRM ? (p.sales / pCostRM) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rank">${i + 1}</td><td class="tname">${name}</td>
      <td class="num">${p.sessions}</td><td class="num">${fmt(p.sent)}</td><td class="num">${readRate}%</td>
      <td class="num">${replyRate}%</td><td class="num">${convRate}%</td>
      <td class="num">${p.sales ? 'RM ' + fmt(p.sales) : '–'}</td>
      <td class="num">RM ${fmt(pCostRM.toFixed(2))}</td>
      <td class="num">${roi === null ? '–' : roi.toFixed(2) + 'x'}</td>`;
    body.appendChild(tr);
  });
  document.getElementById('poster-perf-count').textContent = entries.length + ' poster';
  if (!entries.length) { body.innerHTML = '<tr><td colspan="10" class="empty-state">Tiada data poster lagi</td></tr>'; return; }

  const T = entries.reduce((a, [, p]) => {
    a.sessions += p.sessions; a.sent += p.sent; a.read += p.read; a.reply += p.reply; a.buyer += p.buyer; a.sales += p.sales;
    return a;
  }, { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 });
  const tReadRate = T.sent ? (T.read / T.sent * 100).toFixed(1) : '0.0';
  const tReplyRate = T.sent ? (T.reply / T.sent * 100).toFixed(1) : '0.0';
  const tConvRate = T.sent ? (T.buyer / T.sent * 100).toFixed(2) : '0.00';
  const tCostRMAll = costRM(T.sent);
  const tRoiAll = tCostRMAll ? (T.sales / tCostRMAll) : null;
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  totalTr.innerHTML = `<td></td><td class="tname">JUMLAH</td>
    <td class="num">${T.sessions}</td><td class="num">${fmt(T.sent)}</td><td class="num">${tReadRate}%</td>
    <td class="num">${tReplyRate}%</td><td class="num">${tConvRate}%</td>
    <td class="num">${T.sales ? 'RM ' + fmt(T.sales) : '–'}</td>
    <td class="num">RM ${fmt(tCostRMAll.toFixed(2))}</td>
    <td class="num">${tRoiAll === null ? '–' : tRoiAll.toFixed(2) + 'x'}</td>`;
  body.appendChild(totalTr);
}

function renderWabotPerformance() {
  const rows = lapFilteredEntries().filter(r => r.wabotAccount);
  const byAccount = {};
  rows.forEach(r => {
    const k = r.wabotAccount;
    byAccount[k] = byAccount[k] || { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 };
    const a = byAccount[k];
    a.sessions++; a.sent += r.sent; a.read += r.read; a.reply += r.reply; a.buyer += r.buyer; a.sales += r.sales;
  });
  const body = document.getElementById('wabot-perf-body');
  body.innerHTML = '';
  const entries = Object.entries(byAccount).sort((a, b) => (b[1].buyer / (b[1].sent || 1)) - (a[1].buyer / (a[1].sent || 1)));
  entries.forEach(([name, a], i) => {
    const readRate = a.sent ? (a.read / a.sent * 100).toFixed(1) : '0.0';
    const replyRate = a.sent ? (a.reply / a.sent * 100).toFixed(1) : '0.0';
    const convRate = a.sent ? (a.buyer / a.sent * 100).toFixed(2) : '0.00';
    const aCostRM = costRM(a.sent);
    const roi = aCostRM ? (a.sales / aCostRM) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rank">${i + 1}</td><td class="tname">${name}</td>
      <td class="num">${a.sessions}</td><td class="num">${fmt(a.sent)}</td><td class="num">${readRate}%</td>
      <td class="num">${replyRate}%</td><td class="num">${convRate}%</td>
      <td class="num">${a.sales ? 'RM ' + fmt(a.sales) : '–'}</td>
      <td class="num">RM ${fmt(aCostRM.toFixed(2))}</td>
      <td class="num">${roi === null ? '–' : roi.toFixed(2) + 'x'}</td>`;
    body.appendChild(tr);
  });
  document.getElementById('wabot-perf-count').textContent = entries.length + ' akaun';
  if (!entries.length) { body.innerHTML = '<tr><td colspan="10" class="empty-state">Tiada data akaun lagi</td></tr>'; return; }

  const T = entries.reduce((a, [, acc]) => {
    a.sessions += acc.sessions; a.sent += acc.sent; a.read += acc.read; a.reply += acc.reply; a.buyer += acc.buyer; a.sales += acc.sales;
    return a;
  }, { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0 });
  const tReadRate = T.sent ? (T.read / T.sent * 100).toFixed(1) : '0.0';
  const tReplyRate = T.sent ? (T.reply / T.sent * 100).toFixed(1) : '0.0';
  const tConvRate = T.sent ? (T.buyer / T.sent * 100).toFixed(2) : '0.00';
  const tCostRMAll = costRM(T.sent);
  const tRoiAll = tCostRMAll ? (T.sales / tCostRMAll) : null;
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  totalTr.innerHTML = `<td></td><td class="tname">JUMLAH</td>
    <td class="num">${T.sessions}</td><td class="num">${fmt(T.sent)}</td><td class="num">${tReadRate}%</td>
    <td class="num">${tReplyRate}%</td><td class="num">${tConvRate}%</td>
    <td class="num">${T.sales ? 'RM ' + fmt(T.sales) : '–'}</td>
    <td class="num">RM ${fmt(tCostRMAll.toFixed(2))}</td>
    <td class="num">${tRoiAll === null ? '–' : tRoiAll.toFixed(2) + 'x'}</td>`;
  body.appendChild(totalTr);
}

const DAY_NAMES_MS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

function renderDayOfWeek() {
  const rows = lapFilteredEntries();
  const byDay = {};
  DAY_NAMES_MS.forEach(d => { byDay[d] = { sessions: 0, sent: 0, buyer: 0, sales: 0 }; });
  rows.forEach(r => {
    if (!r.tarikh) return;
    const dow = new Date(r.tarikh + 'T00:00:00').getDay();
    const label = DAY_NAMES_MS[dow];
    const d = byDay[label];
    d.sessions++; d.sent += r.sent; d.buyer += r.buyer; d.sales += r.sales;
  });
  const body = document.getElementById('dayofweek-body');
  body.innerHTML = '';
  DAY_NAMES_MS.forEach(label => {
    const d = byDay[label];
    const convRate = d.sent ? (d.buyer / d.sent * 100).toFixed(2) : '0.00';
    const avgSales = d.sessions ? (d.sales / d.sessions) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="tname">${label}</td><td class="num">${d.sessions}</td><td class="num">${fmt(d.sent)}</td>
      <td class="num">${fmt(d.buyer)}</td><td class="num">${convRate}%</td>
      <td class="num">${d.sales ? 'RM ' + fmt(d.sales) : '–'}</td>
      <td class="num">${d.sessions ? 'RM ' + fmt(avgSales.toFixed(2)) : '–'}</td>`;
    body.appendChild(tr);
  });

  const T = DAY_NAMES_MS.reduce((a, label) => {
    const d = byDay[label];
    a.sessions += d.sessions; a.sent += d.sent; a.buyer += d.buyer; a.sales += d.sales;
    return a;
  }, { sessions: 0, sent: 0, buyer: 0, sales: 0 });
  const tConvRate = T.sent ? (T.buyer / T.sent * 100).toFixed(2) : '0.00';
  const tAvgSales = T.sessions ? (T.sales / T.sessions) : 0;
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  totalTr.innerHTML = `<td class="tname">JUMLAH</td><td class="num">${T.sessions}</td><td class="num">${fmt(T.sent)}</td>
    <td class="num">${fmt(T.buyer)}</td><td class="num">${tConvRate}%</td>
    <td class="num">${T.sales ? 'RM ' + fmt(T.sales) : '–'}</td>
    <td class="num">${T.sessions ? 'RM ' + fmt(tAvgSales.toFixed(2)) : '–'}</td>`;
  body.appendChild(totalTr);
}

function renderHourOfDay() {
  const rows = lapFilteredEntries().filter(r => r.masa);
  const byHour = {};
  rows.forEach(r => {
    const hour = parseInt(r.masa.split(':')[0], 10);
    if (isNaN(hour)) return;
    const label = String(hour).padStart(2, '0') + ':00 - ' + String(hour).padStart(2, '0') + ':59';
    byHour[label] = byHour[label] || { hour, sessions: 0, sent: 0, buyer: 0, sales: 0 };
    const h = byHour[label];
    h.sessions++; h.sent += r.sent; h.buyer += r.buyer; h.sales += r.sales;
  });
  const body = document.getElementById('hourofday-body');
  body.innerHTML = '';
  const entries = Object.entries(byHour).sort((a, b) => a[1].hour - b[1].hour);
  entries.forEach(([label, h]) => {
    const convRate = h.sent ? (h.buyer / h.sent * 100).toFixed(2) : '0.00';
    const avgSales = h.sessions ? (h.sales / h.sessions) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="tname">${label}</td><td class="num">${h.sessions}</td><td class="num">${fmt(h.sent)}</td>
      <td class="num">${fmt(h.buyer)}</td><td class="num">${convRate}%</td>
      <td class="num">${h.sales ? 'RM ' + fmt(h.sales) : '–'}</td>
      <td class="num">${h.sessions ? 'RM ' + fmt(avgSales.toFixed(2)) : '–'}</td>`;
    body.appendChild(tr);
  });
  if (!entries.length) { body.innerHTML = '<tr><td colspan="7" class="empty-state">Tiada entri dengan Masa Blasting diisi lagi</td></tr>'; return; }

  const T = entries.reduce((a, [, h]) => {
    a.sessions += h.sessions; a.sent += h.sent; a.buyer += h.buyer; a.sales += h.sales;
    return a;
  }, { sessions: 0, sent: 0, buyer: 0, sales: 0 });
  const tConvRate = T.sent ? (T.buyer / T.sent * 100).toFixed(2) : '0.00';
  const tAvgSales = T.sessions ? (T.sales / T.sessions) : 0;
  const totalTr = document.createElement('tr');
  totalTr.className = 'total-row';
  totalTr.innerHTML = `<td class="tname">JUMLAH</td><td class="num">${T.sessions}</td><td class="num">${fmt(T.sent)}</td>
    <td class="num">${fmt(T.buyer)}</td><td class="num">${tConvRate}%</td>
    <td class="num">${T.sales ? 'RM ' + fmt(T.sales) : '–'}</td>
    <td class="num">${T.sessions ? 'RM ' + fmt(tAvgSales.toFixed(2)) : '–'}</td>`;
  body.appendChild(totalTr);
}

['lap-filter-from', 'lap-filter-to', 'lap-filter-kategori'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    renderDailyReport(); renderWeeklyReport(); renderPosterPerformance(); renderWabotPerformance();
    renderDayOfWeek(); renderHourOfDay();
  });
});


// ============================================================
// VALID REPLY TRACKER
// - Ignore WhatsApp Business auto replies
// - Ignore emoji-only replies
// - Require a previous outgoing/blast within reply window
// - Dedupe by phone + matched outgoing/blast
// ============================================================
let allValidReplies = [];
let unsubValidReplies = null;
let replyTrackerRows = [];
let replyTrackerBuyerSet = new Set();

const REPLY_AUTO_PATTERNS = [
  /terima kasih kerana (menghubungi|berminat|mesej)/i,
  /terima kasih.*(?:hubungi|mesej).*(?:kami|admin)/i,
  /anda akan (?:dilayan|dibalas|dihubungi)/i,
  /akan (?:dilayan|dibalas|dihubungi).*(?:sebentar|secepat)/i,
  /kami akan (?:membalas|reply|hubungi)/i,
  /mesej anda telah (?:diterima|kami terima)/i,
  /di luar waktu (?:operasi|perniagaan)/i,
  /waktu operasi/i,
  /away message/i,
  /thank you for contacting/i,
  /thanks for contacting/i,
  /we(?:'|’)ll get back to you/i,
  /we will get back to you/i,
  /please wait.*(?:agent|admin)/i
];

function replyMessageText(e){
  const vals=[e?.message,e?.text,e?.body,e?.content];
  for(const v of vals){
    if(typeof v==='string' && v.trim()) return v.trim();
    if(v && typeof v==='object'){
      for(const k of ['text','body','caption','content','message']){
        if(typeof v[k]==='string' && v[k].trim()) return v[k].trim();
      }
    }
  }
  return '';
}

function replyIsEmojiOnly(text){
  const t=String(text||'').trim();
  if(!t) return false;
  try{
    const stripped=t
      .replace(/\p{Extended_Pictographic}/gu,'')
      .replace(/[\uFE0E\uFE0F\u200D]/g,'')
      .replace(/[\s\p{P}\p{S}]/gu,'');
    return stripped.length===0;
  }catch(_){
    return /^[\s\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF\uFE0F\u200D]+$/.test(t);
  }
}

function replyIgnoreReason(e){
  const text=replyMessageText(e);
  if(!text) return 'empty';
  if(replyIsEmojiOnly(text)) return 'emoji';
  if(REPLY_AUTO_PATTERNS.some(rx=>rx.test(text))) return 'auto';
  return '';
}

function replyPhone(v){
  let d=String(v||'').replace(/\D/g,'');
  if(!d) return '';
  if(d.startsWith('0') && d.length>8) d='60'+d.slice(1);
  return d;
}

function replyEventTime(e){
  return wabotDate(e?.eventAt) || wabotDate(e?.receivedAt);
}

function buildRecentValidReplies(events, windowDays=7){
  const useful=(events||[]).filter(isUsefulWabotEvent);
  const outgoingByPhone=new Map();

  useful.forEach(e=>{
    if(wabotEventKind(e)!=='outgoing') return;
    const phone=replyPhone(e.phone||e.to||e.from);
    const d=replyEventTime(e);
    if(!phone || !d) return;
    if(!outgoingByPhone.has(phone)) outgoingByPhone.set(phone,[]);
    outgoingByPhone.get(phone).push({...e,__date:d});
  });

  outgoingByPhone.forEach(rows=>rows.sort((a,b)=>b.__date-a.__date));

  const map=new Map();
  let ignored=0;

  useful.forEach(e=>{
    if(wabotEventKind(e)!=='incoming') return;
    const phone=replyPhone(e.phone||e.from||e.to);
    const rd=replyEventTime(e);
    if(!phone || !rd) return;

    const reason=replyIgnoreReason(e);
    if(reason){ ignored++; return; }

    const cutoff=rd.getTime()-windowDays*86400000;
    const outgoing=(outgoingByPhone.get(phone)||[]).find(o=>
      o.__date.getTime()<=rd.getTime() && o.__date.getTime()>=cutoff
    );
    if(!outgoing) return;

    const outId=outgoing.id || outgoing.messageId || outgoing.message_id ||
      `${phone}_${outgoing.__date.getTime()}`;
    const key=phone+'|'+outId;
    const old=map.get(key);
    const msg=replyMessageText(e);
    if(!old){
      map.set(key,{
        id:'recent_'+key,
        phone,
        firstValidReplyAt:rd,
        lastValidReplyAt:rd,
        lastMessage:msg,
        validMessageCount:1,
        matchedOutgoingId:outId,
        matchedOutgoingAt:outgoing.__date,
        campaign:outgoing.campaign||e.campaign||'',
        script:outgoing.script||outgoing.template||e.script||e.template||'',
        instanceId:outgoing.instanceId||outgoing.instance_id||outgoing.instance||e.instanceId||e.instance_id||e.instance||'',
        source:'recent-events'
      });
    }else{
      old.validMessageCount=(old.validMessageCount||1)+1;
      if(rd>old.lastValidReplyAt){
        old.lastValidReplyAt=rd;
        old.lastMessage=msg;
      }
    }
  });

  return {rows:[...map.values()],ignored};
}

function mergeValidReplyRows(serverRows,recentRows){
  const map=new Map();
  [...(serverRows||[]),...(recentRows||[])].forEach(r=>{
    const phone=replyPhone(r.phone);
    const outId=r.matchedOutgoingId||r.outgoingEventId||'unknown';
    const key=phone+'|'+outId;
    if(!phone) return;

    const old=map.get(key);
    if(!old){ map.set(key,{...r,phone}); return; }

    const oldD=replyEventTime({eventAt:old.lastValidReplyAt});
    const newD=replyEventTime({eventAt:r.lastValidReplyAt});
    if(newD && (!oldD || newD>oldD)){
      map.set(key,{...old,...r,phone});
    }
  });
  return [...map.values()];
}

function replyBlastDateInRange(row){
  const from=document.getElementById('reply-track-from')?.value||'';
  const to=document.getElementById('reply-track-to')?.value||'';
  const d=replyEventTime({eventAt:row.matchedOutgoingAt});
  if(!d) return true;
  const ds=d.toISOString().slice(0,10);
  if(from && ds<from) return false;
  if(to && ds>to) return false;
  return true;
}

function replyPhoneVariants(phone){
  const d=replyPhone(phone);
  if(!d) return [];
  const s=new Set([d]);
  if(d.startsWith('60')) s.add('0'+d.slice(2));
  else if(d.startsWith('0')) s.add('60'+d.slice(1));
  return [...s];
}

async function loadReplyBuyerSet(phones){
  const normalized=[...new Set((phones||[]).map(replyPhone).filter(Boolean))];
  const buyerSet=new Set();

  // Query up to 10 canonical numbers at once; each can create max 2 variants.
  for(let i=0;i<normalized.length;i+=10){
    const chunk=normalized.slice(i,i+10);
    const variants=[...new Set(chunk.flatMap(replyPhoneVariants))].slice(0,30);
    if(!variants.length) continue;
    try{
      const snap=await db.collection('contacts').where('phone','in',variants).get();
      snap.forEach(doc=>{
        const c=doc.data()||{};
        const isBuyer=String(c.status||'').toLowerCase()==='buyer' ||
          (Array.isArray(c.tags)&&c.tags.some(t=>String(t||'').toLowerCase()==='buyer'));
        if(isBuyer) buyerSet.add(replyPhone(c.phone));
      });
    }catch(err){
      console.warn('Reply Tracker buyer lookup:',err.message);
    }
  }

  return buyerSet;
}

function replyUniqueByPhone(rows){
  const map=new Map();
  (rows||[]).forEach(r=>{
    const p=replyPhone(r.phone);
    if(!p) return;
    const old=map.get(p);
    const rd=replyEventTime({eventAt:r.lastValidReplyAt});
    const od=old?replyEventTime({eventAt:old.lastValidReplyAt}):null;
    if(!old || (rd && (!od || rd>od))) map.set(p,r);
  });
  return [...map.values()];
}

async function renderReplyTracker(){
  const body=document.getElementById('reply-tracker-body');
  if(!body) return;

  const windowDays=Number(document.getElementById('reply-track-window')?.value||7);
  const recent=buildRecentValidReplies(allWabotEvents,windowDays);
  let rows=mergeValidReplyRows(allValidReplies,recent.rows).filter(replyBlastDateInRange);

  // Same customer may reply multiple times / to multiple events. Main KPI = unique phone.
  const unique=replyUniqueByPhone(rows);
  replyTrackerBuyerSet=await loadReplyBuyerSet(unique.map(r=>r.phone));

  const buyerFilter=document.getElementById('reply-track-buyer-filter')?.value||'all';
  const shown=unique.filter(r=>{
    const isBuyer=replyTrackerBuyerSet.has(replyPhone(r.phone));
    if(buyerFilter==='buyer') return isBuyer;
    if(buyerFilter==='nonbuyer') return !isBuyer;
    return true;
  });

  replyTrackerRows=unique;

  const buyers=unique.filter(r=>replyTrackerBuyerSet.has(replyPhone(r.phone))).length;
  const nonbuyers=unique.length-buyers;

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=fmt(v);};
  set('reply-valid-count',unique.length);
  set('reply-buyer-count',buyers);
  set('reply-nonbuyer-count',nonbuyers);
  set('reply-ignored-count',recent.ignored);

  const status=document.getElementById('reply-tracker-status');
  if(status) status.textContent=`${fmt(unique.length)} unique valid reply`;

  if(!shown.length){
    body.innerHTML='<tr><td colspan="5" class="empty-state">Tiada valid reply untuk filter ini.</td></tr>';
    return;
  }

  body.innerHTML=shown
    .sort((a,b)=>{
      const ad=replyEventTime({eventAt:a.lastValidReplyAt});
      const bd=replyEventTime({eventAt:b.lastValidReplyAt});
      return (bd?.getTime()||0)-(ad?.getTime()||0);
    })
    .map(r=>{
      const phone=replyPhone(r.phone);
      const replyD=replyEventTime({eventAt:r.lastValidReplyAt});
      const blastD=replyEventTime({eventAt:r.matchedOutgoingAt});
      const buyer=replyTrackerBuyerSet.has(phone);
      const blastLabel=[r.campaign,r.script].filter(Boolean).join(' • ') || (blastD?blastD.toLocaleString('ms-MY'):'Blast terdahulu');
      return `<tr>
        <td class="tname" style="font-family:'IBM Plex Mono';">${wabotEsc(phone)}</td>
        <td>${replyD?replyD.toLocaleString('ms-MY'):'-'}</td>
        <td>${wabotEsc(r.lastMessage||'-')}</td>
        <td><small>${wabotEsc(blastLabel)}</small></td>
        <td><span class="reply-buyer-pill ${buyer?'yes':'no'}">${buyer?'Buyer':'Belum Buyer'}</span></td>
      </tr>`;
    }).join('');
}

async function copyReplyPhones(nonbuyerOnly){
  if(!replyTrackerRows.length){
    await renderReplyTracker();
  }
  let rows=replyUniqueByPhone(replyTrackerRows);
  if(nonbuyerOnly) rows=rows.filter(r=>!replyTrackerBuyerSet.has(replyPhone(r.phone)));
  const phones=[...new Set(rows.map(r=>replyPhone(r.phone)).filter(Boolean))];
  if(!phones.length){toast('Tiada nombor reply untuk disalin',true);return;}
  try{
    await navigator.clipboard.writeText(phones.join('\n'));
    toast(fmt(phones.length)+' nombor reply unik disalin ✓');
  }catch(err){toast('Gagal salin nombor reply',true);}
}

function startValidReplyListener(){
  if(unsubValidReplies) return;
  unsubValidReplies=db.collection('validReplies').orderBy('lastValidReplyAt','desc').limit(2000).onSnapshot(snap=>{
    allValidReplies=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderReplyTracker();
  },err=>{
    console.warn('Valid Reply listener:',err.message);
    // Recent wabotEvents still gives a fallback view.
    renderReplyTracker();
  });
}

document.getElementById('reply-track-refresh')?.addEventListener('click',renderReplyTracker);
['reply-track-from','reply-track-to','reply-track-window','reply-track-buyer-filter'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',renderReplyTracker);
});
document.getElementById('reply-copy-nonbuyer')?.addEventListener('click',()=>copyReplyPhones(true));
document.getElementById('reply-copy-all')?.addEventListener('click',()=>copyReplyPhones(false));
document.querySelector('.app-nav button[data-view="filter"]')?.addEventListener('click',()=>{
  startValidReplyListener();
  setTimeout(renderReplyTracker,100);
});


// ============================================================
// FILTER / SEGMENTASI DATABASE — cari ikut status (Buyer, Reply, dll) + sumber + batch
// ============================================================
let segLastResults = [];
let segLastUnmatched = [];
let segPersistentUnmatched = [];

const SEG_UNMATCHED_STORAGE_KEY = 'crmPersistentUnmatchedPhonesV1';

function loadPersistentUnmatched(){
  try{
    const raw=JSON.parse(localStorage.getItem(SEG_UNMATCHED_STORAGE_KEY)||'[]');
    segPersistentUnmatched=segUniquePhones(Array.isArray(raw)?raw:[]);
  }catch(_){
    segPersistentUnmatched=[];
  }
  renderPersistentUnmatched();
}

function savePersistentUnmatchedLocal(){
  try{
    localStorage.setItem(SEG_UNMATCHED_STORAGE_KEY, JSON.stringify(segPersistentUnmatched));
  }catch(_){}
}

function addPersistentUnmatched(values){
  const merged=segUniquePhones([...(segPersistentUnmatched||[]), ...(values||[])]);
  segPersistentUnmatched=merged;
  savePersistentUnmatchedLocal();
  renderPersistentUnmatched();
}

function renderPersistentUnmatched(){
  const count=document.getElementById('seg-persistent-unmatched-count');
  const list=document.getElementById('seg-persistent-unmatched-list');
  if(count) count.textContent=fmt((segPersistentUnmatched||[]).length);
  if(!list) return;

  if(!(segPersistentUnmatched||[]).length){
    list.innerHTML='<div class="empty-state">Belum ada nombor tiada dalam database.</div>';
    return;
  }

  list.innerHTML=segPersistentUnmatched.map((p,i)=>`
    <div class="seg-unmatched-number-row">
      <span class="num-index">${i+1}</span>
      <code>${p}</code>
      <span class="seg-note-missing">⚠ Tiada dalam database</span>
      <button type="button" class="btn btn-ghost seg-remove-unmatched" data-phone="${p}">Buang</button>
    </div>
  `).join('');
}



async function populateBatchSelect() {
  const sel = document.getElementById('seg-filter-batch');
  const current = sel.value;
  sel.innerHTML = '<option value="">Semua Batch Import</option>';
  try {
    const snap = await db.collection('importBatches').orderBy('createdAt', 'desc').limit(50).get();
    snap.forEach(d => {
      const b = d.data();
      const dateStr = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().toLocaleString('ms-MY') : '';
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${dateStr} — ${b.source || '-'} (${fmt(b.count || 0)} rekod)`;
      sel.appendChild(opt);
    });
    sel.value = current;
  } catch (e) { /* diam-diam gagal */ }
}

document.getElementById('seg-search-btn').addEventListener('click', async () => {
  segLastUnmatched = [];
  const status = document.getElementById('seg-filter-status').value;
  const source = document.getElementById('seg-filter-source').value.trim();
  const batchId = document.getElementById('seg-filter-batch').value;
  const phone = document.getElementById('seg-filter-phone').value.trim();
  const tags = getCheckedTags('seg-filter-tags');
  const body = document.getElementById('seg-result-body');
  body.innerHTML = '<tr><td colspan="6" class="empty-state">Mencari...</td></tr>';
  document.getElementById('seg-result-count').textContent = '–';
  try {
    let snap;
    if (phone) {
      // Carian terus ikut nombor — abaikan tapisan lain, tepat 1 kontak
      snap = await db.collection('contacts').where('phone', '==', phone).limit(5).get();
    } else {
      let q = db.collection('contacts').orderBy('createdAt', 'desc');
      if (status) q = q.where('status', '==', status);
      if (source) q = q.where('source', '==', source);
      if (batchId) q = q.where('importBatchId', '==', batchId);
      if (tags.length) q = q.where('tags', 'array-contains-any', tags);
      q = q.limit(500);
      snap = await q.get();
    }
    segLastResults = segUniqueContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    document.getElementById('seg-result-count').textContent = fmt(segLastResults.length);
    document.getElementById('seg-result-note').textContent = segLastResults.length >= 500
      ? 'Papar 500 rekod pertama sahaja — sempitkan tapisan untuk hasil lebih tepat'
      : 'Semua hasil dipapar';
    body.innerHTML = '';
    segLastResults.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="tname">${c.name}</td>
        <td style="font-family:'IBM Plex Mono';">${c.phone}</td>
        <td style="font-size:12px; color:var(--muted);">${c.source || '–'}</td>
        <td style="max-width:160px;">${renderTagBadges(c.tags)}</td>
        <td><span class="seg-note-ok">Dalam database</span></td>
        <td style="text-align:right;"><span class="status-pill ${c.status}">${statusLabel(c.status)}</span></td>`;
      body.appendChild(tr);
    });
    if (!segLastResults.length) body.innerHTML = '<tr><td colspan="6" class="empty-state">Tiada hasil untuk tapisan ni.</td></tr>';
    renderSegSummary();
  } catch (err) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Ralat: ' + err.message + '</td></tr>';
  }
});



function segNormalizePhone(value){
  let d=String(value||'').replace(/\D/g,'');
  if(!d) return '';

  // Standardise common Malaysia variants to 60xxxxxxxxx.
  if(d.startsWith('60')) return d;
  if(d.startsWith('0') && d.length > 8) return '60'+d.slice(1);

  // For local numbers without prefix, only add 60 when it looks plausible.
  if((d.startsWith('1') || d.startsWith('3') || d.startsWith('4') ||
      d.startsWith('5') || d.startsWith('6') || d.startsWith('7') ||
      d.startsWith('8') || d.startsWith('9')) && d.length >= 8){
    return '60'+d;
  }

  return d;
}

function segUniquePhones(values){
  const seen=new Set();
  const out=[];
  (values||[]).forEach(v=>{
    const n=segNormalizePhone(v);
    if(!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
}

function segUniqueContacts(rows){
  const seen=new Set();
  const out=[];
  (rows||[]).forEach(c=>{
    const key=segNormalizePhone(c?.phone) || String(c?.id||'');
    if(!key || seen.has(key)) return;
    seen.add(key);
    out.push(c);
  });
  return out;
}

function segHasTag(c, wanted){
  const w=String(wanted||'').toLowerCase();
  return Array.isArray(c.tags) && c.tags.some(t=>String(t||'').toLowerCase()===w);
}

function segResultSummary(rows=segLastResults){
  rows=segUniqueContacts(rows);
  let buyer=0, replied=0;
  rows.forEach(c=>{
    const status=String(c.status||'').toLowerCase();
    const isBuyer=status==='buyer' || segHasTag(c,'buyer');
    const isReply=status==='replied' || segHasTag(c,'dah reply') || segHasTag(c,'reply') || segHasTag(c,'replied');
    if(isBuyer) buyer++;
    if(isReply) replied++;
  });
  const total=rows.length;
  const other=Math.max(0,total-buyer-replied);
  return {total,buyer,replied,other};
}

function renderSegSummary(){
  const s=segResultSummary();
  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=fmt(v);};
  set('seg-buyer-count',s.buyer);
  set('seg-reply-count',s.replied);
  set('seg-other-count',s.other);
  set('seg-unmatched-count',segUniquePhones([...(segLastUnmatched||[]), ...(segPersistentUnmatched||[])]).length);
}

function segNumbersBy(kind){
  const rows=segUniqueContacts(segLastResults)
    .filter(c=>{
      const status=String(c.status||'').toLowerCase();
      if(kind==='buyer') return status==='buyer' || segHasTag(c,'buyer');
      if(kind==='reply') return status==='replied' || segHasTag(c,'dah reply') || segHasTag(c,'reply') || segHasTag(c,'replied');
      return true;
    })
    .map(c=>String(c.phone||'').trim())
    .filter(Boolean);
  return segUniquePhones(rows);
}

async function segCopyNumbers(kind){
  const nums=segNumbersBy(kind);
  if(!nums.length){
    toast(kind==='buyer'?'Tiada nombor Buyer dalam hasil ini':'Tiada nombor Reply dalam hasil ini',true);
    return;
  }
  try{
    await navigator.clipboard.writeText(nums.join('\n'));
    toast(fmt(nums.length)+' nombor '+(kind==='buyer'?'Buyer':'Reply')+' disalin ✓');
  }catch(e){
    toast('Gagal salin nombor',true);
  }
}

let segSavedUnsub=null;

function renderSegSavedCards(rows){
  const wrap=document.getElementById('seg-saved-list');
  if(!wrap) return;
  if(!rows.length){
    wrap.innerHTML='<div class="empty-state">Belum ada hasil filter disimpan.</div>';
    return;
  }
  wrap.innerHTML=rows.map(r=>{
    const d=r.createdAt&&r.createdAt.toDate?r.createdAt.toDate():null;
    const date=d?d.toLocaleString('ms-MY'):(r.createdAtText||'-');
    const filterText=[
      r.filters?.status ? 'Status: '+r.filters.status : '',
      r.filters?.source ? 'Sumber: '+r.filters.source : '',
      r.filters?.batchLabel ? 'Batch: '+r.filters.batchLabel : '',
      Array.isArray(r.filters?.tags)&&r.filters.tags.length ? 'Tag: '+r.filters.tags.join(', ') : ''
    ].filter(Boolean).join(' • ') || 'Semua hasil';
    return `<article class="seg-saved-card">
      <div class="seg-saved-top">
        <div>
          <strong>${refEsc ? refEsc(r.name||'Hasil Filter') : (r.name||'Hasil Filter')}</strong>
          <small>${date} • ${filterText}</small>
        </div>
        <button class="btn btn-ghost seg-delete-save" data-id="${r.id}">Padam</button>
      </div>
      <div class="seg-saved-kpis">
        <div><span>Total DB</span><b>${fmt(r.total||0)}</b></div>
        <div><span>Buyer</span><b>${fmt(r.buyer||0)}</b></div>
        <div><span>Dah Reply</span><b>${fmt(r.replied||0)}</b></div>
        <div class="unmatched"><span>Tiada DB</span><b>${fmt(r.unmatched||0)}</b></div>
      </div>
      <div class="seg-saved-actions">
        <button class="btn btn-ghost seg-copy-saved" data-id="${r.id}" data-kind="buyer">📋 Copy Buyer</button>
        <button class="btn btn-ghost seg-copy-saved" data-id="${r.id}" data-kind="reply">📋 Copy Reply</button>
        <button class="btn btn-ghost seg-copy-saved" data-id="${r.id}" data-kind="unmatched">⚠️ Copy Tiada DB</button>
        <button class="btn btn-ghost seg-copy-saved" data-id="${r.id}" data-kind="all">📋 Copy Semua DB</button>
      </div>
    </article>`;
  }).join('');
}


function renderSegCumulativeSummary(rows){
  const buyerSet=new Set();
  const unmatchedSet=new Set();

  (rows||[]).forEach(r=>{
    segUniquePhones(r.buyerPhones||[]).forEach(p=>buyerSet.add(p));
    segUniquePhones(r.unmatchedPhones||[]).forEach(p=>unmatchedSet.add(p));
  });

  const set=(id,val)=>{
    const el=document.getElementById(id);
    if(el) el.textContent=fmt(val);
  };

  set('seg-cumulative-buyers',buyerSet.size);
  set('seg-cumulative-saves',(rows||[]).length);
  set('seg-cumulative-unmatched',unmatchedSet.size);
}

function startSegSavedListener(){
  if(segSavedUnsub) segSavedUnsub();
  segSavedUnsub=db.collection('filterSaves').orderBy('createdAt','desc').limit(200).onSnapshot(snap=>{
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    window.__segSavedRows=rows;
    renderSegSavedCards(rows);
    renderSegCumulativeSummary(rows);
  },err=>toast('Ralat baca hasil filter disimpan: '+err.message,true));
}

async function segWaitForSearchComplete(timeoutMs=8000){
  const started=Date.now();
  while(Date.now()-started < timeoutMs){
    const bodyText=(document.getElementById('seg-result-body')?.textContent||'').trim();
    const countText=(document.getElementById('seg-result-count')?.textContent||'').trim();
    const loading=bodyText.includes('Mencari...') || countText==='–';
    if(!loading) return true;
    await new Promise(r=>setTimeout(r,120));
  }
  return false;
}

document.getElementById('seg-save-result-btn')?.addEventListener('click',async()=>{
  // V43: kalau user terus tekan Simpan tanpa tekan Cari dahulu,
  // jalankan carian semasa secara automatik supaya flow lebih natural.
  if(!segLastResults.length && !(segLastUnmatched||[]).length){
    const searchBtn=document.getElementById('seg-search-btn');
    if(searchBtn){
      toast('Sedang cari nombor ikut filter semasa...');
      searchBtn.click();
      await segWaitForSearchComplete();
    }
  }

  if(!segLastResults.length && !(segLastUnmatched||[]).length && !(segPersistentUnmatched||[]).length){
    toast('Tiada nombor ditemui untuk filter ini. Semak filter dan cuba lagi.',true);
    return;
  }

  const summary=segResultSummary();
  const status=document.getElementById('seg-filter-status')?.value||'';
  const source=document.getElementById('seg-filter-source')?.value.trim()||'';
  const batch=document.getElementById('seg-filter-batch');
  const batchId=batch?.value||'';
  const batchLabel=batchId ? (batch?.selectedOptions?.[0]?.textContent||'') : '';
  const tags=getCheckedTags('seg-filter-tags');
  const name=prompt('Nama simpanan filter ini:', status==='buyer'?'Buyer Retarget':status==='replied'?'Reply Retarget':'Filter Retarget');
  if(name===null) return;
  const buyerPhones=segNumbersBy('buyer');
  const replyPhones=segNumbersBy('reply');
  const allPhones=segNumbersBy('all');
  try{
    await db.collection('filterSaves').add({
      name:(name||'Filter Retarget').trim(),
      total:summary.total,
      buyer:summary.buyer,
      replied:summary.replied,
      other:summary.other,
      buyerPhones,
      replyPhones,
      allPhones,
      unmatchedPhones:segUniquePhones([...(segLastUnmatched||[]), ...(segPersistentUnmatched||[])]),
      unmatched:segUniquePhones([...(segLastUnmatched||[]), ...(segPersistentUnmatched||[])]).length,
      filters:{status,source,batchId,batchLabel,tags},
      createdBy:currentProfile?.name||currentUser?.email||'Staff',
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    toast('Hasil filter disimpan ✓');
  }catch(err){toast('Gagal simpan hasil filter: '+err.message,true);}
});

document.getElementById('seg-copy-buyer-btn')?.addEventListener('click',()=>segCopyNumbers('buyer'));
document.getElementById('seg-copy-reply-btn')?.addEventListener('click',()=>segCopyNumbers('reply'));
document.getElementById('seg-copy-unmatched-btn')?.addEventListener('click',async()=>{
  const nums=segUniquePhones([...(segLastUnmatched||[]), ...(segPersistentUnmatched||[])]);
  if(!nums.length){toast('Tiada nombor yang tidak dijumpai',true);return;}
  try{
    await navigator.clipboard.writeText(nums.join('\n'));
    toast(fmt(nums.length)+' nombor tiada dalam database disalin ✓');
  }catch(err){toast('Gagal salin nombor',true);}
});

document.getElementById('seg-saved-list')?.addEventListener('click',async e=>{
  const copy=e.target.closest('.seg-copy-saved');
  if(copy){
    const row=(window.__segSavedRows||[]).find(r=>r.id===copy.dataset.id);
    if(!row)return;
    const kind=copy.dataset.kind;
    const nums=segUniquePhones(kind==='buyer'?(row.buyerPhones||[]):kind==='reply'?(row.replyPhones||[]):kind==='unmatched'?(row.unmatchedPhones||[]):(row.allPhones||[]));
    if(!nums.length){toast('Tiada nombor dalam kategori ini',true);return;}
    try{await navigator.clipboard.writeText(nums.join('\n'));toast(fmt(nums.length)+' nombor disalin ✓');}
    catch(err){toast('Gagal salin nombor',true);}
    return;
  }
  const del=e.target.closest('.seg-delete-save');
  if(del){
    if(!confirm('Padam rekod hasil filter ini?'))return;
    try{await db.collection('filterSaves').doc(del.dataset.id).delete();toast('Rekod filter dipadam ✓');}
    catch(err){toast('Gagal padam: '+err.message,true);}
  }
});


// ---- Bulk Tag sebagai Buyer — paste nombor, padan dgn database, tanda status=buyer terus ----
document.getElementById('seg-buyer-paste').addEventListener('input', () => {
  const raw = document.getElementById('seg-buyer-paste').value;
  const count = raw.trim() ? parseBulkRows(raw).length : 0;
  document.getElementById('seg-buyer-paste-count').textContent = fmt(count) + ' nombor dikesan';
});

// Nombor MY kadang disimpan dalam format berbeza ikut cara ia diimport dulu:
// dgn kod negara (60113324660), tanpa kod negara + ada 0 (0113324660), atau tanpa 0 langsung (113324660).
// Kita generate semua variasi yg munasabah supaya padanan tetap jumpa walau format tak 100% sama.
function phoneVariants(digits) {
  const variants = new Set([digits]);
  if (digits.startsWith('60') && digits.length > 8) {
    const rest = digits.slice(2);
    variants.add('0' + rest);
    variants.add(rest);
  } else if (digits.startsWith('0')) {
    const rest = digits.slice(1);
    variants.add('60' + rest);
    variants.add(rest);
  } else {
    variants.add('60' + digits);
    variants.add('0' + digits);
  }
  return [...variants];
}

document.getElementById('seg-buyer-tag-btn').addEventListener('click', async () => {
  const btn = document.getElementById('seg-buyer-tag-btn');
  const resultBox = document.getElementById('seg-buyer-tag-result');
  const raw = document.getElementById('seg-buyer-paste').value;
  const rows = raw.trim() ? parseBulkRows(raw) : [];
  const phones = segUniquePhones(rows.map(r => r.phone));
  if (!phones.length) { toast('Paste nombor dulu dalam kotak', true); return; }

  btn.disabled = true; btn.textContent = 'Memproses...';
  resultBox.textContent = 'Mencari & menanda ' + fmt(phones.length) + ' nombor...';
  try {
    let matched = [];
    const foundOriginals = new Set();
    const CHUNK = 9; // 9 nombor asal x sehingga 3 variasi = 27, bawah had 30 utk 'in' query Firestore
    for (let i = 0; i < phones.length; i += CHUNK) {
      const chunk = phones.slice(i, i + CHUNK);
      // peta setiap variasi balik ke nombor asal yg dipaste
      const variantToOriginal = {};
      const allVariants = [];
      chunk.forEach(orig => {
        phoneVariants(orig).forEach(v => { variantToOriginal[v] = orig; allVariants.push(v); });
      });
      const snap = await db.collection('contacts').where('phone', 'in', allVariants).get();
      if (snap.empty) continue;
      const batch = db.batch();
      snap.forEach(d => {
        batch.update(d.ref, { status: 'buyer' });
        const data = d.data();
        matched.push({ id: d.id, ...data, status: 'buyer' });
        const orig = variantToOriginal[data.phone];
        if (orig) foundOriginals.add(orig);
      });
      await batch.commit();
    }
    matched = segUniqueContacts(matched);
    const notFound = segUniquePhones(phones.filter(p => !foundOriginals.has(p)));
    segLastUnmatched = segUniquePhones(notFound);
    addPersistentUnmatched(segLastUnmatched);

    // Terus papar hasil kat table Filter Database bawah (macam lepas tekan Cari)
    segLastResults = matched;
    document.getElementById('seg-result-count').textContent = fmt(matched.length);
    document.getElementById('seg-result-note').textContent = 'Hasil dari Bulk Tag Buyer';
    const body = document.getElementById('seg-result-body');
    body.innerHTML = '';
    matched.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="tname">${c.name}</td>
        <td style="font-family:'IBM Plex Mono';">${c.phone}</td>
        <td style="font-size:12px; color:var(--muted);">${c.source || '–'}</td>
        <td style="max-width:160px;">${renderTagBadges(c.tags)}</td>
        <td><span class="seg-note-ok">Dalam database</span></td>
        <td style="text-align:right;"><span class="status-pill ${c.status}">${statusLabel(c.status)}</span></td>`;
      body.appendChild(tr);
    });
    if (!matched.length) body.innerHTML = '';
    notFound.forEach(phone=>{
      const tr=document.createElement('tr');
      tr.className='seg-unmatched-row';
      tr.innerHTML=`<td class="tname">–</td>
        <td style="font-family:'IBM Plex Mono';">${phone}</td>
        <td>–</td>
        <td>–</td>
        <td><span class="seg-note-missing">⚠ Tiada dalam database</span></td>
        <td style="text-align:right;"><span class="status-pill seg-missing-status">Tidak Dikesan</span></td>`;
      body.appendChild(tr);
    });
    if (!matched.length && !notFound.length) body.innerHTML = '<tr><td colspan="6" class="empty-state">Tiada nombor untuk dipaparkan.</td></tr>';
    renderSegSummary();

    resultBox.textContent = `✓ ${fmt(matched.length)} nombor dijumpai & ditanda sebagai Buyer.` +
      (notFound.length ? `\n⚠️ ${fmt(notFound.length)} nombor TIDAK dijumpai dalam database:\n${notFound.join(', ')}` : '');
    toast(fmt(matched.length) + ' kontak ditanda sebagai Buyer ✓');
  } catch (err) {
    resultBox.textContent = 'Ralat: ' + err.message;
    toast('Gagal proses: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '🏷️ Tag sebagai Buyer & Papar Hasil';
  }
});

document.getElementById('seg-copy-btn').addEventListener('click', async () => {
  if (!segLastResults.length) { toast('Tiada hasil untuk disalin — cari dulu', true); return; }
  const numbers = segLastResults.map(c => c.phone).join('\n');
  try {
    await navigator.clipboard.writeText(numbers);
    toast(fmt(segLastResults.length) + ' nombor disalin ke clipboard ✓');
  } catch (err) {
    toast('Gagal salin — browser tak sokong clipboard', true);
  }
});


// ============================================================
// WABOT OPENING BALANCE BASELINE — 4 Aug 2026
// Total topup €90 dibahagi sama rata kepada 6 nombor official.
// €15 setiap nombor. Usage sebelum tarikh ini tidak ditolak.
// ============================================================
const WABOT_OPENING_BALANCE_DATE = '2026-08-04';
const WABOT_OPENING_BALANCE_EUR = {
  '601111920528': 15,
  '601111920587': 15,
  '601111920523': 15,
  '60148769013': 15,
  '60142881728': 15,
  '601121001339': 15,
};

function wabotOpeningBalanceEUR(phone) {
  return Number(WABOT_OPENING_BALANCE_EUR[String(phone || '').replace(/\D/g,'')] || 0);
}

// ============================================================
// TOPUP BLASTING — track topup EUR/RM, hanya untuk Dashboard Keseluruhan
// ============================================================
let allTopups = [];
let unsubTopups = null;



// ============================================================
// WALLET LEDGER V9
// Single source of truth untuk baki transfer.
// Disimpan dalam collection `meta`, doc `wabotWalletLedger`.
// ============================================================
let wabotWalletLedger = {};

function walletLedgerDefault(){
  const base = {};
  WABOT_OFFICIALS.forEach(a=>{
    base[a.key] = {
      phone:a.phone,
      label:a.label,
      adjustmentEUR:0,
      updatedAtMs:0
    };
  });
  return base;
}

async function loadWalletLedger(){
  const ref = db.collection('meta').doc('wabotWalletLedger');
  const snap = await ref.get();

  const defaults = walletLedgerDefault();

  if(!snap.exists){
    wabotWalletLedger = defaults;
    await ref.set({
      accounts:defaults,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    return wabotWalletLedger;
  }

  const data = snap.data() || {};
  const accounts = data.accounts || {};

  wabotWalletLedger = {...defaults};

  Object.keys(accounts).forEach(k=>{
    wabotWalletLedger[k] = {
      ...(wabotWalletLedger[k] || {}),
      ...accounts[k]
    };
  });

  return wabotWalletLedger;
}

function walletLedgerAdjustmentEUR(acc){
  return Number(
    wabotWalletLedger?.[acc.key]?.adjustmentEUR || 0
  );
}

async function applyWalletTransferToLedger(from,to,amountEUR){
  const ref = db.collection('meta').doc('wabotWalletLedger');

  await db.runTransaction(async tx=>{
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() || {}) : {};
    const accounts = {
      ...walletLedgerDefault(),
      ...(data.accounts || {})
    };

    const fromRow = {
      ...(accounts[from.key] || {
        phone:from.phone,
        label:from.label,
        adjustmentEUR:0
      })
    };

    const toRow = {
      ...(accounts[to.key] || {
        phone:to.phone,
        label:to.label,
        adjustmentEUR:0
      })
    };

    fromRow.adjustmentEUR =
      Number(fromRow.adjustmentEUR || 0) -
      Number(amountEUR || 0);

    toRow.adjustmentEUR =
      Number(toRow.adjustmentEUR || 0) +
      Number(amountEUR || 0);

    fromRow.updatedAtMs = Date.now();
    toRow.updatedAtMs = Date.now();

    accounts[from.key] = fromRow;
    accounts[to.key] = toRow;

    tx.set(ref,{
      accounts,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
  });

  await loadWalletLedger();
}

async function rollbackWalletTransferLedger(from,to,amountEUR){
  const ref = db.collection('meta').doc('wabotWalletLedger');

  await db.runTransaction(async tx=>{
    const snap = await tx.get(ref);
    if(!snap.exists) return;

    const data = snap.data() || {};
    const accounts = {...(data.accounts || {})};

    const fromRow = {...(accounts[from.key] || {})};
    const toRow = {...(accounts[to.key] || {})};

    fromRow.adjustmentEUR =
      Number(fromRow.adjustmentEUR || 0) +
      Number(amountEUR || 0);

    toRow.adjustmentEUR =
      Number(toRow.adjustmentEUR || 0) -
      Number(amountEUR || 0);

    fromRow.updatedAtMs = Date.now();
    toRow.updatedAtMs = Date.now();

    accounts[from.key] = fromRow;
    accounts[to.key] = toRow;

    tx.set(ref,{
      accounts,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
  });

  await loadWalletLedger();
}

async function adjustWalletLedgerForTransferChange(oldTransfer,newTransfer){
  // Reverse old ledger effect if it had been applied.
  if(oldTransfer && oldTransfer.ledgerApplied){
    const oldFrom=WABOT_OFFICIALS.find(x=>
      x.key===oldTransfer.fromOfficialKey ||
      digitsOnly(x.phone)===digitsOnly(oldTransfer.fromOfficialPhone||'')
    );
    const oldTo=WABOT_OFFICIALS.find(x=>
      x.key===oldTransfer.toOfficialKey ||
      digitsOnly(x.phone)===digitsOnly(oldTransfer.toOfficialPhone||'')
    );

    if(oldFrom && oldTo){
      await rollbackWalletTransferLedger(
        oldFrom,
        oldTo,
        Number(oldTransfer.amountEUR||0)
      );
    }
  }

  // Apply replacement transfer if supplied.
  if(newTransfer){
    const newFrom=WABOT_OFFICIALS.find(x=>
      x.key===newTransfer.fromOfficialKey ||
      digitsOnly(x.phone)===digitsOnly(newTransfer.fromOfficialPhone||'')
    );
    const newTo=WABOT_OFFICIALS.find(x=>
      x.key===newTransfer.toOfficialKey ||
      digitsOnly(x.phone)===digitsOnly(newTransfer.toOfficialPhone||'')
    );

    if(!newFrom || !newTo){
      throw new Error('Mapping nombor transfer tidak dijumpai.');
    }

    await applyWalletTransferToLedger(
      newFrom,
      newTo,
      Number(newTransfer.amountEUR||0)
    );
  }
}






function sortWalletRows(){
  allTopups.sort((a,b)=>{
    const at=a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : Number(a.createdAtMs||0);
    const bt=b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : Number(b.createdAtMs||0);
    return bt-at;
  });
}

async function refreshWalletDataNow(){
  try{
    const snap=await db.collection('topups').get();

    allTopups=snap.docs.map(d=>({
      id:d.id,
      ...d.data()
    }));

    sortWalletRows();

    renderTopups();
    renderWabotControl();
    renderTransferHistory();

    return true;
  }catch(err){
    console.error('Wallet/topup/transfer sync gagal:',err);
    toast('Ralat sync wallet: '+err.message,true);
    return false;
  }
}

function startTopupListener(){
  if(unsubTopups){
    try{ unsubTopups(); }catch(_){}
  }

  unsubTopups=db.collection('topups').onSnapshot(snap=>{
    allTopups=snap.docs.map(d=>({
      id:d.id,
      ...d.data()
    }));

    sortWalletRows();

    renderTopups();
    renderWabotControl();
    renderTransferHistory();
  },err=>{
    console.error('Topup/transfer listener:',err);
    toast('Ralat baca topup/transfer: '+err.message,true);
  });
}

document.getElementById('topup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const amountEUR = Number(document.getElementById('topup-amount').value || 0);
  const note = document.getElementById('topup-note').value.trim();
  const officialKey = document.getElementById('topup-phone').value;
  const topupDate = document.getElementById('topup-date').value || todayStr();
  const official = WABOT_OFFICIALS.find(x=>x.key===officialKey);
  if (!amountEUR || !official) return toast('Pilih nombor Official dan masukkan amaun topup.', true);
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await db.collection('topups').add({
      amountEUR, amountRM: amountEUR * EUR_TO_MYR, note, topupDate,
      officialKey: official.key, officialPhone: official.phone, officialLabel: official.label, wabotGroup: official.wabot,
      createdBy: currentProfile.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    e.target.reset();
    initWabotControlInputs();
    toast('Topup ditambah untuk ' + official.label + ' ✓');
  } catch (err) {
    toast('Gagal tambah topup: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '+ Tambah Topup';
  }
});


const transferForm = document.getElementById('transfer-form');

if(transferForm){
  transferForm.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const fromKey=document.getElementById('transfer-from').value;
    const toKey=document.getElementById('transfer-to').value;
    const amountEUR=Number(document.getElementById('transfer-amount').value||0);
    const transferDate=document.getElementById('transfer-date').value||todayStr();
    const note=document.getElementById('transfer-note').value.trim();

    const from=WABOT_OFFICIALS.find(x=>x.key===fromKey);
    const to=WABOT_OFFICIALS.find(x=>x.key===toKey);

    if(!from || !to) return toast('Pilih akaun asal dan penerima.',true);
    if(from.key===to.key) return toast('Akaun asal dan penerima tak boleh sama.',true);
    if(!amountEUR || amountEUR<=0) return toast('Masukkan amaun transfer yang sah.',true);

    const btn=e.target.querySelector('button[type=submit]');
    btn.disabled=true;
    btn.textContent='Menyimpan...';

    try{
      // Ambil source of truth terkini sebelum validate.
      await refreshWalletDataNow();

      const current=wabotWalletStats(from);

      if(amountEUR>Math.max(0,current.balanceEUR)){
        throw new Error(
          `Baki ${from.label} tak cukup. Baki semasa €${current.balanceEUR.toFixed(2)}.`
        );
      }

      const payload={
        transactionType:'transfer',
        amountEUR,
        amountRM:amountEUR*EUR_TO_MYR,
        transferDate,
        fromOfficialKey:from.key,
        fromOfficialPhone:from.phone,
        fromOfficialLabel:from.label,
        toOfficialKey:to.key,
        toOfficialPhone:to.phone,
        toOfficialLabel:to.label,
        note,
        createdBy:currentProfile.name,
        createdAtMs:Date.now(),
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      };

      // Save ONE record only. This one record drives:
      // history + sender deduction + receiver addition.
      const ref=await db.collection('topups').add(payload);

      // Immediate local update, no need to wait listener.
      allTopups.unshift({
        id:ref.id,
        ...payload,
        createdAt:null
      });

      sortWalletRows();
      renderTopups();
      renderWabotControl();
      renderTransferHistory();

      e.target.reset();
      initWalletTransferInputs();

      toast(
        `Transfer €${amountEUR.toFixed(2)}: ${from.label} → ${to.label} berjaya ✓`
      );

      // Reconfirm from Firestore shortly after save.
      setTimeout(()=>refreshWalletDataNow(),500);

    }catch(err){
      toast('Transfer gagal: '+err.message,true);
    }finally{
      btn.disabled=false;
      btn.textContent='Transfer Balance';
    }
  });
}


function renderTopups() {
  const actualTopups = walletTopupRows();
  const totalEUR = actualTopups.reduce((a, t) => a + (t.amountEUR || 0), 0);
  const totalRM = actualTopups.reduce((a, t) => a + (t.amountRM || 0), 0);

  // V10.1: semua element Topup optional.
  // Sync wallet berjalan pada semua tab, jadi jangan error jika card Topup
  // tak wujud pada view/versi HTML semasa.
  const eurEl = document.getElementById('topup-total-eur');
  const rmEl = document.getElementById('topup-total-rm');
  const roiEl = document.getElementById('topup-roi');

  if (eurEl) eurEl.textContent = '€' + totalEUR.toFixed(2);
  if (rmEl) rmEl.textContent = 'RM ' + fmt(totalRM.toFixed(2));

  const totalSentAll = allEntries.reduce((a, r) => a + (r.sent || 0), 0);
  const totalSalesAll = allEntries.reduce((a, r) => a + (r.sales || 0), 0);
  const kosBlastingAll = costRM(totalSentAll);
  const denom = kosBlastingAll + totalRM;
  const roiWithTopup = denom ? (totalSalesAll / denom) : 0;

  if (roiEl) roiEl.textContent = roiWithTopup.toFixed(2) + 'x';

  const body = document.getElementById('topup-history-body');

  // Jika Topup History tak ada dalam DOM, cukup update data sahaja.
  if (!body) return;

  body.innerHTML = '';

  actualTopups.forEach(t => {
    const dateStr =
      t.createdAt && t.createdAt.toDate
        ? t.createdAt.toDate().toLocaleString('ms-MY')
        : '-';

    const tr = document.createElement('tr');

    tr.innerHTML = `<td style="font-size:12px;">${t.topupDate || dateStr}</td>
      <td style="font-size:12px;"><b>${t.officialLabel || 'Legacy / Belum Assigned'}</b>${t.officialPhone ? '<br><span style="color:var(--muted)">'+t.officialPhone+'</span>' : ''}</td>
      <td style="font-size:12px; color:var(--muted);">${t.note || '-'}</td>
      <td class="num">€${(t.amountEUR || 0).toFixed(2)}</td>
      <td class="num">RM ${fmt((t.amountRM || 0).toFixed(2))}</td>
      <td style="font-size:12px; color:var(--muted);">${displayStaffName(t.createdBy)}</td>`;

    body.appendChild(tr);
  });

  if (!actualTopups.length) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty-state">Tiada rekod topup lagi.</td></tr>';
  }
}

// ---- Edit manual Database stats (Total/Dah Blast/Belum Blast) ----
document.getElementById('cstat-edit-btn').addEventListener('click', () => {
  const wrap = document.getElementById('cstat-edit-form-wrap');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('cstat-save-btn').addEventListener('click', async () => {
  const blasted = Number(document.getElementById('cstat-input-blasted').value || 0);
  const pending = Number(document.getElementById('cstat-input-pending').value || 0);
  const replied = Number(document.getElementById('cstat-input-replied').value || 0);
  const buyer = Number(document.getElementById('cstat-input-buyer').value || 0);
  const note = document.getElementById('cstat-input-note').value.trim();
  const btn = document.getElementById('cstat-save-btn');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await db.collection('meta').doc('manualDbStats').set({
      blasted, pending, replied, buyer, note,
      updatedBy: currentProfile.name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    toast('Statistik database dikemaskini ✓');
    document.getElementById('cstat-edit-form-wrap').style.display = 'none';
    loadContactStats();
  } catch (err) {
    toast('Gagal simpan: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan';
  }
});


// ============================================================
// WABOT LIVE + ANALYTICS PRO (ADDITIVE MODULES)
// Existing entries/contacts/tabs are intentionally not modified.
// ============================================================
let allWabotEvents = [];
let unsubWabotEvents = null;

function wabotEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function wabotDate(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (typeof v === 'number') return new Date(v > 2e10 ? v : v * 1000);
  const d = new Date(v); return isNaN(d) ? null : d;
}
function wabotEventKind(e) {
  const raw = `${e.direction || ''} ${e.event || ''} ${e.type || ''} ${e.status || ''}`.toLowerCase();

  // Status mesej diperiksa dahulu supaya delivered/read/failed
  // tidak tersalah dikira sebagai outgoing.
  if (raw.includes('fail') || raw.includes('error')) return 'failed';
  if (raw.includes('read')) return 'read';
  if (raw.includes('delivered')) return 'delivered';

  // Incoming = customer reply
  if (raw.includes('incoming') || raw.includes('received') || e.fromMe === false) {
    return 'incoming';
  }

  // Sent / outgoing
  if (raw.includes('outgoing') || raw.includes('sent') || e.fromMe === true) {
    return 'outgoing';
  }

  return (e.direction || e.status || e.event || e.type || 'event').toLowerCase();
}

function isUsefulWabotEvent(e) {
  const k = wabotEventKind(e);
  return ['incoming', 'outgoing', 'delivered', 'read', 'failed'].includes(k);
}
function startWabotListener() {
  if (unsubWabotEvents) return;
  unsubWabotEvents = db.collection('wabotEvents').orderBy('receivedAt','desc').limit(1000).onSnapshot(snap => {
    allWabotEvents = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderWabotModules();
    if(document.getElementById('view-filter')?.classList.contains('active')) renderReplyTracker();
  }, err => {
    const s=document.getElementById('wabot-live-status'); if(s) s.textContent='Belum aktif / tiada permission';
    console.warn('Wabot listener:', err.message);
  });
}
// start after auth has exposed the app
const _originalStartListeners = startListeners;
startListeners = function(){ _originalStartListeners(); startWabotListener(); startValidReplyListener(); };

function wabotCounts() {
  const c = {
    sent: 0,
    delivered: 0,
    read: 0,
    reply: 0,
    failed: 0
  };

  // Elak event yang sama dikira berulang kali.
  const seen = {
    sent: new Set(),
    delivered: new Set(),
    read: new Set(),
    reply: new Set(),
    failed: new Set()
  };

  allWabotEvents.forEach(e => {
    const k = wabotEventKind(e);

    if (!['outgoing', 'incoming', 'delivered', 'read', 'failed'].includes(k)) {
      return;
    }

    const eventTime = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
    const timeKey = eventTime ? eventTime.getTime() : '';

    // messageId ialah key terbaik. Jika tiada, guna gabungan data event.
    const key =
      e.messageId ||
      e.message_id ||
      `${e.phone || e.from || e.to || '-'}_${timeKey}_${k}_${typeof e.message === 'string' ? e.message : ''}`;

    if (k === 'outgoing' && !seen.sent.has(key)) {
      seen.sent.add(key);
      c.sent++;
    } else if (k === 'delivered' && !seen.delivered.has(key)) {
      seen.delivered.add(key);
      c.delivered++;
    } else if (k === 'read' && !seen.read.has(key)) {
      seen.read.add(key);
      c.read++;
    } else if (k === 'incoming' && !seen.reply.has(key)) {
      seen.reply.add(key);
      c.reply++;
    } else if (k === 'failed' && !seen.failed.has(key)) {
      seen.failed.add(key);
      c.failed++;
    }
  });

  return c;
}
function renderWabotModules(){ renderWabotLive(); renderAnalyticsPro(); renderCampaignManager(); renderAIInsight(); }
function wabotLiveFilteredEvents() {
  const rangeEl = document.getElementById('wabot-range');
  const instanceEl = document.getElementById('wabot-instance-filter');
  const eventEl = document.getElementById('wabot-event-filter');

  const start = aproRangeStart(rangeEl ? rangeEl.value : 'today');
  const instance = instanceEl ? instanceEl.value : '';
  const eventKind = eventEl ? eventEl.value : '';

  return allWabotEvents.filter(e => {
    if (!isUsefulWabotEvent(e)) return false;

    const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
    if (!d || d < start) return false;

    const acc = String(e.instanceName || e.instance || e.instance_id || '');
    if (instance && acc !== instance) return false;

    const k = wabotEventKind(e);
    if (eventKind && k !== eventKind) return false;

    return true;
  });
}

function populateWabotInstanceFilter() {
  const sel = document.getElementById('wabot-instance-filter');
  if (!sel) return;

  const current = sel.value;
  const vals = [...new Set(
    allWabotEvents
      .map(e => String(e.instanceName || e.instance || e.instance_id || '').trim())
      .filter(Boolean)
  )].sort();

  sel.innerHTML = '<option value="">Semua Instance</option>' +
    vals.map(v => `<option value="${wabotEsc(v)}">${wabotEsc(v)}</option>`).join('');

  if (vals.includes(current)) sel.value = current;
}

function renderWabotLive() {
  populateWabotInstanceFilter();

  const events = wabotLiveFilteredEvents();
  const c = wabotCountsFor(events);

  const setAny = (ids, value) => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  };

  setAny(['wstat-sent','wl-sent'], fmt(c.sent));
  setAny(['wstat-delivered','wl-delivered'], fmt(c.delivered));
  setAny(['wstat-read','wl-read'], fmt(c.read));
  setAny(['wstat-reply','wl-reply'], fmt(c.reply));
  setAny(['wstat-failed','wl-failed'], fmt(c.failed));

  const audience = wabotAudienceStats(events);
  const deliveryRate = c.sent ? c.delivered / c.sent * 100 : 0;
  const readRate = c.sent ? c.read / c.sent * 100 : 0;
  const replyRate = audience.replyRate;
  const failedRate = c.sent ? c.failed / c.sent * 100 : 0;

  setAny(['wstat-delivery-rate'], deliveryRate.toFixed(1) + '% delivery');
  setAny(['wstat-read-rate'], readRate.toFixed(1) + '% read');
  setAny(['wstat-reply-rate'], replyRate.toFixed(1) + '% valid customer reply');
  setAny(['wstat-failed-rate'], failedRate.toFixed(1) + '% failed');

  const lastEvent = events
    .map(e => wabotDate(e.eventAt) || wabotDate(e.receivedAt))
    .filter(Boolean)
    .sort((a,b) => b-a)[0];

  setAny(
    ['wabot-live-last','wabot-live-status'],
    lastEvent ? `Update ${lastEvent.toLocaleString('ms-MY')}` : 'Menunggu webhook'
  );

  setAny(['wabot-event-count'], `${fmt(events.length)} event`);

  const body = document.getElementById('wabot-events-body');
  if (body) {
    if (!events.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada event webhook yang sepadan.</td></tr>';
    } else {
      body.innerHTML = events.slice(0,150).map(e => {
        const k = wabotEventKind(e);
        const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
        const msg =
          typeof e.message === 'string' ? e.message :
          typeof e.text === 'string' ? e.text :
          typeof e.status === 'string' ? e.status :
          typeof e.event === 'string' ? e.event : '-';

        return `<tr>
          <td style="font-size:11px;white-space:nowrap;">${d ? d.toLocaleString('ms-MY') : '-'}</td>
          <td><span class="status-pill ${wabotEsc(k)}">${wabotEsc(k)}</span></td>
          <td>${wabotEsc(e.direction || k)}</td>
          <td class="tname">${wabotEsc(e.phone || e.from || e.to || '-')}</td>
          <td>${wabotEsc(msg)}</td>
          <td style="font-size:11px;">${wabotEsc(e.instanceName || e.instance || e.instance_id || '-')}</td>
        </tr>`;
      }).join('');
    }
  }

  // Backward compatibility untuk layout Wabot Live lama.
  const feed = document.getElementById('wl-feed');
  if (feed) {
    feed.innerHTML = events.length
      ? events.slice(0,150).map(e => {
          const k = wabotEventKind(e);
          const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
          const message =
            typeof e.message === 'string' ? e.message :
            typeof e.text === 'string' ? e.text :
            typeof e.status === 'string' ? e.status :
            typeof e.event === 'string' ? e.event : '-';

          return `<div class="live-event ${wabotEsc(k)}">
            <span class="ev-type">${wabotEsc(k)}</span>
            <span class="ev-phone">${wabotEsc(e.phone || e.from || e.to || '-')}</span>
            <span class="ev-message">${wabotEsc(message)}</span>
            <span class="ev-time">${d ? d.toLocaleString('ms-MY') : '-'}</span>
          </div>`;
        }).join('')
      : '<div class="empty-state">Belum ada event yang sepadan.</div>';
  }
}
['wl-filter-direction','wl-filter-phone','wabot-range','wabot-instance-filter','wabot-event-filter'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.addEventListener(id.includes('phone') ? 'input' : 'change', renderWabotLive);
});
['wl-refresh','wabot-refresh-btn'].forEach(id=>{
  const el=document.getElementById(id);
  if(el) el.onclick=renderWabotModules;
});

const wabotHealthBtn = document.getElementById('wabot-health-btn');
if (wabotHealthBtn) {
  wabotHealthBtn.addEventListener('click', async () => {
    const chip = document.getElementById('wabot-live-api');
    wabotHealthBtn.disabled = true;
    if (chip) chip.textContent = 'API: semak...';
    try {
      const res = await fetch('/api/wabot/health', { cache:'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'API tidak OK');
      if (chip) chip.textContent = 'API: Aktif ✓';
      toast('Wabot API aktif ✓');
    } catch (err) {
      if (chip) chip.textContent = 'API: Ralat';
      toast('Wabot API gagal: ' + err.message, true);
    } finally {
      wabotHealthBtn.disabled = false;
    }
  });
}

function renderBars(id, rows, valueKey='value'){
  const el=document.getElementById(id); if(!el)return; if(!rows.length){el.innerHTML='<div class="empty-state">Belum cukup data.</div>';return;}
  const max=Math.max(...rows.map(r=>Number(r[valueKey]||0)),1);
  el.innerHTML=rows.slice(0,10).map(r=>`<div class="bar-row"><span>${wabotEsc(r.label)}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${Math.max(2,Number(r[valueKey]||0)/max*100)}%"></span></span><span class="bar-value">${wabotEsc(r.display ?? fmt(r[valueKey]))}</span></div>`).join('');
}
function groupEvents(fieldFn, filterFn=()=>true){ const m={}; allWabotEvents.filter(filterFn).forEach(e=>{const k=fieldFn(e)||'Tidak Diketahui';m[k]=(m[k]||0)+1}); return Object.entries(m).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value); }
// ============================================================
// ANALYTICS PRO — live Wabot analytics dengan range filter
// ============================================================
function aproRangeStart(value) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (value === '7') {
    start.setDate(start.getDate() - 6);
  } else if (value === '30') {
    start.setDate(start.getDate() - 29);
  }
  return start;
}

function aproFilteredEvents() {
  const rangeEl = document.getElementById('apro-range');
  const range = rangeEl ? rangeEl.value : 'today';
  const start = aproRangeStart(range);

  return allWabotEvents.filter(e => {
    if (!isUsefulWabotEvent(e)) return false;
    const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
    return d && d >= start;
  });
}

function aproFilteredEntries() {
  const rangeEl = document.getElementById('apro-range');
  const range = rangeEl ? rangeEl.value : 'today';
  const start = aproRangeStart(range);
  const startStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;

  return (allEntries || []).filter(e => !e.tarikh || e.tarikh >= startStr);
}

function wabotCountsFor(events) {
  const c = { sent:0, delivered:0, read:0, reply:0, failed:0 };
  const seen = {
    sent:new Set(), delivered:new Set(), read:new Set(), reply:new Set(), failed:new Set()
  };

  events.forEach(e => {
    const k = wabotEventKind(e);
    if (!['outgoing','incoming','delivered','read','failed'].includes(k)) return;

    const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
    const key = e.messageId || e.message_id ||
      `${e.phone || e.from || e.to || '-'}_${d ? d.getTime() : ''}_${k}_${typeof e.message === 'string' ? e.message : ''}`;

    if (k === 'outgoing' && !seen.sent.has(key)) { seen.sent.add(key); c.sent++; }
    else if (k === 'delivered' && !seen.delivered.has(key)) { seen.delivered.add(key); c.delivered++; }
    else if (k === 'read' && !seen.read.has(key)) { seen.read.add(key); c.read++; }
    else if (k === 'incoming' && !seen.reply.has(key)) { seen.reply.add(key); c.reply++; }
    else if (k === 'failed' && !seen.failed.has(key)) { seen.failed.add(key); c.failed++; }
  });
  return c;
}


function normalizeWabotPhone(v) {
  return String(v || '').replace(/\D/g, '');
}

function wabotAudienceStats(events) {
  const contacted = new Set();
  (events||[]).filter(isUsefulWabotEvent).forEach(e=>{
    if(wabotEventKind(e)==='outgoing'){
      const p=replyPhone(e.phone||e.to||e.from);
      if(p) contacted.add(p);
    }
  });

  const valid=buildRecentValidReplies(events,7);
  const uniqueValid=replyUniqueByPhone(valid.rows);
  const replyMessages=valid.rows.reduce((s,r)=>s+Number(r.validMessageCount||1),0);
  const uniqueContacted=contacted.size;
  const validReplyCustomers=uniqueValid.length;

  return {
    uniqueContacted,
    uniqueRepliers: validReplyCustomers,
    validReplyCustomers,
    replyMessages,
    replyRate: uniqueContacted ? validReplyCustomers/uniqueContacted*100 : 0
  };
}

function aproGroupAudience(events, fieldFn) {
  const groups = {};

  events.forEach(e => {
    const label = fieldFn(e) || 'Tidak Diketahui';
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  });

  return Object.entries(groups).map(([label, rows]) => ({
    label,
    counts: wabotCountsFor(rows),
    audience: wabotAudienceStats(rows)
  }));
}

function aproSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function aproGroupLifecycle(events, fieldFn) {
  const groups = {};
  events.forEach(e => {
    const label = fieldFn(e) || 'Tidak Diketahui';
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  });
  return Object.entries(groups).map(([label, rows]) => ({
    label,
    ...wabotCountsFor(rows)
  }));
}

function renderAnalyticsPro() {
  const events = aproFilteredEvents();
  const c = wabotCountsFor(events);
  const audience = wabotAudienceStats(events);
  const entries = aproFilteredEntries();

  const deliveryRate = c.sent ? c.delivered / c.sent * 100 : 0;
  const readRate = c.sent ? c.read / c.sent * 100 : 0;
  const replyRate = audience.replyRate;
  const failedRate = c.sent ? c.failed / c.sent * 100 : 0;

  aproSet('apro-sent', fmt(c.sent));
  aproSet('apro-delivered', fmt(c.delivered));
  aproSet('apro-read', fmt(c.read));
  aproSet('apro-reply', fmt(audience.validReplyCustomers));
  aproSet('apro-failed', fmt(c.failed));

  aproSet('apro-delivery-rate', deliveryRate.toFixed(1) + '% delivery rate');
  aproSet('apro-read-rate', readRate.toFixed(1) + '% read rate');
  aproSet('apro-reply-rate', replyRate.toFixed(1) + '% unique reply rate');
  aproSet('apro-failed-rate', failedRate.toFixed(1) + '% failed rate');

  aproSet('apro-unique-contacted', fmt(audience.uniqueContacted));
  aproSet('apro-reply-messages', fmt(audience.replyMessages));
  aproSet('apro-unique-repliers', fmt(audience.uniqueRepliers));

  const lastEvent = events
    .map(e => wabotDate(e.eventAt) || wabotDate(e.receivedAt))
    .filter(Boolean)
    .sort((a,b) => b-a)[0];

  aproSet(
    'apro-last',
    lastEvent ? `Update ${lastEvent.toLocaleString('ms-MY')}` : 'Belum ada data'
  );

  // Funnel utama guna unique customer supaya Reply Rate tak melebihi 100%.
  const buyers = entries.reduce((s,e) => s + Number(e.buyer || 0), 0);

  const stages = [
    ['Sent Msg', c.sent],
    ['Delivered', c.delivered],
    ['Read', c.read],
    ['Unique Contacted', audience.uniqueContacted],
    ['Valid Reply', audience.validReplyCustomers],
    ['Buyer (CRM)', buyers]
  ];

  const funnel = document.getElementById('apro-funnel');
  if (funnel) {
    const max = Math.max(...stages.map(x => x[1]), 1);

    funnel.innerHTML = stages.map(([label, value]) => {
      let pct = 0;

      if (label === 'Valid Reply') {
        pct = audience.uniqueContacted
          ? value / audience.uniqueContacted * 100
          : 0;
      } else if (label === 'Buyer (CRM)') {
        pct = audience.validReplyCustomers
          ? value / audience.validReplyCustomers * 100
          : 0;
      } else {
        pct = c.sent ? value / c.sent * 100 : 0;
      }

      const width = Math.max(value ? 3 : 0, value / max * 100);

      return `<div class="apro-funnel-row">
        <span>${wabotEsc(label)}</span>
        <span class="apro-funnel-track">
          <span class="apro-funnel-fill" style="display:block;width:${Math.min(width,100)}%"></span>
        </span>
        <span class="num">${fmt(value)} <small>${pct.toFixed(1)}%</small></span>
      </div>`;
    }).join('');
  }

  // Heatmap reply 24 jam — semua mesej reply.
  const byHour = Array.from({length:24}, (_,hour) => ({hour, count:0}));

  events
    .filter(e => wabotEventKind(e) === 'incoming')
    .forEach(e => {
      const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
      if (d) byHour[d.getHours()].count++;
    });

  const heatmap = document.getElementById('apro-heatmap');
  if (heatmap) {
    const maxHour = Math.max(...byHour.map(h => h.count), 1);

    heatmap.innerHTML = byHour.map(h => {
      const w = h.count ? Math.max(6, h.count/maxHour*100) : 0;

      return `<div class="apro-hour">
        <span>${String(h.hour).padStart(2,'0')}</span>
        <span class="apro-hour-bar"><i style="width:${w}%"></i></span>
        <b>${fmt(h.count)}</b>
      </div>`;
    }).join('');
  }

  // Live Reply.
  const replies = events
    .filter(e => wabotEventKind(e) === 'incoming')
    .sort((a,b) => {
      const da = wabotDate(a.eventAt) || wabotDate(a.receivedAt) || new Date(0);
      const dbb = wabotDate(b.eventAt) || wabotDate(b.receivedAt) || new Date(0);
      return dbb - da;
    });

  aproSet(
    'apro-live-reply-count',
    `${fmt(audience.uniqueRepliers)} customer · ${fmt(audience.replyMessages)} mesej`
  );

  const replyBody = document.getElementById('apro-live-replies');

  if (replyBody) {
    if (!replies.length) {
      replyBody.innerHTML =
        '<tr><td colspan="5" class="empty-state">Belum ada reply.</td></tr>';
    } else {
      replyBody.innerHTML = replies.slice(0,30).map(e => {
        const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
        const msg =
          typeof e.message === 'string'
            ? e.message
            : typeof e.text === 'string'
              ? e.text
              : '-';

        const campaign =
          e.campaign ||
          e.campaignName ||
          e.broadcast ||
          e.broadcastName ||
          '-';

        const account =
          e.instanceName ||
          e.instance ||
          e.instance_id ||
          '-';

        return `<tr>
          <td style="font-size:11px;white-space:nowrap;">
            ${d ? d.toLocaleString('ms-MY') : '-'}
          </td>
          <td class="tname">${wabotEsc(e.phone || e.from || e.to || '-')}</td>
          <td>${wabotEsc(msg)}</td>
          <td>${wabotEsc(campaign)}</td>
          <td style="font-size:11px;">${wabotEsc(account)}</td>
        </tr>`;
      }).join('');
    }
  }

  // Performance Akaun Wabot — guna unique customer reply.
  const accounts = aproGroupAudience(
    events,
    e => e.instanceName || e.instance || e.instance_id || 'Tidak Diketahui'
  ).sort((a,b) =>
    b.audience.validReplyCustomers - a.audience.validReplyCustomers ||
    b.counts.sent - a.counts.sent
  );

  const accountBody = document.getElementById('apro-account-body');

  if (accountBody) {
    accountBody.innerHTML = accounts.length
      ? accounts.map(a => {
          const rr = a.audience.replyRate;

          return `<tr>
            <td class="tname">${wabotEsc(a.label)}</td>
            <td class="num">${fmt(a.counts.sent)}</td>
            <td class="num">${fmt(a.audience.uniqueContacted)}</td>
            <td class="num">${fmt(a.audience.validReplyCustomers)}</td>
            <td class="num">${rr.toFixed(1)}%</td>
            <td class="num">${fmt(a.counts.read)}</td>
            <td class="num">${fmt(a.counts.failed)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="7" class="empty-state">Belum ada data akaun.</td></tr>';
  }

  // Performance Script / Template A/B/C.
  const scripts = aproGroupAudience(
    events,
    e => e.script || e.template || e.templateName || 'Tidak Diketahui'
  ).sort((a,b) =>
    b.audience.replyRate - a.audience.replyRate ||
    b.audience.validReplyCustomers - a.audience.validReplyCustomers
  );

  const scriptBody = document.getElementById('apro-script-body');

  if (scriptBody) {
    scriptBody.innerHTML = scripts.length
      ? scripts.map(s => {
          return `<tr>
            <td class="tname">${wabotEsc(s.label)}</td>
            <td class="num">${fmt(s.counts.sent)}</td>
            <td class="num">${fmt(s.audience.uniqueContacted)}</td>
            <td class="num">${fmt(s.audience.validReplyCustomers)}</td>
            <td class="num">${s.audience.replyRate.toFixed(1)}%</td>
            <td class="num">${fmt(s.counts.read)}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="empty-state">Webhook belum membawa metadata script/template.</td></tr>';
  }

  // Performance Staff masih guna data entries CRM sedia ada.
  const staff = {};

  entries.forEach(e => {
    const name = displayStaffName(e.staffName || 'Tidak Diketahui');

    if (!staff[name]) {
      staff[name] = {sent:0, reply:0, buyer:0, sales:0};
    }

    staff[name].sent += Number(e.sent || 0);
    staff[name].reply += Number(e.reply || 0);
    staff[name].buyer += Number(e.buyer || 0);
    staff[name].sales += Number(e.sales || 0);
  });

  const staffRows = Object.entries(staff)
    .map(([label,v]) => ({label, ...v}))
    .sort((a,b) => b.buyer - a.buyer || b.reply - a.reply);

  const staffBody = document.getElementById('apro-staff-body');

  if (staffBody) {
    staffBody.innerHTML = staffRows.length
      ? staffRows.map(s => {
          const rr = s.sent ? s.reply/s.sent*100 : 0;

          return `<tr>
            <td class="tname">${wabotEsc(s.label)}</td>
            <td class="num">${fmt(s.sent)}</td>
            <td class="num">${fmt(s.reply)}</td>
            <td class="num">${rr.toFixed(1)}%</td>
            <td class="num">${fmt(s.buyer)}</td>
            <td class="num">${s.sales ? 'RM '+fmt(s.sales) : '-'}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" class="empty-state">Belum ada data staff dalam entries CRM.</td></tr>';
  }
}
const aproRange = document.getElementById('apro-range');
if (aproRange) aproRange.addEventListener('change', renderAnalyticsPro);

function campaignRangeStart(range) {
  const now = new Date();
  const d = new Date(now);

  if (range === 'today') {
    d.setHours(0,0,0,0);
    return d;
  }

  const days = Number(range || 7);
  d.setDate(d.getDate() - Math.max(days - 1, 0));
  d.setHours(0,0,0,0);
  return d;
}


function normalizeLoose(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function entryMinutes(en) {
  if (!/^\d{1,2}:\d{2}$/.test(en.masa || '')) return null;
  const [hh, mm] = en.masa.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function eventMinutes(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function textSimilarityScore(a, b) {
  const aa = normalizeCampaignKey(a);
  const bb = normalizeCampaignKey(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 100;
  if (aa.includes(bb) || bb.includes(aa)) return 60;

  const at = new Set(aa.split(/[\s_\-\/]+/).filter(Boolean));
  const bt = new Set(bb.split(/[\s_\-\/]+/).filter(Boolean));
  if (!at.size || !bt.size) return 0;

  let common = 0;
  at.forEach(t => { if (bt.has(t)) common++; });
  return Math.round((common / Math.max(at.size, bt.size)) * 50);
}


function campaignMapDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function campaignMapInstance(e) {
  return String(
    e.instanceName || e.instance || e.instance_id ||
    e.phoneNumberId || e.phone_number_id || 'default'
  ).trim();
}

function campaignMapKey(dateStr, instance) {
  return `${dateStr}__${String(instance || 'default').trim()}`;
}

function manualCampaignMappingForEvent(e) {
  const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
  if (!d) return null;
  const dateStr = campaignMapDate(d);
  const instance = campaignMapInstance(e);
  const key = campaignMapKey(dateStr, instance);

  return (allCampaignMappings || []).find(m =>
    m.mapKey === key ||
    (m.date === dateStr && String(m.instance || 'default') === instance)
  ) || null;
}

function campaignEntryById(id) {
  return (allEntries || []).find(e => e.id === id) || null;
}

function campaignEntryLabel(en) {
  if (!en) return '';
  const name = en.template || en.source || en.kategori || 'Campaign CRM';
  const time = en.masa ? ` ${en.masa}` : '';
  const staff = en.staffName ? ` • ${displayStaffName(en.staffName)}` : '';
  return `${en.tarikh || '-'}${time} • ${name}${staff}`;
}

function populateCampaignLinker() {
  const dateEl = document.getElementById('campaign-link-date');
  const instanceEl = document.getElementById('campaign-link-instance');
  const entryEl = document.getElementById('campaign-link-entry');
  const statusEl = document.getElementById('campaign-link-status');
  if (!dateEl || !instanceEl || !entryEl) return;

  const events = (allWabotEvents || []).filter(isUsefulWabotEvent);
  const latest = [...events].sort((a,b) => {
    const ad = wabotDate(a.eventAt) || wabotDate(a.receivedAt) || new Date(0);
    const bd = wabotDate(b.eventAt) || wabotDate(b.receivedAt) || new Date(0);
    return bd - ad;
  })[0];

  if (!dateEl.value) {
    const d = latest ? (wabotDate(latest.eventAt) || wabotDate(latest.receivedAt)) : new Date();
    dateEl.value = campaignMapDate(d);
  }

  const instances = [...new Set(events.map(campaignMapInstance).filter(Boolean))];
  const oldInstance = instanceEl.value;
  instanceEl.innerHTML = instances.length
    ? instances.map(x => `<option value="${wabotEsc(x)}">${wabotEsc(x)}</option>`).join('')
    : '<option value="default">default</option>';
  if (instances.includes(oldInstance)) instanceEl.value = oldInstance;
  else if (latest) instanceEl.value = campaignMapInstance(latest);

  const selectedDate = dateEl.value;
  const candidates = (allEntries || [])
    .filter(en => !selectedDate || en.tarikh === selectedDate)
    .sort((a,b) => String(b.masa||'').localeCompare(String(a.masa||'')));

  const oldEntry = entryEl.value;
  entryEl.innerHTML = '<option value="">-- Pilih rekod CRM --</option>' +
    candidates.map(en => `<option value="${en.id}">${wabotEsc(campaignEntryLabel(en))}</option>`).join('');
  if (candidates.some(en => en.id === oldEntry)) entryEl.value = oldEntry;

  const key = campaignMapKey(dateEl.value, instanceEl.value);
  const existing = (allCampaignMappings || []).find(m => m.mapKey === key);
  if (existing) {
    entryEl.value = existing.entryId || '';
    if (statusEl) statusEl.textContent = `Linked: ${existing.campaignName || 'CRM Campaign'}`;
  } else if (statusEl) {
    if (statusEl) statusEl.textContent = 'Belum linked';
  }
}

async function saveCampaignLink() {
  const dateEl = document.getElementById('campaign-link-date');
  const instanceEl = document.getElementById('campaign-link-instance');
  const entryEl = document.getElementById('campaign-link-entry');
  if (!dateEl || !instanceEl || !entryEl) return;

  const date = dateEl.value;
  const instance = instanceEl.value || 'default';
  const entry = campaignEntryById(entryEl.value);

  if (!date || !entry) {
    toast('Pilih tarikh dan rekod CRM dahulu.', true);
    return;
  }

  const mapKey = campaignMapKey(date, instance);
  const campaignName = entry.template || entry.source || entry.kategori || 'Campaign CRM';

  try {
    await db.collection('campaignMappings').doc(mapKey).set({
      mapKey,
      date,
      instance,
      entryId: entry.id,
      campaignName,
      entryLabel: campaignEntryLabel(entry),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser ? currentUser.uid : null
    }, { merge:true });
    toast('Campaign berjaya linked.');
  } catch (err) {
    toast('Gagal simpan mapping: ' + err.message, true);
  }
}

async function deleteCampaignLink() {
  const dateEl = document.getElementById('campaign-link-date');
  const instanceEl = document.getElementById('campaign-link-instance');
  if (!dateEl || !instanceEl) return;
  const mapKey = campaignMapKey(dateEl.value, instanceEl.value);
  try {
    await db.collection('campaignMappings').doc(mapKey).delete();
    toast('Mapping dibuang.');
  } catch (err) {
    toast('Gagal buang mapping: ' + err.message, true);
  }
}

function wabotEventCampaignInfo(e) {
  const manual = manualCampaignMappingForEvent(e);
  if (manual) {
    const linkedEntry = campaignEntryById(manual.entryId);
    return {
      name: manual.campaignName || (linkedEntry && (linkedEntry.template || linkedEntry.source || linkedEntry.kategori)) || 'Campaign CRM',
      source: 'Manual Link',
      entry: linkedEntry,
      confidence: 100
    };
  }

  const explicit =
    e.campaign ||
    e.campaignName ||
    e.broadcast ||
    e.broadcastName ||
    '';

  if (explicit) {
    return { name: String(explicit), source: 'Webhook', entry: null, confidence: 100 };
  }

  const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
  if (!d) {
    return { name: 'Tanpa Campaign', source: 'Tiada metadata', entry: null, confidence: 0 };
  }

  const dateStr =
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  let candidates = (allEntries || []).filter(en => en.tarikh === dateStr);

  if (!candidates.length) {
    // fallback ±1 hari untuk event yang boleh tersasar timezone / waktu tengah malam.
    const prev = new Date(d); prev.setDate(prev.getDate() - 1);
    const next = new Date(d); next.setDate(next.getDate() + 1);

    const prevStr =
      `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
    const nextStr =
      `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;

    candidates = (allEntries || []).filter(en =>
      en.tarikh === prevStr || en.tarikh === nextStr
    );
  }

  if (!candidates.length) {
    return { name: 'Tanpa Campaign', source: 'Tiada padanan CRM', entry: null, confidence: 0 };
  }

  const eventAcc = normalizeLoose(
    e.instanceName || e.instance || e.instance_id || ''
  );

  const eventText = [
    e.campaign,
    e.campaignName,
    e.broadcast,
    e.broadcastName,
    e.script,
    e.template,
    e.templateName,
    typeof e.message === 'string' ? e.message : '',
    typeof e.text === 'string' ? e.text : ''
  ].filter(Boolean).join(' ');

  const eMin = eventMinutes(d);

  const scored = candidates.map(en => {
    let score = 0;
    const reasons = [];

    // Date match
    if (en.tarikh === dateStr) {
      score += 35;
      reasons.push('tarikh');
    } else {
      score += 10;
      reasons.push('±1 hari');
    }

    // Account similarity
    const entryAcc = normalizeLoose(en.wabotAccount || '');
    if (eventAcc && entryAcc) {
      if (entryAcc === eventAcc) {
        score += 35;
        reasons.push('akaun tepat');
      } else if (entryAcc.includes(eventAcc) || eventAcc.includes(entryAcc)) {
        score += 25;
        reasons.push('akaun hampir');
      }
    }

    // Time similarity
    const m = entryMinutes(en);
    if (m != null) {
      const diff = Math.abs(eMin - m);
      if (diff <= 30) {
        score += 30;
        reasons.push('masa ≤30m');
      } else if (diff <= 90) {
        score += 22;
        reasons.push('masa ≤90m');
      } else if (diff <= 180) {
        score += 14;
        reasons.push('masa ≤3j');
      } else if (diff <= 360) {
        score += 6;
        reasons.push('masa ≤6j');
      }
    }

    // Text/template/source similarity if anything useful exists in payload.
    const textScore = Math.max(
      textSimilarityScore(eventText, en.template || ''),
      textSimilarityScore(eventText, en.source || ''),
      textSimilarityScore(eventText, en.kategori || '')
    );
    if (textScore) {
      score += Math.min(25, textScore);
      reasons.push('teks');
    }

    return { en, score, reasons };
  }).sort((a,b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  // Conservative confidence rule:
  // - at least 45 points
  // - and either unique best or margin >= 10
  const margin = second ? best.score - second.score : best.score;

  if (best && best.score >= 45 && margin >= 10) {
    return {
      name: best.en.template || best.en.source || best.en.kategori || 'Tanpa Campaign',
      source: `Auto CRM ${best.score}%`,
      entry: best.en,
      confidence: best.score
    };
  }

  // If only one candidate on the day, allow weaker match.
  if (scored.length === 1 && best.score >= 30) {
    return {
      name: best.en.template || best.en.source || best.en.kategori || 'Tanpa Campaign',
      source: `Auto CRM ${best.score}%`,
      entry: best.en,
      confidence: best.score
    };
  }

  return {
    name: 'Tanpa Campaign',
    source: 'Padanan tidak pasti',
    entry: null,
    confidence: best ? best.score : 0
  };
}
function normalizeCampaignKey(v) {
  return String(v || '').trim().toLowerCase();
}

function campaignCRMStats(campaignName, exactEntries = []) {
  if (exactEntries && exactEntries.length) {
    const unique = [];
    const seen = new Set();

    exactEntries.forEach(e => {
      const key = e.id || `${e.tarikh || ''}_${e.masa || ''}_${e.template || ''}_${e.staffName || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(e);
      }
    });

    return unique.reduce((a, e) => {
      a.sessions += 1;
      a.buyer += Number(e.buyer || 0);
      a.sales += Number(e.sales || 0);
      return a;
    }, { sessions:0, buyer:0, sales:0 });
  }

  const key = normalizeCampaignKey(campaignName);

  const rows = (allEntries || []).filter(e => {
    const candidates = [e.template, e.source, e.kategori]
      .map(normalizeCampaignKey)
      .filter(Boolean);

    return key && key !== 'tanpa campaign' && candidates.includes(key);
  });

  return rows.reduce((a, e) => {
    a.sessions += 1;
    a.buyer += Number(e.buyer || 0);
    a.sales += Number(e.sales || 0);
    return a;
  }, { sessions:0, buyer:0, sales:0 });
}

function renderCampaignManager(){
  setTimeout(populateCampaignLinker, 0);
  const rangeEl = document.getElementById('campaign-range');
  const start = campaignRangeStart(rangeEl ? rangeEl.value : 'today');

  const events = allWabotEvents.filter(e => {
    if (!isUsefulWabotEvent(e)) return false;
    const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
    return d && d >= start;
  });

  const groups = {};

  events.forEach(e => {
    const info = wabotEventCampaignInfo(e);
    const campaign = info.name || 'Tanpa Campaign';

    if (!groups[campaign]) {
      groups[campaign] = {
        events: [],
        sources: new Set(),
        entries: []
      };
    }

    groups[campaign].events.push(e);
    groups[campaign].sources.add(info.source || 'Tidak Diketahui');
    if (info.entry) groups[campaign].entries.push(info.entry);
  });

  const rows = Object.entries(groups).map(([campaign, group]) => {
    const campaignEvents = group.events;
    const c = wabotCountsFor(campaignEvents);
    const audience = wabotAudienceStats(campaignEvents);
    const crm = campaignCRMStats(campaign, group.entries);

    const hours = {};
    campaignEvents
      .filter(e => wabotEventKind(e) === 'incoming')
      .forEach(e => {
        const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
        if (!d) return;
        const h = String(d.getHours()).padStart(2,'0') + ':00';
        hours[h] = (hours[h] || 0) + 1;
      });

    const bestHour =
      Object.entries(hours).sort((a,b) => b[1] - a[1])[0]?.[0] || '-';

    const deliveryRate = c.sent ? c.delivered / c.sent * 100 : 0;
    const readRate = c.sent ? c.read / c.sent * 100 : 0;
    const conversionRate = audience.uniqueContacted
      ? crm.buyer / audience.uniqueContacted * 100
      : 0;

    const cost = costRM(c.sent);
    const roas = cost ? crm.sales / cost : 0;

    return {
      campaign,
      mapping: [...group.sources].join(' + '),
      sent: c.sent,
      delivered: c.delivered,
      read: c.read,
      uniqueContacted: audience.uniqueContacted,
      validReply: audience.validReplyCustomers,
      replyMessages: audience.replyMessages,
      replyRate: audience.replyRate,
      failed: c.failed,
      buyer: crm.buyer,
      sales: crm.sales,
      conversionRate,
      roas,
      bestHour
    };
  }).sort((a,b) =>
    b.sales - a.sales ||
    b.buyer - a.buyer ||
    b.replyRate - a.replyRate ||
    b.validReply - a.validReply
  );

  const count = document.getElementById('campaign-count');
  if (count) count.textContent = `${rows.length} campaign`;

  const body = document.getElementById('campaign-body');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="15" class="empty-state">Belum ada campaign metadata / padanan CRM.</td></tr>';
    return;
  }

  body.innerHTML = rows.map(r => {
    const deliveryRate = r.sent ? r.delivered/r.sent*100 : 0;
    const readRate = r.sent ? r.read/r.sent*100 : 0;

    return `<tr>
      <td class="tname">${wabotEsc(r.campaign)}</td>
      <td style="font-size:11px;">${wabotEsc(r.mapping)}</td>
      <td class="num">${fmt(r.sent)}</td>
      <td class="num">${deliveryRate.toFixed(1)}%</td>
      <td class="num">${readRate.toFixed(1)}%</td>
      <td class="num">${fmt(r.uniqueContacted)}</td>
      <td class="num">${fmt(r.validReply)}</td>
      <td class="num">${r.replyRate.toFixed(1)}%</td>
      <td class="num">${fmt(r.replyMessages)}</td>
      <td class="num">${fmt(r.buyer)}</td>
      <td class="num">${r.sales ? 'RM '+fmt(r.sales) : '-'}</td>
      <td class="num">${r.conversionRate.toFixed(2)}%</td>
      <td class="num">${r.roas ? r.roas.toFixed(2)+'x' : '-'}</td>
      <td class="num">${fmt(r.failed)}</td>
      <td>${r.bestHour}</td>
    </tr>`;
  }).join('');
}
const campaignLinkDate = document.getElementById('campaign-link-date');
const campaignLinkInstance = document.getElementById('campaign-link-instance');
const campaignLinkEntry = document.getElementById('campaign-link-entry');
const campaignLinkSave = document.getElementById('campaign-link-save');
const campaignLinkDelete = document.getElementById('campaign-link-delete');
if (campaignLinkDate) campaignLinkDate.addEventListener('change', populateCampaignLinker);
if (campaignLinkInstance) campaignLinkInstance.addEventListener('change', populateCampaignLinker);
if (campaignLinkEntry) campaignLinkEntry.addEventListener('change', () => {
  const s = document.getElementById('campaign-link-status');
  if (s && campaignLinkEntry.value) s.textContent = 'Sedia untuk link';
});
if (campaignLinkSave) campaignLinkSave.addEventListener('click', saveCampaignLink);
if (campaignLinkDelete) campaignLinkDelete.addEventListener('click', deleteCampaignLink);

const campaignRange = document.getElementById('campaign-range');
if (campaignRange) campaignRange.addEventListener('change', renderCampaignManager);

function renderAIInsight(){
  const rangeEl = document.getElementById('insight-range');
  const start = aproRangeStart(rangeEl ? rangeEl.value : 'today');

  const events = allWabotEvents.filter(e => {
    if (!isUsefulWabotEvent(e)) return false;
    const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
    return d && d >= start;
  });

  const audience = wabotAudienceStats(events);
  const rr = audience.replyRate;

  const hours = {};
  events.filter(e => wabotEventKind(e) === 'incoming').forEach(e => {
    const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);
    if (!d) return;
    const h = String(d.getHours()).padStart(2,'0') + ':00';
    hours[h] = (hours[h] || 0) + 1;
  });
  const bestHour = Object.entries(hours).sort((a,b)=>b[1]-a[1])[0] || null;

  const campaignGroups = {};
  const scriptGroups = {};

  events.forEach(e => {
    const campaignInfo = wabotEventCampaignInfo(e);
    const campaign = campaignInfo.name && campaignInfo.name !== 'Tanpa Campaign'
      ? campaignInfo.name
      : null;
    const script =
      e.script ||
      e.template ||
      e.templateName ||
      (campaignInfo.entry ? campaignInfo.entry.template : null);

    if (campaign) {
      if (!campaignGroups[campaign]) campaignGroups[campaign] = [];
      campaignGroups[campaign].push(e);
    }
    if (script) {
      if (!scriptGroups[script]) scriptGroups[script] = [];
      scriptGroups[script].push(e);
    }
  });

  const bestCampaign = Object.entries(campaignGroups)
    .map(([label, rows]) => ({label, stats:wabotAudienceStats(rows)}))
    .sort((a,b) => b.stats.replyRate - a.stats.replyRate || b.stats.validReplyCustomers - a.stats.validReplyCustomers)[0] || null;

  const bestScript = Object.entries(scriptGroups)
    .map(([label, rows]) => ({label, stats:wabotAudienceStats(rows)}))
    .sort((a,b) => b.stats.replyRate - a.stats.replyRate || b.stats.validReplyCustomers - a.stats.validReplyCustomers)[0] || null;

  aproSet('insight-reply-rate', rr.toFixed(1) + '%');
  aproSet('insight-best-hour', bestHour ? bestHour[0] : '–');
  aproSet('insight-best-campaign', bestCampaign ? bestCampaign.label : '–');
  aproSet('insight-best-script', bestScript ? bestScript.label : '–');

  const insights = [];

  if (audience.uniqueContacted) {
    insights.push(
      `${fmt(audience.validReplyCustomers)} daripada ${fmt(audience.uniqueContacted)} customer yang dihubungi telah reply (${rr.toFixed(1)}%).`
    );
  } else {
    insights.push('Belum cukup outgoing customer untuk kira CRM Reply Rate.');
  }

  if (bestHour) {
    insights.push(`Waktu reply tertinggi setakat tempoh dipilih ialah ${bestHour[0]} dengan ${fmt(bestHour[1])} mesej reply.`);
  } else {
    insights.push('Belum cukup data untuk tentukan waktu reply terbaik.');
  }

  if (bestCampaign) {
    insights.push(`Campaign terbaik berdasarkan Valid Reply Rate: ${bestCampaign.label} (${bestCampaign.stats.replyRate.toFixed(1)}%).`);
  } else {
    insights.push('Nama campaign belum tersedia dalam payload Wabot, jadi perbandingan campaign belum boleh dibuat.');
  }

  if (bestScript) {
    insights.push(`Script/template terbaik: ${bestScript.label} (${bestScript.stats.replyRate.toFixed(1)}% Valid Reply Rate).`);
  } else {
    insights.push('Metadata script/template belum tersedia dalam payload Wabot.');
  }

  const list = document.getElementById('insight-list') || document.getElementById('ai-insight-list');
  if (list) {
    list.innerHTML = insights
      .map(t => `<div class="insight-item">${wabotEsc(t)}</div>`)
      .join('');
  }
}

const insightRange = document.getElementById('insight-range');
if (insightRange) insightRange.addEventListener('change', renderAIInsight);

// ==================== PROJECTION SIMULATOR V8.4 ====================
(function(){
  const ids=['proj-aov','proj-buyers','proj-cost','proj-sent','proj-reply','proj-conv'];
  const $=id=>document.getElementById(id);
  const n=id=>Math.max(0,Number($(id)?.value||0));
  const money=v=>'RM '+Number(v||0).toLocaleString('en-MY',{minimumFractionDigits:v<100?2:0,maximumFractionDigits:2});
  const num=v=>Math.round(v||0).toLocaleString('en-MY');
  const pct=v=>Number(v||0).toLocaleString('en-MY',{maximumFractionDigits:1})+'%';

  function drawProjectionChart(sales){
    const c=$('projection-chart'); if(!c) return;
    const dpr=window.devicePixelRatio||1;
    const rect=c.getBoundingClientRect();
    const w=Math.max(600,rect.width||1100), h=Math.max(240,rect.height||300);
    c.width=w*dpr;c.height=h*dpr;
    const ctx=c.getContext('2d');ctx.scale(dpr,dpr);
    const css=getComputedStyle(document.documentElement);
    const text=css.getPropertyValue('--muted').trim()||'#667';
    const line=css.getPropertyValue('--line').trim()||'#ddd';
    const mint=css.getPropertyValue('--mint').trim()||'#00b98b';
    const left=58,right=18,top=22,bottom=38, pw=w-left-right, ph=h-top-bottom;
    ctx.clearRect(0,0,w,h);
    ctx.font='10px IBM Plex Mono, monospace';ctx.fillStyle=text;
    ctx.strokeStyle=line;ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=top+ph*(i/4), val=sales*(1-i/4);
      ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
      ctx.fillText('RM'+Math.round(val/1000)+'K',5,y+3);
    }
    [1,5,10,15,20,25,30].forEach(day=>{
      const x=left+pw*((day-1)/29);
      ctx.fillText('D'+day,x-7,h-13);
    });
    ctx.strokeStyle=mint;ctx.lineWidth=3;ctx.beginPath();
    for(let day=1;day<=30;day++){
      const x=left+pw*((day-1)/29), y=top+ph-(ph*(sales*(day/30)/(sales||1)));
      day===1?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.fillStyle=mint;
    for(let day=1;day<=30;day+=4){
      const x=left+pw*((day-1)/29), y=top+ph-(ph*(day/30));
      ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
    }
  }

  function updateProjection(){
    if(!$('proj-aov')) return;
    const aov=n('proj-aov'), buyers=n('proj-buyers'), cost=n('proj-cost'), sent=n('proj-sent');
    const reply=n('proj-reply'), conv=n('proj-conv');
    const sales=aov*buyers, roas=cost?sales/cost:0, roi=cost?((sales-cost)/cost)*100:0, cpa=buyers?cost/buyers:0;
    const replies=sent*(reply/100), funnelBuyers=replies*(conv/100);

    $('proj-sales').textContent=money(sales);
    $('proj-sales-note').textContent=`${num(buyers)} buyer × ${money(aov)} AOV`;
    $('proj-roas').textContent=roas.toFixed(2)+'x';
    $('proj-roi').textContent=pct(roi);
    $('proj-cpa').textContent=money(cpa);
    $('proj-replies').textContent=num(replies);
    $('proj-reply-note').textContent=`${reply.toFixed(1)}% daripada ${num(sent)} sent/leads`;
    $('proj-funnel-buyers').textContent=num(funnelBuyers);
    $('proj-funnel-note').textContent=`${conv.toFixed(1)}% daripada replies`;

    const scenarios=[
      ['Conservative',.70,''],
      ['Target',1,'target'],
      ['Aggressive',1.30,'']
    ];
    $('projection-scenario-grid').innerHTML=scenarios.map(([name,m,cls])=>{
      const b=buyers*m, s=b*aov, r=cost?s/cost:0, cp=b?cost/b:0;
      return `<article class="projection-scenario ${cls}">
        <div class="scenario-name">${name}</div>
        <div class="scenario-sales">${money(s)}</div>
        <dl><dt>Buyer</dt><dd>${num(b)}</dd><dt>AOV</dt><dd>${money(aov)}</dd><dt>ROAS</dt><dd>${r.toFixed(2)}x</dd><dt>Cost / Buyer</dt><dd>${money(cp)}</dd></dl>
      </article>`;
    }).join('');
    drawProjectionChart(sales);
  }

  ids.forEach(id=>$(id)?.addEventListener('input',updateProjection));
  $('projection-reset')?.addEventListener('click',()=>{
    const vals={'proj-aov':80,'proj-buyers':1000,'proj-cost':4210.53,'proj-sent':100000,'proj-reply':10,'proj-conv':1};
    Object.entries(vals).forEach(([id,v])=>{if($(id))$(id).value=v;});
    updateProjection();
  });
  document.querySelector('.app-nav button[data-view="projection"]')?.addEventListener('click',()=>setTimeout(updateProjection,50));

document.querySelector('.app-nav button[data-view="wabotcontrol"]')?.addEventListener('click',async()=>{
  await refreshWalletDataNow();
});

  window.addEventListener('resize',()=>{if(document.getElementById('view-projection')?.classList.contains('active')) updateProjection();});
  setTimeout(updateProjection,500);
})();


// V9.2: Wallet sentiasa sync walaupun user belum klik tab Wabot Control.
// Ini memastikan refresh browser / tukar tab tak tinggalkan card & history pada state lama.
setInterval(()=>{
  if(currentUser){
    refreshWalletDataNow();
  }
},10000);

// Sync semula bila browser/window kembali aktif.
window.addEventListener('focus',()=>{
  if(currentUser) refreshWalletDataNow();
});

window.addEventListener('pageshow',()=>{
  if(currentUser) refreshWalletDataNow();
});

document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && currentUser){
    refreshWalletDataNow();
  }
});


// V9 maintenance helper.
// Jalankan dari browser console hanya jika perlu reset SEMUA transfer adjustment:
// resetWabotWalletLedger()
window.resetWabotWalletLedger = async function(){
  const defaults=walletLedgerDefault();

  await db.collection('meta').doc('wabotWalletLedger').set({
    accounts:defaults,
    resetAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });

  await refreshWalletDataNow();
  toast('Wallet Ledger telah direset ke 0 transfer adjustment.');
};


// V9.2 manual sync helper, useful for troubleshooting.
window.syncWabotWalletNow = async function(){
  const ok = await refreshWalletDataNow();
  if(ok) toast('Wallet, transfer & history sudah sync ✓');
  else toast('Sync wallet gagal. Semak connection / Firestore.', true);
};


// V9.3 diagnostic helper: console -> checkWabotSync()
window.checkWabotSync=async function(){
  const out={};
  try{
    const q=await db.collection('topups').get();
    out.topups=q.size;
    out.transfers=q.docs.filter(d=>String((d.data()||{}).transactionType||(d.data()||{}).type||'').toLowerCase()==='transfer').length;
  }catch(e){out.topupsError=e.message;}
  try{
    const l=await db.collection('meta').doc('wabotWalletLedger').get();
    out.ledgerExists=l.exists;
    out.ledger=l.exists?l.data():null;
  }catch(e){out.ledgerError=e.message;}
  console.log('WABOT SYNC CHECK',out);
  return out;
};


// ============================================================
// PLANNING TAB
// ============================================================
let allPlans = [];
let currentPlanFilter = 'all';
let unsubPlans = null;

function planningEsc(v){
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function planningStatusLabel(s){
  if(s==='progress') return 'In Progress';
  if(s==='done') return 'Done';
  return 'To Do';
}

function planningPriorityClass(p){
  const x=String(p||'Normal').toLowerCase();
  if(x==='urgent') return 'urgent';
  if(x==='high') return 'high';
  return 'normal';
}

function startPlanningListener(){
  if(unsubPlans){
    try{unsubPlans();}catch(_){}
  }

  unsubPlans=db.collection('planning').onSnapshot(snap=>{
    allPlans=snap.docs.map(d=>({id:d.id,...d.data()}));

    allPlans.sort((a,b)=>{
      const ad=String(a.dueDate||a.reviewDate||'');
      const bd=String(b.dueDate||b.reviewDate||'');
      if(ad!==bd) return ad.localeCompare(bd);
      const at=a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : Number(a.createdAtMs||0);
      const bt=b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : Number(b.createdAtMs||0);
      return bt-at;
    });

    renderPlanning();
  },err=>{
    console.error('Planning listener:',err);
    toast('Ralat baca Planning: '+err.message,true);
  });
}

function planningFilteredRows(){
  const project=document.getElementById('planning-project-filter')?.value || '';
  const q=String(document.getElementById('planning-search')?.value || '').trim().toLowerCase();

  return (allPlans||[]).filter(p=>{
    if(currentPlanFilter!=='all' && String(p.status||'todo')!==currentPlanFilter) return false;
    if(project && String(p.project||'')!==project) return false;

    if(q){
      const hay=[
        p.title,p.note,p.project,p.category,p.posterName,p.priority,p.createdBy
      ].join(' ').toLowerCase();

      if(!hay.includes(q)) return false;
    }

    return true;
  });
}

function renderPlanning(){
  const total=(allPlans||[]).length;
  const todo=(allPlans||[]).filter(x=>(x.status||'todo')==='todo').length;
  const progress=(allPlans||[]).filter(x=>x.status==='progress').length;
  const done=(allPlans||[]).filter(x=>x.status==='done').length;

  const set=(id,v)=>{
    const el=document.getElementById(id);
    if(el) el.textContent=v;
  };

  set('plan-total',total);
  set('plan-todo',todo);
  set('plan-progress',progress);
  set('plan-done',done);

  const list=document.getElementById('planning-list');
  if(!list) return;

  const rows=planningFilteredRows();

  if(!rows.length){
    list.innerHTML='<div class="empty-state">Tiada planning untuk filter ini.</div>';
    return;
  }

  list.innerHTML=rows.map(p=>{
    const posterLink=p.posterUrl
      ? `<a href="${planningEsc(p.posterUrl)}" target="_blank" rel="noopener" class="planning-poster-link">Lihat Poster ↗</a>`
      : '';

    const posterPreview=p.posterUrl
      ? `<a href="${planningEsc(p.posterUrl)}" target="_blank" rel="noopener" class="planning-card-poster-preview">
           <img src="${planningEsc(p.posterUrl)}" alt="${planningEsc(p.posterName||'Poster')}">
         </a>`
      : '';

    const due=p.dueDate
      ? `<span class="planning-meta-chip">Due ${planningEsc(p.dueDate)}</span>`
      : '';

    return `
      <article class="planning-item status-${planningEsc(p.status||'todo')}">
        <div class="planning-item-top">
          <div>
            <div class="planning-item-title">${planningEsc(p.title||'Untitled')}</div>
            <div class="planning-item-sub">
              <span>${planningEsc(p.project||'-')}</span>
              <span>•</span>
              <span>${planningEsc(p.category||'Action')}</span>
            </div>
          </div>

          <div class="planning-item-badges">
            <span class="planning-priority ${planningPriorityClass(p.priority)}">${planningEsc(p.priority||'Normal')}</span>
            <span class="planning-status-badge ${planningEsc(p.status||'todo')}">${planningStatusLabel(p.status||'todo')}</span>
          </div>
        </div>

        ${p.note ? `<div class="planning-note">${planningEsc(p.note)}</div>` : ''}

        ${p.posterName || p.posterUrl ? `
          <div class="planning-poster-box">
            ${posterPreview}
            <div class="planning-poster-info">
              <span>POSTER / CREATIVE</span>
              <b>${planningEsc(p.posterName||'Creative')}</b>
              ${posterLink}
            </div>
          </div>
        ` : ''}

        <div class="planning-item-bottom">
          <div class="planning-meta-row">
            <span class="planning-meta-chip">Review ${planningEsc(p.reviewDate||'-')}</span>
            ${due}
            <span class="planning-meta-chip">${planningEsc(displayStaffName(p.createdBy||'-'))}</span>
          </div>

          <div class="planning-actions">
            <select class="planning-status-select" data-id="${p.id}">
              <option value="todo" ${p.status==='todo'?'selected':''}>To Do</option>
              <option value="progress" ${p.status==='progress'?'selected':''}>In Progress</option>
              <option value="done" ${p.status==='done'?'selected':''}>Done</option>
            </select>
            <button type="button" class="planning-edit-btn" data-id="${p.id}">Edit</button>
            <button type="button" class="planning-delete-btn" data-id="${p.id}">Buang</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('.planning-status-select').forEach(sel=>{
    sel.addEventListener('change',async()=>{
      try{
        await db.collection('planning').doc(sel.dataset.id).update({
          status:sel.value,
          updatedBy:currentProfile.name,
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      }catch(err){
        toast('Gagal update status: '+err.message,true);
      }
    });
  });

  list.querySelectorAll('.planning-delete-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const row=allPlans.find(x=>x.id===btn.dataset.id);
      if(!row) return;
      if(!confirm(`Buang planning "${row.title}"?`)) return;

      try{
        await db.collection('planning').doc(row.id).delete();
        toast('Planning dibuang ✓');
      }catch(err){
        toast('Gagal buang planning: '+err.message,true);
      }
    });
  });

  list.querySelectorAll('.planning-edit-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const row=allPlans.find(x=>x.id===btn.dataset.id);
      if(!row) return;

      const title=prompt('Planning / Action:',row.title||'');
      if(title===null) return;

      const note=prompt('Nota:',row.note||'');
      if(note===null) return;

      const posterName=prompt('Nama Poster / Creative:',row.posterName||'');
      if(posterName===null) return;

      db.collection('planning').doc(row.id).update({
        title:title.trim(),
        note:note.trim(),
        posterName:posterName.trim(),
        updatedBy:currentProfile.name,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }).then(()=>{
        toast('Planning dikemaskini ✓');
      }).catch(err=>{
        toast('Gagal edit planning: '+err.message,true);
      });
    });
  });
}


let planningPosterFile = null;

function planningResetPosterUpload(){
  planningPosterFile = null;

  const fileInput=document.getElementById('plan-poster-file');
  const previewWrap=document.getElementById('plan-poster-preview-wrap');
  const preview=document.getElementById('plan-poster-preview');

  if(fileInput) fileInput.value='';
  if(preview) preview.src='';
  if(previewWrap) previewWrap.style.display='none';
}

async function uploadPlanningPoster(file){
  if(!file) return '';

  const allowed=['image/png','image/jpeg','image/webp'];

  if(!allowed.includes(file.type)){
    throw new Error('Poster mesti PNG, JPG atau WEBP.');
  }

  // Firestore document limit is ~1 MiB, so compress aggressively.
  // Target output is kept well below that limit to leave room for other fields.
  const dataUrl = await new Promise((resolve,reject)=>{
    const reader=new FileReader();

    reader.onerror=()=>reject(new Error('Gagal membaca fail poster.'));

    reader.onload=()=>{
      const img=new Image();

      img.onerror=()=>reject(new Error('Gagal membaca imej poster.'));

      img.onload=()=>{
        try{
          const maxW=900;
          const maxH=1200;

          let w=img.naturalWidth || img.width;
          let h=img.naturalHeight || img.height;

          const scale=Math.min(1,maxW/w,maxH/h);
          w=Math.max(1,Math.round(w*scale));
          h=Math.max(1,Math.round(h*scale));

          const canvas=document.createElement('canvas');
          canvas.width=w;
          canvas.height=h;

          const ctx=canvas.getContext('2d',{alpha:false});
          ctx.fillStyle='#ffffff';
          ctx.fillRect(0,0,w,h);
          ctx.drawImage(img,0,0,w,h);

          let quality=.72;
          let out=canvas.toDataURL('image/jpeg',quality);

          // Keep encoded string around <= 650 KB.
          while(out.length > 650000 && quality > .32){
            quality-=.08;
            out=canvas.toDataURL('image/jpeg',quality);
          }

          // If still too large, resize once more.
          if(out.length > 650000){
            const canvas2=document.createElement('canvas');
            const ratio=.72;
            canvas2.width=Math.max(1,Math.round(w*ratio));
            canvas2.height=Math.max(1,Math.round(h*ratio));

            const ctx2=canvas2.getContext('2d',{alpha:false});
            ctx2.fillStyle='#ffffff';
            ctx2.fillRect(0,0,canvas2.width,canvas2.height);
            ctx2.drawImage(canvas,0,0,canvas2.width,canvas2.height);

            out=canvas2.toDataURL('image/jpeg',.55);
          }

          if(out.length > 800000){
            reject(new Error('Poster masih terlalu besar selepas compress. Cuba guna gambar yang lebih kecil.'));
            return;
          }

          resolve(out);
        }catch(err){
          reject(err);
        }
      };

      img.src=reader.result;
    };

    reader.readAsDataURL(file);
  });

  return dataUrl;
}

document.getElementById('plan-poster-file')?.addEventListener('change',(e)=>{
  const file=e.target.files?.[0] || null;

  if(!file){
    planningResetPosterUpload();
    return;
  }

  if(file.size > 15 * 1024 * 1024){
    planningResetPosterUpload();
    toast('Fail asal terlalu besar. Sila pilih poster bawah 15MB.',true);
    return;
  }

  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){
    planningResetPosterUpload();
    toast('Format poster mesti PNG, JPG atau WEBP.',true);
    return;
  }

  planningPosterFile=file;

  const preview=document.getElementById('plan-poster-preview');
  const previewWrap=document.getElementById('plan-poster-preview-wrap');

  if(preview){
    preview.src=URL.createObjectURL(file);
  }

  if(previewWrap){
    previewWrap.style.display='flex';
  }
});

document.getElementById('plan-poster-remove')?.addEventListener('click',()=>{
  planningResetPosterUpload();
});

const planningForm=document.getElementById('planning-form');
if(planningForm){
  planningForm.addEventListener('submit',async(e)=>{
    e.preventDefault();

    const payload={
      reviewDate:document.getElementById('plan-review-date').value,
      project:document.getElementById('plan-project').value,
      category:document.getElementById('plan-category').value,
      priority:document.getElementById('plan-priority').value,
      title:document.getElementById('plan-title').value.trim(),
      dueDate:document.getElementById('plan-due-date').value,
      status:document.getElementById('plan-status').value,
      note:document.getElementById('plan-note').value.trim(),
      posterName:document.getElementById('plan-poster-name').value.trim(),
      posterUrl:'',
      createdBy:currentProfile.name,
      createdAtMs:Date.now(),
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    if(!payload.reviewDate || !payload.project || !payload.title){
      return toast('Isi Tarikh Review, Projek dan Planning.',true);
    }

    const btn=planningForm.querySelector('button[type=submit]');
    btn.disabled=true;
    btn.textContent='Menyimpan...';

    try{
      if(planningPosterFile){
        btn.textContent='Compress Poster...';
        payload.posterUrl=await uploadPlanningPoster(planningPosterFile);
      }

      btn.textContent='Menyimpan Planning...';

      await db.collection('planning').add(payload);

      planningForm.reset();
      planningResetPosterUpload();

      const d=document.getElementById('plan-review-date');
      if(d) d.value=todayStr();

      toast('Planning ditambah ✓');
    }catch(err){
      toast('Gagal tambah planning: '+err.message,true);
    }finally{
      btn.disabled=false;
      btn.textContent='Tambah Planning';
    }
  });
}

document.getElementById('planning-clear')?.addEventListener('click',()=>{
  document.getElementById('planning-form')?.reset();
  planningResetPosterUpload();
  const d=document.getElementById('plan-review-date');
  if(d) d.value=todayStr();
});

document.querySelectorAll('.planning-filter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    currentPlanFilter=btn.dataset.planFilter || 'all';

    document.querySelectorAll('.planning-filter-btn').forEach(b=>{
      b.classList.toggle('active',b===btn);
    });

    renderPlanning();
  });
});

document.getElementById('planning-project-filter')?.addEventListener('change',renderPlanning);
document.getElementById('planning-search')?.addEventListener('input',renderPlanning);

document.querySelector('.app-nav button[data-view="planning"]')?.addEventListener('click',()=>{
  const d=document.getElementById('plan-review-date');
  if(d && !d.value) d.value=todayStr();

  if(!unsubPlans){
    startPlanningListener();
  }else{
    renderPlanning();
  }
});

// ============================================================
// SALES PAGES — salin link penuh untuk dikongsi
// ============================================================
document.querySelectorAll('.salespage-copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const fullUrl = window.location.origin + '/' + btn.dataset.path;
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast('Link disalin ✓ — ' + fullUrl);
    } catch (err) {
      toast('Gagal salin — browser tak sokong clipboard', true);
    }
  });
});


// ============================================================
// TEMPLATE LIBRARY + TEMPLATE PERFORMANCE
// ============================================================
let templateLibraryImageFile = null;

function escHtml(v){
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function templatePerfRows(){
  const from=document.getElementById('tmpl-report-from')?.value || '';
  const to=document.getElementById('tmpl-report-to')?.value || '';
  const project=document.getElementById('tmpl-report-project')?.value || '';

  return (allEntries||[]).filter(r=>{
    if(!r.template) return false;
    if(from && r.tarikh<from) return false;
    if(to && r.tarikh>to) return false;
    if(project && r.kategori!==project) return false;
    return true;
  });
}

function getTemplatePerformanceMap(){
  const map={};

  templatePerfRows().forEach(r=>{
    const k=String(r.template||'').trim();
    if(!k) return;

    map[k]=map[k] || {
      sessions:0,sent:0,read:0,reply:0,buyer:0,sales:0
    };

    const t=map[k];
    t.sessions++;
    t.sent+=Number(r.sent||0);
    t.read+=Number(r.read||0);
    t.reply+=Number(r.reply||0);
    t.buyer+=Number(r.buyer||0);
    t.sales+=Number(r.sales||0);
  });

  return map;
}

function renderTemplateLibraryReport(){
  const body=document.getElementById('template-report-body');
  if(!body) return;

  const map=getTemplatePerformanceMap();

  const rows=Object.entries(map)
    .map(([name,x])=>{
      const replyRate=x.sent ? x.reply/x.sent*100 : 0;
      const conv=x.sent ? x.buyer/x.sent*100 : 0;
      const cost=costRM(x.sent);
      const roas=cost ? x.sales/cost : 0;
      return {name,...x,replyRate,conv,cost,roas};
    })
    .sort((a,b)=>b.sales-a.sales || b.buyer-a.buyer || b.replyRate-a.replyRate);

  body.innerHTML=rows.map((x,i)=>`
    <tr>
      <td class="rank">${i+1}</td>
      <td class="tname">${escHtml(x.name)}</td>
      <td class="num">${x.sessions}</td>
      <td class="num">${fmt(x.sent)}</td>
      <td class="num">${x.replyRate.toFixed(1)}%</td>
      <td class="num">${fmt(x.buyer)}</td>
      <td class="num">${x.conv.toFixed(2)}%</td>
      <td class="num">${x.sales ? 'RM '+fmt(x.sales) : '–'}</td>
      <td class="num">RM ${fmt(x.cost.toFixed(2))}</td>
      <td class="num">${x.cost ? x.roas.toFixed(2)+'x' : '–'}</td>
    </tr>
  `).join('');

  if(!rows.length){
    body.innerHTML='<tr><td colspan="10" class="empty-state">Belum ada data template untuk filter ini.</td></tr>';
  }

  const salesCount=rows.filter(x=>x.sales>0).length;
  const topSales=rows[0];
  const topReply=[...rows].sort((a,b)=>b.replyRate-a.replyRate)[0];

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('tmpl-lib-sales-count',salesCount);
  set('tmpl-lib-top-sales',topSales ? 'RM '+fmt(topSales.sales) : '–');
  set('tmpl-lib-top-sales-name',topSales ? topSales.name : 'Belum ada data');
  set('tmpl-lib-top-reply',topReply ? topReply.replyRate.toFixed(1)+'%' : '–');
  set('tmpl-lib-top-reply-name',topReply ? topReply.name : 'Belum ada data');
}

function populateTemplateDatalist(){
  const list=document.getElementById('entry-template-list');
  if(!list) return;

  const names=new Set();

  (allTemplateLibrary||[]).forEach(t=>{
    if(t.name) names.add(t.name);
  });

  (allEntries||[]).forEach(e=>{
    if(e.template) names.add(e.template);
  });

  list.innerHTML=[...names].sort().map(n=>`<option value="${escHtml(n)}"></option>`).join('');

  const count=document.getElementById('template-library-count');
  if(count) count.textContent=fmt(allTemplateLibrary.length)+' template';

  const total=document.getElementById('tmpl-lib-total');
  if(total) total.textContent=fmt(allTemplateLibrary.length);
}

function renderTemplateLibrary(){
  const grid=document.getElementById('template-library-grid');
  if(!grid) return;

  const project=document.getElementById('tmpl-library-project-filter')?.value || '';
  const q=String(document.getElementById('tmpl-library-search')?.value || '').trim().toLowerCase();
  const perf=getTemplatePerformanceMap();

  const rows=(allTemplateLibrary||[]).filter(t=>{
    if(project && t.project!==project) return false;
    if(q){
      const hay=[t.name,t.script,t.note,t.project].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  grid.innerHTML=rows.map(t=>{
    const p=perf[t.name] || {sent:0,reply:0,buyer:0,sales:0};
    const replyRate=p.sent ? p.reply/p.sent*100 : 0;
    const conv=p.sent ? p.buyer/p.sent*100 : 0;

    return `
      <article class="template-library-card">
        <div class="template-library-card-head">
          <div>
            <div class="template-library-name">${escHtml(t.name||'Tanpa Nama')}</div>
            <div class="template-library-project">${escHtml(t.project||'-')}</div>
          </div>
          <div class="template-sales-badge">${p.sales ? 'RM '+fmt(p.sales) : 'Belum Sales'}</div>
        </div>

        ${t.imageData ? `
          <button type="button" class="template-script-image" onclick="openImageModal('${t.imageData}')">
            <img src="${t.imageData}" alt="Screenshot skrip">
          </button>
        ` : ''}

        ${t.script ? `
          <div class="template-script-text">${escHtml(t.script)}</div>
        ` : '<div class="template-script-empty">Tiada teks skrip — rujuk screenshot.</div>'}

        ${t.note ? `<div class="template-angle"><span>ANGLE / NOTA</span>${escHtml(t.note)}</div>` : ''}

        <div class="template-mini-kpi">
          <div><span>Sent</span><b>${fmt(p.sent)}</b></div>
          <div><span>Reply</span><b>${replyRate.toFixed(1)}%</b></div>
          <div><span>Buyer</span><b>${fmt(p.buyer)}</b></div>
          <div><span>Conv.</span><b>${conv.toFixed(2)}%</b></div>
        </div>

        <div class="template-card-actions">
          <button type="button" class="btn btn-ghost template-copy-btn" data-id="${t.id}">Copy Skrip</button>
          <button type="button" class="template-delete-btn" data-id="${t.id}">Buang</button>
        </div>
      </article>
    `;
  }).join('');

  if(!rows.length){
    grid.innerHTML='<div class="empty-state">Belum ada template dalam library.</div>';
  }

  grid.querySelectorAll('.template-copy-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const t=allTemplateLibrary.find(x=>x.id===btn.dataset.id);
      if(!t?.script) return toast('Template ini tiada teks skrip.',true);

      try{
        await navigator.clipboard.writeText(t.script);
        toast('Skrip dicopy ✓');
      }catch(_){
        toast('Tak dapat copy automatik. Pilih teks secara manual.',true);
      }
    });
  });

  grid.querySelectorAll('.template-delete-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const t=allTemplateLibrary.find(x=>x.id===btn.dataset.id);
      if(!t || !confirm(`Buang template "${t.name}"?`)) return;

      try{
        await db.collection('templateLibrary').doc(t.id).delete();
        toast('Template dibuang ✓');
      }catch(err){
        toast('Gagal buang template: '+err.message,true);
      }
    });
  });

  populateTemplateDatalist();
  renderTemplateLibraryReport();
}

document.getElementById('tmpl-lib-file')?.addEventListener('change',(e)=>{
  const file=e.target.files?.[0] || null;
  templateLibraryImageFile=file;

  const wrap=document.getElementById('tmpl-lib-preview-wrap');
  const img=document.getElementById('tmpl-lib-preview');

  if(!file){
    if(wrap) wrap.style.display='none';
    return;
  }

  if(img) img.src=URL.createObjectURL(file);
  if(wrap) wrap.style.display='flex';
});

document.getElementById('tmpl-lib-remove-image')?.addEventListener('click',()=>{
  templateLibraryImageFile=null;
  const input=document.getElementById('tmpl-lib-file');
  const wrap=document.getElementById('tmpl-lib-preview-wrap');
  if(input) input.value='';
  if(wrap) wrap.style.display='none';
});

document.getElementById('template-library-form')?.addEventListener('submit',async(e)=>{
  e.preventDefault();

  const name=document.getElementById('tmpl-lib-name').value.trim();
  const project=document.getElementById('tmpl-lib-project').value;
  const script=document.getElementById('tmpl-lib-script').value.trim();
  const note=document.getElementById('tmpl-lib-note').value.trim();

  if(!name) return toast('Masukkan nama template.',true);
  if(!script && !templateLibraryImageFile){
    return toast('Masukkan skrip atau upload screenshot skrip.',true);
  }

  const btn=document.getElementById('tmpl-lib-submit');
  btn.disabled=true;
  btn.textContent='Menyimpan...';

  try{
    let imageData='';

    if(templateLibraryImageFile){
      btn.textContent='Compress gambar...';
      imageData=await compressImageToBase64(templateLibraryImageFile);

      if(imageData.length>850000){
        throw new Error('Screenshot terlalu besar selepas compress.');
      }
    }

    await db.collection('templateLibrary').add({
      name,project,script,note,imageData,
      createdBy:currentProfile.name,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    e.target.reset();
    templateLibraryImageFile=null;
    const wrap=document.getElementById('tmpl-lib-preview-wrap');
    if(wrap) wrap.style.display='none';
    toast('Template disimpan ✓');

  }catch(err){
    toast('Gagal simpan template: '+err.message,true);
  }finally{
    btn.disabled=false;
    btn.textContent='Simpan Template';
  }
});

document.getElementById('tmpl-lib-clear')?.addEventListener('click',()=>{
  document.getElementById('template-library-form')?.reset();
  templateLibraryImageFile=null;
  const wrap=document.getElementById('tmpl-lib-preview-wrap');
  if(wrap) wrap.style.display='none';
});

['tmpl-report-from','tmpl-report-to','tmpl-report-project'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',()=>{
    renderTemplateLibraryReport();
    renderTemplateLibrary();
  });
});

document.getElementById('tmpl-library-project-filter')?.addEventListener('change',renderTemplateLibrary);
document.getElementById('tmpl-library-search')?.addEventListener('input',renderTemplateLibrary);

document.querySelector('.app-nav button[data-view="template"]')?.addEventListener('click',()=>{
  renderTemplateLibrary();
  renderTemplateLibraryReport();
});

// ============================================================
// POSTER PERFORMANCE INSIDE POSTER TAB
// ============================================================
function posterLibraryPerformanceMap(){
  const from=document.getElementById('poster-report-from')?.value || '';
  const to=document.getElementById('poster-report-to')?.value || '';
  const project=document.getElementById('poster-report-project')?.value || '';

  const map={};

  (allEntries||[]).forEach(r=>{
    if(!r.poster) return;
    if(from && r.tarikh<from) return;
    if(to && r.tarikh>to) return;
    if(project && r.kategori!==project) return;

    const k=r.poster;
    map[k]=map[k] || {sessions:0,sent:0,reply:0,buyer:0,sales:0};
    const p=map[k];

    p.sessions++;
    p.sent+=Number(r.sent||0);
    p.reply+=Number(r.reply||0);
    p.buyer+=Number(r.buyer||0);
    p.sales+=Number(r.sales||0);
  });

  return map;
}

function renderPosterLibraryPerformance(){
  const body=document.getElementById('poster-library-report-body');
  if(!body) return;

  const map=posterLibraryPerformanceMap();

  const rows=Object.entries(map)
    .map(([name,x])=>{
      const replyRate=x.sent ? x.reply/x.sent*100 : 0;
      const conv=x.sent ? x.buyer/x.sent*100 : 0;
      const cost=costRM(x.sent);
      const roas=cost ? x.sales/cost : 0;
      return {name,...x,replyRate,conv,cost,roas};
    })
    .sort((a,b)=>b.sales-a.sales || b.buyer-a.buyer || b.conv-a.conv);

  body.innerHTML=rows.map((x,i)=>`
    <tr>
      <td class="rank">${i+1}</td>
      <td class="tname">${escHtml(x.name)}</td>
      <td class="num">${x.sessions}</td>
      <td class="num">${fmt(x.sent)}</td>
      <td class="num">${x.replyRate.toFixed(1)}%</td>
      <td class="num">${fmt(x.buyer)}</td>
      <td class="num">${x.conv.toFixed(2)}%</td>
      <td class="num">${x.sales ? 'RM '+fmt(x.sales) : '–'}</td>
      <td class="num">RM ${fmt(x.cost.toFixed(2))}</td>
      <td class="num">${x.cost ? x.roas.toFixed(2)+'x' : '–'}</td>
    </tr>
  `).join('');

  if(!rows.length){
    body.innerHTML='<tr><td colspan="10" class="empty-state">Belum ada data poster untuk filter ini.</td></tr>';
  }

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};

  set('poster-stat-total',allPosters.length);
  set('poster-stat-sales-count',rows.filter(x=>x.sales>0).length);

  const topSales=rows[0];
  const topConv=[...rows].sort((a,b)=>b.conv-a.conv)[0];

  set('poster-stat-top-sales',topSales ? 'RM '+fmt(topSales.sales) : '–');
  set('poster-stat-top-sales-name',topSales ? topSales.name : 'Belum ada data');
  set('poster-stat-top-conv',topConv ? topConv.conv.toFixed(2)+'%' : '–');
  set('poster-stat-top-conv-name',topConv ? topConv.name : 'Belum ada data');
}

['poster-report-from','poster-report-to','poster-report-project'].forEach(id=>{
  document.getElementById(id)?.addEventListener('change',()=>{
    renderPosterLibraryPerformance();
    renderPosters();
  });
});

document.getElementById('poster-library-search')?.addEventListener('input',renderPosters);

document.querySelector('.app-nav button[data-view="poster"]')?.addEventListener('click',()=>{
  renderPosterLibraryPerformance();
  renderPosters();
});


// Manual refresh for historical CRM entries.
async function refreshEntriesNow(){
  try{
    const snap = await db.collection('entries').get();

    allEntries = snap.docs.map(d=>{
      const row={id:d.id,...d.data()};
      if(row.kategori==='Promo Jus') row.kategori='Promo TikTok';
      return row;
    });

    allEntries.sort((a,b)=>{
      const ad=String(a.tarikh||'');
      const bd=String(b.tarikh||'');
      if(ad!==bd) return bd.localeCompare(ad);

      const at=a.createdAt&&a.createdAt.toMillis
        ? a.createdAt.toMillis()
        : Number(a.createdAtMs||0);

      const bt=b.createdAt&&b.createdAt.toMillis
        ? b.createdAt.toMillis()
        : Number(b.createdAtMs||0);

      return bt-at;
    });

    renderEntriesList();

    try{ renderDashboard(); }catch(e){ console.warn(e); }
    try{ renderTemplateLibraryReport(); }catch(e){ console.warn(e); }
    try{ renderPosterLibraryPerformance(); }catch(e){ console.warn(e); }

    toast(`${allEntries.length} entri berjaya dimuat semula ✓`);
  }catch(err){
    toast('Gagal refresh data lama: '+err.message,true);
  }
}

document.getElementById('entries-reload-btn')?.addEventListener('click',refreshEntriesNow);


// ============================================================
// V14 REFERENCE DASHBOARD WIDGETS
// ============================================================

function refEsc(v){
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function refRowsInCurrentDashboardScope(){
  try{
    return typeof filteredEntries === 'function' ? filteredEntries() : (allEntries || []);
  }catch(_){
    return allEntries || [];
  }
}

function refLastNDaysRows(days){
  const rows = refRowsInCurrentDashboardScope();
  const end = new Date();
  end.setHours(12,0,0,0);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const startStr = start.toISOString().slice(0,10);
  const endStr = end.toISOString().slice(0,10);
  return rows.filter(r => (!r.tarikh || (r.tarikh >= startStr && r.tarikh <= endStr)));
}

function renderRefTrend(){
  const wrap = document.getElementById('ref-trend-chart');
  if(!wrap) return;

  const days = Number(document.getElementById('ref-trend-range')?.value || 7);
  const rows = refLastNDaysRows(days);

  const today = new Date();
  today.setHours(12,0,0,0);

  const points = [];
  for(let i=days-1;i>=0;i--){
    const d = new Date(today);
    d.setDate(today.getDate()-i);
    const ds = d.toISOString().slice(0,10);
    const dayRows = rows.filter(r => r.tarikh === ds);
    points.push({
      date: ds,
      sales: dayRows.reduce((s,r)=>s+Number(r.sales||0),0),
      sent: dayRows.reduce((s,r)=>s+Number(r.sent||0),0),
      reply: dayRows.reduce((s,r)=>s+Number(r.reply||0),0),
      buyer: dayRows.reduce((s,r)=>s+Number(r.buyer||0),0)
    });
  }

  const W=760,H=230,L=46,R=18,T=18,B=34;
  const pw=W-L-R, ph=H-T-B;
  const maxVal=Math.max(1,...points.flatMap(p=>[p.sales,p.sent,p.reply,p.buyer]));
  const x=i=>L+(points.length<=1?pw/2:i*(pw/(points.length-1)));
  const y=v=>T+ph-(Number(v||0)/maxVal)*ph;

  const colors={sales:'#20b88b',sent:'#2585ef',reply:'#efa611',buyer:'#8b62df'};

  let grid='';
  for(let i=0;i<4;i++){
    const yy=T+i*(ph/3);
    const val=maxVal-(i*(maxVal/3));
    const label=val>=1000?(val/1000).toFixed(1)+'k':Math.round(val);
    grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="ref-grid-line"/>`;
    grid+=`<text x="${L-8}" y="${yy+4}" text-anchor="end" class="ref-axis-text">${label}</text>`;
  }

  let lines='';
  ['sales','sent','reply','buyer'].forEach(k=>{
    const pts=points.map((p,i)=>`${x(i)},${y(p[k])}`).join(' ');
    lines+=`<polyline points="${pts}" fill="none" stroke="${colors[k]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    points.forEach((p,i)=>{
      lines+=`<circle cx="${x(i)}" cy="${y(p[k])}" r="3.2" fill="${colors[k]}"><title>${p.date}: ${k} ${p[k]}</title></circle>`;
    });
  });

  let labels='';
  const step=Math.max(1,Math.ceil(points.length/7));
  points.forEach((p,i)=>{
    if(i%step===0 || i===points.length-1){
      const d=new Date(p.date+'T12:00:00');
      labels+=`<text x="${x(i)}" y="${H-10}" text-anchor="middle" class="ref-axis-text">${d.getDate()}/${d.getMonth()+1}</text>`;
    }
  });

  wrap.innerHTML=`<svg class="ref-trend-svg" viewBox="0 0 ${W} ${H}" role="img">${grid}${lines}${labels}</svg>`;
}

function refDetectChannel(source){
  const s=String(source||'').toLowerCase();
  if(s.includes('tiktok')) return 'TikTok';
  if(s.includes('fb') || s.includes('facebook') || s.includes('ads')) return 'Ads FB';
  if(s.includes('organic')) return 'Organic';
  return 'Lain-lain';
}

function renderRefChannel(){
  const donut=document.getElementById('ref-channel-donut');
  const legend=document.getElementById('ref-channel-legend');
  if(!donut || !legend) return;

  const metric=document.getElementById('ref-channel-metric')?.value || 'sales';
  const rows=refRowsInCurrentDashboardScope();

  const data={'Ads FB':0,'Organic':0,'TikTok':0,'Lain-lain':0};

  rows.forEach(r=>{
    const channel=refDetectChannel(r.source);
    data[channel]+=Number(r[metric]||0);
  });

  const total=Object.values(data).reduce((a,b)=>a+b,0);
  const colors={'Ads FB':'#27af8b','Organic':'#cbece4','TikTok':'#ffc75f','Lain-lain':'#a981e8'};

  let offset=0;
  const segs=[];
  const C=2*Math.PI*72;
  Object.entries(data).forEach(([name,val])=>{
    const frac=total?val/total:0;
    const len=frac*C;
    segs.push(`<circle cx="90" cy="90" r="72" fill="none" stroke="${colors[name]}" stroke-width="28"
      stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"/>`);
    offset+=len;
  });

  if(!total){
    segs.push(`<circle cx="90" cy="90" r="72" fill="none" stroke="#dceee8" stroke-width="28"/>`);
  }

  const metricLabel = metric==='sales'?'Total Sales':metric==='sent'?'Total Sent':'Total Buyer';
  const centerVal = metric==='sales' ? 'RM '+Math.round(total).toLocaleString('en-MY') : Math.round(total).toLocaleString('en-MY');

  donut.innerHTML=`<svg viewBox="0 0 180 180" class="ref-donut-svg">${segs.join('')}
    <text x="90" y="84" text-anchor="middle" class="ref-donut-value">${refEsc(centerVal)}</text>
    <text x="90" y="103" text-anchor="middle" class="ref-donut-label">${metricLabel}</text>
  </svg>`;

  legend.innerHTML=Object.entries(data).map(([name,val])=>{
    const pct=total?(val/total*100):0;
    const valTxt=metric==='sales'?'RM '+Math.round(val).toLocaleString('en-MY'):Math.round(val).toLocaleString('en-MY');
    return `<div class="ref-channel-item">
      <span class="ref-channel-color" style="background:${colors[name]}"></span>
      <div><b>${name}</b><small>${valTxt} (${pct.toFixed(0)}%)</small></div>
    </div>`;
  }).join('');
}

function renderRefEntries(){
  const body=document.getElementById('ref-entry-body');
  const empty=document.getElementById('ref-entry-empty');
  const count=document.getElementById('ref-entry-count');
  if(!body || !empty || !count) return;

  const rows=[...(allEntries||[])]
    .sort((a,b)=>String(b.tarikh||'').localeCompare(String(a.tarikh||'')))
    .slice(0,5);

  count.textContent=(allEntries||[]).length+' entri';

  body.innerHTML=rows.map(r=>`
    <tr>
      <td>${refEsc(r.tarikh||'-')}</td>
      <td>${refEsc(r.template||'-')}</td>
      <td>${refEsc(r.source||'-')}</td>
      <td>${Number(r.sent||0).toLocaleString('en-MY')}</td>
      <td>${Number(r.reply||0).toLocaleString('en-MY')}</td>
      <td>${Number(r.buyer||0).toLocaleString('en-MY')}</td>
      <td>${Number(r.sales||0)?'RM '+Number(r.sales||0).toLocaleString('en-MY'):'-'}</td>
    </tr>
  `).join('');

  const has=rows.length>0;
  body.closest('table').style.display=has?'table':'none';
  empty.style.display=has?'none':'flex';
}

function renderRefTemplates(){
  const list=document.getElementById('ref-template-list');
  const empty=document.getElementById('ref-template-empty');
  if(!list || !empty) return;

  const map={};
  (allEntries||[]).forEach(r=>{
    const name=String(r.template||'').trim();
    if(!name) return;
    map[name]=(map[name]||0)+Number(r.sales||0);
  });

  const rows=Object.entries(map)
    .filter(([,sales])=>sales>0)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5);

  list.innerHTML=rows.map(([name,sales],i)=>`
    <div class="ref-template-row">
      <span class="ref-template-rank">${i+1}</span>
      <div class="ref-template-copy"><b>${refEsc(name)}</b><small>Sales terkumpul</small></div>
      <strong>RM ${Number(sales).toLocaleString('en-MY')}</strong>
    </div>
  `).join('');

  list.style.display=rows.length?'block':'none';
  empty.style.display=rows.length?'none':'flex';
}

function renderReferenceDashboardWidgets(){
  renderRefTrend();
  renderRefChannel();
  renderRefEntries();
  renderRefTemplates();
}

document.getElementById('ref-trend-range')?.addEventListener('change',renderRefTrend);
document.getElementById('ref-channel-metric')?.addEventListener('change',renderRefChannel);
document.getElementById('ref-entry-refresh')?.addEventListener('click',()=>{
  if(typeof refreshEntriesNow==='function'){
    Promise.resolve(refreshEntriesNow()).finally(renderReferenceDashboardWidgets);
  }else{
    renderReferenceDashboardWidgets();
  }
});
document.getElementById('ref-template-see-all')?.addEventListener('click',()=>{
  document.querySelector('.app-nav button[data-view="template"]')?.click();
});

document.querySelector('.app-nav button[data-view="dashboard"]')?.addEventListener('click',()=>{
  setTimeout(renderReferenceDashboardWidgets,0);
});

// V15 Planning: poster terus nampak, tanpa butang Lihat Poster
function v15PlanningPosterPreview(){
 const view=document.getElementById('view-planning'); if(!view)return;
 [...view.querySelectorAll('a,button')].forEach(el=>{
   const t=(el.textContent||'').trim().toLowerCase();
   if(t==='lihat poster'||t==='view poster') el.style.display='none';
 });
 [...view.querySelectorAll('img')].forEach(img=>{
   const s=(img.src||'').toLowerCase(), a=(img.alt||'').toLowerCase(),
         c=(img.className||'').toString().toLowerCase(),
         tx=(img.closest('article,div')?.textContent||'').toLowerCase();
   if(c.includes('avatar')||c.includes('icon')) return;
   if(a.includes('poster')||a.includes('creative')||c.includes('poster')||
      c.includes('creative')||tx.includes('poster')||tx.includes('creative')){
      const p=img.parentElement;
      if(p) p.classList.add('planning-poster-direct');
      img.title='Klik untuk lihat poster lebih besar';
      if(!img.dataset.v15Zoom){
        img.dataset.v15Zoom='1';
        img.addEventListener('click',()=>window.open(img.src,'_blank','noopener,noreferrer'));
      }
   }
 });
}
document.addEventListener('DOMContentLoaded',()=>{
 const v=document.getElementById('view-planning');
 if(v){
   new MutationObserver(()=>requestAnimationFrame(v15PlanningPosterPreview))
     .observe(v,{childList:true,subtree:true});
   v15PlanningPosterPreview();
 }
});
document.querySelector('.app-nav button[data-view="planning"]')?.addEventListener('click',
 ()=>setTimeout(v15PlanningPosterPreview,100));

document.addEventListener('DOMContentLoaded',()=>{ try{ startSegSavedListener(); }catch(e){ console.warn(e); } });


document.getElementById('seg-copy-persistent-unmatched')?.addEventListener('click',async()=>{
  const nums=segUniquePhones(segPersistentUnmatched||[]);
  if(!nums.length){toast('Tiada nombor tiada DB untuk disalin',true);return;}
  try{
    await navigator.clipboard.writeText(nums.join('\n'));
    toast(fmt(nums.length)+' nombor tiada DB disalin ✓');
  }catch(err){toast('Gagal salin nombor',true);}
});

document.getElementById('seg-reset-persistent-unmatched')?.addEventListener('click',()=>{
  if(!(segPersistentUnmatched||[]).length){toast('Senarai memang kosong',true);return;}
  if(!confirm('Reset semua nombor Tiada Dalam Database yang disimpan sementara?')) return;
  segPersistentUnmatched=[];
  savePersistentUnmatchedLocal();
  renderPersistentUnmatched();
  renderSegSummary();
  toast('Senarai Tiada DB direset ✓');
});

document.getElementById('seg-persistent-unmatched-list')?.addEventListener('click',e=>{
  const btn=e.target.closest('.seg-remove-unmatched');
  if(!btn) return;
  const p=segNormalizePhone(btn.dataset.phone||'');
  segPersistentUnmatched=segPersistentUnmatched.filter(x=>segNormalizePhone(x)!==p);
  savePersistentUnmatchedLocal();
  renderPersistentUnmatched();
  renderSegSummary();
});

document.addEventListener('DOMContentLoaded',()=>{
  try{ loadPersistentUnmatched(); }catch(e){ console.warn(e); }
});


// ============================================================
// SALES PAGE LIVE — MAMARIAM CATALOG
// ============================================================
document.querySelectorAll('.salespage-copy-url-btn').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    const url=btn.dataset.url || '';
    if(!url) return;
    try{
      await navigator.clipboard.writeText(url);
      toast('Link sales page disalin ✓');
    }catch(err){
      toast('Gagal salin link', true);
    }
  });
});
