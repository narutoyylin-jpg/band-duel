import {requestPlayerId,D1RankingStore,publicProfile} from './ranking.mjs';
import {PhoneCpuMatch} from './phone-cpu.mjs';
import {SKINS,COIN_REWARDS,coinReward} from './cosmetics.mjs';
import {D1AchievementStore} from './achievements.mjs';
import {BATTLE_BACKGROUNDS} from './battle-backgrounds.mjs';
import {D1SeasonStore} from './seasons.mjs';
import {MUSIC_TRACKS,musicById} from './music-catalog.mjs';
export class ShopError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
export async function walletIdentity(request){
 const account=requestPlayerId(request);if(account)return 'account:'+account;
 const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)band-wallet=([a-f0-9]{64})(?:;|$)/)?.[1];
 return token?'guest:'+await hash(token):null;
}
const reply=(value,status=200,cookie=null)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export class D1EconomyStore{
 constructor(db){this.db=db;this.ranking=new D1RankingStore(db);this.achievements=new D1AchievementStore(db);this.seasons=new D1SeasonStore(db);}
 async ensure(id){if(!id)return null;await this.db.prepare('INSERT INTO duel_wallets (id,updated_at) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind(id,Date.now()).run();return this.row(id);}
 async row(id){return this.db.prepare('SELECT * FROM duel_wallets WHERE id = ?').bind(id).first();}
 async view(id){const r=await this.ensure(id);return {coins:r.coins,medals:r.medals,backgrounds:JSON.parse(r.backgrounds),background:r.background,owned:JSON.parse(r.inventory),electron:r.electron,hole:r.hole,music:JSON.parse(r.music),homeMusic:r.home_music,duelMusic:r.duel_music};}
 async purchaseMusic(id,track){
  const item=musicById(track);if(!item)throw new ShopError('音樂不存在。');
  for(let i=0;i<8;i++){
   const r=await this.ensure(id),owned=JSON.parse(r.music);if(owned.includes(track))return this.view(id);if(r.coins<item.price)throw new ShopError('金幣不足，完成對戰可取得金幣。',409);owned.push(track);
   const result=await this.db.prepare('UPDATE duel_wallets SET coins=coins-?,music=?,version=version+1,updated_at=? WHERE id=? AND version=? AND coins>=?').bind(item.price,JSON.stringify(owned),Date.now(),id,r.version,item.price).run();if(result.meta.changes===1)return this.view(id);
  }throw new ShopError('商店正在同步，請再試一次。',409);
 }
 async equipMusic(id,scene,track){
  if(!['home','duel'].includes(scene)||!musicById(track))throw new ShopError('請選擇有效的音樂與使用場景。');const r=await this.ensure(id);if(!JSON.parse(r.music).includes(track))throw new ShopError('請先購買這首音樂。',403);
  await this.db.prepare('UPDATE duel_wallets SET '+(scene==='home'?'home_music':'duel_music')+'=?,version=version+1,updated_at=? WHERE id=?').bind(track,Date.now(),id).run();return this.view(id);
 }
 async award(id,matchId,amount){
  if(!id||!amount)return 0;await this.ensure(id);const receipt=matchId+':'+id;
  await this.db.batch([
   this.db.prepare('INSERT INTO duel_coin_receipts (id,wallet_id,amount,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(receipt,id,amount,Date.now()),
   this.db.prepare('UPDATE duel_wallets SET coins = coins + ?,version = version + 1,updated_at = ? WHERE id = ? AND EXISTS(SELECT 1 FROM duel_coin_receipts WHERE id = ? AND applied = 0)').bind(amount,Date.now(),id,receipt),
   ...(id.startsWith('account:')?[this.achievements.peakCoinsStatement(id.slice(8))]:[]),
   this.db.prepare('UPDATE duel_coin_receipts SET applied = 1 WHERE id = ? AND applied = 0').bind(receipt)
  ]);return amount;
 }
 async purchase(id,skin){
  const item=SKINS.find(s=>s.id===skin);if(!item)throw new ShopError('造型不存在。');
  if(item.earned)throw new ShopError('這是月結冠軍限定獎勵，無法購買。',403);
  if(id.startsWith('account:'))await this.achievements.peakCoinsStatement(id.slice(8)).run();
  for(let i=0;i<8;i++){const r=await this.ensure(id),owned=JSON.parse(r.inventory);if(owned.includes(skin))return this.view(id);
   if(r.coins<item.price)throw new ShopError('金幣不足，完成對戰可取得金幣。',409);owned.push(skin);
   const saved=await this.db.prepare('UPDATE duel_wallets SET coins = coins - ?,inventory = ?,version = version + 1,updated_at = ? WHERE id = ? AND version = ? AND coins >= ?').bind(item.price,JSON.stringify(owned),Date.now(),id,r.version,item.price).run();if(saved.meta.changes===1)return this.view(id);
  }throw new ShopError('商店正在同步，請再試一次。',409);
 }
 async equip(id,carrier,skin){if(!['electron','hole'].includes(carrier))throw new ShopError('請選電子或電洞。');const item=SKINS.find(s=>s.id===skin);if(!item||item.electronOnly&&carrier!=='electron')throw new ShopError('這個造型只能裝備在電子。');const r=await this.ensure(id);if(!JSON.parse(r.inventory).includes(skin))throw new ShopError('請先購買這個造型。',403);
  await this.db.prepare('UPDATE duel_wallets SET '+carrier+' = ?,version = version + 1,updated_at = ? WHERE id = ?').bind(skin,Date.now(),id).run();return this.view(id);
 }
 async purchaseBackground(id,background){
  const item=BATTLE_BACKGROUNDS.find(b=>b.id===background);if(!item)throw new ShopError('背景不存在。');
  if(item.currency==='medals'&&!id.startsWith('account:'))throw new ShopError('賽季兌換需要登入帳號。',401);
  if(id.startsWith('account:'))await this.achievements.peakCoinsStatement(id.slice(8)).run();
  for(let i=0;i<8;i++){
   const r=await this.ensure(id),owned=JSON.parse(r.backgrounds),currency=item.currency;if(owned.includes(background))return this.view(id);
   if(r[currency]<item.price)throw new ShopError(currency==='medals'?'賽季代幣不足，參加牌位月結可獲得。':'金幣不足，完成對戰可取得金幣。',409);
   owned.push(background);const saved=await this.db.prepare('UPDATE duel_wallets SET '+currency+'='+currency+'-?,backgrounds=?,version=version+1,updated_at=? WHERE id=? AND version=? AND '+currency+'>=?').bind(item.price,JSON.stringify(owned),Date.now(),id,r.version,item.price).run();if(saved.meta.changes===1)return this.view(id);
  }throw new ShopError('商店正在同步，請再試一次。',409);
 }
 async equipBackground(id,background){
  if(!BATTLE_BACKGROUNDS.some(b=>b.id===background))throw new ShopError('背景不存在。');const r=await this.ensure(id);if(!JSON.parse(r.backgrounds).includes(background))throw new ShopError('請先購買這個背景。',403);
  await this.db.prepare('UPDATE duel_wallets SET background=?,version=version+1,updated_at=? WHERE id=?').bind(background,Date.now(),id).run();return this.view(id);
 }
 async roomReward(r,actor){
  await this.achievements.recordRoom(r);
  if(r.stage!=='finished'||!r.matchmaking||!r.matchId||!r.wallets?.[actor]||r.wallets.player===r.wallets.cpu)return null;
  const w=r.game.history.at(-1)?.decision?.winner;if(!w)return null;const amount=coinReward('random',w==='draw'?'draw':w===actor?'win':'loss');
  await this.award(r.wallets[actor],r.matchId,amount);return {amount,kind:'random'};
 }
 async cpu(id,body){
  if(body.operation==='start'){
   // Only one active computer game per wallet; restarting abandons the old game.
   await this.db.prepare('DELETE FROM duel_computer_matches WHERE wallet_id = ? OR expires_at <= ?').bind(id,Date.now()).run();
   const matchId=crypto.randomUUID(),m=new PhoneCpuMatch(Math.random,body.abilityMode??'classic');await this.db.prepare('INSERT INTO duel_computer_matches (id,wallet_id,state,expires_at) VALUES (?,?,?,?)').bind(matchId,id,JSON.stringify(m.snapshot()),Date.now()+7200000).run();return {matchId,view:m.view()};
  }
  if(typeof body.matchId!=='string'||typeof body.requestId!=='string'||!/^[\w-]{8,64}$/.test(body.requestId))throw new ShopError('對局資料無效。');
  for(let i=0;i<8;i++){
   const r=await this.db.prepare('SELECT * FROM duel_computer_matches WHERE id = ? AND wallet_id = ?').bind(body.matchId,id).first();if(!r||r.expires_at<=Date.now())throw new ShopError('這場電腦對戰已到期。',410);
   const m=PhoneCpuMatch.restore(JSON.parse(r.state));let v;
   if(m.advanceClock()){const timed=await this.db.prepare('UPDATE duel_computer_matches SET state=?,version=version+1 WHERE id=? AND wallet_id=? AND version=?').bind(JSON.stringify(m.snapshot()),r.id,id,r.version).run();if(timed.meta.changes!==1)continue;continue;}
   if(body.round!==undefined&&body.round!==m.view().round)throw new ShopError('回合已更新，請重新同步。',409);
   if(r.receipt===body.requestId||body.operation==='view')v=m.view();
   else{
    if(body.operation==='role')v=m.chooseRole(body.controlled,body.character);else if(body.operation==='mode')v=m.chooseMode(body.mode,body.rounds??5);else if(body.operation==='turn')v=m.finishCpuTurn();else if(body.operation==='draft')v=m.draft(body.action,body.sequence);else if(body.operation==='lock')v=m.lock(body.action);else if(body.operation==='ready')v=m.next();else throw new ShopError('對戰操作無效。');
    const saved=await this.db.prepare('UPDATE duel_computer_matches SET state = ?,receipt = ?,version = version + 1 WHERE id = ? AND wallet_id = ? AND version = ?').bind(JSON.stringify(m.snapshot()),body.requestId,r.id,id,r.version).run();if(saved.meta.changes!==1)continue;
   }
   const wallet=await this.view(id);v.carrierSkins={e:v.controlled==='ec'?wallet.electron:'classic',h:v.controlled==='ev'?wallet.hole:'classic'};
   if(v.stage==='finished'){const w=v.history.at(-1).decision.winner,outcome=w==='you'?'win':w==='opponent'?'loss':'draw',amount=coinReward('computer',outcome);if(id.startsWith('account:'))await this.achievements.recordMatch(id.slice(8),r.id,'computer',outcome,v.roundLimit);await this.award(id,r.id,amount);v.coinReward={amount,kind:'computer'};}
   return {matchId:r.id,view:v};
  }throw new ShopError('對戰正在同步，請再試一次。',409);
 }
}
export async function handleShopRequest(request,store){
 let cookie=null;
 try{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/shop\/?/,'');let id=await walletIdentity(request);
  if(request.method==='GET'&&!path){if(!id){const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');id='guest:'+await hash(token);cookie='band-wallet='+token+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000'+(url.protocol==='https:'?'; Secure':'');}const account=requestPlayerId(request);if(account)await store.seasons.settleDue(Date.now(),account);return reply({wallet:await store.view(id),season:await store.seasons.view(account),signedIn:!!account,catalog:SKINS,backgrounds:BATTLE_BACKGROUNDS,music:MUSIC_TRACKS,rewards:COIN_REWARDS},200,cookie);}
  if(request.method!=='POST')throw new ShopError('這個操作不適用。',405);const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)throw new ShopError('請從對戰網站操作。',403);
  if(!id)throw new ShopError('請先開啟商店，再重試。',401);if(!request.headers.get('Content-Type')?.includes('application/json'))throw new ShopError('操作格式無效。',415);
  const raw=await request.text();if(raw.length>1024)throw new ShopError('操作資料過長。',413);let body;try{body=JSON.parse(raw);}catch{throw new ShopError('操作內容無效。');}
  if(!body||Array.isArray(body))throw new ShopError('操作內容無效。');
  const allowed=path==='buy'?['skin']:path==='equip'?['skin','carrier']:['background/buy','background/equip'].includes(path)?['background']:path==='music/buy'?['track']:path==='music/equip'?['track','scene']:path==='room-code'?['code']:path==='cpu'?['operation','matchId','requestId','controlled','character','mode','rounds','action','sequence','round','abilityMode']:[];if(Object.keys(body).some(k=>!allowed.includes(k)))throw new ShopError('操作參數無效。');
  if(path==='background/buy')return reply({wallet:await store.purchaseBackground(id,body.background)});if(path==='background/equip')return reply({wallet:await store.equipBackground(id,body.background)});
  if(path==='music/buy')return reply({wallet:await store.purchaseMusic(id,body.track)});if(path==='music/equip')return reply({wallet:await store.equipMusic(id,body.scene,body.track)});
  if(path==='room-code'){const account=requestPlayerId(request);if(!account)throw new ShopError('請先登入，才能保存成就。',401);await store.achievements.recordRoomCode(account,body.code);return reply({ok:true});}
  if(path==='buy')return reply({wallet:await store.purchase(id,body.skin)});if(path==='equip')return reply({wallet:await store.equip(id,body.carrier,body.skin)});if(path==='cpu'){const result=await store.cpu(id,body),account=requestPlayerId(request);result.view.yourProfile=publicProfile(account?await store.ranking.ensure(account,Date.now()):null);return reply(result);}throw new ShopError('找不到這個操作。',404);
 }catch(e){return reply({error:e instanceof ShopError?e.message:/能帶|動作|點數|改動|範圍|回合|出招|角色|模式|技能/.test(e.message)?e.message:'商店暫時無法同步，請稍後再試。'},e instanceof ShopError?e.status:400);}
}
