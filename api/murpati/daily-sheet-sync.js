
'use strict';

// V140 - Google Sheets -> Firestore Murpati
// Kolum A  = Tarikh
// Kolum P  = Kos Ads sebelum SST
// Kolum Q  = Kos Ads termasuk SST
// Kolum S  = Link Clicks
// Kolum T  = Jumlah Leads
// Kolum X  = Jumlah Customer / Buyer
// Kolum AB = Jumlah Sales

const crypto = require('node:crypto');
const { getDb } = require('../wabot/firebase');

const tab =
  process.env.GOOGLE_SHEETS_MURPATI_TAB ||
  'WABOT & CRM';

function credentials() {
  if (process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT) {
    return JSON.parse(
      process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT
    );
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    );
  }

  return {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY
      ?.replace(/\\n/g, '\n')
  };
}

function base64url(value) {
  return Buffer.from(
    typeof value === 'string'
      ? value
      : JSON.stringify(value)
  ).toString('base64url');
}

async function getGoogleToken(c) {
  if (!c.client_email || !c.private_key) {
    throw new Error('Service account missing');
  }

  const now = Math.floor(Date.now() / 1000);

  const header = base64url({
    alg: 'RS256',
    typ: 'JWT'
  });

  const payload = base64url({
    iss: c.client_email,
    scope:
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3500
  });

  const unsigned = header + '.' + payload;

  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(unsigned),
    c.private_key.replace(/\\n/g, '\n')
  ).toString('base64url');

  const response = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type:
          'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: unsigned + '.' + signature
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      'Google OAuth gagal: ' +
      (data.error || response.status)
    );
  }

  return data.access_token;
}

function numberValue(value) {
  const result = Number(
    String(value ?? '')
      .replace(/[,RM\s]/g, '')
  );

  return Number.isFinite(result) ? result : 0;
}

function validDate(year, month, date) {
  const d = new Date(
    Date.UTC(year, month - 1, date)
  );

  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === date
  );
}

function formatDate(year, month, date) {
  if (!validDate(year, month, date)) {
    return null;
  }

  return (
    String(year).padStart(4, '0') +
    '-' +
    String(month).padStart(2, '0') +
    '-' +
    String(date).padStart(2, '0')
  );
}

