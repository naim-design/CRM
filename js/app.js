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
let allFeedback = [];
let unsubFeedback = null;
let allCampaignMappings = [];
let unsubCampaignMappings = null;

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
  document.getElementById('theme-toggle').textContent = isLight ? '☀️' : '🌙';
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
  });
});

// ---- Realtime listeners ----
function startListeners() {
  unsubEntries = db.collection('entries').orderBy('createdAt', 'desc').onSnapshot(snap => {
    allEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDashboard();
    renderWabotControl();
    renderTemplateReport();
    renderDailyReport();
    renderPosterPerformance();
    renderWabotPerformance();
    renderDayOfWeek();
    renderHourOfDay();
    renderEntriesList();
    if (allTopups) renderTopups();
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

  const eur = costEUR(sent);
  const rm = costRM(sent);
  document.getElementById('entry-cost-preview').textContent = `Kos: RM ${rm.toFixed(2)} (€${eur.toFixed(2)})`;

  const responRate = sent ? (read / sent * 100) : 0;
  const replyRate = sent ? (reply / sent * 100) : 0;
  const convRate = sent ? (buyer / sent * 100) : 0;
  document.getElementById('live-respon-rate').textContent = responRate.toFixed(1) + '%';
  document.getElementById('live-reply-rate').textContent = replyRate.toFixed(1) + '%';
  document.getElementById('live-conv-rate').textContent = convRate.toFixed(2) + '%';
}
['entry-sent', 'entry-read', 'entry-reply', 'entry-buyer'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateEntryLivePreview);
});

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

function renderEntriesList() {
  const sorted = [...allEntries].sort((a, b) => (b.tarikh || '').localeCompare(a.tarikh || ''));
  const body = document.getElementById('entries-list-body');
  body.innerHTML = '';
  const LIMIT = 100;
  sorted.slice(0, LIMIT).forEach(en => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="tname">${en.tarikh || '-'}</td>
      <td style="font-size:12px;">${en.kategori || '-'}</td>
      <td style="font-size:12px; color:var(--muted);">${en.staffName || '-'}</td>
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
  document.getElementById('entries-list-count').textContent = fmt(sorted.length) + ' entri' + (sorted.length > LIMIT ? ` (papar ${LIMIT} terkini)` : '');
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

const DASH_TARGETS = {
  sales: 30000,
  conversion: 1,
  reply: 50,
  roas: 10,
  roi: 10,
  cost: 1000,
  buyer: 100
};

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
function dashSetTarget(key, value, target, lowerIsBetter=false) {
  const bar = document.getElementById(`target-${key}-bar`);
  const txt = document.getElementById(`target-${key}-text`);
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
    'Projek Leads Ikhtiar (NaimFani)':'Projek Leads Ikhtiar',
    'Promo Jus':'Promo Jus',
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

function renderDashboard() {
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

  dashSetTarget('sales',m.sales,DASH_TARGETS.sales);
  dashSetTarget('roi',m.roi,DASH_TARGETS.roi);
  dashSetTarget('roas',m.roas,DASH_TARGETS.roas);
  dashSetTarget('conv',m.conversion,DASH_TARGETS.conversion);
  dashSetTarget('reply',m.replyRate,DASH_TARGETS.reply);
  dashSetTarget('buyer',m.buyer,DASH_TARGETS.buyer);
  dashSetTarget('cost',m.cost,DASH_TARGETS.cost,true);

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
}

function renderTemplateReport() {
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
    if (type === '7') from.setDate(to.getDate() - 6);
    else if (type === '30') from.setDate(to.getDate() - 29);
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
  if (susuExtra) susuExtra.style.display = kategori === 'Projek Susu' ? 'block' : 'none';

  const leadsExtra = document.getElementById('kategori-naimfani-extra');
  if (leadsExtra) leadsExtra.style.display = kategori === 'Projek Leads Ikhtiar (NaimFani)' ? 'block' : 'none';
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
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Ralat: ' + err.message + '</td></tr>';
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
        <td style="font-size:12px; color:var(--muted);">${b.createdBy || '-'}</td>
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
      <div class="todo-meta">${t.staffName || ''}</div>
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
  document.getElementById('poster-count').textContent = fmt(allPosters.length) + ' poster';
  const grid = document.getElementById('poster-grid');
  grid.innerHTML = '';
  allPosters.forEach(p => {
    const card = document.createElement('div');
    card.className = 'poster-card';
    card.innerHTML = `<img src="${p.imageData}" alt="${p.name}">
      <div class="poster-info"><span class="poster-name">${p.name}</span>
      <button class="poster-del" data-id="${p.id}">✕</button></div>`;
    grid.appendChild(card);
  });
  document.querySelectorAll('.poster-del').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Padam poster ni?')) return;
      try {
        await db.collection('posters').doc(btn.dataset.id).delete();
      } catch (err) {
        toast('Gagal padam: ' + err.message, true);
      }
    };
  });
  if (!allPosters.length) grid.innerHTML = '<div class="empty-state">Tiada poster lagi — upload di atas.</div>';
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
        <div class="fb-foot"><span>${f.createdBy || ''} · ${dateStr}</span>
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

function renderPosterPerformance() {
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
    renderDailyReport(); renderPosterPerformance(); renderWabotPerformance();
    renderDayOfWeek(); renderHourOfDay();
  });
});

