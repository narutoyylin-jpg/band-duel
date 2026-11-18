import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import {D1SocialStore} from './social.mjs';
import {isTeamComputer} from './team-cpu.mjs';

const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {sql,bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const rooms=new D1RoomStore(db),teams=new D1TeamStore(db),social=new D1SocialStore(db),checks=[];
let now=Date.now(),serial=0;
const data=extra=>({requestId:'lifecycle-'+(++serial),...extra});
async function req(team,path='',body,id='host',token=null,at=now){
 const response=await (team?handleTeamRequest:handleRoomRequest)(new Request('https://game.test/api/'+(team?'team-rooms':'rooms')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(id?{'oai-authenticated-user-id':id}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),team?teams:rooms,at);
 return {status:response.status,data:await response.json()};
}
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data;};
async function makeDuel(code){
 const a=ok(await req(false,'',{code,timed:false},code+'-host'),201),b=ok(await req(false,'/'+code+'/join',{},code+'-peer'));
 const players=[{id:code+'-host',token:a.token,view:a.view},{id:code+'-peer',token:b.token,view:b.view}];
 for(const [i,p] of players.entries())p.view=ok(await req(false,'/'+code+'/role',data({round:1,controlled:i?'ev':'ec',matchId:b.view.matchId}),p.id,p.token));
 players[0].view=ok(await req(false,'/'+code+'/mode',data({round:1,mode:'shuffle',matchId:players[0].view.matchId}),players[0].id,players[0].token));
 const order=players[0].view.firstStarter==='you'?players:[...players].reverse();
 for(let round=1;round<=5;round++){
  for(const p of order)p.view=ok(await req(false,'/'+code+'/lock',data({round,matchId:players[0].view.matchId,action:{kind:round===1?'own':'hold',direction:1,amount:round===1?1:0}}),p.id,p.token));
  if(round<5)for(const p of players)p.view=ok(await req(false,'/'+code+'/ready',data({round,matchId:p.view.matchId}),p.id,p.token));
 }
 for(const p of players)p.view=ok(await req(false,'/'+code,undefined,p.id,p.token));
 return {code,players,old:await rooms.get(code)};
}
async function makeTeam(code){
 const a=ok(await req(true,'',{code,timed:false,rounds:5},code+'-host'),201),b=ok(await req(true,'/'+code+'/join',{},code+'-peer'),201);
 const players=[{id:code+'-host',token:a.token,view:a.view},{id:code+'-peer',token:b.token,view:b.view}];
 for(const p of players)p.view=ok(await req(true,'/'+code+'/ready',data({round:1,ready:true,matchId:b.view.matchId}),p.id,p.token));
 players[0].view=ok(await req(true,'/'+code+'/start',data({matchId:players[0].view.matchId}),players[0].id,players[0].token));
 for(let round=1;round<=5;round++){
  for(const p of players)p.view=ok(await req(true,'/'+code+'/lock',data({round,sequence:1,matchId:players[0].view.matchId,action:{ec:0,ev:0}}),p.id,p.token));
  now+=2500;players[0].view=ok(await req(true,'/'+code,undefined,players[0].id,players[0].token));
  assert.equal(players[0].view.stage,round===5?'finished':'revealed');
  if(round<5)for(const p of players)p.view=ok(await req(true,'/'+code+'/next',data({round,matchId:players[0].view.matchId}),p.id,p.token));
 }
 for(const p of players)p.view=ok(await req(true,'/'+code,undefined,p.id,p.token));
 return {code,players,old:await teams.get(code)};
}

// A closed number can be claimed immediately in either format, never an active number.
{
 const first=ok(await req(false,'',{code:'REUSE1'},'reuse-host'),201),old=await rooms.get('REUSE1');
 assert.equal((await req(true,'',{code:'REUSE1'},'other-host')).status,409);
 ok(await req(false,'/REUSE1/leave',data({round:1,matchId:first.view.matchId}),'reuse-host',first.token));
 const closed=await rooms.get('REUSE1');assert.equal(closed.stage,'closed');
 const attempts=await Promise.all([req(true,'',{code:'REUSE1'},'team-claim'),req(false,'',{code:'REUSE1'},'duel-claim')]);
 assert.equal(attempts.filter(r=>r.status===201).length,1,'one creator wins the code');assert.equal(attempts.filter(r=>r.status===409).length,1);
 const replacement=await rooms.get('REUSE1');assert.notEqual(replacement.matchId,old.matchId);
 old.stage='closed';old.version=replacement.version+1;assert.equal(await rooms.save(old,replacement.version),false,'matchId fences stale saves even with matching version');
 const denied=await req(replacement.matchKind==='team','/REUSE1',undefined,'reuse-host',first.token);assert([401,403].includes(denied.status),'old token cannot enter replacement');
 assert.equal((await req(false,'/REUSE1/leave',data({round:1,matchId:first.view.matchId}),'reuse-host',first.token)).status===200,false,'old close cannot remove replacement');
 checks.push('immediate cross-format reuse, creator race, stale token and snapshot fencing');
}

// Expired numbers also remain reusable without a scheduled cleanup job.
{
 const first=ok(await req(false,'',{code:'EXPIRE'},'expiry-host'),201);
 const next=await req(true,'',{code:'EXPIRE'},'expiry-reuser',null,now+7200001);ok(next,201);assert.notEqual(next.data.view.matchId,first.view.matchId);
 checks.push('expired code reuse');
}

// Reused public codes cannot inherit stale matchmaking reservations.
{
 const a=ok(await req(false,'',{code:'QUEUES'},'old-queue-owner'),201),old=await rooms.get('QUEUES');
 ok(await req(false,'/QUEUES/leave',data({round:1,matchId:a.view.matchId}),'old-queue-owner',a.token));
 sqlite.prepare('INSERT INTO duel_match_queue (id,code,expires_at) VALUES (1,?,?)').run('QUEUES',now+7200000);
 sqlite.prepare('INSERT INTO duel_ranked_queue (code,account_id,rating,queued_at,expires_at) VALUES (?,?,?,?,?)').run('QUEUES','old-queue-owner',1000,now,now+7200000);
 sqlite.prepare('INSERT INTO duel_team_queue_members (identity,code,match_id,expires_at) VALUES (?,?,?,?)').run('account:old-queue-owner','QUEUES',old.matchId,now+7200000);
 ok(await req(true,'',{code:'QUEUES'},'new-queue-owner'),201);
 for(const table of ['duel_match_queue','duel_ranked_queue','duel_team_queue_members'])assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM '+table+' WHERE code=?').get('QUEUES').n,0,'successful claim clears stale '+table);
 const b=ok(await req(false,'',{code:'KEEPS1'},'active-queue-owner'),201);
 sqlite.prepare('INSERT INTO duel_match_queue (id,code,expires_at) VALUES (1,?,?)').run('KEEPS1',now+7200000);
 assert.equal((await req(true,'',{code:'KEEPS1'},'failed-code-claimant')).status,409);
 assert.equal(sqlite.prepare('SELECT code FROM duel_match_queue WHERE id=1').get().code,'KEEPS1','failed claim cannot clear current reservation');
 ok(await req(false,'/KEEPS1/leave',data({round:1,matchId:b.view.matchId}),'active-queue-owner',b.token));
 checks.push('successful-only stale queue cleanup');
}

// Completed rooms stay reserved, then both players explicitly consent to a new match.
{
 const {code,players,old}=await makeDuel('AGAIN1');assert.equal(old.stage,'finished');
 assert.equal((await req(true,'',{code},'thief')).status,409,'finished room cannot be stolen');
 assert(players.every(p=>p.view.canRematch));const firstConsent=data({round:5,matchId:old.matchId});
 const ready=ok(await req(false,'/'+code+'/rematch',firstConsent,players[0].id,players[0].token));assert.equal(ready.stage,'finished');assert.equal(ready.rematchReadyCount,1);
 const duplicate=ok(await req(false,'/'+code+'/rematch',firstConsent,players[0].id,players[0].token));assert.equal(duplicate.rematchReadyCount,1);
 const fresh=ok(await req(false,'/'+code+'/rematch',data({round:5,matchId:old.matchId}),players[1].id,players[1].token));
 assert.equal(fresh.stage,'role');assert.equal(fresh.code,code);assert.notEqual(fresh.matchId,old.matchId);assert.equal(fresh.rematchReadyCount,0);
 assert.equal(fresh.round,1);assert.equal(fresh.yourBudget,12);assert.equal(fresh.opponentBudget,12);assert.equal(fresh.clock,null);assert.equal(fresh.timed,false);assert.deepEqual(fresh.history,[]);
 const saved=await rooms.get(code);assert.deepEqual(saved.seats,old.seats);assert.deepEqual(saved.players,old.players);assert(saved.version>old.version);assert.equal(saved.game.abilityMode,old.game.abilityMode);
 assert.equal(sqlite.prepare('SELECT expires_at FROM duel_rooms WHERE code=?').get(code).expires_at,saved.expiresAt,'SQL expiry matches refreshed state');
 const acknowledged=ok(await req(false,'/'+code+'/rematch',firstConsent,players[0].id,players[0].token));assert.equal(acknowledged.matchId,fresh.matchId);assert.equal(acknowledged.rematchReadyCount,0,'exact old retry acknowledges without voting in the new match');
 assert.equal((await req(false,'/'+code+'/rematch',data({round:5,matchId:old.matchId}),players[0].id,players[0].token)).status,409,'different old rematch request cannot vote in the new match');
 assert.equal((await req(false,'/'+code+'/leave',data({round:1,matchId:old.matchId}),players[0].id,players[0].token)).status,409,'late prior-match leave does not close new match');
 assert.equal((await req(false,'/'+code+'/role',data({round:1,controlled:'ec',matchId:old.matchId}),players[0].id,players[0].token)).status,409,'late old role cannot act in new match');
 assert.equal((await req(false,'/'+code+'/role',data({round:1,controlled:'ec'}),players[0].id,players[0].token)).status,409,'rematched rooms reject legacy mutation without matchId');
 for(const p of players)assert.equal((await req(false,'/'+code,undefined,p.id,p.token)).status,200,'preserved tokens still work');
 checks.push('1v1 all-player consent, idempotence, refreshed match, preserved room and stale operation denial');
}

// The same contract works with two real players and two CPU seats.
{
 const {code,players,old}=await makeTeam('AGAIN2');assert.equal(old.stage,'finished');assert(players.every(p=>p.view.canRematch));
 const firstConsent=data({matchId:old.matchId});const first=ok(await req(true,'/'+code+'/rematch',firstConsent,players[0].id,players[0].token));assert.equal(first.stage,'finished');assert.equal(first.rematchReadyCount,1);assert.equal(first.rematchHumanCount,2);
 ok(await req(true,'/'+code+'/rematch',firstConsent,players[0].id,players[0].token));
 const fresh=ok(await req(true,'/'+code+'/rematch',data({matchId:old.matchId}),players[1].id,players[1].token));assert.equal(fresh.stage,'lobby');assert.equal(fresh.code,code);assert.notEqual(fresh.matchId,old.matchId);assert.equal(fresh.humanCount,2);assert.equal(fresh.hasComputers,true);assert.equal(fresh.timed,false);assert.equal(fresh.round,1);assert.deepEqual(fresh.history,[]);assert.equal(fresh.yourBudget,12);
 const saved=await teams.get(code);assert(saved.version>old.version);assert.equal(sqlite.prepare('SELECT expires_at FROM duel_rooms WHERE code=?').get(code).expires_at,saved.expiresAt);
 for(const p of players){const slot=Object.keys(old.players).find(slot=>old.players[slot]===p.id);assert.equal(saved.seats[slot],old.seats[slot]);assert.equal(saved.ready[slot],false);assert.equal((await req(true,'/'+code,undefined,p.id,p.token)).status,200);}
 for(const slot of Object.keys(saved.seats).filter(slot=>saved.players[slot]===null)){assert(isTeamComputer(saved,slot));assert.equal(saved.seats[slot],'computer:'+fresh.matchId+':'+slot);assert.equal(saved.ready[slot],true);}
 const acknowledged=ok(await req(true,'/'+code+'/rematch',firstConsent,players[0].id,players[0].token));assert.equal(acknowledged.matchId,fresh.matchId);assert.equal(acknowledged.rematchReadyCount,0);
 assert.equal((await req(true,'/'+code+'/rematch',data({matchId:old.matchId}),players[0].id,players[0].token)).status,409);
 assert.equal((await req(true,'/'+code+'/leave',data({matchId:old.matchId}),players[0].id,players[0].token)).status,409);
 assert.equal((await req(true,'/'+code+'/ready',data({round:1,ready:true}),players[0].id,players[0].token)).status,409,'rematched team rooms reject legacy mutation without matchId');
 checks.push('2v2 all-human consent, CPU marker renewal, preserved positions and no stale rematch/close');
}

// Room invitations are tied to an incarnation, not only its reusable code.
{
 const owner='invite-owner',peer='invite-peer';await social.ensure(owner,now);await social.ensure(peer,now);await social.request(owner,peer,now);await social.change(peer,owner,'accept',now);
 const a=ok(await req(false,'',{code:'INVITE'},owner),201);await social.invite(owner,peer,'INVITE',now);assert.equal((await social.view(peer,now)).invites.length,1);
 ok(await req(false,'/INVITE/leave',data({round:1,matchId:a.view.matchId}),owner,a.token));
 ok(await req(false,'',{code:'INVITE'},owner),201);assert.equal((await social.view(peer,now)).invites.length,0,'old invite does not target the new room');
 checks.push('old invite invalidation after reuse');
}

// Pause an in-flight ranked claim while its host code is closed and reused.
// Even the same public code, queue stage and version must not authorize it.
{
 const a=ok(await req(false,'/ranked',{},'rank-race-host'),201),code=a.view.code;
 const baseBatch=db.batch.bind(db);let reached,continueClaim,intercepted=false;
 const paused=new Promise(resolve=>reached=resolve),continued=new Promise(resolve=>continueClaim=resolve);
 db.batch=async statements=>{
  if(!intercepted&&statements.some(s=>s.sql.includes('DELETE FROM duel_ranked_queue WHERE code IN'))){intercepted=true;reached();await continued;}
  return baseBatch(statements);
 };
 const peerRequest=req(false,'/ranked',{},'rank-race-peer');
 let pauseTimeout;await Promise.race([paused,new Promise((_,reject)=>pauseTimeout=setTimeout(()=>reject(Error('ranked claim pause not reached')),3000))]);clearTimeout(pauseTimeout);
 ok(await req(false,'/'+code+'/leave',data({round:1,matchId:a.view.matchId}),'rank-race-host',a.token));
 const fresh=await rooms.get(code),newOwner='rank-race-new-owner',profile=await rooms.ranking.ensure(newOwner,now),newToken='e'.repeat(64);
 fresh.matchId=crypto.randomUUID();fresh.version=0;fresh.stage='lobby';fresh.seats={player:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(newToken))),n=>n.toString(16).padStart(2,'0')).join(''),cpu:null};
 fresh.players={player:newOwner,cpu:null};fresh.names={player:'New owner',cpu:null};fresh.profiles={player:{displayName:'New owner',rating:1000},cpu:null};fresh.wallets={player:'account:'+newOwner,cpu:null};fresh.createdAt=now;fresh.expiresAt=now+7200000;
 assert.equal(await rooms.create(fresh),true);await rooms.rankedMatchmaker.enqueue(fresh,profile,now);
 continueClaim();const peer=await peerRequest;db.batch=baseBatch;ok(peer,201);
 const current=await rooms.get(code);assert.equal(current.matchId,fresh.matchId);assert.equal(current.players.player,newOwner);assert.equal(current.stage,'lobby');assert.equal(current.seats.cpu,null);
 assert.equal((await rooms.get(peer.data.view.code)).stage,'lobby','stale claim does not redirect its guest');
 assert.equal((await req(false,'/'+code,undefined,newOwner,newToken)).status,200);
 assert.equal((await req(false,'/'+code,undefined,'rank-race-host',a.token)).status,403);
 checks.push('paused ranked claim cannot overwrite reused code with same version');
}

