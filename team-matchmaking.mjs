import {TEAM_SLOTS} from './team-core.mjs';
import {draftDuelSkills} from './duel-core.mjs';
import {rankedSearchRange} from './ranked-matchmaking.mjs';
import {isTeamComputer,fillTeamComputers} from './team-cpu.mjs';

export const teamMembers=r=>TEAM_SLOTS.filter(s=>r.seats[s.id]&&!isTeamComputer(r,s.id)).map(s=>({slot:s.id,account:r.players[s.id],wallet:r.wallets?.[s.id],profile:r.profiles[s.id],hash:r.seats[s.id]}));
export const TEAM_CPU_FILL_WAIT_MS=15000;
export class TeamQueueError extends Error{constructor(message){super(message);this.status=409;}}
const average=members=>members.reduce((n,p)=>n+(p.profile?.rating??1000),0)/members.length;
const identity=p=>p.account?'account:'+p.account:p.wallet||p.hash;
export function arrangeTeams(rooms){
 const groups=rooms.map(r=>teamMembers(r));if(groups.reduce((n,g)=>n+g.length,0)!==4)return null;
 let best=null;
 for(let mask=1;mask<(1<<groups.length)-1;mask++){
  const a=groups.filter((_,i)=>mask&(1<<i)).flat(),b=groups.filter((_,i)=>!(mask&(1<<i))).flat();if(a.length!==2||b.length!==2)continue;
  const gap=Math.abs(average(a)-average(b));if(!best||gap<best.gap)best={a,b,gap};
 }
 return best;
}
export function arrangePartialTeams(rooms){
 const groups=rooms.map(teamMembers),members=groups.flat(),count=members.length;if(count<2||count>3)return null;
 const botRating=average(members),bot=()=>({computer:true,profile:{rating:botRating}});let best=null;
 for(let mask=1;mask<(1<<groups.length);mask++){
  const a=groups.filter((_,i)=>mask&(1<<i)).flat(),b=groups.filter((_,i)=>!(mask&(1<<i))).flat();if(a.length>2||b.length>2)continue;
  const imbalance=Math.abs(a.length-b.length),aa=[...a],bb=[...b];while(aa.length<2)aa.push(bot());while(bb.length<2)bb.push(bot());
  const gap=Math.abs(average(aa)-average(bb));if(!best||imbalance<best.imbalance||imbalance===best.imbalance&&gap<best.gap)best={a:aa,b:bb,gap,imbalance};
 }return best;
}
export class D1TeamMatchmaker{
 constructor(store){this.store=store;this.db=store.db;}
 async assertAvailable(members,excludeCode=null){
  const ids=members.map(identity);if(new Set(ids).size!==ids.length)throw new TeamQueueError('每個位置必須由不同玩家加入。');
  for(const member of members){
   const duplicate=await this.db.prepare("SELECT 1 FROM duel_rooms r WHERE r.code!=? AND r.expires_at>? AND json_extract(r.state,'$.matchKind')='team' AND json_extract(r.state,'$.stage') IN ('party','queue') AND (EXISTS(SELECT 1 FROM json_each(json_extract(r.state,'$.players')) p WHERE p.value=?) OR EXISTS(SELECT 1 FROM json_each(json_extract(r.state,'$.wallets')) w WHERE w.value=?)) LIMIT 1").bind(excludeCode||'',Date.now(),member.account||'',member.wallet||'').first();
   if(duplicate)throw new TeamQueueError('你或隊友已有等待中的 2v2 配對，請先取消。');
  }
 }
 async partyValid(r){
  const members=teamMembers(r);if(members.length!==2)return members.length===1;
  const [a,b]=members.map(p=>p.account);if(!a||!b||a===b)return false;
  return !!await this.db.prepare("SELECT 1 FROM duel_friendships WHERE status='accepted' AND ((account_a=? AND account_b=?) OR (account_a=? AND account_b=?)) AND NOT EXISTS(SELECT 1 FROM duel_social_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?))").bind(a,b,b,a,a,b,b,a).first();
 }
 async count(kind,rounds,now,abilityMode='classic'){
  return Number((await this.db.prepare("SELECT COALESCE(SUM((SELECT COUNT(*) FROM json_each(json_extract(state,'$.seats')) WHERE value IS NOT NULL)),0) n FROM duel_rooms WHERE expires_at>? AND json_extract(state,'$.matchKind')='team' AND json_extract(state,'$.stage')='queue' AND json_extract(state,'$.queueKind')=? AND json_extract(state,'$.game.roundLimit')=? AND COALESCE(json_extract(state,'$.game.abilityMode'),'classic')=?").bind(now,kind,rounds,abilityMode).first())?.n||0);
 }
 async pair(r,now){
  if(r.stage!=='queue')return;
  const rows=await this.db.prepare("SELECT state,version FROM duel_rooms WHERE expires_at>? AND json_extract(state,'$.matchKind')='team' AND json_extract(state,'$.stage')='queue' AND json_extract(state,'$.queueKind')=? AND json_extract(state,'$.game.roundLimit')=? AND COALESCE(json_extract(state,'$.game.abilityMode'),'classic')=? ORDER BY json_extract(state,'$.queuedAt'),code LIMIT 32").bind(now,r.queueKind,r.game.roundLimit,r.game.abilityMode||'classic').all();
  const rooms=rows.results.map(row=>({...JSON.parse(row.state),version:row.version}));if(!rooms.some(x=>x.code===r.code))rooms.push(r);
  const valid=[];for(const room of rooms)if(await this.partyValid(room))valid.push(room);
  const mine=valid.find(x=>x.code===r.code);if(!mine)return;
  const others=valid.filter(x=>x.code!==r.code),combos=[];
  function collect(selected,index,count){if(count===4){combos.push(selected);return;}for(let i=index;i<others.length;i++){const size=teamMembers(others[i]).length;if(count+size<=4)collect([...selected,others[i]],i+1,count+size);}}
  collect([mine],0,teamMembers(mine).length);
  for(const combo of combos){
   const members=combo.flatMap(teamMembers);if(new Set(members.map(identity)).size!==4)continue;
   if(r.queueKind==='ranked'){
    if(members.some(p=>!p.account)||new Set(members.map(p=>p.account)).size!==4)continue;
   }
   const arranged=arrangeTeams(combo);if(!arranged)continue;
   if(r.queueKind==='ranked'&&arranged.gap>Math.min(...combo.map(x=>rankedSearchRange(now-x.queuedAt))))continue;
   if(await this.claim(combo,arranged,now))return;
  }
  // Prefer four real players. A compatible group of two or three starts a
  // shared 15-second grace period; new arrivals can join before CPUs fill it.
  const partial=[];
  function collectPartial(selected,index,count){if(count>=2&&count<4)partial.push(selected);for(let i=index;i<others.length;i++){const size=teamMembers(others[i]).length;if(count+size<4)collectPartial([...selected,others[i]],i+1,count+size);}}
  collectPartial([mine],0,teamMembers(mine).length);
  partial.sort((a,b)=>b.flatMap(teamMembers).length-a.flatMap(teamMembers).length||Math.min(...a.map(x=>x.queuedAt))-Math.min(...b.map(x=>x.queuedAt)));
  for(const combo of partial){
   const members=combo.flatMap(teamMembers),keys=combo.flatMap(x=>teamMembers(x).map(p=>identity(p)+'@'+x.matchId)).sort();
   if(new Set(members.map(identity)).size!==members.length)continue;
   if(r.queueKind==='ranked'&&(members.some(p=>!p.account)||new Set(members.map(p=>p.account)).size!==members.length))continue;
   const arranged=arrangePartialTeams(combo);if(!arranged)continue;
   if(r.queueKind==='ranked'&&arranged.gap>Math.min(...combo.map(x=>rankedSearchRange(now-x.queuedAt))))continue;
   const oldDeadlines=combo.filter(x=>Number.isFinite(x.cpuFillAt)&&(x.cpuFillMembers||[]).filter(k=>keys.includes(k)).length>=2).map(x=>x.cpuFillAt);
   const deadline=oldDeadlines.length?Math.min(...oldDeadlines):now+TEAM_CPU_FILL_WAIT_MS;
   if(deadline<=now){if(await this.claim(combo,arranged,now))return;continue;}
   for(const room of combo)if(room.cpuFillAt!==deadline||JSON.stringify(room.cpuFillMembers)!==JSON.stringify(keys)){
    const updated={...room,cpuFillAt:deadline,cpuFillMembers:keys,version:room.version+1};await this.store.save(updated,room.version);
   }return;
  }
  if(mine.cpuFillAt){const updated={...mine,cpuFillAt:null,cpuFillMembers:[],version:mine.version+1};await this.store.save(updated,mine.version);}
 }
 async claim(rooms,arranged,now){
  rooms.sort((a,b)=>a.queuedAt-b.queuedAt||a.code.localeCompare(b.code));const original=rooms[0],host=structuredClone(original),assignments={ae:arranged.a[0],av:arranged.a[1],be:arranged.b[0],bv:arranged.b[1]};
  host.seats={};host.players={};host.profiles={};host.wallets={};host.ready={};host.receipts={};host.locked={};host.drafts={};host.sequences={};host.stage='lobby';host.matchedAt=now;host.expiresAt=now+7200000;host.ranked=host.queueKind==='ranked';host.timed=true;host.computer=false;host.hasComputers=false;host.cpuFillAt=null;host.cpuFillMembers=[];host.matchTicket=crypto.randomUUID();host.version++;
  delete host.matchParticipants;delete host.departedPlayers;delete host.finishedRoster;delete host.allowSoloContinuation;
  for(const s of TEAM_SLOTS){const p=assignments[s.id];host.seats[s.id]=p?.computer?null:p.hash;host.players[s.id]=p?.computer?null:p.account;host.profiles[s.id]=p?.computer?null:p.profile;host.wallets[s.id]=p?.computer?null:p.wallet;host.ready[s.id]=false;host.receipts[s.id]=null;host.locked[s.id]=false;host.drafts[s.id]=null;host.sequences[s.id]=0;}
  draftDuelSkills(host.game,TEAM_SLOTS.map(s=>s.id),host.queueKind==='ranked'?'classic':original.game.abilityMode||'classic');host.host=TEAM_SLOTS.find(s=>host.seats[s.id]===original.seats[original.host]).id;
  fillTeamComputers(host,true);
  let checks=rooms.map(()=>"EXISTS(SELECT 1 FROM duel_rooms WHERE code=? AND version=? AND expires_at>? AND json_extract(state,'$.stage')='queue' AND json_extract(state,'$.matchId')=?)").join(' AND ');const values=rooms.flatMap(x=>[x.code,x.version,now,x.matchId]);
  for(const room of rooms){const members=teamMembers(room);if(members.length!==2)continue;const [a,b]=members.map(p=>p.account);checks+=" AND EXISTS(SELECT 1 FROM duel_friendships WHERE status='accepted' AND ((account_a=? AND account_b=?) OR (account_a=? AND account_b=?))) AND NOT EXISTS(SELECT 1 FROM duel_social_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?))";values.push(a,b,b,a,a,b,b,a);}
  const gate="EXISTS(SELECT 1 FROM duel_rooms WHERE code=? AND version=? AND json_extract(state,'$.matchId')=? AND json_extract(state,'$.matchTicket')=? AND json_extract(state,'$.stage')='lobby')",gateValues=[host.code,host.version,host.matchId,host.matchTicket];
  const statements=[this.db.prepare('UPDATE duel_rooms SET state=?,version=?,expires_at=? WHERE code=? AND '+checks).bind(JSON.stringify(host),host.version,host.expiresAt,host.code,...values)];
  for(const room of rooms.slice(1)){const redirect={...room,stage:'redirect',redirectCode:host.code,redirectMatchId:host.matchId,expiresAt:host.expiresAt,version:room.version+1};statements.push(this.db.prepare('UPDATE duel_rooms SET state=?,version=?,expires_at=? WHERE code=? AND version=? AND '+gate).bind(JSON.stringify(redirect),redirect.version,redirect.expiresAt,room.code,room.version,...gateValues));}
  statements.push(this.db.prepare('DELETE FROM duel_team_queue_members WHERE code IN ('+rooms.map(()=>'?').join(',')+') AND '+gate).bind(...rooms.map(x=>x.code),...gateValues));
  const result=await this.db.batch(statements);return result[0].meta.changes===1;
 }
}
