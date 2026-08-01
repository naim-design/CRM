// ============================================================
// FIREBASE CONFIG — GANTI dengan config projek Firebase awak
// ============================================================
// Cara dapatkan:
// 1. Pergi https://console.firebase.google.com -> Create Project
// 2. Dalam project, klik ikon "</>" (Add app -> Web)
// 3. Daftar nama app, copy firebaseConfig object yang diberi kat sini
// 4. Enable "Authentication" -> Sign-in method -> Email/Password
// 5. Enable "Firestore Database" -> Create database -> mode Production
// 6. Pergi Firestore -> Rules -> paste rules dari firestore.rules.txt (dalam folder ni)
// ============================================================

const firebaseConfig = {
  apiKey: "GANTI_API_KEY",
  authDomain: "GANTI_PROJECT.firebaseapp.com",
  projectId: "GANTI_PROJECT",
  storageBucket: "GANTI_PROJECT.appspot.com",
  messagingSenderId: "GANTI_SENDER_ID",
  appId: "GANTI_APP_ID"
};

// Init (guna Firebase v10 modular via CDN, lihat index.html/app.html untuk import)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