// A random queue consumer that already read a public code cannot attach to a
// new custom room created with that code after its former room was closed.
{
 const a=ok(await req(false,'/match',{},'random-race-host'),201),code=a.view.code;
 const baseClaim=rooms.claimQueue.bind(rooms);let reached,continueClaim,intercepted=false;
 const paused=new Promise(resolve=>reached=resolve),continued=new Promise(resolve=>continueClaim=resolve);
 rooms.claimQueue=async(...args)=>{const candidate=await baseClaim(...args),candidateCode=typeof candidate==='string'?candidate:candidate?.code;if(!intercepted&&candidateCode===code){intercepted=true;reached();await continued;}return candidate;};
 const peerRequest=req(false,'/match',{},'random-race-peer');
 let pauseTimeout;await Promise.race([paused,new Promise((_,reject)=>pauseTimeout=setTimeout(()=>reject(Error('random queue pause not reached')),3000))]);clearTimeout(pauseTimeout);
 ok(await req(false,'/'+code+'/leave',data({round:1,matchId:a.view.matchId}),'random-race-host',a.token));
 const fresh=ok(await req(false,'',{code},'custom-after-random'),201);continueClaim();const peer=await peerRequest;rooms.claimQueue=baseClaim;ok(peer,201);
 const current=await rooms.get(code);assert.equal(current.matchId,fresh.view.matchId);assert.equal(current.matchKind,'friend');assert.equal(current.matchmaking,false);assert.equal(current.stage,'lobby');assert.equal(current.seats.cpu,null,'random requester never enters the reused custom room');
 assert.notEqual(peer.data.view.code,code);checks.push('paused random queue cannot enter reused custom room');
}

