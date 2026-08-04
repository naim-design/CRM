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

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

// ---- Kos blasting (auto-kira dari jumlah Sent) ----
const RATE_EUR_PER_SENT = 0.0116;   // kos setiap mesej dihantar, dalam EUR
const EUR_TO_MYR = 4.68;            // kadar tukaran EUR -> RM
function costEUR(sent) { return (sent || 0) * RATE_EUR_PER_SENT; }
function costRM(sent) { return costEUR(sent) * EUR_TO_MYR; }

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
  });
});

// ---- Realtime listeners ----
function startListeners() {
  unsubEntries = db.collection('entries').orderBy('createdAt', 'desc').onSnapshot(snap => {
    allEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDashboard();
    renderTemplateReport();
    renderDailyReport();
    renderPosterPerformance();
    renderWabotPerformance();
    renderEntriesList();
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

function renderDashboard() {
  const rows = filteredEntries();
  const totals = rows.reduce((a, r) => {
    a.sent += r.sent; a.delivered += r.delivered; a.read += r.read;
    a.reply += r.reply; a.failed += r.failed; a.buyer += r.buyer; a.sales += r.sales;
    return a;
  }, { sent: 0, delivered: 0, read: 0, reply: 0, failed: 0, buyer: 0, sales: 0 });

  document.getElementById('stat-sent').textContent = fmt(totals.sent);
  document.getElementById('stat-buyer').textContent = fmt(totals.buyer);
  document.getElementById('stat-sales').textContent = 'RM ' + fmt(totals.sales);
  const totalCostEUR = costEUR(totals.sent);
  const totalCostRM = costRM(totals.sent);
  document.getElementById('stat-cost-rm').textContent = 'RM ' + fmt(totalCostRM.toFixed(2));
  document.getElementById('stat-cost-eur').textContent = '€' + totalCostEUR.toFixed(2);
  const roi = totalCostRM ? (totals.sales / totalCostRM) : 0;
  document.getElementById('stat-roi').textContent = roi.toFixed(2) + 'x';
  const convRate = totals.sent ? (totals.buyer / totals.sent * 100).toFixed(2) : '0.00';
  document.getElementById('stat-conv').textContent = convRate + '%';
  document.getElementById('stat-sessions').textContent = fmt(rows.length) + ' entri';

  // Funnel
  const stages = [
    { label: 'Sent', value: totals.sent, color: '#59646A' },
    { label: 'Delivered', value: totals.delivered, color: '#5FA8E0' },
    { label: 'Read', value: totals.read, color: '#35E0AC' },
    { label: 'Reply', value: totals.reply, color: '#F0AC52' },
    { label: 'Jadi Buyer', value: totals.buyer, color: '#FF7A68' },
  ];
  const funnelEl = document.getElementById('funnel');
  funnelEl.innerHTML = '';
  stages.forEach(s => {
    const pct = totals.sent ? (s.value / totals.sent * 100) : 0;
    const row = document.createElement('div');
    row.className = 'funnel-stage';
    row.innerHTML = `<div class="tick">${s.label}</div>
      <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:${Math.max(pct,1.2)}%; background:${s.color}"></div></div>
      <div class="nums"><span class="n">${fmt(s.value)}</span><span class="r">${pct.toFixed(1)}%</span></div>`;
    funnelEl.appendChild(row);
  });

  // Sources breakdown
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
  if (!entries.length) body.innerHTML = '<tr><td colspan="10" class="empty-state">Tiada data lagi</td></tr>';
}

['filter-from', 'filter-to', 'filter-staff', 'filter-kategori'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { renderDashboard(); renderTemplateReport(); });
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
    const col = db.collection('contacts');
    const [total, blasted] = await Promise.all([
      getCount(col),
      getCount(col.where('status', '==', 'blasted')),
    ]);
    document.getElementById('cstat-total').textContent = fmt(total);
    document.getElementById('cstat-blasted').textContent = fmt(blasted);
    document.getElementById('cstat-pending').textContent = fmt(total - blasted);

    const body = document.getElementById('source-stat-body');
    body.innerHTML = '<tr><td colspan="4" class="empty-state">Mengira...</td></tr>';
    if (!knownSources.length) await loadKnownSources();
    const rows = await Promise.all(knownSources.map(async (src) => {
      const [t, b] = await Promise.all([
        getCount(col.where('source', '==', src)),
        getCount(col.where('source', '==', src).where('status', '==', 'blasted')),
      ]);
      return { src, total: t, blasted: b };
    }));
    body.innerHTML = '';
    rows.filter(r => r.total > 0).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="tname">${r.src}</td><td class="num">${fmt(r.total)}</td>
        <td class="num" style="color:#35E0AC;">${fmt(r.blasted)}</td>
        <td class="num" style="color:#F0AC52;">${fmt(r.total - r.blasted)}</td>`;
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
      <td>
        <span class="status-pill ${c.status}" style="cursor:pointer;" data-id="${d.id}" data-status="${c.status}">
          ${c.status === 'blasted' ? 'Dah Blast' : 'Belum Blast'}
        </span>
      </td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn-ghost contact-edit-btn" data-id="${d.id}" data-name="${(c.name||'').replace(/"/g,'&quot;')}" data-phone="${c.phone||''}" data-source="${(c.source||'').replace(/"/g,'&quot;')}" style="width:auto; padding:5px 10px; font-size:11px; margin-right:6px;">Edit</button>
        <button class="btn-ghost contact-del-btn" data-id="${d.id}" style="width:auto; padding:5px 10px; font-size:11px; color:var(--coral); border-color:rgba(255,122,104,0.3);">Padam</button>
      </td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('.status-pill').forEach(pill => {
    pill.onclick = async () => {
      const newStatus = pill.dataset.status === 'blasted' ? 'pending' : 'blasted';
      await db.collection('contacts').doc(pill.dataset.id).update({ status: newStatus });
      reloadCurrentContactPage();
      loadContactStats();
    };
  });
  document.querySelectorAll('.contact-edit-btn').forEach(btn => {
    btn.onclick = () => openEditContactModal(btn.dataset.id, btn.dataset.name, btn.dataset.phone, btn.dataset.source);
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
  if (!docs.length) body.innerHTML = '<tr><td colspan="6" class="empty-state">Tiada rekod dijumpai.</td></tr>';
}

// ---- Edit contact modal ----
let editingContactId = null;
function openEditContactModal(id, name, phone, source) {
  editingContactId = id;
  document.getElementById('edit-contact-name').value = name || '';
  document.getElementById('edit-contact-phone').value = phone || '';
  document.getElementById('edit-contact-source').value = source || '';
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
  if (!name || !phone) { toast('Nama & nombor tak boleh kosong', true); return; }
  const btn = document.getElementById('edit-contact-save');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await db.collection('contacts').doc(editingContactId).update({ name, phone, source });
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
      const div = document.createElement('div');
      div.className = 'todo-item';
      div.innerHTML = `<div style="flex:1;">
        <div class="todo-text">${c.name} — ${c.phone}</div>
        <div class="todo-meta">Sumber: ${c.source || '–'}</div>
      </div>
      <span class="status-pill ${c.status}">${c.status === 'blasted' ? 'Dah Blast' : 'Belum Blast'}</span>`;
      resultEl.appendChild(div);
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

function renderTodos() {
  const date = document.getElementById('todo-filter-date').value;
  const rows = allTodos.filter(t => !date || t.date === date);
  document.getElementById('todo-count').textContent = fmt(rows.length) + ' tugasan';
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  rows.forEach(t => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (t.done ? ' done' : '');
    item.innerHTML = `
      <div class="todo-check ${t.done ? 'checked' : ''}" data-id="${t.id}" data-done="${t.done}">${t.done ? '✓' : ''}</div>
      <div style="flex:1;">
        <div class="todo-text">${t.text}</div>
        <div class="todo-meta">${t.staffName || ''}</div>
      </div>
      <button class="todo-del" data-id="${t.id}">✕</button>`;
    list.appendChild(item);
  });
  document.querySelectorAll('.todo-check').forEach(el => {
    el.onclick = async () => {
      const newDone = el.dataset.done !== 'true';
      await db.collection('todos').doc(el.dataset.id).update({ done: newDone });
    };
  });
  document.querySelectorAll('.todo-del').forEach(el => {
    el.onclick = async () => {
      if (confirm('Padam tugasan ni?')) await db.collection('todos').doc(el.dataset.id).delete();
    };
  });
  if (!rows.length) list.innerHTML = '<div class="empty-state">Tiada tugasan untuk tarikh ni.</div>';
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
  if (!dates.length) body.innerHTML = '<tr><td colspan="11" class="empty-state">Tiada data lagi</td></tr>';
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
  if (!entries.length) body.innerHTML = '<tr><td colspan="10" class="empty-state">Tiada data poster lagi</td></tr>';
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
  if (!entries.length) body.innerHTML = '<tr><td colspan="10" class="empty-state">Tiada data akaun lagi</td></tr>';
}

['lap-filter-from', 'lap-filter-to', 'lap-filter-kategori'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { renderDailyReport(); renderPosterPerformance(); renderWabotPerformance(); });
});
