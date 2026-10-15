// V131: Murpati -> Firestore. Signed, idempotent and server-only.
const crypto = require('node:crypto');
const { admin, getDb } = require('../wabot/firebase');

// Vercel normally parses JSON before invoking the function. Disable it so HMAC
// verification uses the exact bytes Murpati signed.
module.exports.config = { api: { bodyParser: false } };
const OWNER_PHONE = '601168185110'; // YGrow Formula HQ official number
function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let bytes = 0;
    req.on('data', chunk => { bytes += chunk.length; if (bytes > 65536) { reject(new Error('Payload too large')); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function validSignature(raw, supplied, secret) {
  if (!secret || typeof supplied !== 'string') return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function phone(v) { return String(v || '').replace(/\D/g, ''); }
function short(v, max=2000) { return String(v ?? '').slice(0,max); }
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ok:false,error:'POST only'}); }
  try {
    const raw = await rawBody(req);
    if (!validSignature(raw, req.headers['x-murpati-signature'], process.env.MURPATI_WEBHOOK_SECRET)) return res.status(401).json({ok:false,error:'Invalid signature'});
    let p; try { p = JSON.parse(raw.toString('utf8')); } catch (_) { return res.status(400).json({ok:false,error:'Invalid JSON'}); }
    if (p.event === 'test') return res.status(200).json({ok:true,test:true});
    if (!['message.received','message.sent'].includes(p.event)) return res.status(200).json({ok:true,ignored:true});
    if (p.chat?.is_group) return res.status(200).json({ok:true,ignored:'group'});
    const owner = phone(p.session?.phone_number);
    if (owner !== OWNER_PHONE) return res.status(200).json({ok:true,ignored:'different device'});
    const customer = phone(p.contact?.phone_number), msgId = short(p.message?.id,256);
    if (!/^\d{9,15}$/.test(customer) || !msgId) return res.status(422).json({ok:false,error:'Missing phone or message ID'});
    const ts = Date.parse(p.timestamp || '');
    if (!Number.isFinite(ts)) return res.status(422).json({ok:false,error:'Invalid timestamp'});
    const incoming = p.event === 'message.received';
    const db = getDb();
    const leadRef = db.collection('murpatiLeads').doc(customer);
    const eventKey = crypto.createHash('sha256').update(owner+'|'+p.event+'|'+msgId).digest('hex');
    const eventRef = db.collection('murpatiWebhookEvents').doc(eventKey);
    const iso = new Date(ts).toISOString();
    const outcome = await db.runTransaction(async tx => {
      const [eventSnap, leadSnap] = await Promise.all([tx.get(eventRef),tx.get(leadRef)]);
      if (eventSnap.exists) return 'duplicate';
      const old = leadSnap.exists ? leadSnap.data() : {};
      const lastTs = Date.parse(old.lastMessageAt || '') || 0;
      const isLatest = ts >= lastTs;
      const update = {
        phone: customer, devicePhone: owner, source: old.source || 'Murpati WhatsApp Official',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        inboundCount: Number(old.inboundCount || 0) + (incoming ? 1 : 0),
        outboundCount: Number(old.outboundCount || 0) + (incoming ? 0 : 1),
        ...(leadSnap.exists ? {} : {createdAt: admin.firestore.FieldValue.serverTimestamp(),status:'New',buyer:false,buyerValue:0}),
      };
      if (p.contact?.push_name && (!old.name || old.name === 'Tanpa nama')) update.name = short(p.contact.push_name,200);
      if (incoming && ts >= (Date.parse(old.lastInboundAt || '') || 0)) { update.lastInboundAt = iso; update.lastReplyAt = iso; update.customerReplied = true; }
      if (!incoming && ts >= (Date.parse(old.lastOutboundAt || '') || 0)) update.lastOutboundAt = iso;
      if (isLatest) { update.lastMessageAt = iso; update.lastMessage = short(p.message?.content || p.message?.caption || '',500); update.lastDirection = incoming?'inbound':'outbound'; }
      tx.create(eventRef, {phone:customer,devicePhone:owner,event:p.event,messageId:msgId,timestamp:iso,receivedAt:admin.firestore.FieldValue.serverTimestamp()});
      tx.set(leadRef, update, {merge:true});
      return 'created';
    });
    return res.status(200).json({ok:true,result:outcome});
  } catch (err) {
    console.error('Murpati webhook error:',err.message);
    return res.status(500).json({ok:false,error:'Webhook processing failed'});
  }
};
