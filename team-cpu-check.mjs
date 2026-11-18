import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {D1TeamStore,handleTeamRequest,teamView} from './team-service.mjs';
import {TEAM_SLOTS,teamOpponent,teamActionInfo} from './team-core.mjs';
import {advanceTeamComputers,chooseTeamComputerAction} from './team-cpu.mjs';

const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};}};
const store=new D1TeamStore(db),now=Date.now();let serial=0;
const req=async(path='',body,token,at=now)=>{
 const response=await handleTeamRequest(new Request('https://game.test/api/team-rooms'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),store,at);
 return {status:response.status,data:await response.json()};
};
const body=extra=>({requestId:'team-cpu-'+(++serial),...extra});
assert.equal((await req('',{computer:'yes'})).status,400);
for(const rounds of [5,12])for(const seat of TEAM_SLOTS){
 const c=await req('',{computer:true});assert.equal(c.status,201);const code=c.data.view.code,token=c.data.token,path='/'+code;
 assert(c.data.view.computer);assert.equal(c.data.view.rulesVersion,3);assert.equal(c.data.view.players.filter(p=>p.computer&&p.ready).length,3);
 assert.equal((await req(path+'/join',{})).status,409);assert.equal((await req(path,undefined)).status,401);
 const moved=await req(path+'/seat',body({seat:seat.id}),token);assert.equal(moved.status,200);assert.equal(moved.data.yourSlot,seat.id);assert.equal(moved.data.players.filter(p=>!p.computer).length,1);assert(moved.data.players.find(p=>p.slot===seat.id).host);
 const configured=await req(path+'/settings',body({rounds}),token);assert.equal(configured.data.startingPoints,rounds===5?12:30);assert.equal(configured.data.players.filter(p=>p.computer&&p.ready).length,3);
 await req(path+'/ready',body({round:1,ready:true}),token);let v=(await req(path+'/start',body(),token)).data;
 assert.equal(v.stage,'plan');assert.equal((await req(path+'/draft',{round:1,sequence:1,action:{ec:1,ev:1}},token)).status,400,'API rejects submitting two bands');let at=now;
 for(let round=1;round<=rounds;round++){
  const before=await store.get(code);assert.equal(v.round,round);assert.equal(v.clock.deadline,at+30000);
  v=(await req(path,undefined,token,at+2800)).data;const r=await store.get(code);
  assert.equal(v.stage,'plan');assert.deepEqual(v.visibleOpponent.action,r.drafts[teamOpponent(seat.id)]);assert.deepEqual(v.board,before.game.board);
  for(const hidden of ['drafts','seats','computerSeed','computerState','playersById','receipts'])assert(!(hidden in v));
  const ally=TEAM_SLOTS.find(s=>s.team===seat.team&&s.id!==seat.id).id;
  const altered=structuredClone(r);altered.drafts[ally]={ec:0,ev:-1};
  assert.deepEqual(teamView(altered,seat.id,at+2800),teamView(r,seat.id,at+2800),'ally draft is omitted from every view field');
  const aiBefore=structuredClone(r);advanceTeamComputers(aiBefore,at+4600);advanceTeamComputers(altered,at+4600);
  assert.deepEqual(aiBefore.drafts[teamOpponent(seat.id)],altered.drafts[teamOpponent(seat.id)],'visible enemy CPU cannot inspect its other-role enemy');
  if(round===2){
   // Browser backgrounding/disconnection cannot grant a fresh timer or duplicate a result.
   v=(await req(path,undefined,token,at+60000)).data;assert.equal(v.history.at(-1).autoLocked.includes(seat.id),true);
  }else{
   const target=before.game.board[seat.key]>=0?-1:1,amount=Math.min(before.game.budgets[seat.id],round===1?2:1);
   const action={direction:target,amount};teamActionInfo(before.game,seat.id,action);
   const locked=await req(path+'/lock',body({round,sequence:1,action}),token,at+2900);assert.equal(locked.status,200);assert(locked.data.yourLocked);
   const duplicate=await req(path+'/lock',body({round,sequence:2,action}),token,at+3000);assert.equal(duplicate.status,409);
   v=(await req(path,undefined,token,at+4600)).data;
  }
  assert.equal(v.stage,round===rounds?'finished':'revealed');assert.equal(v.history.length,round);assert.equal(Object.keys(v.history.at(-1).actions).length,4);
  const persisted=await store.get(code);for(const s of TEAM_SLOTS)assert(persisted.game.budgets[s.id]>=0);assert.equal(v.ranked,false);
  assert.deepEqual((await req(path,undefined,token,at+61000)).data.history,v.history,'repeated catch-up resolves only once');
  if(round<rounds){at+=70000;const next=await req(path+'/next',body({round}),token,at);assert.equal(next.status,200);v=next.data;assert.equal(v.stage,'plan','one human Next starts the next round');}
 }
 assert.equal(v.history.length,rounds);assert(['a','b','draw'].includes(v.history.at(-1).decision.winner));
 const closed=await req(path+'/leave',body(),token,at+62000);assert.equal(closed.data.left,true);assert.equal((await store.get(code)).stage,'closed','last human leaving closes the practice room');
}
// CPU strategy always returns a legal plan, including exhausted points and bounds.
for(const slot of TEAM_SLOTS)for(const n of [-8,0,8])for(const budget of [0,1,12]){
 const board={aEc:n,aEv:n,bEc:n,bEv:n},o={slot:slot.id,goal:'Type II',board,budget,round:3,roundLimit:5,visibleOpponent:{direction:1,amount:0}};
 const action=chooseTeamComputerAction(o,1234,4);teamActionInfo({round:3,board,budgets:{[slot.id]:budget}},slot.id,action);
}
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rated_matches').get().n,0);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,0);
sqlite.close();console.log('Passed: CPU 2v2, all four human roles, 5/12 full matches, legal AI, private observations, automatic readiness, early locks, timeout catch-up, reconnect, exactly-once rounds and no ranked/coin rewards.');
