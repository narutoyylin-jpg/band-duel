import {D1RankingStore,publicProfile,requestPlayerId} from './ranking.mjs';
import {D1ChatStore,handleChatRequest} from './chat.mjs';
import {BATTLE_GREETINGS,GREETING_COOLDOWN} from './battle-greetings.mjs';
export {BATTLE_GREETINGS,GREETING_COOLDOWN};
export class SocialError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const pair=(a,b)=>JSON.stringify([a,b].sort());
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const publicCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>alphabet[n%alphabet.length]).join('');
export const normalizePlayerCode=value=>typeof value==='string'?value.toUpperCase().replace(/[ -]/g,''):'';
const validCode=value=>/^[A-Z2-9]{10}$/.test(value);
const check=(ok,message,status=400)=>{if(!ok)throw new SocialError(message,status);};
export class D1SocialStore{
 constructor(db){this.db=db;this.ranking=new D1RankingStore(db);}
 async ensure(id,now){
  await this.ranking.ensure(id,now);
  for(let i=0;i<5;i++){
   const old=await this.db.prepare('SELECT player_code FROM duel_social_profiles WHERE account_id=?').bind(id).first();if(old)return old.player_code;
   try{await this.db.prepare('INSERT INTO duel_social_profiles (account_id,player_code,created_at) VALUES (?,?,?) ON CONFLICT(account_id) DO NOTHING').bind(id,publicCode(),now).run();}catch(e){if(!/UNIQUE/i.test(String(e)))throw e;}
  }throw new SocialError('玩家代碼暫時無法建立，請再試一次。',503);
 }
 async target(id,code){
  const normalized=normalizePlayerCode(code);check(validCode(normalized),'請輸入完整的 10 碼玩家代碼。');
  const row=await this.db.prepare('SELECT account_id FROM duel_social_profiles WHERE player_code=?').bind(normalized).first();check(row&&row.account_id!==id,'找不到這位玩家，或這是你自己的代碼。',404);return row.account_id;
 }
 async blocked(a,b){return !!await this.db.prepare('SELECT 1 FROM duel_social_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').bind(a,b,b,a).first();}
 async relation(a,b){return this.db.prepare('SELECT * FROM duel_friendships WHERE id=?').bind(pair(a,b)).first();}
 async view(id,now){
  const code=await this.ensure(id,now);
  const rows=await this.db.prepare("SELECT f.*,s.player_code,p.display_name,p.avatar_id,p.rating,p.games,p.wins,p.losses,p.draws,e.country_code,e.avatar_key,e.avatar_background FROM duel_friendships f JOIN duel_social_profiles s ON s.account_id=CASE WHEN f.account_a=? THEN f.account_b ELSE f.account_a END JOIN duel_players p ON p.account_id=s.account_id LEFT JOIN duel_profile_extras e ON e.account_id=p.account_id WHERE (f.account_a=? OR f.account_b=?) AND NOT EXISTS(SELECT 1 FROM duel_social_blocks b WHERE (b.blocker_id=f.account_a AND b.blocked_id=f.account_b) OR (b.blocker_id=f.account_b AND b.blocked_id=f.account_a)) ORDER BY f.updated_at DESC LIMIT 150").bind(id,id,id).all();
  const friends=[],incoming=[],outgoing=[];for(const row of rows.results){const entry={code:row.player_code,profile:publicProfile(row)};(row.status==='accepted'?friends:row.requested_by===id?outgoing:incoming).push(entry);}
  const invites=await this.db.prepare("SELECT i.id,i.room_code,i.expires_at,json_extract(r.state,'$.matchKind') AS match_kind,s.player_code,p.display_name,p.avatar_id,p.rating,p.games,p.wins,p.losses,p.draws,e.country_code,e.avatar_key,e.avatar_background FROM duel_friend_invites i JOIN duel_social_profiles s ON s.account_id=i.sender_id JOIN duel_players p ON p.account_id=i.sender_id LEFT JOIN duel_profile_extras e ON e.account_id=p.account_id JOIN duel_rooms r ON r.code=i.room_code WHERE i.recipient_id=? AND i.status='pending' AND i.expires_at>? AND r.expires_at>? AND json_extract(r.state,'$.matchId')=i.match_id AND json_extract(r.state,'$.stage') IN ('lobby','party') AND NOT EXISTS(SELECT 1 FROM json_each(json_extract(r.state,'$.players')) j WHERE j.value=i.recipient_id) AND EXISTS(SELECT 1 FROM duel_friendships f WHERE f.status='accepted' AND ((f.account_a=i.sender_id AND f.account_b=i.recipient_id) OR (f.account_b=i.sender_id AND f.account_a=i.recipient_id))) AND NOT EXISTS(SELECT 1 FROM duel_social_blocks b WHERE (b.blocker_id=i.sender_id AND b.blocked_id=i.recipient_id) OR (b.blocker_id=i.recipient_id AND b.blocked_id=i.sender_id)) ORDER BY i.created_at DESC LIMIT 20").bind(id,now,now).all();
  const blocked=await this.db.prepare('SELECT s.player_code,p.display_name,p.avatar_id,p.rating,p.games,p.wins,p.losses,p.draws FROM duel_social_blocks b JOIN duel_social_profiles s ON s.account_id=b.blocked_id JOIN duel_players p ON p.account_id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC LIMIT 100').bind(id).all();
  return {code,friends,incoming,outgoing,unread:await new D1ChatStore(this.db,this).unread(id),invites:invites.results.map(r=>({id:r.id,code:r.player_code,roomCode:r.room_code,kind:r.match_kind==='team'?'team':'friend',expiresAt:r.expires_at,profile:publicProfile(r)})),blocked:blocked.results.map(r=>({code:r.player_code,profile:publicProfile(r)}))};
 }
 async request(id,target,now){
  check(!await this.blocked(id,target),'目前無法向這位玩家發送邀請。',403);
  const r=await this.relation(id,target);if(r)return;
  const counts=await this.db.prepare("SELECT COUNT(*) n,SUM(CASE WHEN requested_by=? AND created_at>? THEN 1 ELSE 0 END) recent FROM duel_friendships WHERE account_a=? OR account_b=?").bind(id,now-60000,id,id).first();
  check(counts.n<100,'好友與待確認邀請已達上限。',409);check((counts.recent||0)<10,'邀請太頻繁，請稍後再試。',429);
  const [a,b]=[id,target].sort();await this.db.prepare("INSERT INTO duel_friendships (id,account_a,account_b,requested_by,status,created_at,updated_at) SELECT ?,?,?,?,'pending',?,? WHERE NOT EXISTS(SELECT 1 FROM duel_social_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)) ON CONFLICT(id) DO NOTHING").bind(pair(id,target),a,b,id,now,now,id,target,target,id).run();
 }
 async change(id,target,operation,now){
  if(operation==='unblock'){await this.db.prepare('DELETE FROM duel_social_blocks WHERE id=? AND blocker_id=?').bind(JSON.stringify([id,target]),id).run();return;}
  if(operation==='block'){
   await this.db.batch([this.db.prepare('INSERT INTO duel_social_blocks (id,blocker_id,blocked_id,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(JSON.stringify([id,target]),id,target,now),this.db.prepare('DELETE FROM duel_friendships WHERE id=?').bind(pair(id,target)),this.db.prepare("UPDATE duel_friend_invites SET status='declined' WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)").bind(id,target,target,id)]);return;
  }
  const r=await this.relation(id,target);check(r,'好友邀請已更新，請重新整理。',409);
  if(operation==='accept'){
   check(r.status==='pending'&&r.requested_by!==id,'只有收到邀請的玩家可以接受。',403);check(!await this.blocked(id,target),'目前無法接受這個邀請。',403);
   await this.db.prepare("UPDATE duel_friendships SET status='accepted',updated_at=? WHERE id=? AND status='pending' AND requested_by<>? AND NOT EXISTS(SELECT 1 FROM duel_social_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?))").bind(now,r.id,id,id,target,target,id).run();
  }else await this.db.batch([this.db.prepare('DELETE FROM duel_friendships WHERE id=?').bind(r.id),this.db.prepare("UPDATE duel_friend_invites SET status='declined' WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)").bind(id,target,target,id)]);
 }
 async invite(id,target,roomCode,now){
  const relation=await this.relation(id,target);check(relation?.status==='accepted'&&!await this.blocked(id,target),'請先成為好友，才能邀請對戰。',403);
  const row=typeof roomCode==='string'?await this.db.prepare('SELECT state,expires_at FROM duel_rooms WHERE code=?').bind(roomCode).first():null;let room;try{room=JSON.parse(row?.state||'null');}catch{}
  const openSeat=room&&Object.entries(room.seats||{}).some(([slot,value])=>!value||value==='computer:'+room.matchId+':'+slot);
  check(room&&row.expires_at>now&&['lobby','party'].includes(room.stage)&&((room.matchKind==='friend'&&!room.matchmaking&&room.players?.[room.host||'player']===id&&openSeat)||(room.matchKind==='team'&&room.players?.[room.host]===id&&(!room.matchmaking&&openSeat||room.stage==='party'&&Object.values(room.seats).filter(Boolean).length<2))),'請先建立自己的好友房間，或等待目前對局結束。',409);
  const inviteId=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([room.matchId,target])))),n=>n.toString(16).padStart(2,'0')).join(''),old=await this.db.prepare('SELECT created_at,status FROM duel_friend_invites WHERE id=?').bind(inviteId).first();if(old&&old.created_at>now-10000)return;
  await this.db.prepare("INSERT INTO duel_friend_invites (id,sender_id,recipient_id,room_code,match_id,status,created_at,expires_at) SELECT ?,?,?,?,?,'pending',?,? WHERE EXISTS(SELECT 1 FROM duel_friendships WHERE id=? AND status='accepted') AND NOT EXISTS(SELECT 1 FROM duel_social_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)) ON CONFLICT(id) DO UPDATE SET status='pending',created_at=excluded.created_at,expires_at=excluded.expires_at").bind(inviteId,id,target,roomCode,room.matchId,now,Math.min(now+120000,row.expires_at),pair(id,target),id,target,target,id).run();
 }
 async dismissInvite(id,inviteId,now){
  check(typeof inviteId==='string'&&inviteId.length<=320,'對戰邀請無效。');await this.db.prepare("UPDATE duel_friend_invites SET status='declined' WHERE id=? AND recipient_id=?").bind(inviteId,id).run();
 }
}
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function handleSocialRequest(request,store,now=Date.now()){
 try{
  const id=requestPlayerId(request);check(id,'請先登入，才能使用好友功能。',401);const url=new URL(request.url),operation=url.pathname.replace(/^\/api\/friends\/?/,'');
  if(operation==='chat')return handleChatRequest(request,new D1ChatStore(store.db,store),id,now);
  if(request.method==='GET'&&!operation)return reply(await store.view(id,now));
  check(request.method==='POST','這個操作不適用。',405);check(!request.headers.get('Origin')||request.headers.get('Origin')===url.origin,'請從對戰網站操作。',403);
  check(request.headers.get('Content-Type')?.includes('application/json'),'操作格式無效。',415);const raw=await request.text();check(raw.length<=1024,'操作資料過長。',413);
  let body;try{body=JSON.parse(raw);}catch{throw new SocialError('操作內容無效。');}check(body&&typeof body==='object'&&!Array.isArray(body),'操作內容無效。');
  const allowed=operation==='invite'?['code','roomCode']:operation==='dismiss-invite'?['id']:['code'];check(Object.keys(body).every(k=>allowed.includes(k)),'操作參數無效。');
  await store.ensure(id,now);
  if(operation==='dismiss-invite')await store.dismissInvite(id,body.id,now);
  else{
   check(['request','accept','remove','block','unblock','invite'].includes(operation),'找不到這個好友操作。',404);const target=await store.target(id,body.code);
   if(operation==='request')await store.request(id,target,now);else if(operation==='invite')await store.invite(id,target,body.roomCode,now);else await store.change(id,target,operation,now);
  }
  return reply(await store.view(id,now));
 }catch(e){return reply({error:e instanceof SocialError?e.message:'好友暫時無法同步，請稍後再試。'},e instanceof SocialError?e.status:503);}
}
