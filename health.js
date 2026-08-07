module.exports = (req,res) => res.status(200).json({
  ok:true,
  service:'wabot-crm',
  firebaseAdminConfigured:!!process.env.FIREBASE_SERVICE_ACCOUNT,
  webhookKeyConfigured:!!process.env.WABOT_WEBHOOK_KEY
});
