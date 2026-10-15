// V132: authenticated, preview-first historical conversation backfill.
// Accepts records exported from Murpati (JSON); never invents historical records.
const {admin,getDb}=require('../wabot/firebase');
const crypto=require('node:crypto');
const owner='601168185110';
const digits=v=>String(v||'').replace(/\D/g,'');
const str=(v,n=500)=>String(v??'').slice(0,n);
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST only'});
 try{
  const match=/^Bearer (.+)$/.exec(req.headers.authorization||'');
  if(!match)return res.status(401).json({ok:false,error:'Firebase login required'});
  const db=getDb();
  const identity=await admin.auth().verifyIdToken(match[1]);
  if(!identity.uid)return res.status(403).json({ok:false,error:'Invalid user'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const input=body.records;
  if(!Array.isArray(input)||input.length<1||input.length>300)return res.status(400).json({ok:false,error:'Send 1-300 records per batch'});
  const normalized=[],invalid=[];
  for(let i=0;i<input.length;i++){
   const x=input[i]||{};
   const phone=digits(x.phone_number||x.phone||x.contact?.phone_number);
   const device=digits(x.device_phone||x.session?.phone_number||owner);
   if(!/^\d{9,15}$/.test(phone)||device!==owner){invalid.push(i+1);continue;}
   normalized.push({phone,devicePhone:owner,name:str(x.name||x.push_name||x.contact?.push_name||'',200),conversationId:str(x.conversation_id||'',200),adId:str(x.ad_id||'',100),adHeadline:str(x.ad_headline||'',250),adSource:str(x.ad_source||'',350),stageName:str(x.stage_name||'',80),lastMessage:str(x.last_message||'',500),lastMessageAt:str(x.last_message_at||'',80),lastDirection:x.last_message_from==='us'?'outbound':x.last_message_from==='contact'?'inbound':'unknown'});
  }
  const seen=new Set();const deduped=normalized.filter(x=>{if(seen.has(x.phone))return false;seen.add(x.phone);return true});
  const existing=await Promise.all(deduped.map(x=>db.collection('murpatiLeads').doc(x.phone).get()));
  const created=existing.filter(s=>!s.exists).length,updated=existing.length-created;
  if(body.preview!==false)return res.json({ok:true,preview:true,received:input.length,valid:deduped.length,invalid:invalid.length,duplicateInFile:normalized.length-deduped.length,create:created,update:updated});
  if(body.confirm!=='IMPORT_MURPATI_HISTORY')return res.status(400).json({ok:false,error:'Confirmation required'});
  const batch=db.batch();
  deduped.forEach((x,i)=>{
   const old=existing[i].exists?existing[i].data():{};
   const data={phone:x.phone,devicePhone:owner,updatedAt:admin.firestore.FieldValue.serverTimestamp(),historicalImportedAt:admin.firestore.FieldValue.serverTimestamp()};
   if(!existing[i].exists){data.createdAt=admin.firestore.FieldValue.serverTimestamp();data.status='New';data.buyer=false;data.buyerValue=0;data.inboundCount=0;data.outboundCount=0;}
   if(x.name&&(!old.name||old.name==='Tanpa nama'))data.name=x.name;
   if(x.conversationId)data.conversationId=x.conversationId;
   if(x.adId&&!old.adId)data.adId=x.adId;
   if(x.adHeadline&&!old.adHeadline)data.adHeadline=x.adHeadline;
   if(x.adSource&&!old.adSource)data.adSource=x.adSource;
   if(x.stageName&&!old.murpatiStage)data.murpatiStage=x.stageName;
   const incomingTime=Date.parse(x.lastMessageAt)||0,previousTime=Date.parse(old.lastMessageAt)||0;
   if(incomingTime>previousTime){data.lastMessageAt=new Date(incomingTime).toISOString();data.lastMessage=x.lastMessage;data.lastDirection=x.lastDirection;}
   batch.set(db.collection('murpatiLeads').doc(x.phone),data,{merge:true});
  });
  await batch.commit();
  return res.json({ok:true,preview:false,created,updated,invalid:invalid.length,imported:deduped.length});
 }catch(e){console.error('Murpati backfill:',e.message);return res.status(500).json({ok:false,error:'Import failed; inspect Vercel logs'});}
};
