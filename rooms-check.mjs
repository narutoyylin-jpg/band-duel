import assert from 'node:assert/strict';
import {handleRoomRequest} from './rooms-service.mjs';
import {duelActions,resolveTerminalDuel,DUEL_MODES,DUEL_TARGETS} from './duel-core.mjs';
class MemoryStore {
 rows=new Map();queue=null;
 async get(code){return structuredClone(this.rows.get(code)||null);}
 async create(r){if(this.rows.has(r.code))return false;this.rows.set(r.code,structuredClone(r));return true;}
 async save(r,v){if(this.rows.get(r.code)?.version!==v)return false;this.rows.set(r.code,structuredClone(r));return true;}
 async claimQueue(code,expiresAt,now){if(this.queue?.expiresAt<=now)this.queue=null;if(!this.queue)this.queue={code,expiresAt};return this.queue?.code||null;}
 async releaseQueue(code){if(this.queue?.code===code)this.queue=null;}
 async waitingCount(now){return this.queue?.expiresAt>now&&this.rows.get(this.queue.code)?.stage==='lobby'?1:0;}
 async cleanup(now){for(const [c,r] of this.rows)if(r.expiresAt<=now)this.rows.delete(c);if(this.queue?.expiresAt<=now)this.queue=null;}
}
const store=new MemoryStore(),now=Date.now();let id=0;
async function request(path='',body,token,at=now,db=store,origin){
 const response=await handleRoomRequest(new Request('https://lab.test/api/rooms'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body)}),db,at);
 return {status:response.status,data:await response.json()};
}
const op=(round,extra={})=>({round,requestId:'test-request-'+(++id),...extra});
function privateView(v,otherToken){
 for(const key of ['pending','seats','players'])assert(!(key in v));if(v.stage==='finished')assert(v.opponentGoal?.type);else assert(!('opponentGoal' in v));assert(!JSON.stringify(v).includes(otherToken));
 for(const h of v.history){for(const key of ['cpu','player'])assert(!(key in h));assert(h.opponentAction);if(h.round<5)assert.equal(h.decision,null);}
}
for(const mode of ['shuffle']){
 const created=await request('',{});assert.equal(created.status,201);const p=created.data,code=p.view.code;
 assert.equal(p.view.stage,'lobby');assert.equal(p.view.goal,null);
 const joins=await Promise.all([request('/'+code+'/join',{}),request('/'+code+'/join',{})]);assert.deepEqual(joins.map(x=>x.status).sort(),[200,409]);const c=joins.find(x=>x.status===200).data,ts={player:p.token,cpu:c.token};
 assert.equal(c.view.stage,'role');assert.equal(c.view.goal,null);assert.equal(c.view.controlled,null);assert.equal(p.view.controlled,null);assert.equal(c.view.firstStarter,null);
 assert.equal((await request('/'+code)).status,401);assert.equal((await request('/'+code,undefined,'a'.repeat(64))).status,403);
 assert.equal((await request('/'+code+'/mode',op(1,{mode}),p.token)).status,409);
 assert.equal((await request('/'+code+'/ready',op(1),p.token)).status,409);
 const controlled=mode==='types'||mode==='together'?'ec':'ev';
 const confirmed=await request('/'+code+'/role',op(1,{controlled}),p.token);assert.equal(confirmed.data.stage,'role');assert.equal(confirmed.data.yourReady,true);assert.equal(confirmed.data.controlled,controlled);
 assert.equal((await request('/'+code+'/role',op(1,{controlled}),c.token)).status,409);
 const both=await request('/'+code+'/role',op(1,{controlled:controlled==='ec'?'ev':'ec'}),c.token);assert.equal(both.data.stage,'mode');assert.equal(both.data.goal,null);assert.notEqual(both.data.controlled,controlled);
 assert.equal((await request('/'+code+'/mode',op(1,{mode}),c.token)).status,409);
 const selected=await request('/'+code+'/mode',op(1,{mode}),p.token);assert.equal(selected.status,200);assert.equal(selected.data.stage,'plan');assert.equal(selected.data.mode,mode);
 const guest=(await request('/'+code,undefined,c.token)).data;if(mode==='types')assert.notEqual(selected.data.goal.id,guest.goal.id);if(['together','separate'].includes(mode))assert.equal(selected.data.goal.id,guest.goal.id);assert.notEqual(selected.data.firstStarter,guest.firstStarter);
 if(mode==='types')for(const v of [selected.data,guest]){assert.equal(v.goal.eSide,null);assert.equal(v.goal.hSide,null);privateView(v,'unrelated-token');}
 const first=(await store.get(code)).firstStarter;
 for(let round=1;round<=5;round++){
  const internal=await store.get(code),who=first,second=who==='player'?'cpu':'player';
  const actions=Object.fromEntries(['player','cpu'].map(a=>{const options=duelActions(internal.game,a);return [a,options[round%options.length]];}));
  const inputs=Object.fromEntries(['player','cpu'].map(a=>[a,op(round,{action:actions[a]})]));
  assert.equal((await request('/'+code+'/lock',inputs[second],ts[second])).status,409);
  const locked=await request('/'+code+'/lock',inputs[who],ts[who]);assert.equal(locked.status,200);assert.equal(locked.data.yourLocked,true);assert.equal(locked.data.yourTurn,false);assert.deepEqual(locked.data.yourLockedAction,actions[who]);
  assert.deepEqual(locked.data.board,internal.game.board);assert.equal(locked.data.history.length,round-1);assert.equal(locked.data.yourBudget,who==='player'?internal.game.playerBudget:internal.game.cpuBudget);
  const hidden=(await request('/'+code,undefined,ts[second])).data;assert.equal(hidden.yourTurn,true);assert.equal(hidden.opponentLocked,true);assert.equal(hidden.yourLockedAction,null);assert.deepEqual(hidden.board,internal.game.board);assert.equal(hidden.opponentBudget,locked.data.yourBudget);privateView(hidden,ts[who]);
  const resolved=await Promise.all([request('/'+code+'/lock',inputs[second],ts[second]),request('/'+code+'/lock',inputs[who],ts[who])]);assert(resolved.every(r=>r.status===200));
  const expected=resolveTerminalDuel(internal.game,actions.player,actions.cpu),actual=await store.get(code);assert.deepEqual(actual.game,expected);assert.equal(actual.game.history.length,round);
  const views=[];for(const actor of ['player','cpu']){const v=(await request('/'+code,undefined,ts[actor])).data;views.push(v);privateView(v,ts[actor==='player'?'cpu':'player']);assert(!('yourScore' in v));assert(v.yourBudget>=0);assert.equal(v.yourLockedAction,null);assert.deepEqual(v.history.at(-1).startBoard,internal.game.board);assert.equal((await request('/'+code+'/lock',op(round,{action:actions[actor]}),ts[actor])).status,409);}
  assert.deepEqual(views[0].history.at(-1).yourAction,views[1].history.at(-1).opponentAction);assert.deepEqual(views[0].history.at(-1).afterFirstBoard,views[1].history.at(-1).afterFirstBoard);assert.notEqual(views[0].history.at(-1).firstStarter,views[1].history.at(-1).firstStarter);if(round===5){assert.deepEqual(views[0].opponentGoal,views[1].goal);assert.deepEqual(views[1].opponentGoal,views[0].goal);}
  if(round<5){const waiting=await request('/'+code+'/ready',op(round),p.token);assert.equal(waiting.data.stage,'revealed');assert.equal(waiting.data.round,round);const next=await request('/'+code+'/ready',op(round),c.token);assert.equal(next.data.stage,'plan');assert.equal(next.data.round,round+1);assert.equal(next.data.roundStarter,who==='cpu'?'you':'opponent');assert.equal((await request('/'+code+'/ready',op(round),p.token)).status,409);}else assert.equal(actual.stage,'finished');
 }
 assert.equal((await request('/'+code,undefined,p.token,now+7200001)).status,410);
}
assert.equal((await request('',{},null,now,store,'https://evil.test')).status,403);assert.equal((await request('',{unexpected:true})).status,400);
// The host sets 12 rounds for both phones; turn barriers and final judgment follow that choice.
{
 const host=(await request('',{rounds:12})).data,peer=(await request('/'+host.view.code+'/join',{})).data,code=host.view.code,ts={player:host.token,cpu:peer.token};assert.equal(host.view.roundLimit,12);
 await request('/'+code+'/role',op(1,{controlled:'ec'}),host.token);
 await request('/'+code+'/role',op(1,{controlled:'ev'}),peer.token);
 assert.equal((await request('/'+code+'/mode',op(1,{mode:'together',rounds:12}),host.token)).status,400);
 assert.equal((await request('/'+code+'/mode',op(1,{mode:'shuffle',rounds:7}),host.token)).status,400);
 const selected=await request('/'+code+'/mode',op(1,{mode:'shuffle',rounds:12}),host.token);
 assert.equal(selected.status,200);assert.equal(selected.data.roundLimit,12);assert.equal(selected.data.startingPoints,30);assert.equal(selected.data.yourBudget,30);
 assert.equal((await request('/'+code,undefined,peer.token)).data.roundLimit,12);
 for(let round=1;round<=12;round++){
  const game=(await store.get(code)).game,first=(await store.get(code)).firstStarter,second=first==='player'?'cpu':'player';
  for(const actor of [first,second]){
   const actions=duelActions(game,actor),action=actions.find(x=>x.kind==='hold')||actions[0];
   const locked=await request('/'+code+'/lock',op(round,{action}),ts[actor]);assert.equal(locked.status,200);
  }
  const view=(await request('/'+code,undefined,host.token)).data;
  assert.equal(view.stage,round===12?'finished':'revealed');assert.equal(view.history.length,round);assert.equal(view.history.at(-1).decision===null,round<12);
  if(round<12){await request('/'+code+'/ready',op(round),host.token);const next=await request('/'+code+'/ready',op(round),peer.token);assert.equal(next.data.stage,'plan');}
 }
}
// A previously stored direction-specific Type I vs Type II room adopts the new rule.
const migrating=(await request('',{})).data,migratingPeer=(await request('/'+migrating.view.code+'/join',{})).data;
const previous=await store.get(migrating.view.code);Object.assign(previous,{mode:'types',stage:'plan',roleChoice:'player',firstStarter:'player'});
previous.game.controlled='ec';previous.game.goals={player:{...DUEL_TARGETS[0]},cpu:{...DUEL_TARGETS[2]}};store.rows.set(previous.code,previous);
const migratedView=(await request('/'+previous.code,undefined,migrating.token)).data;
assert.equal(migratedView.goal.type,'Type I');assert.equal(migratedView.goal.eSide,null);assert.equal(migratedView.goal.hSide,null);privateView(migratedView,migratingPeer.token);
assert.equal((await request('/'+previous.code+'/lock',op(1,{action:{kind:'own',direction:-1,amount:3}}),migrating.token)).status,200);
const migratedResult=await request('/'+previous.code+'/lock',op(1,{action:{kind:'own',direction:1,amount:3}}),migratingPeer.token);
assert.equal(migratedResult.status,200);assert(!('opponentScore' in migratedResult.data));assert.equal(migratedResult.data.history[0].decision,null);assert.equal(migratedResult.data.history[0].type,'Type I');
const closed=(await request('',{})).data,peer=(await request('/'+closed.view.code+'/join',{})).data;
assert.equal((await request('/'+closed.view.code+'/close',op(1),closed.token)).data.stage,'closed');assert.equal((await request('/'+closed.view.code,undefined,peer.token)).data.stage,'closed');assert.equal((await request('/'+closed.view.code+'/ready',op(1),peer.token)).status,409);
const queueStore=new MemoryStore();
const waiting=await request('/match',{},null,now,queueStore);assert.equal(waiting.status,201);assert.equal(waiting.data.view.waitingPlayers,1);
assert.deepEqual((await request('/queue',undefined,null,now,queueStore)).data,{waitingPlayers:1});
const matched=await request('/match',{},null,now,queueStore);assert.equal(matched.status,200);assert.equal(matched.data.view.code,waiting.data.view.code);assert.equal(matched.data.view.stage,'role');assert.equal(queueStore.queue,null);
assert.deepEqual((await request('/queue',undefined,null,now,queueStore)).data,{waitingPlayers:0});
const cancelling=await request('/match',{},null,now,queueStore);await request('/'+cancelling.data.view.code+'/leave',op(1),cancelling.data.token,now,queueStore);assert.equal(queueStore.queue,null);
const concurrent=await Promise.all(Array.from({length:4},()=>request('/match',{},null,now,queueStore)));assert(concurrent.every(x=>[200,201].includes(x.status)));
const groups=Object.groupBy(concurrent,x=>x.data.view.code);assert.deepEqual(Object.values(groups).map(g=>g.length).sort(),[2,2]);assert.equal(queueStore.queue,null);
for(const [code,group] of Object.entries(groups)){const r=await queueStore.get(code);assert.equal(r.stage,'role');assert(r.seats.player&&r.seats.cpu);assert.notEqual(group[0].data.token,group[1].data.token);}
const expiring=await request('/match',{},null,now,queueStore),fresh=await request('/match',{},null,now+7200001,queueStore);assert.equal(fresh.data.view.stage,'lobby');assert.notEqual(fresh.data.view.code,expiring.data.view.code);
// Both phones choosing the same half concurrently cannot acquire the same band.
for(const controlled of ['ec','ev']){
 const a=(await request('',{})).data,b=(await request('/'+a.view.code+'/join',{})).data,path='/'+a.view.code+'/role';
 const picks=await Promise.all([request(path,op(1,{controlled}),a.token),request(path,op(1,{controlled}),b.token)]);assert.deepEqual(picks.map(x=>x.status).sort(),[200,409]);
 const loser=picks[0].status===409?a:b,winner=picks[0].status===200?a:b;
 const v=(await request('/'+a.view.code,undefined,loser.token)).data;assert.notEqual(v.controlled,controlled);assert.equal(v.firstStarter,null);
 const done=await request(path,op(1,{controlled:v.controlled}),loser.token);assert.equal(done.data.stage,'mode');assert.notEqual(done.data.controlled,(await request('/'+a.view.code,undefined,winner.token)).data.controlled);
}
// Old persisted rooms retain their simultaneous lock protocol.
const legacy=(await request('',{})).data,r=await store.get(legacy.view.code);delete r.flow;delete r.firstStarter;delete r.game.countFirstRound;store.rows.set(r.code,r);
const oldGuest=(await request('/'+r.code+'/join',{})).data;assert.equal(oldGuest.view.stage,'plan');const old=await store.get(r.code);
const legacyLocks=await Promise.all([request('/'+r.code+'/lock',op(1,{action:duelActions(old.game,'player')[0]}),legacy.token),request('/'+r.code+'/lock',op(1,{action:duelActions(old.game,'cpu')[0]}),oldGuest.token)]);assert(legacyLocks.every(x=>x.status===200));assert.equal((await store.get(r.code)).game.history.length,1);assert.equal((await store.get(r.code)).game.history[0].reason,'design');
console.log('Passed: official Shuffle x five rounds, twelve-round budgets and final judgment, private sequential turns, shared reveal, role/ready barriers, retries, permissions, join races, matchmaking races, cancellation, expiry and old rooms.');
