CRM CAMPAIGN LINKER V6
======================

Replace:
- app.html
- js/app.js

Apa baru:
1. Campaign Linker dalam Campaign Manager.
2. Pilih Tarikh Wabot + Akaun/Instance + rekod CRM.
3. Tekan Link Campaign.
4. Mapping disimpan dalam Firestore collection: campaignMappings.
5. Event pada tarikh + instance tersebut akan menggunakan Manual Link (confidence 100%).
6. Buyer, Sales, Conversion Rate dan ROAS menggunakan rekod CRM yang dilink.
7. Smart Matching V5 masih kekal sebagai fallback.
8. Ada butang Buang Link.

PENTING FIRESTORE RULES:
Jika rules semasa hanya allow collection tertentu, tambah campaignMappings.
Contoh dalam match /databases/{database}/documents:
match /campaignMappings/{docId} {
  allow read, write: if request.auth != null;
}

Selepas replace:
- Commit GitHub
- Tunggu Vercel Ready
- Hard refresh Ctrl+Shift+R
- Campaign Manager > Campaign Linker