// ============================================================
// FILTER / SEGMENTASI DATABASE — cari ikut status (Buyer, Reply, dll) + sumber + batch
// ============================================================
let segLastResults = [];

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
  const status = document.getElementById('seg-filter-status').value;
  const source = document.getElementById('seg-filter-source').value.trim();
  const batchId = document.getElementById('seg-filter-batch').value;
  const phone = document.getElementById('seg-filter-phone').value.trim();
  const tags = getCheckedTags('seg-filter-tags');
  const body = document.getElementById('seg-result-body');
  body.innerHTML = '<tr><td colspan="5" class="empty-state">Mencari...</td></tr>';
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
    segLastResults = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
        <td style="text-align:right;"><span class="status-pill ${c.status}">${statusLabel(c.status)}</span></td>`;
      body.appendChild(tr);
    });
    if (!segLastResults.length) body.innerHTML = '<tr><td colspan="5" class="empty-state">Tiada hasil untuk tapisan ni.</td></tr>';
  } catch (err) {
    body.innerHTML = '<tr><td colspan="5" class="empty-state">Ralat: ' + err.message + '</td></tr>';
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
  const phones = [...new Set(rows.map(r => r.phone))];
  if (!phones.length) { toast('Paste nombor dulu dalam kotak', true); return; }

  btn.disabled = true; btn.textContent = 'Memproses...';
  resultBox.textContent = 'Mencari & menanda ' + fmt(phones.length) + ' nombor...';
  try {
    const matched = [];
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
    const notFound = phones.filter(p => !foundOriginals.has(p));

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
        <td style="text-align:right;"><span class="status-pill ${c.status}">${statusLabel(c.status)}</span></td>`;
      body.appendChild(tr);
    });
    if (!matched.length) body.innerHTML = '<tr><td colspan="5" class="empty-state">Tiada nombor yang padan dgn database.</td></tr>';

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
      <td style="font-size:12px; color:var(--muted);">${t.createdBy || '-'}</td>`;

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
  }, err => {
    const s=document.getElementById('wabot-live-status'); if(s) s.textContent='Belum aktif / tiada permission';
    console.warn('Wabot listener:', err.message);
  });
}
// start after auth has exposed the app
const _originalStartListeners = startListeners;
startListeners = function(){ _originalStartListeners(); startWabotListener(); };

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
  const repliers = new Set();
  const validRepliers = new Set();
  const replyMessages = new Set();

  events
    .filter(isUsefulWabotEvent)
    .forEach(e => {
      const k = wabotEventKind(e);
      const phone = normalizeWabotPhone(e.phone || e.to || e.from);
      const d = wabotDate(e.eventAt) || wabotDate(e.receivedAt);

      if (k === 'outgoing' && phone) {
        contacted.add(phone);
      }

      if (k === 'incoming') {
        if (phone) repliers.add(phone);
        replyMessages.add(
          e.messageId ||
          e.message_id ||
          `${phone || '-'}_${d ? d.getTime() : ''}_${typeof e.message === 'string' ? e.message : ''}`
        );
      }
    });

  repliers.forEach(phone => {
    if (contacted.has(phone)) validRepliers.add(phone);
  });

  const uniqueContacted = contacted.size;
  const uniqueRepliers = repliers.size;
  const validReplyCustomers = validRepliers.size;
  const replyMessageCount = replyMessages.size;
  const replyRate = uniqueContacted
    ? (validReplyCustomers / uniqueContacted * 100)
    : 0;

  return {
    uniqueContacted,
    uniqueRepliers,
    validReplyCustomers,
    replyMessages: replyMessageCount,
    replyRate
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
    const name = e.staffName || 'Tidak Diketahui';

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
  const staff = en.staffName ? ` • ${en.staffName}` : '';
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
