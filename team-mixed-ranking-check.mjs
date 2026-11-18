import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {D1RankingStore,eloChange} from './ranking.mjs';
import {D1TeamRanking} from './team-ranking.mjs';
import {D1SeasonStore} from './seasons.mjs';
import {TEAM_SLOTS,resolveTeamRound} from './team-core.mjs';
import {teamMvp} from './team-mvp.mjs';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={
 prepare(sql){let values=[];return {bind(...args){values=args;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},
 batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}
};
const store={db,ranking:new D1RankingStore(db)},ranking=new D1TeamRanking(store),now=Date.now();
let serial=0;
async function fixture(humanSlots,winner='a',ratings={}){
 const sequence=++serial,matchId='mixed-ranking-'+sequence,code=String(sequence).padStart(6,'0');
 const room={code,matchId,matchKind:'team',stage:'finished',ranked:true,matchmaking:true,queueKind:'ranked',version:1,createdAt:now,expiresAt:now+7200000,seats:{},players:{},profiles:{},game:{roundLimit:5,history:Array.from({length:5},()=>({decision:{winner}}))}};
 for(const [index,slot] of TEAM_SLOTS.entries()){
  if(humanSlots.includes(slot.id)){
   const id=matchId+'-'+slot.id;await store.ranking.ensure(id,now);
   sqlite.prepare('UPDATE duel_players SET rating=? WHERE account_id=?').run(ratings[slot.id]??1000,id);
   room.players[slot.id]=id;room.seats[slot.id]=(sequence.toString(16)+index).padStart(64,'0');
   room.profiles[slot.id]={displayName:id,rating:ratings[slot.id]??1000};
  }else{
   room.players[slot.id]=null;room.seats[slot.id]='computer:'+matchId+':'+slot.id;
   room.profiles[slot.id]={displayName:'CPU '+slot.id.toUpperCase(),avatarId:'robot',rating:ratings[slot.id]??1000};
  }
 }
 sqlite.prepare('INSERT INTO duel_rooms (code,version,state,created_at,expires_at) VALUES (?,0,?,?,?)').run(code,JSON.stringify({...room,version:0}),now,room.expiresAt);
 return room;
}
const event=r=>sqlite.prepare('SELECT * FROM duel_rating_events WHERE match_id=?').get(r.matchId);
async function verify(r,expectedDelta){
 const ids=Object.values(r.players).filter(Boolean),playerCount=sqlite.prepare('SELECT COUNT(*) n FROM duel_players').get().n;
 assert.equal(await ranking.save(r,0),true);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_players').get().n,playerCount,'CPU never creates a ladder account');
 const participants=JSON.parse(event(r).participants);assert.equal(participants.length,ids.length);assert(participants.every(p=>ids.includes(p.accountId)));
 for(const p of participants){const profile=await store.ranking.profile(p.accountId);assert.equal(profile.games,1);assert.equal(profile.rating,p.before+(p.team==='a'?expectedDelta:-expectedDelta));assert.equal(p.after,profile.rating);const season=await new D1SeasonStore(db).view(p.accountId,now);assert.equal(season.games,1,'human gets one monthly game');}
 assert.equal(event(r).settled,1);
 r.version++;assert.equal(await ranking.save(r,r.version-1),true,'resync reuses the existing result');
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rating_events WHERE match_id=?').get(r.matchId).n,1);
 for(const id of ids)assert.equal((await store.ranking.profile(id)).games,1,'idempotent results');
 assert.equal(await ranking.save(structuredClone(r),0),false,'stale room version cannot overwrite settlement');
}

await verify(await fixture(['ae','be']),16);
await verify(await fixture(['ae','av']),16); // A two-person friend party may face two CPUs.
await verify(await fixture(['ae','av','be'],'b'),-16);
await verify(await fixture(['ae','av','be','bv'],'draw'),0);
await verify(await fixture(['ae','be'],'a',{ae:1200,av:800,be:1000,bv:1400}),eloChange(1000,1200,'player'));
const fallback=await fixture(['ae','be']);delete fallback.profiles.av.rating;fallback.profiles.bv.rating=null;await verify(fallback,16);

// Reject invalid participant maps, solo practice and unfinished games before any settlement.
for(const mutate of [
 r=>{r.computer=true;},
 r=>{r.matchmaking=false;},
 r=>{r.queueKind='random';},
 r=>{r.ranked=false;},
 r=>{r.players.be=r.players.ae;},
 r=>{r.players.be=null;r.seats.be='computer:'+r.matchId+':be';},
 r=>{r.seats.av='not-a-server-cpu';},
 r=>{r.players.av='fake-bot-account';},
 r=>{r.seats.ae='missing-session';},
 r=>{r.seats.be=r.seats.ae;},
 r=>{r.stage='revealed';},
 r=>{r.game.history.pop();}
]){
 const r=await fixture(['ae','be']);mutate(r);await assert.rejects(()=>ranking.save(r,0));assert.equal(event(r),undefined);
}

// An outdated player-profile read cannot settle a match or a partially updated ladder.
const profileRace=await fixture(['ae','be']);
const originalProfile=store.ranking.profile.bind(store.ranking);let bump=true;
store.ranking.profile=async id=>{const profile=await originalProfile(id);if(bump&&id===profileRace.players.ae){bump=false;sqlite.prepare('UPDATE duel_players SET rating=rating+100,version=version+1 WHERE account_id=?').run(id);}return profile;};
assert.equal(await ranking.save(profileRace,0),false);assert.equal(event(profileRace),undefined);
assert.equal((await originalProfile(profileRace.players.ae)).games,0);assert.equal((await originalProfile(profileRace.players.be)).games,0);
store.ranking.profile=originalProfile;assert.equal(await ranking.save(profileRace,0),true);

// Concurrent requests share exactly one result and one stat increment per human.
const simultaneous=await fixture(['ae','av','be']);
const settled=await Promise.all([ranking.save(structuredClone(simultaneous),0),ranking.save(structuredClone(simultaneous),0)]);
assert.equal(settled.filter(Boolean).length,1);
for(const id of Object.values(simultaneous.players).filter(Boolean))assert.equal((await originalProfile(id)).games,1);
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM duel_players WHERE account_id LIKE 'computer:%'").get().n,0);
// The contribution-based MVP considers every winning-team slot, including a CPU,
// without assuming every slot owns an account or favoring a human's metadata.
const mvpRoom={code:'MVP222',matchId:'mixed-mvp',stage:'plan',goals:{a:'Type I',b:'Type II'},players:{ae:'human-a',av:null,be:'human-b',bv:null},game:{rulesVersion:3,round:5,roundLimit:5,board:{aEc:0,aEv:0,bEc:0,bEv:0},budgets:{ae:12,av:12,be:12,bv:12},history:[]},drafts:{ae:{ec:-2,ev:0},av:{ec:0,ev:2},be:{ec:0,ev:0},bv:{ec:0,ev:0}},autoLocks:[]};
resolveTeamRound(mvpRoom);const mvp=teamMvp(mvpRoom);assert(mvp&&['ae','av'].includes(mvp.slot));
assert.deepEqual(teamMvp({...structuredClone(mvpRoom),players:{ae:null,av:'human-a',be:null,bv:'human-b'}}),mvp,'MVP remains based on recorded contribution');
mvpRoom.game.history.at(-1).decision.winner='draw';assert.equal(teamMvp(mvpRoom),null);
sqlite.close();
console.log('Passed: 2/3/4-human ranked teams, same-team friend parties, CPU rating snapshots, human-only ladder and season events, idempotence, malformed/solo rejection, profile-version races and concurrent settlement.');
