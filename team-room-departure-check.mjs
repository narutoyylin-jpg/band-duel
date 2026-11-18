import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1SocialStore} from './social.mjs';
import {isTeamComputer,humanTeamSlots} from './team-cpu.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const teams=new D1TeamStore(db),rooms=new D1RoomStore(db),social=new D1SocialStore(db),checks=[];let now=Date.now(),serial=0;
const data=extra=>({requestId:'team-departure-'+(++serial),...extra});
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data?.error||r.data));return r.data;};
async function req(path='',body,id='depart-host',token=null,team=true){const response=await (team?handleTeamRequest:handleRoomRequest)(new Request('https://game.test/api/'+(team?'team-rooms':'rooms')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':id,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),team?teams:rooms,now);return {status:response.status,data:await response.json()};}
async function view(ctx,p=ctx.players[0]){return p.view=ok(await req('/'+ctx.code,undefined,p.id,p.token));}
async function cmd(ctx,p,op,extra={}){const payload={matchId:p.view.matchId,...(['ready','lock','next'].includes(op)?{round:p.view.round}:{}),...extra},result=await req('/'+ctx.code+'/'+op,op==='draft'?payload:data(payload),p.id,p.token);if(result.status===200)p.view=result.data;return result;}
async function make(count=2,{skills=false,timed=false}={}){
 const code=String(++serial).padStart(6,'D'),players=[];
 for(let i=0;i<count;i++){const id=code+'-player-'+i,result=ok(await req(i?'/'+code+'/join':'',i?{}:{code,rounds:5,abilityMode:skills?'skills':'classic',timed},id),201);players.push({id,token:result.token,view:result.view});}
 return {code,players};
}
async function start(ctx){for(const p of ctx.players){await view(ctx,p);if(p.view.skills.enabled)ok(await cmd(ctx,p,'skill',{skill:p.view.skills.offers[0]}));ok(await cmd(ctx,p,'ready',{ready:true}));}await view(ctx,ctx.players[0]);ok(await cmd(ctx,ctx.players[0],'start'));for(const p of ctx.players)await view(ctx,p);}
async function round(ctx,players=ctx.players,{move=false}={}){
 for(const p of players){await view(ctx,p);ok(await cmd(ctx,p,'lock',{sequence:1,action:move?{ec:0,ev:0,[p.view.controlled]:1}:{ec:0,ev:0}}));}
 now+=3000;for(const p of players)await view(ctx,p);
}
async function next(ctx,players=ctx.players){for(const p of players){await view(ctx,p);ok(await cmd(ctx,p,'next'));}for(const p of players)await view(ctx,p);}
const actorSlot=(r,id)=>Object.keys(r.players).find(slot=>r.players[slot]===id);
const invalidToken=async(ctx,p)=>assert([401,403].includes((await req('/'+ctx.code,undefined,p.id,p.token)).status),'departed token cannot read remaining room');

for(const count of [2,3,4]){
 const ctx=await make(count),[host,...remaining]=ctx.players,old=await teams.get(ctx.code),oldSlot=actorSlot(old,host.id);
 const departed=ok(await cmd(ctx,host,'leave'));assert.equal(departed.left,true);const r=await teams.get(ctx.code);assert.equal(r.stage,'lobby');assert.equal(humanTeamSlots(r).length,count-1);assert(isTeamComputer(r,oldSlot));assert.equal(r.host,actorSlot(r,remaining[0].id));
 await invalidToken(ctx,host);assert.equal((await req('',{code:ctx.code},'duplicate-code')).status,409,'occupied room survives departure');
 const newId=ctx.code+'-replacement',joined=ok(await req('/'+ctx.code+'/join',{},newId),201),replacement={id:newId,token:joined.token,view:joined.view};
 assert.equal(joined.view.humanCount,count);assert.equal(joined.view.host,false);assert.equal((await cmd(ctx,replacement,'close')).status,403,'replacement cannot close host room');
 const newHost=remaining[0];await view(ctx,newHost);assert.equal(newHost.view.host,true);ok(await cmd(ctx,newHost,'settings',{rounds:12,timed:true}));
 assert.notEqual((await req('/'+ctx.code+'/leave',data({matchId:old.matchId}),host.id,host.token)).status,200,'old token cannot close survivor');
 ok(await cmd(ctx,newHost,'close'));assert.equal((await teams.get(ctx.code)).stage,'closed');ok(await req('',{code:ctx.code},'reuse-after-close'),201);
 checks.push(count+'-human lobby departure, host transfer, CPU replacement and host-only close');
}

// A locked player is replaced without discarding their already committed move.
{
 const ctx=await make(4,{skills:true,timed:true}),[host,mate,enemy,other]=ctx.players;await start(ctx);await round(ctx,ctx.players,{move:true});assert.equal(host.view.stage,'revealed');await next(ctx);
 await view(ctx,host);ok(await cmd(ctx,host,'lock',{sequence:1,action:{ec:0,ev:0,[host.view.controlled]:1}}));const before=await teams.get(ctx.code),slot=actorSlot(before,host.id),participants=structuredClone(before.matchParticipants);
 ok(await cmd(ctx,host,'leave'));const after=await teams.get(ctx.code);assert.equal(after.stage,'plan');assert.deepEqual(after.game.board,before.game.board);assert.deepEqual(after.game.budgets,before.game.budgets);assert.deepEqual(after.game.characters,before.game.characters);assert.deepEqual(after.game.skillUsed,before.game.skillUsed);assert.deepEqual(after.drafts[slot],before.drafts[slot]);assert.equal(after.locked[slot],true);assert.equal(after.deadline,before.deadline);assert.deepEqual(after.game.history,before.game.history);assert.deepEqual(after.matchParticipants,participants);
 await invalidToken(ctx,host);await view(ctx,enemy);ok(await cmd(ctx,enemy,'draft',{round:2,sequence:1,action:{ec:-1,ev:0}}));const enemyBefore=await teams.get(ctx.code),enemySlot=actorSlot(enemyBefore,enemy.id);
 ok(await cmd(ctx,enemy,'leave'));const enemyAfter=await teams.get(ctx.code);assert(isTeamComputer(enemyAfter,enemySlot));assert.equal(enemyAfter.game.budgets[enemySlot],enemyBefore.game.budgets[enemySlot]);assert.deepEqual(enemyAfter.drafts[enemySlot],enemyBefore.drafts[enemySlot]);assert.deepEqual(enemyAfter.matchParticipants,participants);
 await round(ctx,[mate,other]);assert.equal(mate.view.stage,'revealed');assert.equal(mate.view.history.length,2);assert.equal((await teams.get(ctx.code)).game.budgets[slot],before.game.budgets[slot]-1,'locked move executes once after departure');
 checks.push('active locked/unlocked CPU takeover preserves board, budget, skill, draft, timer and original participants');
}

// One remaining human can continue an already started room with CPUs.
{
 const ctx=await make(2),[host,peer]=ctx.players;await start(ctx);ok(await cmd(ctx,host,'leave'));await view(ctx,peer);assert.equal(peer.view.humanCount,1);assert.equal(peer.view.stage,'plan');
 await round(ctx,[peer]);assert.equal(peer.view.stage,'revealed');await next(ctx,[peer]);assert.equal(peer.view.stage,'plan');assert.equal(peer.view.round,2);
 for(let n=2;n<=5;n++){await round(ctx,[peer]);if(n<5)await next(ctx,[peer]);}assert.equal(peer.view.stage,'finished');assert.equal(peer.view.canRematch,true);
 ok(await cmd(ctx,peer,'rematch',{settingsVersion:peer.view.rematchSettings.version}));await view(ctx,peer);assert.equal(peer.view.stage,'lobby');ok(await cmd(ctx,peer,'ready',{ready:true}));ok(await cmd(ctx,peer,'start'));assert.equal(peer.view.stage,'plan','the surviving human can continue the same room through a rematch');
 ok(await cmd(ctx,peer,'leave'));assert.equal((await teams.get(ctx.code)).stage,'closed');ok(await req('',{code:ctx.code},'cross-format-owner',null,false),201);
 checks.push('solo continuation and rematch after departure, last-real closure and cross-format code reuse');
}

// Completion facts remain attached to the completed roster when someone leaves.
{
 const ctx=await make(3),[host,mate,enemy]=ctx.players;await start(ctx);for(let n=1;n<=5;n++){await round(ctx);if(n<5)await next(ctx);}
 const before=await view(ctx,host);assert.equal(before.stage,'finished');ok(await cmd(ctx,host,'leave'));const after=await view(ctx,mate);assert.equal(after.stage,'finished');assert.deepEqual(after.history,before.history);assert.deepEqual(after.mvp,before.mvp);
 assert.deepEqual(after.players.map(p=>({slot:p.slot,profile:p.profile,computer:p.computer})),before.players.map(p=>({slot:p.slot,profile:p.profile,computer:p.computer})),'completed action/MVP names do not turn into CPU names');
 assert.equal(after.rematchHumanCount,2);assert.equal(after.rematchReadyCount,0);assert.equal(after.host,true);await invalidToken(ctx,host);
 for(const p of [mate,enemy]){await view(ctx,p);ok(await cmd(ctx,p,'rematch',{settingsVersion:p.view.rematchSettings.version}));}
 await view(ctx,mate);assert.equal(mate.view.stage,'lobby');assert.equal(mate.view.humanCount,2);assert.equal(mate.view.hasComputers,true);
 checks.push('finished result and roster preservation, reduced consent count and surviving-player rematch');
}

// A leave racing a join must retain everyone except the actual departed token.
{
 const ctx=await make(3),departing=ctx.players[1],id=ctx.code+'-racing-newcomer';await view(ctx,departing);
 const [left,joined]=await Promise.all([cmd(ctx,departing,'leave'),req('/'+ctx.code+'/join',{},id)]);ok(left);ok(joined,201);
 const r=await teams.get(ctx.code),ids=Object.values(r.players).filter(Boolean);assert.equal(r.stage,'lobby');assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert(ids.includes(id));assert(!ids.includes(departing.id));await invalidToken(ctx,departing);
 checks.push('concurrent leave/join keeps exactly three distinct humans');
}

// Either the final departure closes first or the accepted newcomer stays; a
// concurrent join must not leave an occupied room closed or revive an empty one.
{
 const ctx=await make(1),host=ctx.players[0],id=ctx.code+'-last-racing-join';
 const [left,joined]=await Promise.all([cmd(ctx,host,'leave'),req('/'+ctx.code+'/join',{},id)]);ok(left);
 const current=await teams.get(ctx.code),humans=humanTeamSlots(current);
 if(joined.status===201){assert.equal(current.stage,'lobby');assert.equal(humans.length,1);assert.equal(current.players[humans[0].id],id);}
 else {assert.equal(joined.status,409);assert.equal(current.stage,'closed');assert.equal(humans.length,0);}
 await invalidToken(ctx,host);checks.push('last-real departure racing a join cannot create a ghost or close an accepted survivor');
}

// Leaving a party releases that identity while its remaining friend keeps waiting.
{
 const a='party-depart-host',b='party-depart-peer';await social.ensure(a,now);await social.ensure(b,now);await social.request(a,b,now);await social.change(b,a,'accept',now);
 const first=ok(await req('',{queue:'random',party:true},a),201),j=ok(await req('/'+first.view.code+'/join',{},b),201),ctx={code:first.view.code,players:[{id:a,token:first.token,view:first.view},{id:b,token:j.token,view:j.view}]};
 ok(await cmd(ctx,ctx.players[0],'leave'));const r=await teams.get(ctx.code);assert.equal(r.stage,'party');assert.equal(humanTeamSlots(r).length,1);assert(!Object.keys(r.seats).some(slot=>isTeamComputer(r,slot)),'waiting parties are not CPU-filled');
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_team_queue_members WHERE identity=?').get('account:'+a).n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_team_queue_members WHERE identity=?').get('account:'+b).n,1);
 ok(await req('',{queue:'random'},a),201);checks.push('party survivor waits without CPUs and departed account can queue again');
}

// A ranked leaver retains the original result while the CPU finishes their seat.
{
 const ids=['ranked-depart-original','ranked-depart-survivor'],a=ok(await req('',{queue:'ranked'},ids[0]),201),b=ok(await req('',{queue:'ranked'},ids[1]),201);now+=15001;
 const ctx={code:a.view.code,players:[{id:ids[0],token:a.token,view:a.view},{id:ids[1],token:b.token,view:b.view}]};
 for(const p of ctx.players){const v=ok(await req('/'+p.view.code,undefined,p.id,p.token));p.view=v;ctx.code=v.code;}
 for(const p of ctx.players)ok(await cmd(ctx,p,'ready',{ready:true}));for(const p of ctx.players)await view(ctx,p);
 const original=structuredClone((await teams.get(ctx.code)).matchParticipants),host=ctx.players.find(p=>p.view.host),peer=ctx.players.find(p=>p!==host),slot=actorSlot(await teams.get(ctx.code),host.id);
 ok(await cmd(ctx,host,'lock',{sequence:1,action:{ec:0,ev:0,[host.view.controlled]:1}}));ok(await cmd(ctx,host,'leave'));
 for(let n=1;n<=5;n++){await round(ctx,[peer]);if(n<5)await next(ctx,[peer]);}
 const end=await teams.get(ctx.code);assert.equal(end.stage,'finished');assert.deepEqual(end.matchParticipants,original);assert(isTeamComputer(end,slot));
 for(const id of ids)assert.equal((await teams.ranking.profile(id)).games,1,'departed original humans still receive the final ranked result');
 const event=sqlite.prepare('SELECT participants FROM duel_rating_events WHERE match_id=?').get(end.matchId);assert.deepEqual(new Set(JSON.parse(event.participants).map(p=>p.accountId)),new Set(ids));
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts WHERE id LIKE ?').get(end.matchId+':%').n,2);await view(ctx,peer);for(const id of ids)assert.equal((await teams.ranking.profile(id)).games,1);checks.push('ranked CPU takeover settles original players and wallets once');
}

// A matched-lobby departure and teammate/CPU role swap keep the immutable
// original accounts aligned with their new slots when the game later settles.
{
 const players=[];for(let i=0;i<4;i++){const id='ranked-lobby-swap-'+i,c=ok(await req('',{queue:'ranked'},id),201);players.push({id,token:c.token,view:c.view});}
 const ctx={code:players[0].view.code,players};for(const p of players){p.view=ok(await req('/'+p.view.code,undefined,p.id,p.token));ctx.code=p.view.code;}
 const leaver=players.find(p=>p.view.host),swapper=players.find(p=>p!==leaver&&p.view.yourTeam===leaver.view.yourTeam),departedSlot=leaver.view.yourSlot,oldSwapSlot=swapper.view.yourSlot;
 ok(await cmd(ctx,leaver,'leave'));const remaining=players.filter(p=>p!==leaver);for(const p of remaining)await view(ctx,p);
 ok(await cmd(ctx,swapper,'seat',{seat:departedSlot}));assert.equal(swapper.view.yourSlot,departedSlot);
 const swapped=await teams.get(ctx.code);assert.equal(swapped.matchParticipants.find(p=>p.accountId===swapper.id).slot,departedSlot);assert.equal(swapped.matchParticipants.find(p=>p.accountId===leaver.id).slot,oldSwapSlot);assert.equal(swapped.departedPlayers[oldSwapSlot].accountId,leaver.id);assert(isTeamComputer(swapped,oldSwapSlot));
 for(const p of remaining){await view(ctx,p);ok(await cmd(ctx,p,'ready',{ready:true}));}for(const p of remaining)await view(ctx,p);
 for(let n=1;n<=5;n++){await round(ctx,remaining);if(n<5)await next(ctx,remaining);}
 assert.equal(remaining[0].view.stage,'finished');for(const p of players)assert.equal((await teams.ranking.profile(p.id)).games,1);checks.push('ranked matched-lobby departure plus CPU role swap preserves original scoring identities');
}
sqlite.close();console.log('Passed: '+checks.join('; ')+'.');
