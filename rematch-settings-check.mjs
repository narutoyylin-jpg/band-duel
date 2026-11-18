import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import {isTeamComputer} from './team-cpu.mjs';

const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const rooms=new D1RoomStore(db),teams=new D1TeamStore(db),checks=[];let now=Date.now(),serial=0;
const data=extra=>({requestId:'rematch-settings-'+(++serial),...extra});
const safe=body=>JSON.stringify({...body,...(body?.token?{token:'<test token>'}:{})});
const ok=(r,status=200)=>{assert.equal(r.status,status,safe(r.data));return r.data;};
async function req(team,path='',body,id='settings-host',token=null){
 const response=await (team?handleTeamRequest:handleRoomRequest)(new Request('https://game.test/api/'+(team?'team-rooms':'rooms')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':id,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),team?teams:rooms,now);
 return {status:response.status,data:await response.json()};
}
async function view(ctx,p=ctx.players[0]){return p.view=ok(await req(ctx.team,'/'+ctx.code,undefined,p.id,p.token));}
function body(ctx,p,extra={}){return data({matchId:p.view.matchId,...(!ctx.team?{round:p.view.round}:{}),...extra});}
async function command(ctx,p,operation,extra={}){const result=await req(ctx.team,'/'+ctx.code+'/'+operation,body(ctx,p,extra),p.id,p.token);if(result.status===200)p.view=result.data;return result;}
async function fixture(team,code){
 const a=ok(await req(team,'',{code,rounds:5,abilityMode:'classic',timed:false},code+'-host'),201),b=ok(await req(team,'/'+code+'/join',{},code+'-peer'),team?201:200);
 return {team,code,players:[{id:code+'-host',token:a.token,view:a.view},{id:code+'-peer',token:b.token,view:b.view}]};
}
async function finish(ctx){
 const [host,peer]=ctx.players;await view(ctx,host);await view(ctx,peer);const rounds=host.view.roundLimit;
 if(ctx.team){
  for(const p of ctx.players){if(p.view.skills.enabled)ok(await command(ctx,p,'skill',{skill:p.view.skills.offers[0]}));ok(await command(ctx,p,'ready',{round:1,ready:true}));}
  ok(await command(ctx,host,'start'));await view(ctx,peer);
 }else{
  for(const [index,p] of ctx.players.entries())ok(await command(ctx,p,'role',{controlled:index?'ev':'ec',...(p.view.skills.enabled?{character:p.view.skills.offers[0]}:{})}));
  // The already selected room/rematch round count must not silently fall back to 5.
  ok(await command(ctx,host,'mode',{mode:'shuffle'}));await view(ctx,peer);assert.equal(host.view.roundLimit,rounds);
 }
 assert.equal(host.view.clock?.duration??null,host.view.timed?30000:null);
 const order=ctx.team?ctx.players:host.view.firstStarter==='you'?ctx.players:[...ctx.players].reverse();
 for(let round=1;round<=rounds;round++){
  for(const p of order){await view(ctx,p);ok(await command(ctx,p,'lock',ctx.team?{round,sequence:1,action:{ec:0,ev:0}}:{round,action:{kind:round===1?'own':'hold',direction:1,amount:round===1?1:0}}));}
  if(ctx.team)now+=2500;await view(ctx,host);
  assert.equal(host.view.stage,round===rounds?'finished':'revealed');
  if(round<rounds)for(const p of ctx.players){await view(ctx,p);ok(await command(ctx,p,ctx.team?'next':'ready',{round}));}
 }
 for(const p of ctx.players)await view(ctx,p);assert.equal(host.view.history.length,rounds);
}
const snapshot=r=>({game:structuredClone(r.game),timed:r.timed,clock:structuredClone(r.clock??null),deadline:r.deadline??null});
const denied=r=>assert([400,403,409].includes(r.status),safe(r.data));

for(const team of [false,true]){
 const ctx=await fixture(team,team?'SETTWO':'SETONE'),[host,peer]=ctx.players,store=team?teams:rooms;
 denied(await command(ctx,host,'rematch-settings',{settingsVersion:0,rounds:12}));
 await finish(ctx);const old=await store.get(ctx.code),unchanged=snapshot(old),oldMatchId=old.matchId;
 assert.deepEqual(host.view.rematchSettings,{rounds:5,abilityMode:'classic',timed:false,version:0});assert.equal(host.view.canEditRematchSettings,true);assert.equal(peer.view.canEditRematchSettings,false);
 const legacyConsent=body(ctx,peer);ok(await req(team,'/'+ctx.code+'/rematch',legacyConsent,peer.id,peer.token));await view(ctx,host);assert.equal(host.view.rematchReadyCount,1,'version-zero legacy consent still works');
 denied(await command(ctx,peer,'rematch-settings',{settingsVersion:0,rounds:12}));
 for(const invalid of [{rounds:7},{rounds:'12'},{abilityMode:'paid-character'},{timed:'off'},{settingsVersion:-1},{settingsVersion:'0'},{coins:999}])denied(await command(ctx,host,'rematch-settings',{settingsVersion:0,...invalid}));
 denied(await command(ctx,host,'rematch-settings',{rounds:12}));
 assert.deepEqual(snapshot(await store.get(ctx.code)),unchanged,'invalid changes preserve completed result');
 const change=body(ctx,host,{settingsVersion:0,rounds:12,abilityMode:'skills',timed:true});
 const changed=ok(await req(team,'/'+ctx.code+'/rematch-settings',change,host.id,host.token));host.view=changed;
 assert.deepEqual(changed.rematchSettings,{rounds:12,abilityMode:'skills',timed:true,version:1});assert.equal(changed.rematchReadyCount,0,'changes reset all consent');assert.deepEqual(snapshot(await store.get(ctx.code)),unchanged,'pending changes leave old game untouched');
 const afterChange=await store.get(ctx.code),retry=ok(await req(team,'/'+ctx.code+'/rematch-settings',change,host.id,host.token));assert.equal(retry.rematchSettings.version,1);assert.equal((await store.get(ctx.code)).version,afterChange.version,'exact settings retry is idempotent');
 denied(await command(ctx,host,'rematch-settings',{settingsVersion:0,timed:false}));
 denied(await req(team,'/'+ctx.code+'/rematch',body(ctx,peer,{settingsVersion:0}),peer.id,peer.token));
 denied(await req(team,'/'+ctx.code+'/rematch',body(ctx,peer),peer.id,peer.token));
 const peerVote=body(ctx,peer,{settingsVersion:1});ok(await req(team,'/'+ctx.code+'/rematch',peerVote,peer.id,peer.token));await view(ctx,host);assert.equal(host.view.rematchReadyCount,1);
 const beforeNoop=await store.get(ctx.code),noop=ok(await command(ctx,host,'rematch-settings',{settingsVersion:1,rounds:12,abilityMode:'skills',timed:true}));
 assert.equal(noop.rematchReadyCount,1,'same-value update preserves consent');assert.equal(noop.rematchSettings.version,1);assert.equal((await store.get(ctx.code)).version,beforeNoop.version,'same values are a storage no-op');
 const fresh=ok(await command(ctx,host,'rematch',{settingsVersion:1}));assert.notEqual(fresh.matchId,oldMatchId);assert.equal(fresh.roundLimit,12);assert.equal(fresh.startingPoints,30);assert.equal(fresh.yourBudget,30);assert.equal(fresh.skills.enabled,true);assert.equal(fresh.skills.offers.length,3);assert.equal(fresh.timed,true);assert.equal(fresh.round,1);assert.deepEqual(fresh.history,[]);
 const saved=await store.get(ctx.code);for(const p of ctx.players){const slot=Object.keys(old.seats).find(slot=>old.players[slot]===p.id);assert(slot);assert.equal(saved.seats[slot],old.seats[slot]);}
 if(team)for(const slot of Object.keys(saved.seats).filter(slot=>saved.players[slot]===null)){assert(isTeamComputer(saved,slot));assert(saved.game.characters[slot]);}
 const ack=ok(await req(team,'/'+ctx.code+'/rematch',peerVote,peer.id,peer.token));assert.equal(ack.matchId,fresh.matchId);assert.equal(ack.rematchReadyCount,0,'old successful consent retry cannot vote anew');
 denied(await req(team,'/'+ctx.code+'/rematch',legacyConsent,peer.id,peer.token));
 await finish(ctx);assert.equal(host.view.roundLimit,12);assert.equal(host.view.skills.enabled,true);
 const secondGame=snapshot(await store.get(ctx.code));assert.equal(host.view.rematchSettings.version,0);
 const competing=[body(ctx,host,{settingsVersion:0,rounds:5}),body(ctx,host,{settingsVersion:0,timed:false})];
 const race=await Promise.all(competing.map(b=>req(team,'/'+ctx.code+'/rematch-settings',b,host.id,host.token)));assert.equal(race.filter(r=>r.status===200).length,1,'one stale-version competing update wins');assert.equal(race.filter(r=>r.status===409).length,1);
 await view(ctx,host);assert.equal(host.view.rematchSettings.version,1);assert.deepEqual(snapshot(await store.get(ctx.code)),secondGame);
 ok(await command(ctx,host,'rematch-settings',{settingsVersion:1,rounds:5,abilityMode:'classic',timed:false}));await view(ctx,host);assert.equal(host.view.rematchSettings.version,2);
 for(const p of [peer,host]){await view(ctx,p);ok(await command(ctx,p,'rematch',{settingsVersion:2}));}
 await view(ctx,host);assert.equal(host.view.roundLimit,5);assert.equal(host.view.startingPoints,12);assert.equal(host.view.yourBudget,12);assert.equal(host.view.skills.enabled,false);assert.equal(host.view.timed,false);assert.deepEqual(host.view.history,[]);
 checks.push((team?'2v2 + CPUs':'1v1')+' pending settings, host authority, consent reset, stale versions, retry/no-op idempotence, 5→12→5 and classic→skills→classic');
}
// A final consent and a changed next-match configuration cannot both commit.
for(const team of [false,true]){
 const ctx=await fixture(team,team?'CASTWO':'CASONE'),[host,peer]=ctx.players,store=team?teams:rooms;await finish(ctx);const old=await store.get(ctx.code),oldGame=snapshot(old);
 ok(await command(ctx,host,'rematch',{settingsVersion:0}));
 const consent=body(ctx,peer,{settingsVersion:0}),edit=body(ctx,host,{settingsVersion:0,rounds:12,abilityMode:'skills',timed:true});
 const race=await Promise.all([req(team,'/'+ctx.code+'/rematch',consent,peer.id,peer.token),req(team,'/'+ctx.code+'/rematch-settings',edit,host.id,host.token)]);
 assert.equal(race.filter(r=>r.status===200).length,1,'only a final consent or a settings update commits');assert.equal(race.filter(r=>r.status===409).length,1);
 const current=await store.get(ctx.code),v=await view(ctx,host);
 if(current.matchId===old.matchId){assert.equal(v.stage,'finished');assert.equal(v.rematchReadyCount,0);assert.equal(v.rematchSettings.version,1);assert.deepEqual(snapshot(current),oldGame);}
 else {assert.equal(v.stage,team?'lobby':'role');assert.equal(v.roundLimit,5);assert.equal(v.timed,false);assert.equal(v.skills.enabled,false);assert.equal(v.rematchSettings.version,0);}
 checks.push((team?'2v2':'1v1')+' atomic settings-vs-final-consent race');
}
for(const team of [false,true])for(const kind of ['random','ranked']){
 const id='official-settings-'+team+'-'+kind,c=ok(await req(team,team?'':kind==='random'?'/match':'/ranked',team?{queue:kind}:{},id),201),fake={team,code:c.view.code,players:[{id,token:c.token,view:c.view}]};
 denied(await command(fake,fake.players[0],'rematch-settings',{settingsVersion:0,rounds:12}));checks.push((team?'2v2':'1v1')+' '+kind+' queue rejects custom rematch settings');
}
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rated_matches').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rating_events').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,0);
sqlite.close();console.log('Passed: '+checks.join('; ')+'.');
