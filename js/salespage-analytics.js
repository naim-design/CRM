// ============================================================
// SALES PAGE ANALYTICS — reads from Firestore collection "salesPageAnalytics"
// Data ditulis oleh pixel tracker yang tertanam dalam sales page (public,
// tanpa login). Panel ni baca & agregat data tu untuk paparan dalam CRM.
// Guna `db` global yang dah diinit dalam js/firebase-config.js.
// ============================================================

const SPA_SECTION_LABELS = {
  'utama': 'Hero (Utama)',
  'update-hq': 'Update HQ',
  'repeat-reasons-v108': 'Sebab Repeat',
  'repeat-order': 'Repeat Order',
  'kenapa-consume-jus-mamariam': 'Kenapa Consume',
  'kenapa-repeat-beli': 'Kenapa Repeat Beli',
  'vip-grab-sekarang': 'VIP Grab Sekarang',
  'repeat-benefit': 'Repeat Benefit',
  'pakej': 'Pakej / Harga',
  'selebriti': 'Selebriti',
  'faq': 'FAQ'
};
const SPA_SECTION_ORDER = ['utama', 'update-hq', 'repeat-reasons-v108', 'repeat-order', 'kenapa-consume-jus-mamariam', 'kenapa-repeat-beli', 'vip-grab-sekarang', 'repeat-benefit', 'pakej', 'selebriti', 'faq'];

let spaLoaded = false;

function spaFmtTime(sec) {
  if (!sec || sec <= 0) return '0s';
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + 'm ' + s + 's';
}
function spaFmtDate(ts) {
  if (!ts || !ts.toDate) return '-';
  const d = ts.toDate();
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
}
function spaBarRow(label, pct, val, extraClass) {
  return '<div class="spa-bar-row"><div class="spa-label">' + label + '</div><div class="spa-bar-track"><div class="spa-bar-fill' + (extraClass ? (' ' + extraClass) : '') + '" style="width:' + Math.max(pct, 2) + '%"></div></div><div class="spa-bar-val">' + val + '</div></div>';
}

