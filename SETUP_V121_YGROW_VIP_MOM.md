# CRM V121 — YGROW VIP MOM auto-sync

## 1. GitHub / Vercel
Upload **all files from this ZIP** (including `api/ygrow-vip-mom.js` and `package.json`) to the same root of the `naim-design/CRM` repository. Vercel must deploy the repository root as the project root. The `api` directory uses Vercel Node.js Functions. Do not upload `.gs` as a public web asset if it contains any secrets (the supplied file contains no secrets).

## 2. Vercel environment variables (Settings → Environment Variables)
- **Keep** existing `FIREBASE_SERVICE_ACCOUNT` JSON secret as-is. This is read by the new API. Do not copy it into GitHub or Apps Script.
- **Keep** existing `WABOT_WEBHOOK_KEY` as-is. It is unrelated to this integration.
- **Add** `YGROW_FORM_SYNC_SECRET`: a strong random shared secret (32+ random bytes). Store only in Vercel and Apps Script Script Properties.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are **not needed** when `FIREBASE_SERVICE_ACCOUNT` is valid JSON with `project_id`, `client_email`, and `private_key`.

Set the new secret for Production and redeploy. Do not share secrets in chat/screenshots. Do not change Firestore security rules for this integration.

## 3. Google Sheets Apps Script
Open the existing **response spreadsheet** → Extensions → Apps Script. The script project must be bound to this spreadsheet for the install function to work. If the existing project `YGROW Customer Feedback HQ` is bound to a different file or standalone, add the code in the response spreadsheet's Apps Script project instead; the form and response sheet stay unchanged. Paste functions from `YGROW_VIP_MOM_APPS_SCRIPT.gs`. In Project Settings → Script Properties set:
- `YGROW_SYNC_URL`: `https://crm-xjd6.vercel.app/api/ygrow-vip-mom`
- `YGROW_SYNC_SECRET`: same value as Vercel environment variable.

Run `installYgrowVipMomTrigger` once, authorize requested permissions. This installs a spreadsheet `On form submit` trigger. **Do not run `ygrowVipMomOnSubmit` manually**; it needs the submit event object.

## 4. Test safely
Submit one TEST response using the public Google Form with a unique test phone number. Check Apps Script Executions status and Vercel Functions logs. In CRM → Servicing YGROW verify a new record with `Menunggu Pengesahan` and correct values. Submit same number again; API returns `exists`, preserving HQ edits. Delete test record manually only after confirming it is test data.

## Important
- Existing records are **not deleted or overwritten**. The endpoint writes only on new form submissions.
- CSV import remains available as fallback; avoid simultaneously importing the same new responses.
- Old Google Form responses are **not backfilled automatically**. Use CSV import once for old entries, then rely on live sync for new ones.
- The existing `ygrowServiceCustomers` collection may contain sensitive child/parent information. Restrict staff access using Firebase Authentication/Firestore Rules; server writes bypass client rules. This patch does not itself implement staff role restrictions.
- No automatic WhatsApp messages are sent. Follow-ups are managed in CRM.
- The endpoint accepts all original form fields and stores consent answers separately; do not interpret them as automatic permission to publish testimonials.
