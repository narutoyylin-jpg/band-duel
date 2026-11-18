import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {duelStartingPoints} from './duel-core.mjs';
import {BATTLE_GREETINGS} from './social.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
const store=new D1RoomStore(db),now=Date.now();let serial=0;
async function req(path='',body,id='owner',token=null,at=now){const response=await handleRoomRequest(new Request('https://game.test/api/rooms'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':id,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),store,at);return {status:response.status,data:await response.json()};}
const command=(round,matchId,extra={})=>({round,matchId,requestId:'room-rematch-'+(++serial),...extra});
async function make(code,options={}){const a=await req('',{code,...options});assert.equal(a.status,201,JSON.stringify(a));return {code:a.data.view.code,token:a.data.token,id:'owner',view:a.data.view};}
async function join(a){const b=await req('/'+a.code+'/join',{},'peer');assert.equal(b.status,200,JSON.stringify(b));return {code:a.code,token:b.data.token,id:'peer',view:b.data.view};}
const send=(p,op,body,at=now)=>req('/'+p.code+'/'+op,body,p.id,p.token,at);
const view=(p,at=now)=>req('/'+p.code,undefined,p.id,p.token,at);

// Closing makes the code immediately claimable without waiting for the TTL.
{
 const a=await make('REUSE1'),old=await store.get(a.code);
 assert.equal((await req('',{code:a.code},'intruder')).status,409,'live room is protected');
 assert.equal((await send(a,'leave',command(1,a.view.matchId))).status,200);
 const b=await req('',{code:a.code},'new-owner',null,now+1);assert.equal(b.status,201,'closed code can be used immediately');assert.notEqual(b.data.view.matchId,a.view.matchId);
 assert.equal((await view(a,now+1)).status,403,'old token cannot enter the replacement room');
 old.version++;old.stage='closed';assert.equal(await store.save(old,0),false,'stale update cannot overwrite reused code');
 assert.equal((await store.get(a.code)).matchId,b.data.view.matchId);
 sqlite.prepare('INSERT INTO duel_match_queue (id,code,expires_at) VALUES (1,?,?)').run(a.code,now+7200000);
 await store.releaseQueue(a.code,old.matchId);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_match_queue WHERE code=?').get(a.code).n,1,'late old-room cleanup does not remove a replacement queue');
 await store.releaseQueue(a.code,b.data.view.matchId);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_match_queue WHERE code=?').get(a.code).n,0);
 const redirect={...old,code:'REDIR1',matchId:crypto.randomUUID(),redirectCode:a.code,redirectMatchId:old.matchId,stage:'redirect',version:0};assert.equal(await store.create(redirect),true);
 assert.equal((await req('/REDIR1',undefined,a.id,a.token,now+1)).status,410,'old redirects never attach to a replacement match at the same code');
 const c=await make('RACE01');await send(c,'leave',command(1,c.view.matchId));
 const raced=await Promise.all([req('',{code:c.code},'racer-a',null,now+2),req('',{code:c.code},'racer-b',null,now+2)]);assert.equal(raced.filter(x=>x.status===201).length,1,'only one new owner can claim a closed room');
}

for(const [rounds,abilityMode] of [[5,'classic'],[12,'skills']]){
 const a=await make('AGAIN'+(rounds===5?'5':'2'),{rounds,timed:false,abilityMode}),b=await join(a),path='/'+a.code,oldMatchId=a.view.matchId;
 for(const [p,controlled] of [[a,'ec'],[b,'ev']])assert.equal((await send(p,'role',command(1,oldMatchId,{controlled}))).status,200);
 assert.equal((await send(a,'mode',command(1,oldMatchId,{mode:'shuffle',rounds}))).status,200);
 for(let round=1;round<=rounds;round++){
  const r=await store.get(a.code),first=r.firstStarter==='player'?a:b,second=first===a?b:a,action=round===1?{kind:'own',direction:1,amount:1}:{kind:'hold',direction:1,amount:0};
  for(const p of [first,second])assert.equal((await send(p,'lock',command(round,oldMatchId,{action}))).status,200);
  if(round<rounds)for(const p of [a,b])assert.equal((await send(p,'ready',command(round,oldMatchId))).status,200);
 }
 const finished=await store.get(a.code),before=structuredClone(finished);assert.equal(finished.stage,'finished');assert.equal((await view(a)).data.canRematch,true);
 assert.equal((await req('',{code:a.code},'outsider')).status,409,'a finished room is reserved for its players until closed');
 const missingIdentity=await send(a,'rematch',{round:rounds,requestId:'missing-match-id'});assert.equal(missingIdentity.status,409,'rematch requires exact match identity: '+JSON.stringify(missingIdentity.data));
 const consentA=command(rounds,oldMatchId),consentB=command(rounds,oldMatchId);
 let response=await send(a,'rematch',consentA,now+1000);assert.equal(response.status,200);assert.equal(response.data.stage,'finished');assert.equal(response.data.rematchReady,true);assert.equal(response.data.rematchReadyCount,1);assert.equal(response.data.rematchHumanCount,2);assert.equal(response.data.matchId,oldMatchId);
 const consentVersion=response.data.version;response=await send(a,'rematch',consentA,now+1001);assert.equal(response.status,200);assert.equal(response.data.version,consentVersion,'duplicate consent does not increment version');
 assert.deepEqual((await store.get(a.code)).game.history,before.game.history,'first consent preserves the completed result');
 response=await send(b,'rematch',consentB,now+2000);assert.equal(response.status,200);assert.equal(response.data.stage,'role');assert.equal(response.data.round,1);assert.equal(response.data.code,a.code);assert.equal(response.data.joined,true);assert.equal(response.data.goal,null);assert.equal(response.data.clock,null);assert.equal(response.data.controlled,null);assert.equal(response.data.rematchReadyCount,0);assert.notEqual(response.data.matchId,oldMatchId);
 const fresh=await store.get(a.code);assert(fresh.version>before.version);assert.deepEqual(fresh.seats,before.seats);assert.deepEqual(fresh.players,before.players);assert.deepEqual(fresh.wallets,before.wallets);assert.deepEqual(fresh.profiles,before.profiles);assert.deepEqual(fresh.skins,before.skins);assert.equal(fresh.game.abilityMode,abilityMode);assert.equal(fresh.game.roundLimit,rounds);assert.equal(fresh.game.playerBudget,duelStartingPoints(fresh.game));assert.equal(fresh.game.cpuBudget,duelStartingPoints(fresh.game));assert.deepEqual(fresh.game.board,{ec:0,ev:0});assert.deepEqual(fresh.game.history,[]);assert.equal(fresh.timed,false);assert.equal(fresh.firstStarter,null);assert.equal(fresh.roleChoice,null);assert.deepEqual(fresh.autoLocks,[]);assert.deepEqual(fresh.greetings,[]);assert.equal(fresh.rating,undefined);assert.equal(fresh.expiresAt,now+2000+7200000);
 assert.equal(sqlite.prepare('SELECT expires_at FROM duel_rooms WHERE code=?').get(a.code).expires_at,fresh.expiresAt,'TTL is renewed in the storage column too');
 assert.equal((await send(a,'rematch',consentA,now+2001)).status,200,'exact request retry safely acknowledges the completed rematch');
 assert.equal((await send(a,'rematch',command(rounds,oldMatchId),now+2001)).status,409,'new stale rematch request cannot affect next match');
 for(const [op,extra] of [['role',{controlled:'ec'}],['ready',{}],['leave',{}],['mode',{mode:'shuffle'}],['lock',{action:{kind:'own',direction:1,amount:1}}]])assert.equal((await send(a,op,command(1,oldMatchId,extra),now+2001)).status,409,'stale '+op+' is fenced');
 assert.equal((await send(a,'draft',{round:1,sequence:1,matchId:oldMatchId,action:{kind:'own',direction:1,amount:1}},now+2001)).status,409);
 assert.equal((await send(a,'greeting',{matchId:oldMatchId,phrase:BATTLE_GREETINGS[0].id,requestId:'stale-greeting'},now+2001)).status,409);
 assert.equal((await send(a,'leave',{round:1,requestId:'missing-leave-match'},now+2001)).status,409,'old clients without a match identity cannot close a rematch');
 // Tokens continue to work for choosing the next match's bands.
 const current=fresh.matchId;assert.equal((await send(a,'role',command(1,current,{controlled:'ev'}),now+2002)).status,200);assert.equal((await send(b,'role',command(1,current,{controlled:'ec'}),now+2002)).status,200);
 assert.equal((await view(a,now+2002)).data.stage,'mode');
 await send(a,'close',command(1,current),now+2003);assert.equal((await req('',{code:a.code},'replacement',null,now+2004)).status,201);
}
// Rematches never turn random/ranked matchmaking into a private repeatable queue.
{
 const a=await req('/match',{}),code=a.data.view.code,r=await store.get(code);r.stage='finished';r.version++;await store.save(r,0);const view=await req('/'+code,undefined,'owner',a.data.token);assert.equal(view.data.canRematch,false);assert.equal((await req('/'+code+'/rematch',command(1,r.matchId),'owner',a.data.token)).status,409);
}
sqlite.close();console.log('Passed: immediate closed-code reuse, atomic ownership and stale-token fencing, finished-room reservation, 5/12-round consent rematches, preserved players/settings, renewed TTL, fresh budgets/skills/history, duplicate retries, stale-match rejection and matchmaking exclusion.');
