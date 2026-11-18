import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {D1RankingStore,eloChange} from './ranking.mjs';
import {D1TeamRanking} from './team-ranking.mjs';
import {TEAM_SLOTS} from './team-core.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const store={db,ranking:new D1RankingStore(db)},ranker=new D1TeamRanking(store),now=Date.now();let serial=0;
async function fixture(humanSlots=['ae','av','be','bv'],winner='a'){
 const n=++serial,r={code:String(n).padStart(6,'0'),matchId:'departure-rating-'+n,matchKind:'team',matchmaking:true,queueKind:'ranked',ranked:true,computer:false,stage:'finished',version:1,createdAt:now,expiresAt:now+7200000,seats:{},players:{},profiles:{},wallets:{},departedPlayers:{},matchParticipants:[],game:{roundLimit:5,history:Array.from({length:5},()=>({decision:{winner}}))}};
 for(const [index,s] of TEAM_SLOTS.entries()){
  const human=humanSlots.includes(s.id),id=human?r.matchId+'-'+s.id:null,rating=human?1200-index*100:1000;
  if(human){await store.ranking.ensure(id,now);sqlite.prepare('UPDATE duel_players SET rating=? WHERE account_id=?').run(rating,id);}
  r.players[s.id]=id;r.seats[s.id]=human?(n.toString(16)+index).padStart(64,'0'):'computer:'+r.matchId+':'+s.id;r.profiles[s.id]={displayName:id||'CPU '+s.id,rating};r.wallets[s.id]=human?'account:'+id:null;
  r.matchParticipants.push({slot:s.id,accountId:id,seatHash:r.seats[s.id],profile:{...r.profiles[s.id]},wallet:r.wallets[s.id]});
 }
 sqlite.prepare('INSERT INTO duel_rooms (code,version,state,created_at,expires_at) VALUES (?,0,?,?,?)').run(r.code,JSON.stringify({...r,version:0,stage:'plan'}),now,r.expiresAt);return r;
}
function depart(r,slot,{finished=false}={}){
 const entry=r.matchParticipants.find(p=>p.slot===slot);r.departedPlayers[slot]={accountId:entry.accountId,seatHash:entry.seatHash,at:now};
 r.seats[slot]=finished?null:'computer:'+r.matchId+':'+slot;r.players[slot]=finished?entry.accountId:null;r.wallets[slot]=null;r.profiles[slot]={displayName:'CPU takeover',rating:9999};
}
async function assertSettlement(r){
 const original=r.matchParticipants.filter(p=>p.accountId),averages=team=>r.matchParticipants.filter(p=>p.slot[0]===team).reduce((sum,p)=>sum+p.profile.rating,0)/2;
 const delta=eloChange(averages('a'),averages('b'),r.game.history.at(-1).decision.winner==='a'?'player':'cpu');
 assert.equal(await ranker.save(r,0),true);
 const record=sqlite.prepare('SELECT * FROM duel_rating_events WHERE match_id=?').get(r.matchId),participants=JSON.parse(record.participants);assert.equal(participants.length,original.length);
 for(const p of original){const profile=await store.ranking.profile(p.accountId);assert.equal(profile.games,1);assert.equal(profile.rating,p.profile.rating+(p.slot[0]==='a'?delta:-delta));assert(participants.some(v=>v.accountId===p.accountId&&v.slot===p.slot));}
 const before=original.map(p=>sqlite.prepare('SELECT * FROM duel_players WHERE account_id=?').get(p.accountId));r.version++;assert.equal(await ranker.save(r,1),true);
 assert.deepEqual(original.map(p=>sqlite.prepare('SELECT * FROM duel_players WHERE account_id=?').get(p.accountId)),before,'repeat settlement never grants more rating');
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_players WHERE account_id LIKE ?').get(r.matchId+'%').n,original.length,'CPUs never get accounts');
}
const checks=[];
{
 const r=await fixture();depart(r,'ae');await assertSettlement(r);checks.push('four original humans score after host CPU takeover');
}
{
 const r=await fixture(['ae','be']);depart(r,'ae');r.profiles.av.rating=9999;r.profiles.bv.rating=-9999;await assertSettlement(r);checks.push('two original humans include departed player; original CPU rating snapshots stay authoritative');
}
{
 const r=await fixture();await assertSettlement(r);depart(r,'bv',{finished:true});r.version++;assert.equal(await ranker.save(r,2),true);assert.equal((await store.ranking.profile(r.matchParticipants.find(p=>p.slot==='bv').accountId)).games,1);checks.push('finished departure preserves settled original participant receipt');
}
for(const corrupt of [
 r=>{depart(r,'ae');delete r.departedPlayers.ae;},
 r=>{depart(r,'ae');r.departedPlayers.ae.seatHash='f'.repeat(64);},
 r=>{depart(r,'ae');r.departedPlayers.ae.accountId='different-account';},
 r=>{depart(r,'ae');delete r.matchParticipants;},
 r=>{r.matchParticipants[0].slot='bv';},
 r=>{r.matchParticipants[1].accountId=r.matchParticipants[0].accountId;},
 r=>{r.players.ae='new-unrelated-player';r.seats.ae='f'.repeat(64);},
 r=>{r.matchParticipants[0].seatHash='computer:'+r.matchId+':ae';},
 r=>{r.computer=true;},
 ]){
 const r=await fixture();corrupt(r);await assert.rejects(()=>ranker.save(r,0));assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rating_events WHERE match_id=?').get(r.matchId).n,0,'invalid original roster cannot settle');
}
checks.push('missing/forged original roster, departure identity, live occupant, duplicate identities and solo-practice rejection');
sqlite.close();console.log('Passed: '+checks.join('; ')+'.');
