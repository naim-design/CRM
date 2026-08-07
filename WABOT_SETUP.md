# Wabot Live — Setup Ringkas

Modul ini **tidak mengubah collection lama** (`entries`, `contacts`, `todos`, dll). Webhook hanya menulis ke collection baru `wabotEvents` dan `wabotWebhookMeta`.

## 1) Deploy project ini ke Vercel
Deploy folder/project seperti biasa. Selepas deploy, semak URL:

`https://DOMAIN-ANDA/api/wabot/health`

Ia perlu pulangkan JSON dengan `ok: true`.

## 2) Firebase Admin Service Account
Firebase Console → Project Settings → Service accounts → **Generate new private key**.

Di Vercel → Project → Settings → Environment Variables, tambah:

- `FIREBASE_SERVICE_ACCOUNT` = paste keseluruhan kandungan JSON service-account.
- `WABOT_WEBHOOK_KEY` = secret panjang ciptaan sendiri, contoh `mamariam_wabot_2026_xxx...`.

Jangan letakkan dua nilai ini dalam `app.html`, `firebase-config.js`, GitHub public atau screenshot.

Selepas tambah env vars, **Redeploy**.

## 3) Firestore Rules
Firebase Console → Firestore Database → Rules.
Copy kandungan `firestore.rules.txt` dalam project ini dan Publish.

Rules baru membenarkan user CRM yang login membaca `wabotEvents`, tetapi browser tidak boleh menulis event palsu. Backend Firebase Admin sahaja yang menulis.

## 4) Wabot
Wabot → REST API → `POST Set Receiving Webhook`.

Isi:

- `webhook_url`: `https://DOMAIN-ANDA/api/wabot/webhook?key=SECRET-ANDA`
- `enable`: `true`

Kemudian Send Request.

## 5) Test
Hantar satu mesej masuk ke nombor WhatsApp instance Wabot dan satu mesej keluar dari Wabot.
Buka CRM → tab **Wabot Live**.

> Penting: format payload Wabot sebenar mungkin berbeza mengikut instance/event. Backend ini sengaja simpan `raw` payload dan normalize field umum. Selepas test pertama, semak event di Wabot Live / Firestore dan kita boleh refine mapping jika perlu.

## Keselamatan
Jika Access Token Wabot pernah terpapar dalam screenshot/chat, rotate/regenerate token sebelum production.
