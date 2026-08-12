const { firebaseReady } = require('./firebase');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Method not allowed' });
  return res.status(200).json({
    ok: true,
    service: 'wabot-webhook',
    firebaseReady: firebaseReady(),
    webhookKeyReady: Boolean(process.env.WABOT_WEBHOOK_KEY),
    now: new Date().toISOString()
  });
};
