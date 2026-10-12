// V120: Server-only Google Form -> Firestore sync. Never expose these environment secrets in frontend.
const crypto = require('node:crypto');
const admin = require('firebase-admin');

function getAdmin() {
  if (!admin.apps.length) {
    // Prefer the existing Vercel FIREBASE_SERVICE_ACCOUNT JSON secret.
    // Retain compatibility with separate credentials if already configured.
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    let credentials;
    if (serviceAccountJson) {
      try {
        credentials = JSON.parse(serviceAccountJson);
      } catch (_) {
        throw Error('FIREBASE_SERVICE_ACCOUNT must be valid service-account JSON');
      }
      if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
        throw Error('FIREBASE_SERVICE_ACCOUNT is missing required credential fields');
      }
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      if (!projectId || !clientEmail || !privateKey) {
        throw Error('Firebase Admin environment not configured');
      }
      credentials = {project_id: projectId, client_email: clientEmail, private_key: privateKey};
    }
    admin.initializeApp({credential: admin.credential.cert(credentials)});
  }
  return admin.firestore();
}
const str = x => String(x ?? '').trim();
function normalizePhone(value) {
  let p = str(value).replace(/\D/g,'');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '60'+p.slice(1);
  if (/^1\d{8,10}$/.test(p)) p = '60'+p;
  return /^60\d{8,11}$/.test(p) ? p : '';
}
function parseDate(v) {
  const s=str(v); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
}
function mapRow(raw) {
  const fields=Object.entries(raw||{}).map(([k,v])=>[str(k).toLowerCase(),str(Array.isArray(v)?v[0]:v)]);
  const get = needle => (fields.find(([k])=>k.includes(needle.toLowerCase()))||[])[1]||'';
  const phone=normalizePhone(get('Nombor WhatsApp'));
  const h=Number(get('Ketinggian sebelum').replace(',','.'));
  const height=Number.isFinite(h)&&h>0&&h<250?h:null;
  return {phone,name:get('Nama penuh ibu'),childName:get('Nama anak'),childAge:get('Umur anak'),childGender:get('Jantina anak'),state:get('Negeri'),relationship:get('Hubungan dengan anak'),boxes:get('Bilangan kotak'),startDate:parseDate(get('Tarikh mula anak')),before:height,beforeKnown:height!==null,baselineDate:parseDate(get('Tarikh ketinggian awal')),childWeight:get('Berat anak'),tried:get('Adakah anak sudah mencuba'),feel:get('Bagaimana penerimaan anak'),routine:get('Bagaimana rutin'),feedback:get('Pengalaman atau komen awal'),consentProgram:get('Saya ibu/bapa/penjaga'),consentData:get('Saya telah membaca notis'),consentInternal:get('Kebenaran penggunaan maklum balas'),consentPromo:get('Kebenaran HQ menghubungi'),consentMarketing:get('Kebenaran penggunaan testimoni'),formTimestamp:get('Timestamp'),journey:true,journeyStatus:'pending',rewardStatus:'Belum Layak',measurements:{},weeklyUpdates:[],status:'follow',source:'google_form_v120'};
}
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed'});}
  try {
    const secret=process.env.YGROW_FORM_SYNC_SECRET||'';
    const supplied=str(req.headers['x-ygrow-sync-secret']);
    if(!secret||!supplied||supplied.length!==secret.length||!crypto.timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))return res.status(401).json({ok:false,error:'Unauthorized'});
    const raw=req.body?.answers;
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({ok:false,error:'Missing answers'});
    const data=mapRow(raw);
    if(!data.phone||!data.name)return res.status(422).json({ok:false,error:'Missing or invalid phone/name'});
    // Deterministic document ID prevents duplicate submits, even under concurrent requests.
    const id='vipmom_'+crypto.createHash('sha256').update(data.phone).digest('hex').slice(0,32);
    const db=getAdmin();const ref=db.collection('ygrowServiceCustomers').doc(id);
    const result=await db.runTransaction(async tx=>{
      const doc=await tx.get(ref);
      if(doc.exists)return 'exists';
      // Protect earlier manually imported records with different Firestore IDs.
      const existing=await tx.get(db.collection('ygrowServiceCustomers').where('phone','==',data.phone).limit(1));
      if(!existing.empty)return 'exists';
      tx.create(ref,{...data,createdAt:admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
      return 'created';
    });
    return res.status(200).json({ok:true,result});
  } catch(err) {console.error('YGROW sync error',err.message);return res.status(500).json({ok:false,error:'Server sync failed'});}
};
