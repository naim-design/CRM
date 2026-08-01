// ============================================================
// APP.JS — Auth guard, nav, data entry (Firestore realtime)
// ============================================================

let currentUser = null;
let currentProfile = null;
let unsubEntries = null;
let unsubContacts = null;
let unsubTodos = null;
let unsubPosters = null;
let allEntries = [];
let allContacts = [];
let allTodos = [];
let allPosters = [];

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 2800);
}

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
  }, err => toast('Ralat baca data: ' + err.message, true));

  unsubContacts = db.collection('contacts').orderBy('createdAt', 'desc').onSnapshot(snap => {
    allContacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderContacts();
  }, err => toast('Ralat baca kontak: ' + err.message, true));

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
// INPUT DATA — Entry blast harian
// ============================================================
document.getElementById('entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  const payload = {
    staffId: currentUser.uid,
    staffName: currentProfile.name,
    tarikh: document.getElementById('entry-tarikh').value,
    source: document.getElementById('entry-source').value.trim() || 'Umum',
    template: document.getElementById('entry-template').value.trim() || 'Tanpa nama',
    poster: document.getElementById('entry-poster').value || '',
    sent: Number(document.getElementById('entry-sent').value || 0),
    delivered: Number(document.getElementById('entry-delivered').value || 0),
    read: Number(document.getElementById('entry-read').value || 0),
    reply: Number(document.getElementById('entry-reply').value || 0),
    failed: Number(document.getElementById('entry-failed').value || 0),
    buyer: Number(document.getElementById('entry-buyer').value || 0),
    sales: Number(document.getElementById('entry-sales').value || 0),
    spend: Number(document.getElementById('entry-spend').value || 0),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await db.collection('entries').add(payload);
    toast('Entri disimpan ✓');
    e.target.reset();
    document.getElementById('entry-tarikh').value = todayStr();
  } catch (err) {
    toast('Gagal simpan: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Simpan Entri';
  }
});

// ============================================================
// DASHBOARD — Kira & render stats dari data live
// ============================================================
function filteredEntries() {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const staff = document.getElementById('filter-staff').value;
  return allEntries.filter(en => {
    if (from && en.tarikh < from) return false;
    if (to && en.tarikh > to) return false;
    if (staff && en.staffId !== staff) return false;
    return true;
  });
}

