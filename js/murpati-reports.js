/* V137: Dashboard visual laporan CRM Murpati */
(function () {
  const root = document.getElementById('mp-reports');
  if (!root) return;

  const $ = id => document.getElementById(id);

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));

  const num = value =>
    Number.isFinite(value) ? value.toLocaleString('ms-MY') : '—';

  const fmt = value =>
    new Intl.DateTimeFormat('ms-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kuala_Lumpur'
    }).format(new Date(value));

  const day = value =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Kuala_Lumpur'
    }).format(new Date(value));

  let reports = [];
  let selected = '';
  let category = 'Semua';

  const groups = [
    'Bayaran & order',
    'Kesesuaian',
    'Jawapan & layanan',
    'Lain-lain'
  ];

  function group(text) {
    if (/alahan|alerg|allerg|susu lembu|gula|kesesuaian/i.test(text)) {
      return groups[1];
    }

    if (/bayaran|payment|pakej|rm59|cod|pos laju|poslaju|alamat|order/i.test(text)) {
      return groups[0];
    }

    if (/bubble|menolak|penolakan|carta|pertanyaan|jawapan|opening|susulan/i.test(text)) {
      return groups[2];
    }

    return groups[3];
  }

  const list = (title, values) => `
    <h4>${esc(title)}</h4>
    ${
      values.length
        ? '<ul>' + values.map(value => '<li>' + esc(value) + '</li>').join('') + '</ul>'
        : '<p class="mr-muted">Tiada direkodkan.</p>'
    }
  `;

  root.innerHTML = `
    <style>
      #mp-reports {
        --mr-green: #008c72;
        --mr-amber: #c28b27;
        --mr-red: #c34d52;
        font-family: inherit;
        color: var(--text, #183e3a);
      }

      #mp-reports * {
        box-sizing: border-box;
      }

      #mp-reports [hidden] {
        display: none !important;
      }

      #mp-reports button,
      #mp-reports select,
      #mp-reports textarea,
      #mp-reports input {
        font: inherit;
      }

      #mp-reports button {
        cursor: pointer;
      }

      #mp-reports button:disabled {
        opacity: .55;
        cursor: wait;
      }

      #mp-reports .mr-toolbar {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        margin: 8px 0 18px;
      }

      #mp-reports .mr-picker {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }

      #mp-reports select,
      #mp-reports .mr-button {
        padding: 10px 14px;
        border: 1px solid var(--line, #d7e5e1);
        border-radius: 10px;
        background: var(--surface, #fff);
        color: inherit;
        max-width: 100%;
      }

      #mp-reports .mr-button.primary {
        background: #006c57;
        color: #fff;
        border-color: #006c57;
      }

      #mp-reports .mr-hero {
        padding: 28px;
        border-radius: 20px;
        background: linear-gradient(115deg, #003b37, #076958);
        color: #fff;
        display: flex;
        gap: 24px;
        justify-content: space-between;
        align-items: center;
        position: relative;
        overflow: hidden;
      }

      #mp-reports .mr-eyebrow {
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 700;
        color: #94e5cf;
      }

      #mp-reports h2 {
        font-size: clamp(22px, 3vw, 32px);
        margin: 8px 0 10px;
        color: inherit;
        line-height: 1.2;
      }

      #mp-reports .mr-hero p {
        font-size: 13px;
        line-height: 1.6;
        margin: 0;
        color: #c9e6df;
      }

      #mp-reports .mr-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 650;
        white-space: nowrap;
        background: #eaf8f3;
        color: #006d56;
      }

      #mp-reports .mr-pill.amber {
        background: #fff0ce;
        color: #805714;
      }

      #mp-reports .mr-pill.red {
        background: #fdeced;
        color: #9d3440;
      }

      #mp-reports .mr-kpis {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin: 18px 0;
      }

      #mp-reports .mr-card {
        background: var(--surface, #fff);
        border: 1px solid var(--line, #dce8e4);
        border-radius: 16px;
        padding: 21px;
        min-width: 0;
      }

      #mp-reports .mr-kpi {
        position: relative;
        overflow: hidden;
      }

      #mp-reports .mr-kpi:before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: var(--accent, #008c72);
      }

      #mp-reports .mr-label {
        font-size: 12px;
        color: var(--muted, #68807a);
        font-weight: 600;
      }

      #mp-reports .mr-value {
        font-size: 36px;
        line-height: 1.2;
        font-weight: 750;
        letter-spacing: -1px;
        margin: 10px 0 7px;
      }

      #mp-reports .mr-muted {
        color: var(--muted, #68807a);
        font-size: 12px;
        line-height: 1.6;
        margin: 6px 0;
      }

      #mp-reports .mr-grid {
        display: grid;
        grid-template-columns: 1.15fr 1fr;
        gap: 18px;
        margin-bottom: 20px;
      }

      #mp-reports h3 {
        font-size: 16px;
        line-height: 1.4;
        margin: 0 0 5px;
        color: inherit;
      }

      #mp-reports h4 {
        font-size: 13px;
        margin: 18px 0 8px;
        color: inherit;
      }

      #mp-reports .mr-coverage {
        display: flex;
        gap: 24px;
        align-items: center;
        margin: 22px 0 15px;
      }

      #mp-reports .mr-donut {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        background: conic-gradient(
          #00a685 calc(var(--pct) * 1%),
          #dfece7 0
        );
      }

      #mp-reports .mr-donut-hole {
        width: 116px;
        height: 116px;
        border-radius: 50%;
        background: var(--surface, #fff);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      #mp-reports .mr-donut strong {
        font-size: 28px;
        line-height: 1.2;
      }

      #mp-reports .mr-donut small {
        font-size: 11px;
        color: var(--muted, #68807a);
        margin-top: 5px;
      }

      #mp-reports .mr-legend {
        flex: 1;
        min-width: 0;
      }

      #mp-reports .mr-legend-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        margin: 12px 0;
        align-items: center;
      }

      #mp-reports .mr-dot {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #00a685;
        margin-right: 8px;
      }

      #mp-reports .mr-dot.slate {
        background: #b9cbc5;
      }

      #mp-reports .mr-meter {
        height: 9px;
        border-radius: 6px;
        background: var(--surface-raised, #eaf1ee);
        overflow: hidden;
        display: flex;
        margin: 14px 0 8px;
      }

      #mp-reports .mr-meter span {
        display: block;
        height: 100%;
        background: #00a685;
      }

      #mp-reports .mr-meter .amber {
        background: #e5b75b;
      }

      #mp-reports .mr-row {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: center;
        margin: 17px 0 7px;
        font-size: 12px;
      }

      #mp-reports .mr-bar {
        height: 10px;
        background: var(--surface-raised, #edf2ef);
        border-radius: 6px;
        overflow: hidden;
      }

      #mp-reports .mr-bar span {
        display: block;
        height: 100%;
        background: var(--bar, #008c72);
        border-radius: 6px;
      }

      #mp-reports .mr-section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin: 24px 0 12px;
      }

      #mp-reports .mr-filters {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      #mp-reports .mr-filter {
        padding: 8px 12px;
        border-radius: 20px;
        border: 1px solid var(--line, #dce8e4);
        background: var(--surface, #fff);
        color: inherit;
        font-size: 12px;
      }

      #mp-reports .mr-filter.active {
        background: #006c57;
        color: #fff;
        border-color: #006c57;
      }

      #mp-reports .mr-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      #mp-reports .mr-action {
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-top: 3px solid var(--accent, #008c72);
      }

      #mp-reports .mr-action-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }

      #mp-reports .mr-index {
        display: grid;
        place-items: center;
        background: var(--surface-raised, #edf5f1);
        border-radius: 9px;
        font-size: 12px;
        font-weight: 700;
        width: 30px;
        height: 30px;
      }

      #mp-reports .mr-action p {
        font-size: 14px;
        line-height: 1.65;
        margin: 0;
        overflow-wrap: anywhere;
      }

      #mp-reports details {
        margin-top: 16px;
      }

      #mp-reports summary {
        cursor: pointer;
        font-size: 13px;
        font-weight: 650;
        line-height: 1.5;
      }

      #mp-reports details p,
      #mp-reports details li {
        font-size: 13px;
        line-height: 1.75;
        overflow-wrap: anywhere;
      }

      #mp-reports .mr-notice {
        border-left: 3px solid #d6a342;
        padding: 10px 13px;
        background: var(--surface-raised, #fbf6e9);
        border-radius: 0 8px 8px 0;
        margin-top: 14px;
        font-size: 12px;
        line-height: 1.6;
      }

      #mp-reports .mr-empty {
        text-align: center;
        padding: 40px 20px;
      }

      #mp-reports textarea {
        width: 100%;
        min-height: 180px;
        margin: 12px 0;
        padding: 12px;
        background: var(--surface-raised, #f5f8f6);
        color: inherit;
        border: 1px solid var(--line, #dce8e4);
        border-radius: 9px;
      }

      #mp-reports #mpr-status {
        font-size: 12px;
        color: var(--muted, #68807a);
        margin-bottom: 14px;
      }

      @media (max-width: 950px) {
        #mp-reports .mr-kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        #mp-reports .mr-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 620px) {
        #mp-reports .mr-actions {
          grid-template-columns: 1fr;
        }

        #mp-reports .mr-hero {
          padding: 21px;
          align-items: flex-start;
          flex-direction: column;
          gap: 16px;
        }

        #mp-reports .mr-card {
          padding: 17px;
        }

        #mp-reports .mr-coverage {
          gap: 15px;
        }

        #mp-reports .mr-donut {
          width: 120px;
          height: 120px;
        }

        #mp-reports .mr-donut-hole {
          width: 92px;
          height: 92px;
        }

        #mp-reports .mr-value {
          font-size: 29px;
        }
      }
    </style>

    <div class="mr-toolbar">
      <div class="mr-picker">
        <label for="mr-report">Laporan</label>
        <select id="mr-report" aria-label="Pilih laporan">
          <option>Belum dimuat</option>
        </select>
      </div>

      <button class="mr-button" type="button" id="mpr-refresh">
        ↻ Muat semula
      </button>
    </div>

    <p id="mpr-status" role="status">
      Buka tab Laporan CRM untuk memuat data.
    </p>

    <div id="mpr-list"></div>

    <details class="mr-card" id="mr-import">
      <summary>Import / tampal laporan JSON</summary>

      <p>
        Masukkan laporan sebenar. Satu item perubahan mewakili
        satu tindakan yang disahkan, bukan seorang pelanggan.
      </p>

      <input
        id="mpr-file"
        type="file"
        accept=".json,application/json"
        aria-label="Fail laporan JSON"
      >

      <textarea
        id="mpr-json"
        aria-label="Kandungan laporan JSON"
        placeholder="Tampal laporan JSON di sini"
      ></textarea>

      <button class="mr-button primary" id="mpr-save" type="button">
        Simpan laporan
      </button>

      <p id="mpr-save-status" role="status"></p>

      <p>
        <a href="reports/murpati-report-template.json" download>
          Template kosong
        </a>
      </p>
    </details>
  `;

  async function call(method, body) {
    const user = window.firebase?.auth?.().currentUser;

    if (!user) {
      throw Error('Sila login CRM dahulu');
    }

    const token = await user.getIdToken();

    const response = await fetch('/api/murpati/reports', {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    if (
      response.headers &&
      !(response.headers.get('content-type') || '').includes('json')
    ) {
      throw Error(
        'API laporan tidak memberikan JSON. Semak deployment.'
      );
    }

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw Error(data.error || 'Permintaan laporan gagal');
    }

    return data;
  }

  function visible() {
    const from = $('mp-from')?.value || '';
    const to = $('mp-to')?.value || '';

    return reports.filter(report => {
      const date = day(report.periodEnd);

      return (!from || date >= from) && (!to || date <= to);
    });
  }

  function render() {
    const rows = visible();

    if (!rows.some(report => report.id === selected)) {
      selected = rows[0]?.id || '';
    }

    $('mr-report').innerHTML = rows.length
      ? rows.map((report, index) => `
          <option value="${esc(report.id)}">
            ${esc(fmt(report.periodEnd))}${index === 0 ? ' · terkini' : ''}
          </option>
        `).join('')
      : '<option value="">Tiada laporan</option>';

    $('mr-report').value = selected;

    if (!rows.length) {
      $('mpr-list').innerHTML = `
        <div class="mr-card mr-empty">
          <h3>Belum ada laporan untuk julat ini</h3>
          <p class="mr-muted">
            Laporan yang disimpan akan muncul di sini.
            Cuba kosongkan penapis tarikh jika perlu.
          </p>
        </div>
      `;
      return;
    }

    const report = rows.find(item => item.id === selected);
    const coverage = report.coverage;

    const actions = report.staffActions || [];
    const changes = report.confirmedChanges || [];
    const failures = report.failures || [];

    const total = Number.isInteger(coverage.total)
      ? coverage.total
      : null;

    const percentage = total > 0
      ? Math.min(100, coverage.listed / total * 100)
      : total === 0
        ? 0
        : null;

    const remaining = total === null
      ? null
      : Math.max(0, total - coverage.listed);

    const listOnly = Math.max(
      0,
      coverage.listed - coverage.readFull
    );

    const partial =
      coverage.hasMore !== false ||
      coverage.filterTruncated !== false ||
      total === null ||
      coverage.listed < total;

    const counts = groups.map(name => ({
      name,
      count: actions.filter(text => group(text) === name).length
    }));

    const colors = [
      '#008c72',
      '#c28b27',
      '#588fb1',
      '#8b92a1'
    ];

    const kpi = (label, value, note, color) => `
      <div class="mr-card mr-kpi" style="--accent:${color}">
        <div class="mr-label">${esc(label)}</div>
        <div class="mr-value">${esc(value)}</div>
        <div class="mr-muted">${esc(note)}</div>
      </div>
    `;

    const actionHtml = actions
      .map((text, index) => ({
        text,
        index,
        kind: group(text)
      }))
      .filter(action =>
        category === 'Semua' || action.kind === category
      )
      .map(action => `
        <article
          class="mr-card mr-action"
          style="--accent:${colors[groups.indexOf(action.kind)]}"
        >
          <div class="mr-action-head">
            <span class="mr-index">
              ${String(action.index + 1).padStart(2, '0')}
            </span>

            <span class="mr-pill ${action.kind === groups[1] ? 'amber' : ''}">
              ${esc(action.kind)}
            </span>
          </div>

          <p>${esc(action.text)}</p>

          <span class="mr-muted">
            Tindakan staf diperlukan · belum dianggap selesai
          </span>
        </article>
      `)
      .join('');

    const fullReadPercentage = coverage.listed
      ? coverage.readFull / coverage.listed * 100
      : 0;

    const listOnlyPercentage = coverage.listed
      ? listOnly / coverage.listed * 100
      : 0;

    $('mpr-list').innerHTML = `
      <section class="mr-hero">
        <div>
          <div class="mr-eyebrow">
            YGROW FORMULA HQ · LAPORAN CRM
          </div>

          <h2>Gambaran semakan & tindakan</h2>

          <p>
            ${esc(fmt(report.periodStart))}
            →
            ${esc(fmt(report.periodEnd))} MYT
          </p>

          <p>
            Dijana ${esc(fmt(report.generatedAt))}
            · 601168185110
          </p>
        </div>

        <span class="mr-pill ${partial ? 'amber' : ''}">
          ${partial ? '◐ Liputan terhad' : '✓ Senarai lengkap'}
        </span>
      </section>

      <section class="mr-kpis" aria-label="Ringkasan semakan">
        ${kpi(
          'Chat disenaraikan',
          num(coverage.listed),
          total === null
            ? 'Jumlah padanan belum diketahui'
            : num(total) + ' jumlah padanan nombor',
          '#008c72'
        )}

        ${kpi(
          'Dibaca penuh',
          num(coverage.readFull),
          'Perbualan dibaca dalam run ini',
          '#588fb1'
        )}

        ${kpi(
          'Perubahan disahkan',
          num(changes.length),
          'Bilangan tindakan berjaya, bukan lead unik',
          '#008c72'
        )}

        ${kpi(
          'Tindakan staf',
          num(actions.length),
          'Perkara yang perlu disemak / dibantu',
          '#c28b27'
        )}
      </section>

      <section class="mr-grid">
        <article class="mr-card">
          <h3>Sejauh mana chat telah disenarai?</h3>

          <p class="mr-muted">
            Liputan senarai untuk nombor ini
          </p>

          <div class="mr-coverage">
            <div
              class="mr-donut"
              style="--pct:${percentage ?? 0}"
              role="img"
              aria-label="${esc(
                percentage === null
                  ? 'Jumlah keseluruhan belum diketahui'
                  : percentage.toFixed(1) + ' peratus padanan disenaraikan'
              )}"
            >
              <div class="mr-donut-hole">
                <strong>
                  ${percentage === null ? '—' : percentage.toFixed(1) + '%'}
                </strong>
                <small>disenaraikan</small>
              </div>
            </div>

            <div class="mr-legend">
              <div class="mr-legend-row">
                <span>
                  <i class="mr-dot"></i>Disenaraikan
                </span>
                <strong>${num(coverage.listed)}</strong>
              </div>

              <div class="mr-legend-row">
                <span>
                  <i class="mr-dot slate"></i>Belum disenaraikan
                </span>
                <strong>${num(remaining)}</strong>
              </div>

              <div class="mr-legend-row">
                <span>Jumlah padanan</span>
                <strong>${num(total)}</strong>
              </div>
            </div>
          </div>

          <div
            class="mr-meter"
            role="img"
            aria-label="${coverage.readFull} daripada ${coverage.listed} chat disenaraikan dibaca penuh dalam run ini"
          >
            <span style="width:${fullReadPercentage}%"></span>
            <span
              class="amber"
              style="width:${listOnlyPercentage}%"
            ></span>
          </div>

          <p class="mr-muted">
            ${num(coverage.readFull)} dibaca penuh
            · ${num(listOnly)} lain dalam senarai tidak dibaca
            penuh pada run ini.
          </p>

          <div class="mr-notice">
            Jumlah padanan merangkumi rekod nombor ini.
            Ia bukan jumlah lead baharu atau jumlah pelanggan
            membeli dalam tempoh laporan.
          </div>
        </article>

        <article class="mr-card">
          <h3>Fokus tindakan staf</h3>

          <p class="mr-muted">
            Bilangan catatan tindakan mengikut kategori
          </p>

          ${counts.map((item, index) => `
            <div class="mr-row">
              <span>${esc(item.name)}</span>
              <strong>${item.count}</strong>
            </div>

            <div class="mr-bar" style="--bar:${colors[index]}">
              <span style="width:${
                actions.length
                  ? item.count / actions.length * 100
                  : 0
              }%"></span>
            </div>
          `).join('')}

          <p class="mr-muted" style="margin-top:17px">
            Kategori membantu menyusun catatan berdasarkan teks
            laporan; bukan pengesahan punca pelanggan tidak membeli.
          </p>
        </article>
      </section>

      <div class="mr-section-head">
        <div>
          <h3>Apa yang staf perlu buat?</h3>
          <p class="mr-muted">
            Setiap kad mewakili satu catatan tindakan.
          </p>
        </div>

        <span class="mr-pill ${failures.length ? 'red' : ''}">
          ${
            failures.length
              ? failures.length + ' tindakan gagal / ditolak'
              : 'Tiada kegagalan direkodkan'
          }
        </span>
      </div>

      <div
        class="mr-filters"
        role="group"
        aria-label="Tapis tindakan"
      >
        ${['Semua', ...groups].map(name => `
          <button
            type="button"
            class="mr-filter ${category === name ? 'active' : ''}"
            data-mr-category="${esc(name)}"
          >
            ${esc(name)} · ${
              name === 'Semua'
                ? actions.length
                : counts.find(item => item.name === name).count
            }
          </button>
        `).join('')}
      </div>

      <section class="mr-actions">
        ${
          actionHtml ||
          '<div class="mr-card"><p class="mr-muted">Tiada catatan untuk kategori ini.</p></div>'
        }
      </section>

      <details class="mr-card">
        <summary>
          Butiran perubahan disahkan · ${changes.length}
        </summary>

        ${list('Perubahan yang direkodkan', changes)}

        <p class="mr-muted">
          Pengesahan berdasarkan laporan yang disimpan.
          Paparan ini tidak membuat perubahan pada lead.
        </p>
      </details>

      <details class="mr-card">
        <summary>
          Butiran liputan & batas data · ${(report.limitations || []).length}
        </summary>

        <p>
          has_more: ${esc(coverage.hasMore ?? 'Tidak diketahui')}
          · filter_truncated:
          ${esc(coverage.filterTruncated ?? 'Tidak diketahui')}
        </p>

        ${list('Kekangan / belum diketahui', report.limitations || [])}
      </details>

      ${
        failures.length
          ? `
            <details class="mr-card">
              <summary>
                Tindakan gagal / ditolak · ${failures.length}
              </summary>
              ${list('Butiran kegagalan', failures)}
            </details>
          `
          : ''
      }
    `;

    root.querySelectorAll('[data-mr-category]').forEach(button => {
      button.addEventListener('click', () => {
        category = button.dataset.mrCategory;
        render();
      });
    });
  }

  async function load() {
    const button = $('mpr-refresh');
    button.disabled = true;
    $('mpr-status').textContent = 'Memuat laporan...';

    try {
      const data = await call('GET');

      reports = (data.reports || []).sort((first, second) =>
        Date.parse(second.periodEnd) - Date.parse(first.periodEnd) ||
        Date.parse(second.generatedAt) - Date.parse(first.generatedAt)
      );

      render();

      $('mpr-status').textContent =
        `${reports.length} laporan dimuat · ` +
        `maksimum ${data.limit || 50} terkini · ` +
        'penapis menggunakan tarikh akhir tempoh MYT.';
    } catch (error) {
      $('mpr-status').textContent = 'Ralat: ' + error.message;
    } finally {
      button.disabled = false;
    }
  }

  $('mr-report').onchange = event => {
    selected = event.target.value;
    category = 'Semua';
    render();
  };

  $('mpr-refresh').onclick = load;

  $('mpr-file').onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      if (file.size > 250000) {
        throw Error('Maksimum 250KB');
      }

      $('mpr-json').value = await file.text();

      $('mpr-save-status').textContent =
        'Fail dimuat. Semak sebelum simpan.';
    } catch (error) {
      $('mpr-save-status').textContent = error.message;
    }
  };

  $('mpr-save').onclick = async () => {
    const button = $('mpr-save');
    button.disabled = true;

    try {
      const data = JSON.parse($('mpr-json').value);

      if (!confirm(
        'Simpan laporan ini? Pastikan perubahan mempunyai pengesahan tool.'
      )) {
        return;
      }

      const result = await call('POST', data);

      $('mpr-save-status').textContent = result.created
        ? 'Laporan berjaya disimpan.'
        : 'Laporan sama sudah disimpan; tiada pendua.';

      selected = result.id || selected;

      await load();
    } catch (error) {
      $('mpr-save-status').textContent = 'Ralat: ' + error.message;
    } finally {
      button.disabled = false;
    }
  };

  function select(reportTab) {
    root.hidden = !reportTab;
    $('mp-content').hidden = reportTab;
    $('mp-state').hidden = reportTab;

    if (reportTab) {
      load();
    }
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
    $(id)?.addEventListener('change', () => {
      category = 'Semua';
      render();
    });
  });

  $('mp-refresh')?.addEventListener('click', () => {
    if (!root.hidden) {
      load();
    }
  });
})();