function renderSalesPageAnalytics(docs) {
  const statusEl = document.getElementById('spa-status');
  if (!docs.length) {
    statusEl.textContent = '0 rekod dijumpai untuk tempoh ini.';
    document.getElementById('spa-kpi-sessions').textContent = '0';
    document.getElementById('spa-kpi-visitors').textContent = '0';
    document.getElementById('spa-kpi-time').textContent = '0s';
    document.getElementById('spa-kpi-complete').textContent = '0%';
    document.getElementById('spa-funnel-bars').innerHTML = '<div class="spa-empty">Belum ada data. Tunggu pelawat masuk sales page dahulu.</div>';
    document.getElementById('spa-dropoff-bars').innerHTML = '';
    document.getElementById('spa-skip-bars').innerHTML = '';
    document.getElementById('spa-device-bars').innerHTML = '';
    document.querySelector('#spa-recent-table tbody').innerHTML = '';
    return;
  }
  statusEl.textContent = docs.length + ' session dijumpai.';

  const total = docs.length;
  const visitorSet = {};
  let totalActive = 0, completedCount = 0;
  const milestoneCounts = { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p100: 0 };
  const dropoffCounts = {};
  const skipCounts = {};
  const deviceCounts = { mobile: 0, desktop: 0 };

  docs.forEach(d => {
    const data = d.data();
    if (data.visitorId) visitorSet[data.visitorId] = true;
    totalActive += (data.activeTimeSec || 0);
    if (data.completed) completedCount++;
    const ms = data.milestones || {};
    ['p10', 'p25', 'p50', 'p75', 'p90', 'p100'].forEach(k => { if (ms[k] !== undefined) milestoneCounts[k]++; });
    const drop = data.furthestSection || data.exitSection;
    if (drop) dropoffCounts[drop] = (dropoffCounts[drop] || 0) + 1;
    if (data.scrollSpeedMaxSection) skipCounts[data.scrollSpeedMaxSection] = (skipCounts[data.scrollSpeedMaxSection] || 0) + 1;
    const dev = data.device === 'mobile' ? 'mobile' : 'desktop';
    deviceCounts[dev]++;
  });

  document.getElementById('spa-kpi-sessions').textContent = total;
  document.getElementById('spa-kpi-visitors').textContent = Object.keys(visitorSet).length;
  document.getElementById('spa-kpi-time').textContent = spaFmtTime(Math.round(totalActive / total));
  document.getElementById('spa-kpi-complete').textContent = Math.round((completedCount / total) * 100) + '%';

  let funnelHtml = '';
  [['p10', '10%'], ['p25', '25%'], ['p50', '50%'], ['p75', '75%'], ['p90', '90%'], ['p100', '100% (Habis)']].forEach(pair => {
    const count = milestoneCounts[pair[0]];
    const pct = Math.round((count / total) * 100);
    funnelHtml += spaBarRow(pair[1], pct, pct + '% (' + count + ')');
  });
  document.getElementById('spa-funnel-bars').innerHTML = funnelHtml;

  let dropoffHtml = '';
  SPA_SECTION_ORDER.forEach(sec => {
    const count = dropoffCounts[sec] || 0;
    if (count === 0) return;
    const pct = Math.round((count / total) * 100);
    dropoffHtml += spaBarRow(SPA_SECTION_LABELS[sec] || sec, pct, count + ' org');
  });
  document.getElementById('spa-dropoff-bars').innerHTML = dropoffHtml || '<div class="spa-empty">Tiada data lagi.</div>';

  const skipEntries = Object.keys(skipCounts).map(k => [k, skipCounts[k]]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSkip = skipEntries.length ? skipEntries[0][1] : 1;
  let skipHtml = '';
  skipEntries.forEach(e => {
    const pct = Math.round((e[1] / maxSkip) * 100);
    skipHtml += spaBarRow(SPA_SECTION_LABELS[e[0]] || e[0], pct, e[1] + 'x', 'amber');
  });
  document.getElementById('spa-skip-bars').innerHTML = skipHtml || '<div class="spa-empty">Tiada data lagi.</div>';

  let deviceHtml = '';
  ['mobile', 'desktop'].forEach(dev => {
    const count = deviceCounts[dev];
    const pct = Math.round((count / total) * 100);
    deviceHtml += spaBarRow(dev === 'mobile' ? 'Mobile' : 'Desktop', pct, pct + '% (' + count + ')', dev === 'mobile' ? '' : 'amber');
  });
  document.getElementById('spa-device-bars').innerHTML = deviceHtml;

  const sorted = docs.slice().sort((a, b) => {
    const ta = a.data().lastUpdate ? a.data().lastUpdate.toMillis() : 0;
    const tb = b.data().lastUpdate ? b.data().lastUpdate.toMillis() : 0;
    return tb - ta;
  }).slice(0, 20);
  const rows = sorted.map(d => {
    const data = d.data();
    const sec = data.furthestSection || data.exitSection || '-';
    return '<tr>'
      + '<td>' + spaFmtDate(data.lastUpdate) + '</td>'
      + '<td><span class="spa-pill ' + (data.device === 'mobile' ? 'mobile' : 'desktop') + '">' + (data.device || '-') + '</span></td>'
      + '<td>' + (data.maxScrollPercent || 0) + '%</td>'
      + '<td>' + spaFmtTime(data.activeTimeSec || 0) + '</td>'
      + '<td>' + (SPA_SECTION_LABELS[sec] || sec) + '</td>'
      + '<td><span class="spa-pill ' + (data.completed ? 'done' : 'pending') + '">' + (data.completed ? 'Ya' : 'Tidak') + '</span></td>'
      + '</tr>';
  }).join('');
  document.querySelector('#spa-recent-table tbody').innerHTML = rows;
}

function loadSalesPageAnalytics(range) {
  const statusEl = document.getElementById('spa-status');
  if (!statusEl) return;
  statusEl.textContent = 'Memuatkan data...';
  let q = db.collection('salesPageAnalytics');
  const now = new Date();
  if (range === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    q = q.where('firstSeen', '>=', start);
  } else if (range === '7' || range === '30') {
    const days = parseInt(range, 10);
    const start2 = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    q = q.where('firstSeen', '>=', start2);
  }
  q.get().then(snap => {
    renderSalesPageAnalytics(snap.docs);
  }).catch(err => {
    statusEl.textContent = 'Ralat memuatkan data: ' + err.message;
    console.error('[salespage-analytics]', err);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const filterWrap = document.querySelector('.spa-filters');
  if (!filterWrap) return;
  filterWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    filterWrap.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadSalesPageAnalytics(btn.dataset.spaRange);
  });

  // Load bila tab "Page Analytics" dibuka (guna nav sedia ada dalam app.js)
  document.querySelectorAll('.app-nav button[data-view="pageanalytics"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!spaLoaded) {
        spaLoaded = true;
        loadSalesPageAnalytics('7');
      }
    });
  });

  // Kalau tab Page Analytics tu default active semasa page load, terus load
  const salespagesView = document.getElementById('view-pageanalytics');
  if (salespagesView && salespagesView.classList.contains('active') && !spaLoaded) {
    spaLoaded = true;
    loadSalesPageAnalytics('7');
  }
});
