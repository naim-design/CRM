(function () {
  const root = document.getElementById('mp-reports');
  if (!root) return;

  const $ = id => document.getElementById(id);

  const esc = value => String(value ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

  const dt = value => new Intl.DateTimeFormat('ms-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur'
  }).format(new Date(value));

  let reports = [];

  root.innerHTML = `
    <div class="mp-panel">
      <h3>Laporan Semakan CRM</h3>
      <p>YGrow Formula HQ · 601168185110 · Asia/Kuala_Lumpur</p>
      <p>Laporan semakan disimpan berasingan daripada leads dan jualan.
      Penghantaran automatik tengah malam belum disambungkan.</p>
      <button type="button" id="mpr-refresh">Muat semula laporan</button>
      <p id="mpr-status" role="status">Buka tab ini untuk memuat laporan.</p>
    </div>

    <div id="mpr-list"></div>

    <details class="mp-panel">
      <summary>Masukkan laporan JSON</summary>
      <p>Gunakan laporan sebenar sahaja. Satu item confirmedChanges
      mewakili satu tindakan yang berjaya disahkan tool.</p>

      <input type="file" id="mpr-file"
        accept=".json,application/json"
        aria-label="Fail laporan JSON">

      <textarea id="mpr-json" rows="12"
        style="display:block;width:100%;box-sizing:border-box;margin:12px 0"
        aria-label="Kandungan laporan JSON"
        placeholder="Tampal laporan JSON di sini"></textarea>

      <button type="button" id="mpr-save">Simpan laporan</button>
      <p id="mpr-save-status" role="status"></p>

      <p>
        <a href="reports/murpati-report-template.json" download>
          Muat turun template kosong
        </a>
      </p>
    </details>
  `;

  async function call(method, body) {
    const user = window.firebase?.auth?.().currentUser;

    if (!user) throw Error('Sila login CRM dahulu');

    const token = await user.getIdToken();

    const response = await fetch('/api/murpati/reports', {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw Error(data.error || 'Gagal membaca laporan');
    }

    return data;
  }

  function list(title, items) {
    return `<h4>${title}</h4>` + (
      items.length
        ? '<ul>' + items.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'
        : '<p>Tiada direkodkan.</p>'
    );
  }

  function render() {
    const from = $('mp-from').value;
    const to = $('mp-to').value;

    const dateKey = value => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));

    const visible = reports.filter(r => {
      const date = dateKey(r.periodEnd);
      return (!from || date >= from) && (!to || date <= to);
    });

    $('mpr-list').innerHTML = visible.length
      ? visible.map(r => {
          const c = r.coverage;
          const partial =
            c.hasMore !== false ||
            c.filterTruncated !== false ||
            c.total === null ||
            c.readFull < c.listed ||
            c.listed < c.total;

          return `
            <article class="mp-panel">
              <h3>${esc(dt(r.periodStart))} hingga ${esc(dt(r.periodEnd))}</h3>
              <p>Dijana ${esc(dt(r.generatedAt))} MYT</p>

              <p><strong>${
                partial
                  ? 'Liputan terhad / belum dipastikan lengkap'
                  : 'Liputan lengkap mengikut rekod laporan'
              }</strong></p>

              <p>
                Disenarai: ${esc(c.listed)} ·
                Dibaca penuh: ${esc(c.readFull)} ·
                Jumlah tersedia: ${esc(c.total ?? 'Tidak diketahui')} ·
                has_more: ${esc(c.hasMore ?? 'Tidak diketahui')} ·
                filter_truncated: ${esc(c.filterTruncated ?? 'Tidak diketahui')}
              </p>

              <p>
                <strong>${r.confirmedChanges.length} perubahan disahkan</strong>
                (bilangan tindakan, bukan lead unik).
                Pengesahan berdasarkan laporan yang dimasukkan.
              </p>

              ${list('Perubahan disahkan', r.confirmedChanges)}
              ${list('Tindakan staf', r.staffActions)}
              ${list('Kekangan / belum diketahui', r.limitations)}
              ${list('Tindakan gagal / ditolak', r.failures)}
            </article>
          `;
        }).join('')
      : '<div class="mp-panel">Belum ada laporan untuk julat ini.</div>';
  }

  async function load() {
    const button = $('mpr-refresh');
    button.disabled = true;
    $('mpr-status').textContent = 'Memuat laporan...';

    try {
      const data = await call('GET');
      reports = data.reports;
      render();

      $('mpr-status').textContent =
        `${reports.length} laporan dimuat, maksimum ${data.limit} terkini. ` +
        'Penapis tarikh menggunakan tarikh akhir tempoh MYT.';
    } catch (e) {
      $('mpr-status').textContent = 'Ralat: ' + e.message;
    } finally {
      button.disabled = false;
    }
  }

  $('mpr-refresh').onclick = load;

  $('mpr-file').onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 250000) throw Error('Maksimum 250KB');

      $('mpr-json').value = await file.text();
      $('mpr-save-status').textContent =
        'Fail dimuat. Semak sebelum simpan.';
    } catch (e) {
      $('mpr-save-status').textContent = e.message;
    }
  };

  $('mpr-save').onclick = async () => {
    const button = $('mpr-save');
    button.disabled = true;

    try {
      const data = JSON.parse($('mpr-json').value);

      if (!confirm(
        'Simpan laporan ini? Pastikan perubahan mempunyai pengesahan tool.'
      )) return;

      const result = await call('POST', data);

      $('mpr-save-status').textContent = result.created
        ? 'Laporan berjaya disimpan.'
        : 'Laporan sama sudah disimpan; tiada pendua.';

      await load();
    } catch (e) {
      $('mpr-save-status').textContent = 'Ralat: ' + e.message;
    } finally {
      button.disabled = false;
    }
  };

  function select(report) {
    root.hidden = !report;
    $('mp-content').hidden = report;
    $('mp-state').hidden = report;

    if (report) load();
  }

  document.querySelectorAll('[data-view="murpati"]').forEach(button => {
    button.addEventListener('click', () => {
      select(button.dataset.murpatiTab === 'reports');
    });
  });

  document.querySelectorAll('[data-mp-tab]').forEach(button => {
    button.addEventListener('click', () => {
      select(button.dataset.mpTab === 'reports');
    });
  });

  ['mp-from', 'mp-to'].forEach(id => {
    $(id).addEventListener('change', render);
  });

  $('mp-refresh').addEventListener('click', () => {
    if (!root.hidden) load();
  });
})();
