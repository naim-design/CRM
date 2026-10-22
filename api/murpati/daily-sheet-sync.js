
'use strict';

// V141 - MURPATI GOOGLE SHEETS -> FIRESTORE
// Google Sheets date format: MM/DD/YYYY
//
// A  = Tarikh
// P  = Kos Ads sebelum SST
// Q  = Kos Ads termasuk SST
// S  = Link Clicks
// T  = Jumlah Leads
// X  = Jumlah Customer
// AB = Total Sales

const crypto = require('node:crypto');
const { getDb } = require('../wabot/firebase');

const VERSION = 'V141';

const TAB =
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
    private_key:
      process.env.FIREBASE_PRIVATE_KEY?.replace(
        /\\n/g,
        '\n'
      )
  };
}

function b64(value) {
  return Buffer.from(
    typeof value === 'string'
      ? value
      : JSON.stringify(value)
  ).toString('base64url');
}

async function getToken(c) {
  if (!c.client_email || !c.private_key) {
    throw new Error('Service account missing');
  }

  const now = Math.floor(Date.now() / 1000);

  const header = b64({
    alg: 'RS256',
    typ: 'JWT'
  });

  const payload = b64({
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
      (data.error_description ||
        data.error ||
        response.status)
    );
  }

  return data.access_token;
}

function num(value) {
  const n = Number(
    String(value ?? '')
      .replace(/[,RM\s]/g, '')
  );

  return Number.isFinite(n) ? n : 0;
}

function formatDate(year, month, day) {
  const d = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function parseDate(value) {
  const text = String(value ?? '').trim();

  // YYYY-MM-DD
  let m = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (m) {
    return formatDate(
      Number(m[1]),
      Number(m[2]),
      Number(m[3])
    );
  }

  // MM/DD/YYYY - Google Sheets format
  m = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (m) {
    return formatDate(
      Number(m[3]),
      Number(m[1]),
      Number(m[2])
    );
  }

  return null;
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
    const id =
      process.env.GOOGLE_SHEETS_MURPATI_ID;

    if (!id) {
      throw new Error(
        'GOOGLE_SHEETS_MURPATI_ID missing'
      );
    }

    const c = credentials();
    const token = await getToken(c);

    const range = encodeURIComponent(
      "'" + TAB.replace(/'/g, "''") + "'!A1:AB500"
    );

    const url =
      'https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(id) +
      '/values/' +
      range +
      '?valueRenderOption=FORMATTED_VALUE';

    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(
        data.error?.message ||
        'Google Sheets API error'
      );

      error.status = response.status;
      error.code = 'SHEETS_API_ERROR';

      throw error;
    }

    const rows = data.values || [];

    const headerFound = rows
      .slice(0, 4)
      .some(row =>
        row.some(cell =>
          /LEADS\s+MURPATI/i.test(
            String(cell || '')
          )
        )
      );

    if (!headerFound) {
      return res.status(422).json({
        ok: false,
        version: VERSION,
        code: 'HEADER_NOT_FOUND',
        error: 'LEADS MURPATI header not found'
      });
    }

    const valid = [];
    const invalidDates = [];
    let skipped = 0;

    for (let i = 4; i < rows.length; i++) {
      const r = rows[i] || [];

      if (!r[16] && !r[15]) {
        continue;
      }

      const date = parseDate(r[0]);

      if (!date) {
        invalidDates.push({
          row: i + 1,
          value: String(r[0] ?? '').slice(0, 40)
        });

        skipped++;
        continue;
      }

      const spend = num(r[16]);
      const spendBeforeSst = num(r[15]);
      const clicks = num(r[18]);
      const leads = num(r[19]);
      const buyers = num(r[23]);
      const sales = num(r[27]);

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

    if (invalidDates.length) {
      console.error(
        '[murpati-sheet-sync] INVALID_DATES',
        JSON.stringify(invalidDates.slice(0, 20))
      );

      return res.status(422).json({
        ok: false,
        version: VERSION,
        code: 'INVALID_SHEET_DATES',
        invalidDates: invalidDates.slice(0, 20),
        skipped
      });
    }

    if (!valid.length) {
      return res.status(422).json({
        ok: false,
        version: VERSION,
        code: 'NO_VALID_ROWS',
        rowsRead: rows.length,
        skipped
      });
    }

    // Avoid silent overwrite from duplicate dates.
    const seen = new Set();
    const duplicates = [];

    for (const record of valid) {
      if (seen.has(record.date)) {
        duplicates.push(record.date);
      }

      seen.add(record.date);
    }

    if (duplicates.length) {
      return res.status(422).json({
        ok: false,
        version: VERSION,
        code: 'DUPLICATE_DATES',
        dates: [...new Set(duplicates)]
      });
    }

    const db = getDb();
    const batch = db.batch();

    for (const record of valid) {
      batch.set(
        db.collection('murpatiAdDaily')
          .doc(record.date),
        record,
        { merge: true }
      );
    }

    await batch.commit();

    const summary = {
      version: VERSION,
      updated: valid.length,
      skipped,
      firstDate: valid[0].date,
      lastDate: valid[valid.length - 1].date
    };

    console.info(
      '[murpati-sheet-sync] success',
      JSON.stringify(summary)
    );

    return res.status(200).json({
      ok: true,
      ...summary,
      rowsRead: rows.length,
      range: TAB + '!A1:AB500',
      dates: valid.map(r => r.date)
    });

  } catch (error) {
    const code = error.code || 'SYNC_ERROR';
    const status = error.status || 500;

    console.error(
      '[murpati-sheet-sync] error',
      JSON.stringify({
        version: VERSION,
        code,
        status,
        message: error.message
      })
    );

    return res.status(status).json({
      ok: false,
      version: VERSION,
      code,
      error: error.message
    });
  }
};
