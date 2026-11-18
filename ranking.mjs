export const START_RATING=1000;
export const RATING_K=32;
export const AVATAR_IDS=['orb','ring','spark','prism','cat','robot','moon','crystal'];
export function ratingTier(rating){return rating>=1500?'master':rating>=1300?'expert':rating>=1100?'researcher':rating>=900?'apprentice':'starter';}
export class RankingError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function requestPlayerId(request){const id=request.headers.get('oai-authenticated-user-id');return id&&id.length<=256?id:null;}
export function validateNickname(value){
  if(typeof value!=='string')throw new RankingError('請輸入玩家暱稱。');const name=value.normalize('NFC').trim().replace(/ +/g,' ');
  if(!/^[\p{L}\p{N} ._-]{2,20}$/u.test(name))throw new RankingError('暱稱需 2～20 字，可用中英文字、數字、空格、底線或短橫線。');return name;
}
export function eloChange(a,b,winner){const expected=1/(1+10**((b-a)/400)),score=winner==='player'?1:winner==='cpu'?0:.5;return Math.round(RATING_K*(score-expected));}
export function publicProfile(p){return p?{displayName:p.display_name,avatarId:p.avatar_id==='photo'&&p.avatar_key?'photo':AVATAR_IDS.includes(p.avatar_id)?p.avatar_id:'orb',avatarUrl:p.avatar_key?'/api/avatars/'+p.avatar_key:null,avatarBackground:avatarBackgroundId(p.avatar_background),countryCode:validCountry(p.country_code)?p.country_code||'':'',rating:p.rating,tier:ratingTier(p.rating),games:p.games,wins:p.wins,losses:p.losses,draws:p.draws}:null;}
export function ratingForSeat(result,actor){if(!result)return null;const mine=actor==='player',before=mine?result.player_before:result.opponent_before,after=mine?result.player_after:result.opponent_after;return {before,after,change:after-before,opponentBefore:mine?result.opponent_before:result.player_before,opponentAfter:mine?result.opponent_after:result.player_after};}
export class D1RankingStore{
  constructor(db){this.db=db;this.achievements=new D1AchievementStore(db);}
  async profile(id){return id?this.db.prepare('SELECT p.*,e.country_code,e.avatar_key,e.avatar_background FROM duel_players p LEFT JOIN duel_profile_extras e ON e.account_id = p.account_id WHERE p.account_id = ?').bind(id).first():null;}
  async ensure(id,now){if(!id)return null;const label='Player '+crypto.randomUUID().slice(0,6).toUpperCase();await this.db.prepare('INSERT INTO duel_players (account_id,display_name,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(account_id) DO NOTHING').bind(id,label,now,now).run();return this.profile(id);}
  async rename(id,name,now){await this.ensure(id,now);await this.db.prepare('UPDATE duel_players SET display_name = ?,updated_at = ? WHERE account_id = ?').bind(name,now,id).run();return this.profile(id);}
  async setAvatar(id,avatarId,now){await this.ensure(id,now);if(!AVATAR_IDS.includes(avatarId)&&!(avatarId==='photo'&&(await this.profile(id))?.avatar_key))throw new RankingError('請選擇有效頭像。');await this.db.prepare('UPDATE duel_players SET avatar_id = ?,updated_at = ? WHERE account_id = ?').bind(avatarId,now,id).run();return this.profile(id);}
  async setCountry(id,code,now){if(typeof code!=='string'||!validCountry(code))throw new RankingError('請選擇有效的國籍。');await this.ensure(id,now);await this.db.prepare("INSERT INTO duel_profile_extras (account_id,country_code,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET country_code=excluded.country_code,updated_at=excluded.updated_at").bind(id,code,now).run();return this.profile(id);}
  async setBackground(id,background,now){if(typeof background!=='string'||!AVATAR_BACKGROUNDS.some(x=>x.id===background))throw new RankingError('請選擇有效的頭像背景。');await this.ensure(id,now);await this.db.prepare('INSERT INTO duel_profile_extras (account_id,avatar_background,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET avatar_background=excluded.avatar_background,updated_at=excluded.updated_at').bind(id,background,now).run();return this.profile(id);}
  async setPhoto(id,image,now){
    let encoded;try{encoded=decodeAvatarImage(image);}catch(e){throw new RankingError(e.message);}
    await this.ensure(id,now);const key=crypto.randomUUID();
    await this.db.batch([
      this.db.prepare('INSERT INTO duel_profile_extras (account_id,avatar_key,avatar_image,updated_at) VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET avatar_key=excluded.avatar_key,avatar_image=excluded.avatar_image,updated_at=excluded.updated_at').bind(id,key,encoded,now),
      this.db.prepare("UPDATE duel_players SET avatar_id = 'photo',updated_at = ? WHERE account_id = ?").bind(now,id)
    ]);return this.profile(id);
  }
  async removePhoto(id,now){await this.db.batch([this.db.prepare('UPDATE duel_profile_extras SET avatar_key = NULL,avatar_image = NULL,updated_at = ? WHERE account_id = ?').bind(now,id),this.db.prepare("UPDATE duel_players SET avatar_id = CASE WHEN avatar_id = 'photo' THEN 'orb' ELSE avatar_id END,updated_at = ? WHERE account_id = ?").bind(now,id)]);return this.profile(id);}
  async board(id,now){
    const profile=await this.ensure(id,now),rows=await this.db.prepare('SELECT p.account_id,p.display_name,p.avatar_id,p.rating,p.games,p.wins,p.losses,p.draws,e.country_code,e.avatar_key,e.avatar_background FROM duel_players p LEFT JOIN duel_profile_extras e ON e.account_id=p.account_id WHERE p.games > 0 ORDER BY p.rating DESC,p.games DESC,p.wins DESC,p.account_id ASC LIMIT 50').all();
    const ranks=new Map();const entries=rows.results.map((p,i)=>{if(!ranks.has(p.rating))ranks.set(p.rating,i+1);return {...publicProfile(p),rank:ranks.get(p.rating),you:p.account_id===id};});
    const rank=profile?.games?(await this.db.prepare('SELECT COUNT(*) AS n FROM duel_players WHERE games > 0 AND rating > ?').bind(profile.rating).first()).n+1:null;
    const achievements=profile?await this.achievements.summary(id,profile,rank,now):null;
    return {entries,viewer:{signedIn:!!id,profile:publicProfile(profile),rank,achievements},rules:{initial:START_RATING,k:RATING_K,humanOnly:true,completedOnly:true,distinctAccounts:true}};
  }
  async match(id){return this.db.prepare('SELECT * FROM duel_rated_matches WHERE id = ? AND settled = 1').bind(id).first();}
  async saveFinishedRoom(r,expected){
    const old=await this.match(r.matchId);if(old){r.rating=old;const saved=await this.db.prepare('UPDATE duel_rooms SET state = ?,version = ? WHERE code = ? AND version = ? AND json_extract(state,\'$.matchId\') = ?').bind(JSON.stringify(r),r.version,r.code,expected,r.matchId).run();return saved.meta.changes===1;}
    const [a,b]=await Promise.all([this.profile(r.players.player),this.profile(r.players.cpu)]);if(!a||!b)throw new RankingError('積分資料尚未就緒，請重新同步。',503);
    const winner=r.game.history.at(-1)?.decision?.winner;if(!['player','cpu','draw'].includes(winner))throw new RankingError('對戰尚未完成，不能結算積分。',409);
    const change=eloChange(a.rating,b.rating,winner),rating={id:r.matchId,player_before:a.rating,opponent_before:b.rating,player_after:a.rating+change,opponent_after:b.rating-change,winner};r.rating=rating;
    // D1 batches run atomically. Versions protect ratings across simultaneous games;
    // the unique match receipt prevents duplicate settlements on retries.
    const statements=[
      this.db.prepare('INSERT INTO duel_rated_matches (id,player_id,opponent_id,winner,player_before,opponent_before,player_after,opponent_after,created_at,settled) SELECT ?,?,?,?,?,?,?,?,?,0 WHERE EXISTS(SELECT 1 FROM duel_rooms WHERE code = ? AND version = ? AND json_extract(state,\'$.matchId\') = ?) AND EXISTS(SELECT 1 FROM duel_players WHERE account_id = ? AND version = ?) AND EXISTS(SELECT 1 FROM duel_players WHERE account_id = ? AND version = ?) ON CONFLICT(id) DO NOTHING').bind(r.matchId,a.account_id,b.account_id,winner,a.rating,b.rating,rating.player_after,rating.opponent_after,Date.now(),r.code,expected,r.matchId,a.account_id,a.version,b.account_id,b.version),
      this.db.prepare('UPDATE duel_players SET rating = ?,games = games + 1,wins = wins + ?,losses = losses + ?,draws = draws + ?,version = version + 1,updated_at = ? WHERE account_id = ? AND EXISTS(SELECT 1 FROM duel_rated_matches WHERE id = ? AND settled = 0)').bind(rating.player_after,winner==='player'?1:0,winner==='cpu'?1:0,winner==='draw'?1:0,Date.now(),a.account_id,r.matchId),
      this.db.prepare('UPDATE duel_players SET rating = ?,games = games + 1,wins = wins + ?,losses = losses + ?,draws = draws + ?,version = version + 1,updated_at = ? WHERE account_id = ? AND EXISTS(SELECT 1 FROM duel_rated_matches WHERE id = ? AND settled = 0)').bind(rating.opponent_after,winner==='cpu'?1:0,winner==='player'?1:0,winner==='draw'?1:0,Date.now(),b.account_id,r.matchId),
      ...this.achievements.ratingStatements([a.account_id,b.account_id],r.matchId),
      this.db.prepare("INSERT INTO duel_rating_events (match_id,format,winner,participants,created_at,settled) SELECT ?,'1v1',?,?,created_at,1 FROM duel_rated_matches WHERE id=? AND settled=0 ON CONFLICT(match_id) DO NOTHING").bind(r.matchId,winner,JSON.stringify([{accountId:a.account_id,before:a.rating,after:rating.player_after},{accountId:b.account_id,before:b.rating,after:rating.opponent_after}]),r.matchId),
      this.db.prepare('UPDATE duel_rated_matches SET settled = 1 WHERE id = ? AND settled = 0').bind(r.matchId),
      this.db.prepare('UPDATE duel_rooms SET state = ?,version = ? WHERE code = ? AND version = ? AND json_extract(state,\'$.matchId\') = ? AND EXISTS(SELECT 1 FROM duel_rated_matches WHERE id = ? AND settled = 1)').bind(JSON.stringify(r),r.version,r.code,expected,r.matchId,r.matchId)
    ];const result=await this.db.batch(statements);return result.at(-1).meta.changes===1;
  }
}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function handleRankingRequest(request,store,now=Date.now()){
  try{const id=requestPlayerId(request);if(request.method==='GET')return response(await store.board(id,now));
    if(request.method!=='POST')throw new RankingError('這個操作不適用。',405);if(!id)throw new RankingError('請先登入，才能設定玩家資料。',401);
    const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw new RankingError('請從對戰網站操作。',403);
    if(!request.headers.get('Content-Type')?.includes('application/json'))throw new RankingError('操作格式無效。',415);
    const maxLength=Math.ceil(MAX_AVATAR_BYTES*4/3)+128;if(Number(request.headers.get('Content-Length'))>maxLength)throw new RankingError('玩家資料過長。',413);
    let raw='',length=0;const reader=request.body?.getReader(),decoder=new TextDecoder();
    if(reader){while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxLength){await reader.cancel();throw new RankingError('玩家資料過長。',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
    let body;try{body=JSON.parse(raw);}catch{throw new RankingError('操作內容無效。');}
    if(!body||Array.isArray(body))throw new RankingError('操作內容無效。');
    const keys=Object.keys(body);let profile;
    if(keys.length===2&&keys.includes('avatarImage')&&keys.includes('consent')){
      if(body.consent!==true)throw new RankingError('請先同意公開使用這張頭像。');profile=await store.setPhoto(id,body.avatarImage,now);
    }else if(keys.length===1){
      if(keys[0]==='displayName')profile=await store.rename(id,validateNickname(body.displayName),now);
      else if(keys[0]==='avatarId')profile=await store.setAvatar(id,body.avatarId,now);
      else if(keys[0]==='countryCode')profile=await store.setCountry(id,body.countryCode,now);
      else if(keys[0]==='avatarBackground')profile=await store.setBackground(id,body.avatarBackground,now);
      else if(keys[0]==='removePhoto'&&body.removePhoto===true)profile=await store.removePhoto(id,now);
      else throw new RankingError('只能修改玩家暱稱、頭像、背景或國籍。');
    }else throw new RankingError('請一次修改一項玩家資料。');
    return response({profile:publicProfile(profile)});
  }catch(e){return response({error:e instanceof RankingError?e.message:'排行榜暫時無法連線，請稍後再試。'},e instanceof RankingError?e.status:503);}
}
import {validCountry} from './countries.mjs';
import {decodeAvatarImage,MAX_AVATAR_BYTES} from './avatar-image.mjs';
import {D1AchievementStore} from './achievements.mjs';
import {AVATAR_BACKGROUNDS,avatarBackgroundId} from './avatar-backgrounds.mjs';