function renderDashboard() {
  const rows = filteredEntries();
  const totals = rows.reduce((a, r) => {
    a.sent += r.sent; a.delivered += r.delivered; a.read += r.read;
    a.reply += r.reply; a.failed += r.failed; a.buyer += r.buyer; a.sales += r.sales;
    a.spend += (r.spend || 0);
    return a;
  }, { sent: 0, delivered: 0, read: 0, reply: 0, failed: 0, buyer: 0, sales: 0, spend: 0 });

  document.getElementById('stat-sent').textContent = fmt(totals.sent);
  document.getElementById('stat-buyer').textContent = fmt(totals.buyer);
  document.getElementById('stat-sales').textContent = 'RM ' + fmt(totals.sales);
  document.getElementById('stat-spend').textContent = 'RM ' + fmt(totals.spend);
  const roi = totals.spend ? ((totals.sales - totals.spend) / totals.spend * 100) : 0;
  const roas = totals.spend ? (totals.sales / totals.spend) : 0;
  document.getElementById('stat-roi').textContent = (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%';
  document.getElementById('stat-roas').textContent = 'ROAS ' + roas.toFixed(2) + 'x';
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
    byTmpl[k] = byTmpl[k] || { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0, spend: 0 };
    const t = byTmpl[k];
    t.sessions++; t.sent += r.sent; t.read += r.read; t.reply += r.reply; t.buyer += r.buyer; t.sales += r.sales;
    t.spend += (r.spend || 0);
  });
  const body = document.getElementById('tmpl-body');
  body.innerHTML = '';
  const entries = Object.entries(byTmpl).sort((a, b) => (b[1].reply / (b[1].sent || 1)) - (a[1].reply / (a[1].sent || 1)));
  entries.forEach(([name, t], i) => {
    const readRate = t.sent ? (t.read / t.sent * 100).toFixed(1) : '0.0';
    const replyRate = t.sent ? (t.reply / t.sent * 100).toFixed(1) : '0.0';
    const convRate = t.sent ? (t.buyer / t.sent * 100).toFixed(2) : '0.00';
    const roi = t.spend ? ((t.sales - t.spend) / t.spend * 100) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rank">${i + 1}</td><td class="tname">${name}</td>
      <td class="num">${t.sessions}</td><td class="num">${fmt(t.sent)}</td><td class="num">${readRate}%</td>
      <td class="num">${replyRate}%</td><td class="num">${convRate}%</td>
      <td class="num">${t.sales ? 'RM ' + fmt(t.sales) : '–'}</td>
      <td class="num">${roi === null ? '–' : (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%'}</td>`;
    body.appendChild(tr);
  });
  document.getElementById('tmpl-count').textContent = entries.length + ' template';
  if (!entries.length) body.innerHTML = '<tr><td colspan="9" class="empty-state">Tiada data lagi</td></tr>';
}

['filter-from', 'filter-to', 'filter-staff'].forEach(id => {
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
// CONTACTS — CRUD
// ============================================================
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const source = document.getElementById('contact-source').value.trim() || 'Umum';
  if (!name || !phone) return;
  try {
    await db.collection('contacts').add({
      name, phone, source, status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    e.target.reset();
    toast('Kontak ditambah ✓');
  } catch (err) {
    toast('Gagal tambah kontak: ' + err.message, true);
  }
});

let cFilter = '', cStatus = '', cPage = 0;
const PAGE_SIZE = 50;

function renderContacts() {
  const q = cFilter.toLowerCase();
  const filtered = allContacts.filter(c =>
    (!q || c.name.toLowerCase().includes(q) || c.phone.includes(q)) &&
    (!cStatus || c.status === cStatus)
  );
  const total = filtered.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  if (cPage > maxPage) cPage = maxPage;
  const start = cPage * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  document.getElementById('contact-count').textContent = fmt(total) + ' kontak';
  document.getElementById('page-info').textContent = total ? `Papar ${start + 1}–${Math.min(start + PAGE_SIZE, total)} dari ${fmt(total)}` : 'Tiada hasil';
  document.getElementById('prev-page').disabled = cPage === 0;
  document.getElementById('next-page').disabled = cPage >= maxPage;
  const body = document.getElementById('contact-body');
  body.innerHTML = '';
  pageRows.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = c.status === 'blasted' ? 'row-blasted' : 'row-pending';
    tr.innerHTML = `<td class="tname">${c.name}</td>
      <td style="font-family:'IBM Plex Mono';">${c.phone}</td>
      <td style="font-size:12px; color:var(--muted);">${c.source}</td>
      <td style="text-align:right;">
        <span class="status-pill ${c.status}" style="cursor:pointer;" data-id="${c.id}" data-status="${c.status}">
          ${c.status === 'blasted' ? 'Dah Blast' : 'Belum Blast'}
        </span>
      </td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('.status-pill').forEach(pill => {
    pill.onclick = async () => {
      const newStatus = pill.dataset.status === 'blasted' ? 'pending' : 'blasted';
      await db.collection('contacts').doc(pill.dataset.id).update({ status: newStatus });
    };
  });
  if (!total) body.innerHTML = '<tr><td colspan="4" class="empty-state">Tiada kontak lagi — tambah di atas.</td></tr>';
}

document.getElementById('search-contact').addEventListener('input', e => { cFilter = e.target.value; cPage = 0; renderContacts(); });
document.getElementById('filter-contact-status').addEventListener('change', e => { cStatus = e.target.value; cPage = 0; renderContacts(); });
document.getElementById('prev-page').addEventListener('click', () => { if (cPage > 0) { cPage--; renderContacts(); } });
document.getElementById('next-page').addEventListener('click', () => { cPage++; renderContacts(); });

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
  return allEntries.filter(en => {
    if (from && en.tarikh < from) return false;
    if (to && en.tarikh > to) return false;
    return true;
  });
}

function renderDailyReport() {
  const rows = lapFilteredEntries();
  const byDate = {};
  rows.forEach(r => {
    const k = r.tarikh || '-';
    byDate[k] = byDate[k] || { sent: 0, read: 0, reply: 0, buyer: 0, sales: 0, spend: 0 };
    const d = byDate[k];
    d.sent += r.sent; d.read += r.read; d.reply += r.reply; d.buyer += r.buyer; d.sales += r.sales; d.spend += (r.spend || 0);
  });
  const body = document.getElementById('daily-body');
  body.innerHTML = '';
  const dates = Object.keys(byDate).sort().reverse();
  dates.forEach(date => {
    const d = byDate[date];
    const readRate = d.sent ? (d.read / d.sent * 100).toFixed(1) : '0.0';
    const replyRate = d.sent ? (d.reply / d.sent * 100).toFixed(1) : '0.0';
    const convRate = d.sent ? (d.buyer / d.sent * 100).toFixed(2) : '0.00';
    const roas = d.spend ? (d.sales / d.spend) : null;
    const roi = d.spend ? ((d.sales - d.spend) / d.spend * 100) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="tname">${date}</td><td class="num">${fmt(d.sent)}</td>
      <td class="num">${readRate}%</td><td class="num">${replyRate}%</td>
      <td class="num">${fmt(d.buyer)}</td><td class="num">${convRate}%</td>
      <td class="num">${d.sales ? 'RM ' + fmt(d.sales) : '–'}</td>
      <td class="num">${roas === null ? '–' : roas.toFixed(2) + 'x'}</td>
      <td class="num">${roi === null ? '–' : (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%'}</td>`;
    body.appendChild(tr);
  });
  if (!dates.length) body.innerHTML = '<tr><td colspan="9" class="empty-state">Tiada data lagi</td></tr>';
}

function renderPosterPerformance() {
  const rows = lapFilteredEntries().filter(r => r.poster);
  const byPoster = {};
  rows.forEach(r => {
    const k = r.poster;
    byPoster[k] = byPoster[k] || { sessions: 0, sent: 0, read: 0, reply: 0, buyer: 0, sales: 0, spend: 0 };
    const p = byPoster[k];
    p.sessions++; p.sent += r.sent; p.read += r.read; p.reply += r.reply; p.buyer += r.buyer; p.sales += r.sales; p.spend += (r.spend || 0);
  });
  const body = document.getElementById('poster-perf-body');
  body.innerHTML = '';
  const entries = Object.entries(byPoster).sort((a, b) => (b[1].buyer / (b[1].sent || 1)) - (a[1].buyer / (a[1].sent || 1)));
  entries.forEach(([name, p], i) => {
    const readRate = p.sent ? (p.read / p.sent * 100).toFixed(1) : '0.0';
    const replyRate = p.sent ? (p.reply / p.sent * 100).toFixed(1) : '0.0';
    const convRate = p.sent ? (p.buyer / p.sent * 100).toFixed(2) : '0.00';
    const roi = p.spend ? ((p.sales - p.spend) / p.spend * 100) : null;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rank">${i + 1}</td><td class="tname">${name}</td>
      <td class="num">${p.sessions}</td><td class="num">${fmt(p.sent)}</td><td class="num">${readRate}%</td>
      <td class="num">${replyRate}%</td><td class="num">${convRate}%</td>
      <td class="num">${p.sales ? 'RM ' + fmt(p.sales) : '–'}</td>
      <td class="num">${roi === null ? '–' : (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%'}</td>`;
    body.appendChild(tr);
  });
  document.getElementById('poster-perf-count').textContent = entries.length + ' poster';
  if (!entries.length) body.innerHTML = '<tr><td colspan="9" class="empty-state">Tiada data poster lagi</td></tr>';
}

['lap-filter-from', 'lap-filter-to'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { renderDailyReport(); renderPosterPerformance(); });
});
