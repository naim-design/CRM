const { admin, getDb } = require('../wabot/firebase');
const { validateReport } = require('../../lib/murpati-report-schema');
const crypto = require('node:crypto');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');

  if (!match) {
    return res.status(401).json({
      ok: false,
      error: 'Sila login CRM dahulu'
    });
  }

  try {
    const db = getDb();
    let identity;

    try {
      identity = await admin.auth().verifyIdToken(match[1], true);
    } catch {
      return res.status(401).json({
        ok: false,
        error: 'Sesi tamat. Sila login semula.'
      });
    }

    const profile = await db.collection('users').doc(identity.uid).get();

    if (!profile.exists || profile.data().status !== 'active') {
      return res.status(403).json({
        ok: false,
        error: 'Akaun staf aktif diperlukan'
      });
    }

    const collection = db.collection('murpatiReports');

    if (req.method === 'GET') {
      const snapshot = await collection
        .orderBy('periodEnd', 'desc')
        .limit(50)
        .get();

      return res.json({
        ok: true,
        reports: snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })),
        limit: 50
      });
    }

    const raw = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});

    if (Buffer.byteLength(raw) > 250000) {
      return res.status(413).json({
        ok: false,
        error: 'Maksimum 250KB'
      });
    }

    let report;

    try {
      report = validateReport(
        typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body
      );
    } catch (e) {
      return res.status(400).json({
        ok: false,
        error: e.message
      });
    }

    const id = crypto
      .createHash('sha256')
      .update(JSON.stringify(report))
      .digest('hex');

    const ref = collection.doc(id);

    const created = await db.runTransaction(async tx => {
      const existing = await tx.get(ref);

      if (existing.exists) return false;

      tx.set(ref, {
        ...report,
        savedBy: identity.uid,
        savedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return true;
    });

    return res.json({ ok: true, id, created });
  } catch (e) {
    console.error('Murpati reports:', e.code || 'server_error');

    return res.status(500).json({
      ok: false,
      error: 'Laporan tidak dapat diproses. Semak konfigurasi Firebase Admin di Vercel.'
    });
  }
};
