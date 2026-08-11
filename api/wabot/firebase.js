const admin = require('firebase-admin');

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const parsed = JSON.parse(raw);
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return admin.credential.cert(parsed);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }
  return null;
}

function firebaseReady() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
  );
}

function getDb() {
  if (!admin.apps.length) {
    const credential = getCredential();
    if (!credential) throw new Error('Firebase Admin credentials belum dikonfigurasi');
    admin.initializeApp({ credential });
  }
  return admin.firestore();
}

module.exports = { admin, getDb, firebaseReady };