function parseDate(value) {
  const text = String(value ?? '').trim();

  let match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (match) {
    return formatDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);

  // Format Malaysia DD/MM/YYYY.
  // Jika nilai kedua > 12, format sumber
  // semestinya MM/DD/YYYY.
  const month = second > 12 ? first : second;
  const date = second > 12 ? second : first;

  return formatDate(year, month, date);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'GET only'
    });
  }

  if (
    !process.env.CRON_SECRET ||
    req.headers.authorization !==
      'Bearer ' + process.env.CRON_SECRET
  ) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized'
    });
  }

  try {
    const spreadsheetId =
      process.env.GOOGLE_SHEETS_MURPATI_ID;

    if (!spreadsheetId) {
      throw new Error(
        'GOOGLE_SHEETS_MURPATI_ID belum ditetapkan'
      );
    }

    const c = credentials();
    const accessToken = await getGoogleToken(c);

    console.info(
      '[murpati-sheet-sync] auth',
      JSON.stringify({
        serviceAccountEmail: c.client_email,
        credentialSource:
          process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT
            ? 'GOOGLE_SHEETS_SERVICE_ACCOUNT'
            : process.env.FIREBASE_SERVICE_ACCOUNT
              ? 'FIREBASE_SERVICE_ACCOUNT'
              : 'FIREBASE_CLIENT_EMAIL'
      })
    );

    const range = encodeURIComponent(
      "'" + tab.replace(/'/g, "''") + "'!A1:AB500"
    );

    const url =
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(spreadsheetId) +
      '/values/' +
      range +
      '?valueRenderOption=FORMATTED_VALUE';

    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + accessToken
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const status = response.status;

      const code =
        status === 403
          ? 'SHEETS_ACCESS_DENIED'
          : status === 404
            ? 'SHEET_NOT_FOUND'
            : status === 400
              ? 'SHEET_RANGE_INVALID'
              : 'SHEETS_API_ERROR';

      console.error(
        '[murpati-sheet-sync] sheets-error',
        JSON.stringify({
          code,
          status,
          googleMessage: String(
            data.error?.message || ''
          ).slice(0, 700),
          googleStatus: data.error?.status || null
        })
      );

      const error = new Error(
        'Google Sheets API HTTP ' +
        status +
        ' (' +
        code +
        ')'
      );

      error.status = status;
      error.code = code;

      throw error;
    }

    const rows = data.values || [];

    const headerFound = rows
      .slice(0, 4)
      .some(row =>
        (row || []).some(cell =>
          /LEADS\s+MURPATI/i.test(
            String(cell || '')
          )
        )
      );

    if (!headerFound) {
      throw new Error(
        'Tajuk LEADS MURPATI tidak dijumpai'
      );
    }

    const valid = [];
    const invalidDates = [];
    let skipped = 0;

    for (let i = 4; i < rows.length; i++) {
      const r = rows[i] || [];

      // Kolum Q atau P mesti mempunyai nilai.
      if (!r[16] && !r[15]) {
        continue;
      }

      const date = parseDate(r[0]);

      if (!date) {
        skipped++;

        invalidDates.push({
          row: i + 1,
          value: String(r[0] ?? '').slice(0, 40)
        });

        continue;
      }

      const spend = numberValue(r[16]);
      const spendBeforeSst = numberValue(r[15]);
      const clicks = numberValue(r[18]);
      const leads = numberValue(r[19]);
      const buyers = numberValue(r[23]);
      const sales = numberValue(r[27]);

      if (
        spend <= 0 ||
        sales < 0 ||
        leads < 0 ||
        buyers < 0
      ) {
        skipped++;
        continue;
      }

      valid.push({
        date,
        sourceRow: i + 1,
        spend,
        spendBeforeSst,
        clicks,
        leads,
        buyers,
        sales,
        source: 'google_sheets_fadzli',
        updatedAt: new Date().toISOString()
      });
    }

    if (!valid.length) {
      return res.status(422).json({
        ok: false,
        code: 'NO_VALID_ROWS',
        error: 'Tiada baris sah untuk sync',
        skipped,
        rowsRead: rows.length,
        invalidDates: invalidDates.slice(0, 10)
      });
    }

    // Hentikan sync jika tarikh tidak sah.
    // Elakkan dashboard menerima data separa.
    if (invalidDates.length) {
      return res.status(422).json({
        ok: false,
        code: 'INVALID_SHEET_DATES',
        error:
          'Ada tarikh Google Sheets yang tidak sah',
        invalidDates: invalidDates.slice(0, 20),
        skipped
      });
    }

    const db = getDb();
    const batch = db.batch();

    for (const record of valid) {
      const ref = db
        .collection('murpatiAdDaily')
        .doc(record.date);

      batch.set(ref, record, {
        merge: true
      });
    }

    await batch.commit();

    console.info(
      '[murpati-sheet-sync] success',
      JSON.stringify({
        updated: valid.length,
        skipped,
        firstDate: valid[0]?.date,
        lastDate: valid[valid.length - 1]?.date
      })
    );

    return res.status(200).json({
      ok: true,
      version: 'V140',
      updated: valid.length,
      skipped,
      rowsRead: rows.length,
      range: tab + '!A1:AB500',
      dates: valid.map(x => x.date)
    });

  } catch (error) {
    const code = error.code || 'SYNC_ERROR';
    const status = error.status || 500;

    console.error(
      '[murpati-sheet-sync]',
      JSON.stringify({
        code,
        status,
        message: error.message
      })
    );

    return res.status(status).json({
      ok: false,
      code,
      error: error.message
    });
  }
};
