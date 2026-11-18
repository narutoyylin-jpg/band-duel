import {publicProfile} from './ranking.mjs';
export const CHAT_LIMIT=400,CHAT_INTERVAL=1500;
class ChatError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const requireChat=(ok,message,status=400)=>{if(!ok)throw new ChatError(message,status);};
const conversation=(a,b)=>JSON.stringify([a,b].sort());
export function normalizeChatText(value){
 requireChat(typeof value==='string','請輸入訊息。');const text=value.normalize('NFC').replace(/\r\n?/g,'\n').trim();
 requireChat(text.length>0&&Array.from(text).length<=CHAT_LIMIT&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text),'訊息需 1～400 字，請移除無效字元。');return text;
}
export class D1ChatStore{
 constructor(db,social){this.db=db;this.social=social;}
 async authorize(id,code){const target=await this.social.target(id,code),relation=await this.social.relation(id,target);requireChat(relation?.status==='accepted'&&!await this.social.blocked(id,target),'目前無法與這位玩家聊天，請確認好友關係。',403);return target;}
 async unread(id){
  const rows=await this.db.prepare("SELECT s.player_code,COUNT(*) unread FROM duel_chat_messages m JOIN duel_social_profiles s ON s.account_id=m.sender_id JOIN duel_friendships f ON f.id=m.conversation_id LEFT JOIN duel_chat_reads r ON r.account_id=m.recipient_id AND r.peer_id=m.sender_id WHERE m.recipient_id=? AND f.status='accepted' AND m.id>COALESCE(r.last_read_id,0) AND NOT EXISTS(SELECT 1 FROM duel_social_blocks b WHERE (b.blocker_id=m.sender_id AND b.blocked_id=m.recipient_id) OR (b.blocker_id=m.recipient_id AND b.blocked_id=m.sender_id)) GROUP BY s.player_code").bind(id).all();return Object.fromEntries(rows.results.map(r=>[r.player_code,Number(r.unread)]));
 }
 message(row,id){return {id:row.id,text:row.text,sender:row.sender_id===id?'you':'friend',createdAt:row.created_at};}
 async history(id,code,before=null){
  const target=await this.authorize(id,code);requireChat(before===null||Number.isSafeInteger(before)&&before>0,'聊天分頁無效。');const cid=conversation(id,target);
  const rows=await this.db.prepare('SELECT id,sender_id,text,created_at FROM duel_chat_messages WHERE conversation_id=? AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT 41').bind(cid,before,before).all();
  const items=rows.results.slice(0,40).reverse();return {code:await this.social.ensure(target,Date.now()),profile:publicProfile(await this.social.ranking.profile(target)),messages:items.map(r=>this.message(r,id)),beforeCursor:rows.results.length>40?items[0].id:null};
 }
 async send(id,code,input,clientId,now){
  const target=await this.authorize(id,code),text=normalizeChatText(input);requireChat(typeof clientId==='string'&&/^[A-Za-z0-9-]{8,64}$/.test(clientId),'訊息識別無效。');const cid=conversation(id,target);
  let row=await this.db.prepare('SELECT * FROM duel_chat_messages WHERE sender_id=? AND client_id=?').bind(id,clientId).first();
  if(row){requireChat(row.conversation_id===cid&&row.text===text,'這則訊息已送出，請勿重複使用識別碼。',409);return {message:this.message(row,id)};}
  await this.db.prepare("INSERT INTO duel_chat_messages (conversation_id,sender_id,recipient_id,client_id,text,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM duel_friendships WHERE id=? AND status='accepted') AND NOT EXISTS(SELECT 1 FROM duel_social_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)) AND NOT EXISTS(SELECT 1 FROM duel_chat_messages WHERE sender_id=? AND created_at>?) AND (SELECT COUNT(*) FROM duel_chat_messages WHERE sender_id=? AND created_at>?)<30 ON CONFLICT(sender_id,client_id) DO NOTHING").bind(cid,id,target,clientId,text,now,cid,id,target,target,id,id,now-CHAT_INTERVAL,id,now-60000).run();
  row=await this.db.prepare('SELECT * FROM duel_chat_messages WHERE sender_id=? AND client_id=?').bind(id,clientId).first();if(!row){await this.authorize(id,code);throw new ChatError('訊息傳送太快，請稍後再試。',429);}requireChat(row.conversation_id===cid&&row.text===text,'這則訊息已送出，請勿重複使用識別碼。',409);return {message:this.message(row,id)};
 }
 async read(id,code,lastId){
  const target=await this.authorize(id,code);requireChat(Number.isSafeInteger(lastId)&&lastId>=0,'已讀位置無效。');const cid=conversation(id,target),max=await this.db.prepare('SELECT MAX(id) last FROM duel_chat_messages WHERE conversation_id=?').bind(cid).first();const value=Math.min(lastId,Number(max.last||0));
  await this.db.prepare('INSERT INTO duel_chat_reads (id,account_id,peer_id,last_read_id) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_read_id=MAX(last_read_id,excluded.last_read_id)').bind(JSON.stringify([id,target]),id,target,value).run();return {ok:true};
 }
}
export async function handleChatRequest(request,store,id,now=Date.now()){
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 try{
  const url=new URL(request.url);requireChat(id,'請先登入，才能使用好友聊天。',401);
  if(request.method==='GET'){const before=url.searchParams.has('before')?Number(url.searchParams.get('before')):null;return reply(await store.history(id,url.searchParams.get('code'),before));}
  requireChat(request.method==='POST','這個操作不適用。',405);requireChat(!request.headers.get('Origin')||request.headers.get('Origin')===url.origin,'請從對戰網站操作。',403);requireChat(request.headers.get('Content-Type')?.includes('application/json'),'操作格式無效。',415);
  const reader=request.body?.getReader(),decoder=new TextDecoder();let raw='',size=0;if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new ChatError('訊息資料過長。',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
  let body;try{body=JSON.parse(raw);}catch{throw new ChatError('操作內容無效。');}requireChat(body&&typeof body==='object'&&!Array.isArray(body),'操作內容無效。');const allowed=body.operation==='send'?['operation','code','text','clientId']:body.operation==='read'?['operation','code','lastId']:[];requireChat(allowed.length&&Object.keys(body).every(k=>allowed.includes(k)),'聊天操作無效。');
  return reply(body.operation==='send'?await store.send(id,body.code,body.text,body.clientId,now):await store.read(id,body.code,body.lastId));
 }catch(e){const known=e instanceof ChatError||Number.isInteger(e.status)&&e.status>=400&&e.status<500;return reply({error:known?e.message:'聊天暫時無法同步，請稍後再試。'},known?e.status:503);}
}
