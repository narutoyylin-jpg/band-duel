import {TEAM_SLOTS} from './team-core.mjs';
import {eloChange} from './ranking.mjs';
function originalParticipants(r){
 const hasSnapshot=r.matchParticipants!==undefined;
 if(hasSnapshot&&(!Array.isArray(r.matchParticipants)||r.matchParticipants.length!==4))throw Error('牌位對戰的原始玩家資料無效。');
 if(!hasSnapshot&&Object.keys(r.departedPlayers||{}).length)throw Error('離場牌位玩家需要原始對戰資料。');
 const entries=hasSnapshot?r.matchParticipants:TEAM_SLOTS.map(s=>({slot:s.id,accountId:r.players?.[s.id],seatHash:r.seats?.[s.id],profile:r.profiles?.[s.id]}));
 if(new Set(entries.map(p=>p?.slot)).size!==4||entries.some(p=>!TEAM_SLOTS.some(s=>s.id===p?.slot)))throw Error('牌位位置資料無效。');
 const humans=[];
 for(const slot of TEAM_SLOTS){
  const entry=entries.find(p=>p.slot===slot.id),id=entry.accountId,hash=entry.seatHash,seat=r.seats?.[slot.id],current=r.players?.[slot.id],marker='computer:'+r.matchId+':'+slot.id;
  if(typeof id==='string'&&id.length>0&&id.length<=256&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)){
   const departed=r.departedPlayers?.[slot.id],left=hasSnapshot&&departed?.accountId===id&&departed?.seatHash===hash&&(current===null||current===id)&&(seat===marker||seat===null);
   if(!(current===id&&seat===hash)&&!left)throw Error('牌位玩家與原始對戰位置不符。');
   humans.push({slot,id,entry});
  }else if(id!==null||hash!==marker||current!==null||seat!==marker)throw Error('牌位位置必須是登入玩家或有效的電腦補位。');
 }
 if(humans.length<2||new Set(humans.map(p=>p.id)).size!==humans.length)throw Error('牌位對戰至少需要兩個不同的登入帳號。');
 if(new Set(entries.map(p=>p.seatHash)).size!==4)throw Error('每個組隊位置必須使用獨立的操作權。');
 return {humans,entries};
}
export class D1TeamRanking{
 constructor(store){this.store=store;this.db=store.db;}
 async save(r,expected){
  if(r.computer||!r.ranked||!r.matchmaking||r.queueKind!=='ranked')throw Error('只有真人參與的牌位配對才能結算積分。');
  const {humans,entries}=originalParticipants(r);
  const ids=humans.map(p=>p.id);
  const winner=r.game?.history?.at(-1)?.decision?.winner;
  if(r.stage!=='finished'||!['a','b','draw'].includes(winner)||![5,12].includes(r.game.roundLimit)||r.game.history.length!==r.game.roundLimit)throw Error('對戰尚未完成，不能結算積分。');
  const old=await this.db.prepare("SELECT * FROM duel_rating_events WHERE match_id=? AND format='2v2' AND settled=1").bind(r.matchId).first();
  if(old){const participants=JSON.parse(old.participants);if(participants.length!==humans.length||humans.some(p=>!participants.some(x=>x.accountId===p.id&&x.slot===p.slot.id)))throw Error('牌位結算玩家與本場對戰不符。');r.rating={winner:old.winner,participants};return this.writeRoom(r,expected);}
  const profiles=await Promise.all(ids.map(id=>this.store.ranking.profile(id)));if(profiles.some((p,i)=>!p||p.account_id!==ids[i]||!Number.isFinite(p.rating)))throw Error('積分資料尚未就緒，請重新同步。');
  // Human ratings use current ladder values. A CPU keeps its match-start rating
  // snapshot for the expectation calculation and never gets a ladder account.
  const ratings=new Map(humans.map((p,i)=>[p.slot.id,profiles[i].rating]));
  for(const slot of TEAM_SLOTS)if(!ratings.has(slot.id)){const rating=entries.find(p=>p.slot===slot.id)?.profile?.rating;ratings.set(slot.id,Number.isFinite(rating)?Math.max(-10000,Math.min(10000,rating)):1000);}
  const teamAverage=team=>TEAM_SLOTS.filter(s=>s.team===team).reduce((n,s)=>n+ratings.get(s.id),0)/2;
  const delta=eloChange(teamAverage('a'),teamAverage('b'),winner==='a'?'player':winner==='b'?'cpu':'draw'),now=Date.now();
  const participants=profiles.map((p,i)=>({accountId:p.account_id,slot:humans[i].slot.id,team:humans[i].slot.team,before:p.rating,after:p.rating+(humans[i].slot.team==='a'?delta:-delta)}));r.rating={winner,participants};
  const playerChecks=profiles.map(()=>"EXISTS(SELECT 1 FROM duel_players WHERE account_id=? AND version=?)").join(' AND '),gate="EXISTS(SELECT 1 FROM duel_rating_events WHERE match_id=? AND format='2v2' AND settled=0)";
  const sql=[this.db.prepare("INSERT INTO duel_rating_events (match_id,format,winner,participants,created_at,settled) SELECT ?,'2v2',?,?,?,0 WHERE EXISTS(SELECT 1 FROM duel_rooms WHERE code=? AND version=? AND json_extract(state,'$.matchId')=?) AND "+playerChecks+' ON CONFLICT(match_id) DO NOTHING').bind(r.matchId,winner,JSON.stringify(participants),now,r.code,expected,r.matchId,...profiles.flatMap(p=>[p.account_id,p.version]))];
  for(const p of participants)sql.push(this.db.prepare('UPDATE duel_players SET rating=?,games=games+1,wins=wins+?,losses=losses+?,draws=draws+?,version=version+1,updated_at=? WHERE account_id=? AND '+gate).bind(p.after,winner===p.team?1:0,winner!=='draw'&&winner!==p.team?1:0,winner==='draw'?1:0,now,p.accountId,r.matchId));
  sql.push(...this.store.ranking.achievements.ratingStatements(ids,r.matchId,now,true),this.db.prepare("UPDATE duel_rating_events SET settled=1 WHERE match_id=? AND format='2v2' AND settled=0").bind(r.matchId),this.roomStatement(r,expected));
  const result=await this.db.batch(sql);return result.at(-1).meta.changes===1;
 }
 roomStatement(r,expected){return this.db.prepare("UPDATE duel_rooms SET state=?,version=? WHERE code=? AND version=? AND json_extract(state,'$.matchId')=? AND EXISTS(SELECT 1 FROM duel_rating_events WHERE match_id=? AND format='2v2' AND settled=1)").bind(JSON.stringify(r),r.version,r.code,expected,r.matchId,r.matchId);}
 async writeRoom(r,expected){return (await this.roomStatement(r,expected).run()).meta.changes===1;}
}
