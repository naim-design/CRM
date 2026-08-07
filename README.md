# WA Blasting Control Room — App

App live untuk team blasting: staff log masuk, isi entri harian, dashboard auto-update, urus kontak.

**Stack**: HTML/JS biasa + Firebase (Auth + Firestore). Tak perlu build step (npm/webpack) — terus boleh deploy.

---

## Setup (± 10 minit)

### 1. Buat Firebase Project
1. Pergi https://console.firebase.google.com → **Add project** → beri nama (cth: `mamariam-blasting`)
2. Dalam project, klik ikon **`</>`** (Add app → Web) → daftar nama app → **jangan** tick "Firebase Hosting" (kita guna Vercel)
3. Firebase akan bagi kod `firebaseConfig` — **copy semua**

### 2. Isi config dalam app
1. Buka fail `js/firebase-config.js`
2. Ganti bahagian `GANTI_...` dengan nilai sebenar dari Firebase (apiKey, authDomain, projectId, dll)

### 3. Enable Authentication
1. Firebase Console → **Authentication** → **Get started**
2. Sign-in method → enable **Email/Password**

### 4. Enable Firestore Database
1. Firebase Console → **Firestore Database** → **Create database**
2. Pilih mode **Production**, pilih region terdekat (cth: `asia-southeast1` Singapore)
3. Pergi tab **Rules** → padam semua → paste kandungan fail `firestore.rules.txt` → **Publish**

### 5. Jadikan akaun pertama sebagai Admin
Role default bila daftar akaun baru ialah `staff`. Untuk naikkan ke admin:
1. Daftar akaun awak dulu dalam app (Daftar Akaun Baru)
2. Firebase Console → Firestore Database → koleksi `users` → cari doc dengan email awak
3. Edit field `role` dari `staff` → `admin` → Save

---

## Deploy ke Vercel (percuma)

1. Pergi https://vercel.com → Sign up/login (boleh guna akaun GitHub)
2. **Add New → Project → Import** — upload folder ni terus (drag & drop) atau push ke GitHub repo dulu
3. Vercel akan detect ni static site — tak perlu ubah apa-apa setting build
4. **Deploy** — dalam beberapa saat dapat link macam `xxx.vercel.app`

Boleh juga guna **Firebase Hosting** kalau nak (`firebase deploy` selepas `firebase init hosting`), tapi Vercel lagi senang untuk static files macam ni.

---

## Struktur Data (Firestore)

**`users/{uid}`**
```
{ name, email, role: "admin" | "staff", status, createdAt }
```

**`entries/{id}`** — satu entri = satu rekod blast harian
```
{ staffId, staffName, tarikh, source, template, sent, delivered, read, reply, failed, buyer, sales, createdAt }
```

**`contacts/{id}`**
```
{ name, phone, source, status: "pending" | "blasted", createdAt }
```

---

## Apa yang ada sekarang

- ✅ Login / Daftar / Reset Password (Firebase Auth)
- ✅ Input Data — staff isi entri blast harian
- ✅ Dashboard live — funnel, breakdown sumber, laporan template (auto-kira dari data sebenar)
- ✅ Filter dashboard ikut tarikh & staff
- ✅ Kontak — tambah, cari, filter status, toggle Blasted/Pending, pagination

## Boleh tambah lepas ni (bagitahu saya kalau nak)

- Import kontak dari CSV/Excel sekali gus
- Export laporan ke CSV
- Bahagian "Product Knowledge" & "Strategic Monthly" (editable notes)
- Kawalan akses admin-only untuk padam data / urus staff
- Nombor & SIM tracking (macam WA Leads Tracker asal)

---

## Nota Keselamatan

Rules Firestore yang disertakan (`firestore.rules.txt`) benarkan **semua user yang log masuk** baca & tulis semua data — sesuai untuk tool internal team kecil. Kalau team lebih besar dan nak had staff biasa dari edit/padam data staff lain, bagitahu saya — saya boleh ketatkan rules ikut role.

## V2 — Wabot Live Add-on
Tab lama dan collection lama dikekalkan. Modul tambahan: Wabot Live, Analytics Pro, Campaign Manager dan AI Insight. Lihat `WABOT_SETUP.md` untuk setup webhook.
