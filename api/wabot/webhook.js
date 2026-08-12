const crypto = require('crypto');
const { admin, getDb } = require('./firebase');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) {
      try { return Object.fromEntries(new URLSearchParams(req.body)); } catch (_) { return { raw:req.body }; }
    }
  }
  return {};
}

function allEntries(obj, prefix = '', out = []) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push([path.toLowerCase(), v]);
    if (v && typeof v === 'object' && !Array.isArray(v)) allEntries(v, path, out);
  }
  return out;
}

function findValue(obj, keys) {
  const entries = allEntries(obj);
  const wanted = keys.map(k => k.toLowerCase());
  for (const key of wanted) {
    const exact = entries.find(([p, v]) => p.split('.').pop() === key && v !== null && v !== undefined && v !== '');
    if (exact) return exact[1];
  }
  return undefined;
}

function text(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    for (const k of ['text','body','caption','content','message']) if (v[k] != null && typeof v[k] !== 'object') return String(v[k]);
  }
  return '';
}

function normalizePhone(v) {
  let s = text(v).trim();
  if (!s) return '';
  s = s.replace(/@.+$/, '').replace(/\D/g, '');
  if (s.startsWith('0')) s = '60' + s.slice(1);
  return s;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stableStringify(value[k])).join(',') + '}';
}

function detect(payload) {
  const eventName = text(findValue(payload, ['event','event_name','eventType','type','action','status'])).toLowerCase();
  const status = text(findValue(payload, ['status','message_status','ack','state'])).toLowerCase();
  const directionRaw = text(findValue(payload, ['direction','message_direction','fromMe','from_me','isFromMe'])).toLowerCase();
  const fromMe = directionRaw === 'true' || directionRaw === '1' || directionRaw === 'outgoing' || directionRaw === 'sent';
  const to = findValue(payload, ['to','recipient','recipient_id','remoteJid','remote_jid']);
  const from = findValue(payload, ['from','sender','sender_id','author','participant']);
  const phone = normalizePhone(fromMe ? (to || from) : (from || to));
  const instanceId = text(findValue(payload, ['instance_id','instanceId','instance','device_id','deviceId']));
  const message = text(findValue(payload, ['message','body','text','caption','content']));
  const messageId = text(findValue(payload, ['message_id','messageId','msg_id','id','key.id']));
  // Optional campaign metadata. Wabot payloads may expose these under different keys,
  // so we normalise common variants without requiring them to exist.
  const campaign = text(findValue(payload, ['campaign','campaign_name','campaignName','broadcast','broadcast_name','broadcastName','campaign_id','campaignId']));
  const script = text(findValue(payload, ['script','script_name','scriptName','template','template_name','templateName']));
  const staff = text(findValue(payload, ['staff','agent','agent_name','agentName','user_name','userName','created_by','createdBy']));
  const account = text(findValue(payload, ['account','account_name','accountName','instance_name','instanceName','device_name','deviceName']));

  let normalizedType = 'other';
  if (/disconnect|connect|connection|qr/.test(eventName)) normalizedType = 'connection';
  if (/failed|error|undeliver/.test(status + ' ' + eventName)) normalizedType = 'failed';
  else if (/read|seen/.test(status + ' ' + eventName)) normalizedType = 'read';
  else if (/deliver/.test(status + ' ' + eventName)) normalizedType = 'delivered';
  else if (/incoming|received|message\.received|message_received/.test(eventName) || (!fromMe && phone && message)) normalizedType = 'incoming';
  else if (/outgoing|sent|message\.sent|message_sent/.test(eventName) || (fromMe && phone)) normalizedType = 'outgoing';

  let direction = '';
  if (normalizedType === 'incoming') direction = 'incoming';
  if (normalizedType === 'outgoing') direction = 'outgoing';
  if (!direction && directionRaw === 'incoming') direction = 'incoming';
  if (!direction && (directionRaw === 'outgoing' || fromMe)) direction = 'outgoing';

  return { eventName, status, normalizedType, direction, phone, instanceId, message, messageId, campaign, script, staff, account };
}

async function updateExistingContact(db, phone, normalizedType) {
  if (process.env.WABOT_UPDATE_EXISTING_CONTACTS !== 'true' || !phone) return;
  const variants = [...new Set([phone, phone.startsWith('60') ? '0'+phone.slice(2) : phone])];
  for (const variant of variants) {
    const snap = await db.collection('contacts').where('phone','==',variant).limit(10).get();
    for (const doc of snap.docs) {
      const current = doc.data().status || 'pending';
      if (current === 'buyer') continue;
      let next = current;
      if (normalizedType === 'incoming') next = 'replied';
      else if (normalizedType === 'outgoing' && current === 'pending') next = 'blasted';
      if (next !== current) await doc.ref.update({ status:next, wabotAutoUpdatedAt:admin.firestore.FieldValue.serverTimestamp() });
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok:true, service:'wabot-webhook', message:'POST Wabot events here' });
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });

  const expected = process.env.WABOT_WEBHOOK_KEY;
  if (!expected) return res.status(503).json({ ok:false, error:'WABOT_WEBHOOK_KEY belum dikonfigurasi' });
  if (req.query.key !== expected) return res.status(401).json({ ok:false, error:'Invalid webhook key' });

  try {
    const payload = parseBody(req);
    const db = getDb();
    const n = detect(payload);
    const signature = n.messageId || crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
    const eventId = crypto.createHash('sha256').update(`${n.instanceId}|${signature}|${n.normalizedType}|${n.status}`).digest('hex');
    const ref = db.collection('wabotEvents').doc(eventId);
    const existing = await ref.get();
    if (existing.exists) return res.status(200).json({ ok:true, duplicate:true, eventId });

    const now = admin.firestore.Timestamp.now();
    const eventDoc = {
      ...n,
      receivedAt: now,
      source: 'wabot-webhook',
      raw: payload
    };
    await ref.create(eventDoc);

    if (n.phone) {
      const cRef = db.collection('wabotContacts').doc(n.phone);
      const update = {
        phone:n.phone,
        instanceId:n.instanceId || '',
        lastEvent:n.normalizedType,
        lastStatus:n.status || '',
        lastMessage:n.message || '',
        lastSeenAt:now,
        updatedAt:now
      };
      if (n.normalizedType === 'incoming') update.lastIncomingAt = now;
      if (n.normalizedType === 'outgoing') update.lastOutgoingAt = now;
      await cRef.set(update, { merge:true });
    }

    const day = new Date().toISOString().slice(0,10);
    const dailyRef = db.collection('wabotDaily').doc(day);
    const incField = ({ incoming:'reply', outgoing:'sent', delivered:'delivered', read:'read', failed:'failed' })[n.normalizedType];
    const dailyUpdate = { date:day, lastEventAt:now, totalEvents:admin.firestore.FieldValue.increment(1) };
    if (incField) dailyUpdate[incField] = admin.firestore.FieldValue.increment(1);
    await dailyRef.set(dailyUpdate, { merge:true });

    await updateExistingContact(db, n.phone, n.normalizedType);
    return res.status(200).json({ ok:true, eventId, normalizedType:n.normalizedType, phone:n.phone || null });
  } catch (err) {
    console.error('Wabot webhook error:', err);
    return res.status(500).json({ ok:false, error:err.message });
  }
};
