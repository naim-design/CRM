const admin = require('firebase-admin');
const crypto = require('crypto');

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); }
  catch (_) { serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
  return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function pick(obj, paths) {
  for (const path of paths) {
    const parts = path.split('.'); let cur = obj;
    for (const p of parts) cur = cur && typeof cur === 'object' ? cur[p] : undefined;
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return null;
}
function cleanPhone(v) { return v == null ? null : String(v).replace(/@.+$/, '').replace(/\D/g, ''); }
function inferDirection(body) {
  const explicit = String(pick(body,['direction','data.direction','message.direction']) || '').toLowerCase();
  if (explicit.includes('in')) return 'incoming'; if (explicit.includes('out')) return 'outgoing';
  const fromMe = pick(body,['fromMe','data.fromMe','key.fromMe','data.key.fromMe','message.key.fromMe']);
  if (fromMe === true || fromMe === 'true' || fromMe === 1) return 'outgoing';
  if (fromMe === false || fromMe === 'false' || fromMe === 0) return 'incoming';
  const ev=String(pick(body,['event','type','event_type','data.event','data.type'])||'').toLowerCase();
  if (ev.includes('incoming')||ev.includes('received')) return 'incoming';
  if (ev.includes('outgoing')||ev.includes('sent')) return 'outgoing';
  return null;
}
function normalize(body) {
  const direction=inferDirection(body);
  const from=cleanPhone(pick(body,['from','sender','phone','data.from','data.sender','data.phone','message.from','key.remoteJid','data.key.remoteJid']));
  const to=cleanPhone(pick(body,['to','recipient','data.to','data.recipient','message.to']));
  const phone=direction==='incoming' ? (from||to) : (to||from);
  return {
    event: String(pick(body,['event','type','event_type','data.event','data.type']) || 'webhook'),
    status: pick(body,['status','data.status','message.status']),
    direction,
    from, to, phone,
    fromMe: pick(body,['fromMe','data.fromMe','key.fromMe','data.key.fromMe','message.key.fromMe']),
    message: pick(body,['message.text','data.message.text','text','body','data.body','message','data.message.body','data.text']),
    messageId: pick(body,['messageId','message_id','id','data.id','key.id','data.key.id','message.id']),
    instance: pick(body,['instance','instanceName','data.instance','data.instanceName']),
    instanceName: pick(body,['instanceName','instance_name','data.instanceName','data.instance_name']),
    instance_id: pick(body,['instance_id','instanceId','data.instance_id','data.instanceId']),
    campaign: pick(body,['campaign','campaignName','campaign_name','broadcast','broadcastName','data.campaign','data.campaignName']),
    template: pick(body,['template','templateName','template_name','data.template','data.templateName']),
    script: pick(body,['script','scriptName','data.script','data.scriptName']),
    eventAt: pick(body,['timestamp','time','createdAt','data.timestamp','data.time','message.timestamp']),
  };
}
function safeEqual(a,b){ if(!a||!b)return false; const A=Buffer.from(String(a)),B=Buffer.from(String(b)); return A.length===B.length && crypto.timingSafeEqual(A,B); }

module.exports = async (req,res) => {
  if (req.method === 'GET') return res.status(200).json({ok:true, service:'wabot-webhook', configured:!!process.env.FIREBASE_SERVICE_ACCOUNT});
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  const configuredKey=process.env.WABOT_WEBHOOK_KEY;
  const supplied=req.query.key || req.headers['x-wabot-webhook-key'];
  if (!configuredKey || !safeEqual(configuredKey,supplied)) return res.status(401).json({ok:false,error:'Unauthorized webhook'});
  try {
    initAdmin();
    const db=admin.firestore();
    const body=(req.body && typeof req.body==='object') ? req.body : {};
    const norm=normalize(body);
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify({mid:norm.messageId,event:norm.event,status:norm.status,phone:norm.phone,ts:norm.eventAt,body})).digest('hex');
    const ref=db.collection('wabotEvents').doc(fingerprint.slice(0,40));
    await ref.set({...norm, raw:body, receivedAt:admin.firestore.FieldValue.serverTimestamp()}, {merge:true});
    await db.collection('wabotWebhookMeta').doc('last').set({lastReceivedAt:admin.firestore.FieldValue.serverTimestamp(), lastEvent:norm.event, lastPhone:norm.phone||null},{merge:true});
    return res.status(200).json({ok:true,id:ref.id,direction:norm.direction,event:norm.event});
  } catch(err) {
    console.error('Wabot webhook error',err);
    return res.status(500).json({ok:false,error:err.message});
  }
};
