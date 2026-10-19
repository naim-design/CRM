const OWNER = '601168185110';

function validateReport(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) {
    throw Error('Laporan mesti objek JSON');
  }

  if (
    x.devicePhone !== OWNER ||
    x.timezone !== 'Asia/Kuala_Lumpur'
  ) {
    throw Error('Nombor atau zon waktu tidak tepat');
  }

  for (const k of ['periodStart', 'periodEnd', 'generatedAt']) {
    if (
      typeof x[k] !== 'string' ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(x[k]) ||
      !Number.isFinite(Date.parse(x[k]))
    ) {
      throw Error('Tarikh ISO dengan zon waktu diperlukan: ' + k);
    }
  }

  if (Date.parse(x.periodEnd) <= Date.parse(x.periodStart)) {
    throw Error('Tempoh laporan tidak sah');
  }

  const count = v => Number.isInteger(v) && v >= 0;
  const c = x.coverage;

  if (
    !c ||
    !count(c.listed) ||
    !count(c.readFull) ||
    c.readFull > c.listed
  ) {
    throw Error('Liputan listed/readFull tidak sah');
  }

  if (
    c.total !== null &&
    (!count(c.total) || c.total < c.listed)
  ) {
    throw Error('total mesti null atau jumlah yang sah');
  }

  for (const k of ['hasMore', 'filterTruncated']) {
    if (![true, false, null].includes(c[k])) {
      throw Error(k + ' mesti true, false atau null');
    }
  }

  for (const k of [
    'confirmedChanges',
    'staffActions',
    'limitations',
    'failures'
  ]) {
    if (
      !Array.isArray(x[k]) ||
      x[k].length > 300 ||
      x[k].some(v =>
        typeof v !== 'string' ||
        !v.trim() ||
        v.length > 1500
      )
    ) {
      throw Error(k + ' mesti senarai teks, maksimum 300 item');
    }
  }

  return {
    schemaVersion: 1,
    devicePhone: OWNER,
    timezone: x.timezone,
    periodStart: x.periodStart,
    periodEnd: x.periodEnd,
    generatedAt: x.generatedAt,
    coverage: {
      listed: c.listed,
      readFull: c.readFull,
      total: c.total,
      hasMore: c.hasMore,
      filterTruncated: c.filterTruncated
    },
    confirmedChanges: x.confirmedChanges,
    staffActions: x.staffActions,
    limitations: x.limitations,
    failures: x.failures
  };
}

module.exports = { validateReport };
