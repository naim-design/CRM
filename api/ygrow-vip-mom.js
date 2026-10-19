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
    // A customer may already exist from the legacy Servicing module with a random document ID.
    // Merge the registration into that SAME document, preserving servicing notes and history.
    const id='vipmom_'+crypto.createHash('sha256').update(data.phone).digest('hex').slice(0,32);
    const db=getAdmin();
    const col=db.collection('ygrowServiceCustomers');
    const ref=col.doc(id);
    const result=await db.runTransaction(async tx=>{
      // Firestore transactions must perform all reads before any writes.
      const deterministic=await tx.get(ref);
      const matches=await tx.get(col.where('phone','==',data.phone));
      const existing=deterministic.exists ? deterministic :
        (matches.docs.find(d=>d.data().journey===true)||matches.docs[0]||null);
      const now=admin.firestore.FieldValue.serverTimestamp();
      if(!existing){
        tx.create(ref,{...data,createdAt:now,updatedAt:now});
        return 'created';
      }
      const old=existing.data()||{};
      // Keep legacy servicing feedback/status, measurements, follow-ups and HQ notes intact.
      // Store raw registration details separately for auditing and future re-submissions.
      const formDetails={
        name:data.name,phone:data.phone,childName:data.childName,childAge:data.childAge,
        childGender:data.childGender,state:data.state,relationship:data.relationship,
        boxes:data.boxes,startDate:data.startDate,before:data.before,
        baselineDate:data.baselineDate,childWeight:data.childWeight,tried:data.tried,
        feel:data.feel,routine:data.routine,feedback:data.feedback,
        consentProgram:data.consentProgram,consentData:data.consentData,
        consentInternal:data.consentInternal,consentPromo:data.consentPromo,
        consentMarketing:data.consentMarketing,formTimestamp:data.formTimestamp
      };
      const patch={
        journey:true,
        journeyStatus:old.journeyStatus||'pending',
        rewardStatus:old.rewardStatus||'Belum Layak',
        source:old.source||'google_form_v120',
        vipMomForm:formDetails,
        vipMomLastSyncAt:now,
        updatedAt:now
      };
      // Add or refresh registration fields, but never blank out existing values.
      // If HQ has already edited journey details, keep those edits.
      const fields=['name','childName','childAge','childGender','state','relationship',
        'boxes','startDate','baselineDate','childWeight','tried','routine',
        'consentProgram','consentData','consentInternal','consentPromo',
        'consentMarketing','formTimestamp'];
      for(const key of fields){
        if(data[key] && (!old[key] || !old.journey)) patch[key]=data[key];
      }
      if(!old.journey){
        // Legacy records can have a separate servicing height and experience.
        // Only fill empty slots, never overwrite them.
        if(old.before==null && data.before!=null){patch.before=data.before;patch.beforeKnown=true;}
        if(!old.feel && data.feel)patch.feel=data.feel;
        if(!old.feedback && data.feedback)patch.feedback=data.feedback;
      }
      tx.update(existing.ref,patch);
      return old.journey?'updated':'linked';
    });
    return res.status(200).json({ok:true,result});
  } catch(err) {console.error('YGROW sync error',err.message);return res.status(500).json({ok:false,error:'Server sync failed'});}
};