// A late cleanup from a successful manual join cannot remove the reservation
// of a newer ranked room that has already reused the public code.
{
 const code='JOINED',a=ok(await req(false,'',{code},'manual-race-host'),201),baseRelease=rooms.releaseQueue.bind(rooms);let reached,continueCleanup,intercepted=false;
 const paused=new Promise(resolve=>reached=resolve),continued=new Promise(resolve=>continueCleanup=resolve);
 rooms.releaseQueue=async(...args)=>{if(!intercepted&&args[0]===code){intercepted=true;reached();await continued;}return baseRelease(...args);};
 const peerRequest=req(false,'/'+code+'/join',{},'manual-race-peer');
 let pauseTimeout;await Promise.race([paused,new Promise((_,reject)=>pauseTimeout=setTimeout(()=>reject(Error('manual join cleanup pause not reached')),3000))]);clearTimeout(pauseTimeout);
 ok(await req(false,'/'+code+'/close',data({round:1,matchId:a.view.matchId}),'manual-race-host',a.token));
 const fresh=await rooms.get(code),id='manual-race-new-owner',profile=await rooms.ranking.ensure(id,now);
 fresh.matchId=crypto.randomUUID();fresh.version=0;fresh.stage='lobby';fresh.matchKind='ranked';fresh.matchmaking=true;fresh.players={player:id,cpu:null};fresh.seats={player:'c'.repeat(64),cpu:null};fresh.profiles={player:{displayName:'New queued owner',rating:1000},cpu:null};fresh.wallets={player:'account:'+id,cpu:null};fresh.ranked=false;fresh.createdAt=now;fresh.expiresAt=now+7200000;
 assert.equal(await rooms.create(fresh),true);await rooms.rankedMatchmaker.enqueue(fresh,profile,now);
 continueCleanup();ok(await peerRequest);rooms.releaseQueue=baseRelease;
 assert.equal((await rooms.get(code)).matchId,fresh.matchId);assert.equal(sqlite.prepare('SELECT account_id FROM duel_ranked_queue WHERE code=?').get(code)?.account_id,id,'late old join cleanup preserves newer queue reservation');
 checks.push('paused manual join cleanup preserves newer ranked reservation');
}
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rated_matches').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rating_events').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,0,'friend rematches never create coin rewards');
sqlite.close();console.log('Passed: '+checks.join('; ')+'.');
