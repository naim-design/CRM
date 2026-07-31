

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC6b4NzGYiq6qFgv-V9PzxZX-ViisBkFo0",
  authDomain: "crm-team-52d2b.firebaseapp.com",
  projectId: "crm-team-52d2b",
  storageBucket: "crm-team-52d2b.firebasestorage.app",
  messagingSenderId: "774265969136",
  appId: "1:774265969136:web:0e9e42558d60425734a535",
  measurementId: "G-ZBL0VLDVFN"
};

// Init (guna Firebase v10 modular via CDN, lihat index.html/app.html untuk import)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
