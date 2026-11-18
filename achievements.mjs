import {ACHIEVEMENTS} from './achievement-catalog.mjs';
import {normalizeRoomCode,ROOM_CODE_PATTERN} from './room-codes.mjs';
export {ACHIEVEMENTS} from './achievement-catalog.mjs';
export class D1AchievementStore{
  constructor(db){this.db=db;}
  async recordRoomCode(id,code,now=Date.now()){
    const normalized=normalizeRoomCode(code);if(!ROOM_CODE_PATTERN.test(normalized))throw Error('房間代號需要 6 碼英文或數字。');
    if(!id||normalized!=='114514')return;
    await this.db.prepare('INSERT INTO duel_achievements (id,account_id,achievement_id,unlocked_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id+':secret-room-114514',id,'secret-room-114514',now).run();
  }
  peakCoinsStatement(id,now=Date.now()){
    return this.db.prepare("INSERT INTO duel_achievement_progress (account_id,peak_coins,updated_at) SELECT ?,coins,? FROM duel_wallets WHERE id=? ON CONFLICT(account_id) DO UPDATE SET peak_coins=MAX(duel_achievement_progress.peak_coins,excluded.peak_coins),updated_at=excluded.updated_at").bind(id,now,'account:'+id);
  }
  ratingStatements(ids,matchId,now=Date.now(),team=false){
    const gate=team?"EXISTS(SELECT 1 FROM duel_rating_events WHERE match_id=? AND format='2v2' AND settled=0)":'EXISTS(SELECT 1 FROM duel_rated_matches WHERE id=? AND settled=0)';
    return [
      ...ids.map(id=>this.db.prepare('INSERT INTO duel_achievement_progress (account_id,peak_rating,updated_at) SELECT account_id,rating,? FROM duel_players WHERE account_id=? AND '+gate+' ON CONFLICT(account_id) DO UPDATE SET peak_rating=MAX(duel_achievement_progress.peak_rating,excluded.peak_rating),updated_at=excluded.updated_at').bind(now,id,matchId)),
      this.db.prepare("INSERT INTO duel_achievements (id,account_id,achievement_id,unlocked_at) SELECT account_id||':rank-first',account_id,'rank-first',? FROM duel_players WHERE games>0 AND rating=(SELECT MAX(rating) FROM duel_players WHERE games>0) AND "+gate+' ON CONFLICT(id) DO NOTHING').bind(now,matchId)
    ];
  }
  async recordMatch(id,matchId,kind,outcome,rounds,now=Date.now()){
    if(!id||!matchId||!['ranked','human','computer'].includes(kind)||!['win','loss','draw'].includes(outcome))return;
    await this.db.prepare('INSERT INTO duel_achievement_matches (id,match_id,account_id,kind,outcome,rounds,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(matchId+':'+id,matchId,id,kind,outcome,rounds===12?12:5,now).run();
  }
  async recordRoom(r){
    if(r.stage!=='finished'||!r.matchId||!r.players||r.players.player===r.players.cpu)return;
    const winner=r.game.history.at(-1)?.decision?.winner;if(!['player','cpu','draw'].includes(winner))return;
    await Promise.all(['player','cpu'].map(seat=>this.recordMatch(r.players[seat],r.matchId,r.ranked?'ranked':'human',winner==='draw'?'draw':winner===seat?'win':'loss',r.game.roundLimit)));
  }
  async summary(id,profile,rank,now=Date.now()){
    if(!id)return null;
    await this.db.batch([this.peakCoinsStatement(id,now),this.db.prepare('INSERT INTO duel_achievement_progress (account_id,peak_rating,updated_at) VALUES (?,?,?) ON CONFLICT(account_id) DO UPDATE SET peak_rating=MAX(duel_achievement_progress.peak_rating,excluded.peak_rating),updated_at=excluded.updated_at').bind(id,profile.rating,now)]);
    const [progress,stats,legacy,wallet,unlocks]=await Promise.all([
      this.db.prepare('SELECT * FROM duel_achievement_progress WHERE account_id=?').bind(id).first(),
      this.db.prepare("SELECT COUNT(CASE WHEN kind!='ranked' THEN 1 END) AS games,COUNT(CASE WHEN kind!='ranked' AND outcome='win' THEN 1 END) AS wins,COUNT(CASE WHEN rounds=12 THEN 1 END) AS long_games FROM duel_achievement_matches WHERE account_id=?").bind(id).first(),
      // Older coin receipts prove completion. Exclude ranked games and new receipts to avoid double counting.
      this.db.prepare("SELECT COUNT(*) AS games,COUNT(CASE WHEN amount IN (15,30) THEN 1 END) AS wins FROM duel_coin_receipts c WHERE wallet_id=? AND applied=1 AND amount IN (5,10,15,20,30) AND NOT EXISTS(SELECT 1 FROM duel_rated_matches r WHERE r.id||':'||c.wallet_id=c.id AND r.settled=1) AND NOT EXISTS(SELECT 1 FROM duel_rating_events e WHERE e.match_id||':'||c.wallet_id=c.id AND e.settled=1) AND NOT EXISTS(SELECT 1 FROM duel_achievement_matches m WHERE m.account_id=? AND m.match_id||':'||c.wallet_id=c.id)").bind('account:'+id,id).first(),
      this.db.prepare('SELECT coins,inventory FROM duel_wallets WHERE id=?').bind('account:'+id).first(),
      this.db.prepare('SELECT achievement_id,unlocked_at FROM duel_achievements WHERE account_id=?').bind(id).all()
    ]);
    const metrics={games:profile.games+stats.games+legacy.games,wins:profile.wins+stats.wins+legacy.wins,longGames:stats.long_games,peakCoins:progress?.peak_coins||0,peakRating:progress?.peak_rating||1000,skins:JSON.parse(wallet?.inventory||'[]').filter(s=>s!=='classic').length,rankedGames:profile.games,champion:rank===1?1:0};
    const known=new Map(unlocks.results.map(a=>[a.achievement_id,a.unlocked_at]));
    metrics.secretRoom=known.has('secret-room-114514')?1:0;metrics.seasonChampion=known.has('season-champion')?1:0;
    const qualifying=ACHIEVEMENTS.filter(a=>metrics[a.metric]>=a.target&&!known.has(a.id));
    if(qualifying.length)await this.db.batch(qualifying.map(a=>this.db.prepare('INSERT INTO duel_achievements (id,account_id,achievement_id,unlocked_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id+':'+a.id,id,a.id,now)));
    // Read persisted timestamps so concurrent requests see a single unlock date.
    const saved=await this.db.prepare('SELECT achievement_id,unlocked_at FROM duel_achievements WHERE account_id=?').bind(id).all();const dates=new Map(saved.results.map(a=>[a.achievement_id,a.unlocked_at]));
    const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('achievement-notices:'+id))),n=>n.toString(16).padStart(2,'0')).join('');
    return {key,metrics,coins:wallet?.coins||0,items:ACHIEVEMENTS.map(a=>({id:a.id,progress:Math.min(a.target,metrics[a.metric]),target:a.target,unlockedAt:dates.get(a.id)||null}))};
  }
}
