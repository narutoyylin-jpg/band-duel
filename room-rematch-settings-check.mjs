import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
const store=new D1RoomStore(db),now=Date.now();let serial=0;
async function req(path='',body,id='owner',token=null,at=now){const response=await handleRoomRequest(new Request('https://game.test/api/rooms'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':id,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),store,at);return {status:response.status,data:await response.json()};}
const op=(round,matchId,extra={})=>({round,matchId,requestId:'settings-check-'+(++serial),...extra});
const created=await req('',{code:'SETNEW',rounds:5,abilityMode:'classic',timed:true}),a={id:'owner',token:created.data.token},path='/'+created.data.view.code;
const joined=await req(path+'/join',{},'peer'),b={id:'peer',token:joined.data.token};assert.equal(created.status,201);assert.equal(joined.status,200);
const send=(p,operation,body,at=now)=>req(path+'/'+operation,body,p.id,p.token,at);
const view=p=>req(path,undefined,p.id,p.token);
async function choose(matchId){for(const [p,controlled] of [[a,'ec'],[b,'ev']])assert.equal((await send(p,'role',op(1,matchId,{controlled}))).status,200);const mode=await send(a,'mode',op(1,matchId,{mode:'shuffle'}));assert.equal(mode.status,200);return mode.data;}
async function finish(matchId,rounds){for(let round=1;round<=rounds;round++){const state=await store.get('SETNEW'),first=state.firstStarter==='player'?a:b,second=first===a?b:a,action=round===1?{kind:'own',direction:1,amount:1}:{kind:'hold',direction:1,amount:0};for(const p of [first,second])assert.equal((await send(p,'lock',op(round,matchId,{action}))).status,200);if(round<rounds)for(const p of [a,b])assert.equal((await send(p,'ready',op(round,matchId))).status,200);}}
let matchId=created.data.view.matchId;
assert.equal((await send(a,'rematch-settings',op(1,matchId,{settingsVersion:0,rounds:12}))).status,403,'active setup cannot edit next match');
await choose(matchId);await finish(matchId,5);
const initial=await store.get('SETNEW'),initialHistory=structuredClone(initial.game.history),initialBoard={...initial.game.board};
assert.deepEqual((await view(a)).data.rematchSettings,{rounds:5,abilityMode:'classic',timed:true,version:0});assert.equal((await view(a)).data.canEditRematchSettings,true);assert.equal((await view(b)).data.canEditRematchSettings,false);
assert.equal((await send(b,'rematch-settings',op(5,matchId,{settingsVersion:0,rounds:12}))).status,403);
for(const extra of [{rounds:6},{rounds:'12'},{abilityMode:'paid'},{timed:'off'},{settingsVersion:-1},{settingsVersion:'0'}])assert.equal((await send(a,'rematch-settings',op(5,matchId,{settingsVersion:0,...extra}))).status,400);
const missingVersion=op(5,matchId,{rounds:12});assert.equal((await send(a,'rematch-settings',missingVersion)).status,400);
assert.equal((await send(a,'rematch-settings',{round:5,requestId:'missing-settings-match',settingsVersion:0,rounds:12})).status,409,'finished first-generation rooms require explicit match identity for settings');
const firstConsent=op(5,matchId,{settingsVersion:0});assert.equal((await send(b,'rematch',firstConsent)).data.rematchReadyCount,1);
const changedRequest=op(5,matchId,{settingsVersion:0,rounds:12,abilityMode:'skills',timed:false});
let result=await send(a,'rematch-settings',changedRequest);assert.equal(result.status,200);assert.deepEqual(result.data.rematchSettings,{rounds:12,abilityMode:'skills',timed:false,version:1});assert.equal(result.data.rematchReadyCount,0);assert.equal(result.data.stage,'finished');assert.equal(result.data.roundLimit,5);assert.equal(result.data.timed,true);assert.equal(result.data.skills.enabled,false);
let stored=await store.get('SETNEW');assert.deepEqual(stored.game.history,initialHistory);assert.deepEqual(stored.game.board,initialBoard);assert.equal(stored.game.playerBudget,initial.game.playerBudget);assert.equal(stored.game.cpuBudget,initial.game.cpuBudget);assert.deepEqual(stored.rematchRequests,{player:null,cpu:null});assert.deepEqual(stored.receipts,{player:null,cpu:null});
const afterChangeVersion=stored.version;result=await send(a,'rematch-settings',changedRequest);assert.equal(result.status,200);assert.equal(result.data.version,afterChangeVersion,'exact settings retry acknowledges without reapplying');
assert.equal((await send(a,'rematch-settings',op(5,matchId,{settingsVersion:0,rounds:5}))).status,409,'new stale settings update is rejected');
assert.equal((await send(a,'rematch-settings',op(5,matchId,{settingsVersion:0,rounds:12}))).status,409,'new stale same-value request still needs current version');
assert.equal((await send(b,'rematch',firstConsent)).status,409,'old consent is invalidated by settings change');
assert.equal((await send(b,'rematch',op(5,matchId))).status,409,'missing version cannot consent after settings change');
const consentA=op(5,matchId,{settingsVersion:1}),consentB=op(5,matchId,{settingsVersion:1});result=await send(a,'rematch',consentA);assert.equal(result.data.rematchReadyCount,1);
const readyVersion=result.data.version;result=await send(a,'rematch-settings',op(5,matchId,{settingsVersion:1,rounds:12,abilityMode:'skills',timed:false}));assert.equal(result.status,200);assert.equal(result.data.rematchReadyCount,1);assert.equal(result.data.version,readyVersion,'same settings preserve consent');
result=await send(a,'rematch-settings',changedRequest);assert.equal(result.status,200);assert.equal(result.data.rematchReadyCount,1,'exact settings retry cannot clear consent');
result=await send(b,'rematch',consentB,now+1000);assert.equal(result.status,200);assert.equal(result.data.stage,'role');assert.notEqual(result.data.matchId,matchId);assert.deepEqual(result.data.rematchSettings,{rounds:12,abilityMode:'skills',timed:false,version:0});assert.equal(result.data.roundLimit,12);assert.equal(result.data.startingPoints,30);assert.equal(result.data.yourBudget,30);assert.equal(result.data.opponentBudget,30);assert.equal(result.data.timed,false);assert.equal(result.data.skills.enabled,true);assert.equal(result.data.skills.offers.length,3);assert.deepEqual(result.data.history,[]);
const nextId=result.data.matchId;assert.equal((await send(a,'rematch',consentA,now+1001)).status,200,'completed consent retry remains acknowledged');assert.equal((await send(a,'rematch-settings',changedRequest,now+1001)).status,409,'old settings cannot affect a new match');
const nextMode=await choose(nextId);assert.equal(nextMode.roundLimit,12,'choosing Shuffle without a new length preserves pending twelve-round setup');assert.equal(nextMode.clock,null);assert.equal(nextMode.skills.enabled,true);
await finish(nextId,12);matchId=nextId;
// Flip all settings back in the same room, and make concurrent host updates use CAS.
const [x,y]=await Promise.all([send(a,'rematch-settings',op(12,matchId,{settingsVersion:0,rounds:5,abilityMode:'classic',timed:true})),send(a,'rematch-settings',op(12,matchId,{settingsVersion:0,rounds:12,abilityMode:'skills',timed:true}))]);assert.equal([x,y].filter(r=>r.status===200).length,1);assert.equal([x,y].filter(r=>r.status===409).length,1);
let settings=(await view(a)).data.rematchSettings;if(settings.rounds!==5||settings.abilityMode!=='classic')assert.equal((await send(a,'rematch-settings',op(12,matchId,{settingsVersion:settings.version,rounds:5,abilityMode:'classic',timed:true}))).status,200);
settings=(await view(a)).data.rematchSettings;for(const p of [a,b])result=await send(p,'rematch',op(12,matchId,{settingsVersion:settings.version}));assert.equal(result.data.stage,'role');assert.equal(result.data.roundLimit,5);assert.equal(result.data.yourBudget,12);assert.equal(result.data.timed,true);assert.equal(result.data.skills.enabled,false);assert.deepEqual(result.data.skills.offers,[]);assert.equal(result.data.rematchSettings.version,0);
assert.deepEqual((await store.get('SETNEW')).seats,initial.seats);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rated_matches').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,0);
sqlite.close();console.log('Passed: host-only pending rematch settings, strict values/versions, exact retry acknowledgement, preserved completed results, consent invalidation, same-value consent preservation, concurrent settings CAS, 5↔12 budgets, Classic↔Skills offers, timer flip, same-room players and stale-match fencing.');
