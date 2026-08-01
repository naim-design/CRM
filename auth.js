// ============================================================
// AUTH LOGIC — Login / Daftar / Reset Password
// ============================================================

const screens = {
  login: document.getElementById('screen-login'),
  register: document.getElementById('screen-register'),
  reset: document.getElementById('screen-reset'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  document.querySelectorAll('.auth-error').forEach(e => e.classList.remove('show'));
}

// ---- Theme toggle (dark/light) ----
function applyThemeIcon() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.getElementById('theme-toggle').textContent = isLight ? '☀️' : '🌙';
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }
  applyThemeIcon();
});
applyThemeIcon();

document.getElementById('go-register').onclick = (e) => { e.preventDefault(); showScreen('register'); };
document.getElementById('go-login').onclick = (e) => { e.preventDefault(); showScreen('login'); };
document.getElementById('go-login-2').onclick = (e) => { e.preventDefault(); showScreen('login'); };
document.getElementById('go-reset').onclick = (e) => { e.preventDefault(); showScreen('reset'); };

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

function friendlyError(err) {
  const map = {
    'auth/invalid-email': 'Format email tak sah.',
    'auth/user-not-found': 'Email tak berdaftar.',
    'auth/wrong-password': 'Password salah.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/email-already-in-use': 'Email ni dah didaftarkan.',
    'auth/weak-password': 'Password terlalu pendek (minimum 6 aksara).',
    'auth/too-many-requests': 'Terlalu banyak percubaan. Cuba lagi sekejap.',
  };
  return map[err.code] || err.message;
}

// ---- Login ----
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Log masuk...';
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    window.location.href = 'app.html';
  } catch (err) {
    showError('login-error', friendlyError(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Log Masuk';
  }
});

// ---- Register ----
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Mendaftar...';
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-password').value;
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    // Simpan profile dalam Firestore. Role default 'staff' — admin boleh naikkan
    // taraf ke 'admin' terus dalam Firestore console (koleksi users -> field role).
    await db.collection('users').doc(cred.user.uid).set({
      name, email, role: 'staff', status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    window.location.href = 'app.html';
  } catch (err) {
    showError('register-error', friendlyError(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Daftar Sekarang';
  }
});

// ---- Reset password ----
document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Menghantar...';
  const email = document.getElementById('reset-email').value.trim();
  try {
    await auth.sendPasswordResetEmail(email);
    showError('reset-error', 'Link reset dah dihantar. Sila semak email anda.');
    document.getElementById('reset-error').style.color = 'var(--mint)';
    document.getElementById('reset-error').style.background = 'var(--mint-dim)';
  } catch (err) {
    showError('reset-error', friendlyError(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Hantar Link Reset';
  }
});

// ---- If already logged in, redirect straight to app ----
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'app.html';
});
