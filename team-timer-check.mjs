import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {PhoneCpuMatch} from './phone-cpu.mjs';
import {TEAM_SLOTS,teamOpponent,normalizeTeamAction} from './team-core.mjs';
import {D1SocialStore} from './social.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let v=[];return {bind(...values){v=values;return this;},first(){return sqlite.prepare(sql).get(...v)||null;},all(){return {results:sqlite.prepare(sql).all(...v)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...v).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const store=new D1TeamStore(db),duels=new D1RoomStore(db),now=Date.now();let serial=0;
const req=async(path='',body,token,at=now,origin='https://game.test',team=true)=>{
 const r=await (team?handleTeamRequest:handleRoomRequest)(new Request('https://game.test/api/'+(team?'team-rooms':'rooms')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),team?store:duels,at);return {status:r.status,data:await r.json()};
};
const body=extra=>({requestId:'team-timer-request-'+(++serial),...extra});
for(const rounds of [5,12]){
 const created=await req('',{});assert.equal(created.status,201);const code=created.data.view.code,tokens={ae:created.data.token};
 for(const id of ['av','be','bv']){const j=await req('/'+code+'/join',{});assert.equal(j.status,201);assert.equal(j.data.view.yourSlot,id);tokens[id]=j.data.token;}
 assert.equal((await req('/'+code+'/join',{})).status,409);assert.equal((await req('/'+code,undefined,'a'.repeat(64))).status,403);assert.equal((await req('/'+code+'/start',body(),tokens.ae)).status,409);
 assert.equal((await req('/'+code+'/settings',body({rounds:12}),tokens.av)).status,403);await req('/'+code+'/settings',body({rounds}),tokens.ae);
 for(const id of Object.keys(tokens))await req('/'+code+'/ready',body({round:1,ready:true}),tokens[id]);
 const started=await req('/'+code+'/start',body(),tokens.ae);assert.equal(started.status,200);assert.equal(started.data.clock.deadline,now+30000);assert.equal(started.data.startingPoints,rounds===5?12:30);
 const actions={ae:{direction:1,amount:1},av:{direction:-1,amount:2},be:{direction:-1,amount:3},bv:{direction:1,amount:4}};
 const posts=await Promise.all(TEAM_SLOTS.map(s=>req('/'+code+'/draft',{round:1,sequence:1,action:actions[s.id]},tokens[s.id])));assert(posts.every(p=>p.status===200));
 for(const s of TEAM_SLOTS){const v=(await req('/'+code,undefined,tokens[s.id])).data;assert.deepEqual(v.visibleOpponent.action,normalizeTeamAction(actions[teamOpponent(s.id)],teamOpponent(s.id),true));assert.deepEqual(v.yourDraft,normalizeTeamAction(actions[s.id],s.id,true));assert.equal(v.players.find(p=>p.slot===s.id).budget,rounds===5?12:30);for(const key of ['drafts','seats','receipts','playersById','pending'])assert(!(key in v));assert.equal(v.history.length,0);assert.deepEqual(v.board,{aEc:0,aEv:0,bEc:0,bEv:0});assert(!JSON.stringify(v).includes(tokens[s.id]));}
 assert.equal((await req('/'+code+'/draft',{round:1,sequence:2,action:{direction:1,amount:1,cost:0}},tokens.ae)).status,400);
 await req('/'+code+'/draft',{round:1,sequence:2,action:{direction:-1,amount:1}},tokens.ae);await req('/'+code+'/draft',{round:1,sequence:1,action:actions.ae},tokens.ae);assert.equal((await req('/'+code,undefined,tokens.ae)).data.yourDraft.ec,-1);
 await req('/'+code+'/lock',body({round:1,sequence:3,action:actions.ae}),tokens.ae);
 await req('/'+code+'/draft',{round:1,sequence:4,action:{direction:-1,amount:2}},tokens.ae);assert.deepEqual((await req('/'+code,undefined,tokens.be)).data.visibleOpponent.action,normalizeTeamAction(actions.ae,'ae',true),'locked moves cannot change');
 assert.equal((await req('/'+code,undefined,tokens.av,now+20001)).data.stage,'plan','20 seconds no longer ends a turn');
 const expired=await req('/'+code,undefined,tokens.av,now+30001);assert.equal(expired.data.stage,'revealed');assert.deepEqual(expired.data.board,{aEc:1,aEv:-2,bEc:-3,bEv:4});assert.equal(expired.data.history.length,1);assert.equal(expired.data.history[0].autoLocked.length,3);assert.equal((await req('/'+code,undefined,tokens.bv,now+50000)).data.history.length,1);
 let at=now+60000;
 for(let round=2;round<=rounds;round++){
  for(const s of TEAM_SLOTS)await req('/'+code+'/next',body({round:round-1}),tokens[s.id],at);
  let v=(await req('/'+code,undefined,tokens.ae,at)).data;assert.equal(v.stage,'plan');assert.equal(v.round,round);assert.equal(v.clock.deadline,at+30000);
  // Entirely disconnected rounds still settle once, using the last server-synced plans.
  v=(await req('/'+code,undefined,tokens.ae,at+30001)).data;assert.equal(v.history.length,round);assert.equal(v.stage,round===rounds?'finished':'revealed');at+=40000;
 }
 const end=(await req('/'+code,undefined,tokens.ae,at)).data;assert(['a','b','draw'].includes(end.history.at(-1).decision.winner));assert.equal((await req('/'+code,undefined,tokens.av,now,'https://game.test',false)).status,409,'1v1 endpoint cannot operate team state');
}
// Sequential 1v1 grants a fresh 30 seconds to the second player and never reveals drafts.
{
 const a=(await req('',{},null,now,'https://game.test',false)).data,code=a.view.code,b=(await req('/'+code+'/join',{},null,now,'https://game.test',false)).data;
 for(const [token,controlled] of [[a.token,'ec'],[b.token,'ev']])await req('/'+code+'/role',body({round:1,controlled}),token,now,'https://game.test',false);
 assert.equal((await req('/'+code+'/mode',body({round:1,mode:'types'}),a.token,now,'https://game.test',false)).status,400,'fixed pairings are practice only');
 const v=(await req('/'+code+'/mode',body({round:1,mode:'shuffle'}),a.token,now,'https://game.test',false)).data,first=v.firstStarter==='you'?a.token:b.token,second=first===a.token?b.token:a.token;
 assert.equal(v.clock.deadline,now+32500);await req('/'+code+'/draft',{round:1,sequence:1,action:{kind:'own',direction:-1,amount:4}},first,now+3000,'https://game.test',false);
 const other=(await req('/'+code,undefined,second,now+3000,'https://game.test',false)).data;assert.equal(other.yourLockedAction,null);assert(!('opponentDraft' in other));assert.equal(other.opponentBudget,12);
 let timed=(await req('/'+code,undefined,second,now+32501,'https://game.test',false)).data;assert.equal(timed.opponentLocked,true);assert.equal(timed.yourTurn,true);assert.equal(timed.clock.deadline,now+62500);assert.equal(timed.history.length,0);
 timed=(await req('/'+code,undefined,second,now+62501,'https://game.test',false)).data;assert.equal(timed.stage,'revealed');assert.equal(timed.history.length,1);assert.equal(timed.history[0].opponentAction.amount,4);assert.equal((await req('/'+code,undefined,first,now+90000,'https://game.test',false)).data.history.length,1);
}
for(const seed of [.1,.9]){
 const cpu=new PhoneCpuMatch(()=>seed);cpu.chooseRole('ec');let v=cpu.chooseMode('types');const initial=cpu.snapshot(),at=Date.now();
 cpu.advanceClock(at+1000);v=cpu.view();assert(v.clock);cpu.draft({kind:'own',direction:-1,amount:4},1);const copy=PhoneCpuMatch.restore(JSON.parse(JSON.stringify(cpu.snapshot())));assert.equal(copy.advanceClock(v.clock.deadline+1000),true);assert.equal(copy.view().stage,'revealed');assert.equal(copy.view().history.length,1);assert.equal(copy.view().history[0].yourAction.amount,4);assert.equal(copy.advanceClock(v.clock.deadline+50000),false);
}
// Fixed Type pairings remain available only in CPU practice.
for(const [mode,expected] of [['types',new Set(['Type I','Type II'])],['together',new Set(['Type I'])],['separate',new Set(['Type II'])],['shuffle',null]]){
 const created=await req('',{computer:true,mode}),code=created.data.view.code,token=created.data.token;
 assert.equal(created.status,201);assert.equal(created.data.view.mode,mode);
 await req('/'+code+'/ready',body({round:1,ready:true}),token);const started=await req('/'+code+'/start',body(),token);assert.equal(started.status,200);assert.equal(started.data.clock.duration,30000);
 const record=await store.get(code);if(expected)assert.deepEqual(new Set(Object.values(record.goals)),expected);else assert(Object.values(record.goals).filter(g=>g==='邊界排列').length<=1);
}
{
 const created=await req('',{}),code=created.data.view.code,token=created.data.token;
 assert.equal((await req('/'+code+'/settings',body({mode:'types'}),token)).status,400);
 assert.equal((await req('',{mode:'types'})).status,400);
}
// Existing 20-second CPU snapshots retain their original deadline until the next turn.
{
 const cpu=new PhoneCpuMatch(()=>.1);cpu.chooseRole('ec');cpu.chooseMode('types');const snapshot=cpu.snapshot();
 snapshot.clock.deadline=snapshot.clock.startsAt+20000;const restored=PhoneCpuMatch.restore(snapshot);assert.equal(restored.view().clock.duration,20000);
}
// Friend invitations understand four-seat rooms and stop inviting a seated recipient.
{
 const social=new D1SocialStore(db),hostId='team-invite-host',peerId='team-invite-peer';await social.ensure(hostId,now);await social.ensure(peerId,now);await social.request(hostId,peerId,now);await social.change(peerId,hostId,'accept',now);
 const createResponse=await handleTeamRequest(new Request('https://game.test/api/team-rooms',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':hostId},body:'{}'}),store,now),created=await createResponse.json();assert.equal(createResponse.status,201);
 await social.invite(hostId,peerId,created.view.code,now);let invites=(await social.view(peerId,now)).invites;assert.equal(invites.length,1);assert.equal(invites[0].kind,'team');
 const joinResponse=await handleTeamRequest(new Request('https://game.test/api/team-rooms/'+created.view.code+'/join',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':peerId},body:'{}'}),store,now);assert.equal(joinResponse.status,201);assert.equal((await social.view(peerId,now)).invites.length,0);
}
console.log('Passed: 4-seat rooms, same-role-only live drafts, hidden teammate plans, strict ownership, ordered edits, immutable locks, shared deadline, disconnect catch-up, 5/12 rounds, sequential 1v1 clocks and persisted CPU auto-lock.');
