import {FIRST_SEASON,SEASON_MIN_GAMES,SEASON_GRACE_MS,CHAMPION_SKIN,seasonKey,seasonBounds} from './season-rules.mjs';
import {D1AchievementStore} from './achievements.mjs';

// The immutable rated-match receipt ledger is the source of monthly eligibility.
// rowid breaks timestamp ties in actual settlement order, including concurrent games.
const standingsSQL=`WITH raw_participants AS (
 SELECT rowid AS event_order,created_at,player_id AS account_id,player_after AS rating FROM duel_rated_matches WHERE settled=1 AND player_id<>opponent_id AND created_at>=? AND created_at<? AND NOT EXISTS(SELECT 1 FROM duel_rating_events e WHERE e.match_id=duel_rated_matches.id AND e.settled=1)
 UNION ALL
 SELECT rowid AS event_order,created_at,opponent_id AS account_id,opponent_after AS rating FROM duel_rated_matches WHERE settled=1 AND player_id<>opponent_id AND created_at>=? AND created_at<? AND NOT EXISTS(SELECT 1 FROM duel_rating_events e WHERE e.match_id=duel_rated_matches.id AND e.settled=1)
 UNION ALL
 SELECT e.id AS event_order,e.created_at,json_extract(p.value,'$.accountId') AS account_id,json_extract(p.value,'$.after') AS rating FROM duel_rating_events e,json_each(e.participants) p WHERE e.settled=1 AND e.created_at>=? AND e.created_at<?
), participants AS (
 SELECT ROW_NUMBER() OVER (ORDER BY created_at,event_order,account_id) AS seq,account_id,rating FROM raw_participants
), activity AS (
 SELECT account_id,COUNT(*) AS games,MAX(seq) AS last_seq FROM participants GROUP BY account_id
), eligible AS (
 SELECT a.account_id,a.games,p.rating FROM activity a JOIN participants p ON p.account_id=a.account_id AND p.seq=a.last_seq WHERE a.games>=${SEASON_MIN_GAMES}
), standings AS (SELECT *,RANK() OVER (ORDER BY rating DESC) AS rank FROM eligible)`;
const boundValues=key=>{const {start,end}=seasonBounds(key);return [start,end,start,end,start,end];};
export class D1SeasonStore{
 constructor(db){this.db=db;this.achievements=new D1AchievementStore(db);}
 async freeze(key,now=Date.now()){
  if(key<FIRST_SEASON||seasonBounds(key).end+SEASON_GRACE_MS>now)return false;
  // Snapshot all placements and close the month in one transaction. Concurrent
  // cron/recovery requests cannot partially freeze or replace an existing month.
  const results=await this.db.batch([
   this.db.prepare(standingsSQL+` INSERT INTO duel_season_rewards (id,season_id,account_id,rank,rating,games,coins,medals,champion,created_at)
    SELECT ?||':'||account_id,?,account_id,rank,rating,games,
    CASE WHEN rank=1 THEN 500 WHEN rank<=3 THEN 300 WHEN rank<=10 THEN 150 ELSE 50 END,
    CASE WHEN rank=1 THEN 150 WHEN rank<=3 THEN 100 WHEN rank<=10 THEN 60 ELSE 20 END,
    CASE WHEN rank=1 THEN 1 ELSE 0 END,? FROM standings
    WHERE NOT EXISTS(SELECT 1 FROM duel_season_closures WHERE season_id=?) ON CONFLICT(id) DO NOTHING`).bind(...boundValues(key),key,key,now,key),
   this.db.prepare('INSERT INTO duel_season_closures (season_id,closed_at) VALUES (?,?) ON CONFLICT(season_id) DO NOTHING').bind(key,now)
  ]);return results.at(-1).meta.changes===1;
 }
 async applyPending(accountId=null,now=Date.now()){
  const scope=accountId?' AND account_id=?':'',args=accountId?[accountId]:[],pending='SELECT * FROM duel_season_rewards WHERE applied=0'+scope;
  // Every mutation is gated by the same unapplied receipts, then those receipts
  // are marked applied in the same D1 batch. Retrying cannot duplicate currency.
  await this.db.batch([
   this.db.prepare('INSERT INTO duel_wallets (id,updated_at) SELECT DISTINCT \'account:\'||account_id,? FROM ('+pending+') WHERE true ON CONFLICT(id) DO NOTHING').bind(now,...args),
   this.db.prepare(`UPDATE duel_wallets SET coins=coins+(SELECT SUM(coins) FROM (${pending}) r WHERE 'account:'||r.account_id=duel_wallets.id),
    medals=medals+(SELECT SUM(medals) FROM (${pending}) r WHERE 'account:'||r.account_id=duel_wallets.id),
    inventory=CASE WHEN EXISTS(SELECT 1 FROM (${pending}) r WHERE 'account:'||r.account_id=duel_wallets.id AND champion=1) AND NOT EXISTS(SELECT 1 FROM json_each(inventory) WHERE value=?) THEN json_insert(inventory,'$[#]',?) ELSE inventory END,
    version=version+1,updated_at=? WHERE id IN (SELECT 'account:'||account_id FROM (${pending}))`).bind(...args,...args,...args,CHAMPION_SKIN,CHAMPION_SKIN,now,...args),
   this.db.prepare(`INSERT INTO duel_achievement_progress (account_id,peak_coins,updated_at) SELECT substr(id,9),coins,? FROM duel_wallets WHERE id IN (SELECT 'account:'||account_id FROM (${pending})) ON CONFLICT(account_id) DO UPDATE SET peak_coins=MAX(duel_achievement_progress.peak_coins,excluded.peak_coins),updated_at=excluded.updated_at`).bind(now,...args),
   this.db.prepare(`INSERT INTO duel_achievements (id,account_id,achievement_id,unlocked_at) SELECT account_id||':season-champion',account_id,'season-champion',? FROM (${pending}) WHERE champion=1 ON CONFLICT(id) DO NOTHING`).bind(now,...args),
   this.db.prepare('UPDATE duel_season_rewards SET applied=1,awarded_at=? WHERE applied=0'+scope).bind(now,...args)
  ]);
 }
 async settleDue(now=Date.now(),accountId=null){
  const months=await this.db.prepare("SELECT DISTINCT strftime('%Y-%m',created_at/1000+28800,'unixepoch') AS season FROM (SELECT created_at FROM duel_rated_matches WHERE settled=1 UNION ALL SELECT created_at FROM duel_rating_events WHERE settled=1) WHERE created_at<? AND strftime('%Y-%m',created_at/1000+28800,'unixepoch')>=? AND NOT EXISTS(SELECT 1 FROM duel_season_closures c WHERE c.season_id=strftime('%Y-%m',created_at/1000+28800,'unixepoch'))").bind(seasonBounds(seasonKey(now-SEASON_GRACE_MS)).start,FIRST_SEASON).all();
  for(const {season} of months.results)await this.freeze(season,now);
  await this.applyPending(accountId,now);
 }
 async view(accountId,now=Date.now()){
  const key=seasonKey(now),bounds=seasonBounds(key),params=boundValues(key);
  const [mine,leaders,history]=await Promise.all([
   accountId?this.db.prepare(standingsSQL+' SELECT a.games,p.rating,s.rank FROM activity a JOIN participants p ON p.account_id=a.account_id AND p.seq=a.last_seq LEFT JOIN standings s ON s.account_id=a.account_id WHERE a.account_id=?').bind(...params,accountId).first():null,
   this.db.prepare(standingsSQL+' SELECT s.rank,s.rating,s.games,p.display_name,p.avatar_id,e.avatar_key,e.country_code,e.avatar_background FROM standings s JOIN duel_players p ON p.account_id=s.account_id LEFT JOIN duel_profile_extras e ON e.account_id=s.account_id ORDER BY s.rank,p.display_name LIMIT 10').bind(...params).all(),
   accountId?this.db.prepare('SELECT season_id AS season,rank,rating,games,coins,medals,champion,applied,awarded_at AS awardedAt FROM duel_season_rewards WHERE account_id=? ORDER BY season_id DESC LIMIT 12').bind(accountId).all():{results:[]}
  ]);
  return {key,endsAt:bounds.end,paysAfter:bounds.end+SEASON_GRACE_MS,minGames:SEASON_MIN_GAMES,games:mine?.games||0,rank:mine?.rank||null,rating:mine?.rating||null,entries:leaders.results.map(p=>({rank:p.rank,rating:p.rating,games:p.games,displayName:p.display_name,avatar:p.avatar_id})),history:history.results};
 }
}
