import assert from 'node:assert/strict';
import {PhoneCpuMatch,choosePrivateCpuPlan} from './phone-cpu.mjs';
import {DUEL_MODES,DUEL_TARGETS,DUEL_TYPE_TARGETS,makeDuel,duelActions} from './duel-core.mjs';

const publicGame=v=>({controlled:v.controlled,round:v.round,board:v.board,playerBudget:v.yourBudget,cpuBudget:v.opponentBudget});
function checkPrivacy(v){for(const key of ['cpuPlan','cpuAction','opponentAction','goals','yourScore','opponentScore'])assert(!(key in v));if(v.stage==='finished')assert(v.opponentGoal?.type);else assert(!('opponentGoal' in v));for(const h of v.history){assert(!('cpu' in h));assert(h.opponentAction);if(h.round<5)assert.equal(h.decision,null);}}
for(const mode of Object.keys(DUEL_MODES))for(const controlled of ['ec','ev'])for(const randomValue of [.1,.9]){
  const m=new PhoneCpuMatch(()=>randomValue);assert.equal(m.view().stage,'role');assert.equal(m.view().goal,null);assert.equal(m.view().controlled,null);
  assert.throws(()=>m.chooseMode(mode));assert.equal(m.chooseRole(controlled).stage,'mode');assert.throws(()=>m.chooseRole(controlled));
  let v=m.chooseMode(mode),first=randomValue<.5?'you':'opponent';assert.equal(v.firstStarter,first);assert.equal(v.controlled,controlled);assert(v.goal);if(mode==='types'){assert.equal(v.goal.eSide,null);assert.equal(v.goal.hSide,null);}
  for(let round=1;round<=5;round++){
    const before=m.view();assert.equal(before.round,round);assert.equal(before.roundStarter,first);assert.equal(before.history.length,round-1);checkPrivacy(before);
    if(first==='opponent'){assert.equal(before.yourTurn,false);assert.throws(()=>m.lock(duelActions(publicGame(before),'player')[0]));v=m.finishCpuTurn();assert.equal(v.yourTurn,true);assert.equal(v.opponentLocked,true);assert.deepEqual(v.board,before.board);assert.equal(v.opponentBudget,before.opponentBudget);}else assert.equal(before.yourTurn,true);
    const action=duelActions(publicGame(m.view()),'player')[(round+1)%duelActions(publicGame(m.view()),'player').length];v=m.lock(action);
    if(first==='you'){assert.equal(v.yourLocked,true);assert.equal(v.yourTurn,false);assert.deepEqual(v.yourLockedAction,action);assert.deepEqual(v.board,before.board);assert.equal(v.opponentBudget,before.opponentBudget);assert.equal(v.yourBudget,before.yourBudget);assert.throws(()=>m.lock(action));v=m.finishCpuTurn();}
    assert.equal(v.stage,round===5?'finished':'revealed');assert.equal(v.history.length,round);checkPrivacy(v);assert(v.yourBudget>=0&&v.opponentBudget>=0);assert(Math.abs(v.board.ec)<=8&&Math.abs(v.board.ev)<=8);assert.equal(v.yourLocked,false);
    assert.equal(v.history.at(-1).firstStarter,first);assert.deepEqual(v.history.at(-1).startBoard,before.board);assert.deepEqual(v.history.at(-1).board,v.board);if(round===5)assert(['you','opponent','draw'].includes(v.history.at(-1).decision.winner));
    assert.throws(()=>m.lock(action));if(round<5)v=m.next();else assert.throws(()=>m.next());
  }
}
// A long match keeps its larger shared budget and finishes only after round 12.
for(const randomValue of [.1,.9]){
  const m=new PhoneCpuMatch(()=>randomValue);m.chooseRole('ec');let v=m.chooseMode('types',12);
  assert.equal(v.roundLimit,12);assert.equal(v.startingPoints,30);assert.equal(v.yourBudget,30);assert.equal(v.opponentBudget,30);
  for(let round=1;round<=12;round++){
    if(!v.yourTurn)v=m.finishCpuTurn();
    const action=duelActions(publicGame(v),'player').find(x=>x.kind==='hold')||duelActions(publicGame(v),'player')[0];
    v=m.lock(action);if(v.stage==='plan')v=m.finishCpuTurn();
    assert.equal(v.stage,round===12?'finished':'revealed');assert.equal(v.history.length,round);
    assert.equal(v.history.at(-1).decision===null,round<12);
    if(round<12)v=m.next();
  }
}
// The computer's own task is fixed; changing private player information cannot alter its choice.
for(const mode of Object.keys(DUEL_MODES))for(const ownGoal of mode==='types'?DUEL_TYPE_TARGETS:DUEL_TARGETS)for(const controlled of ['ec','ev']){
  const others=[...DUEL_TARGETS,...DUEL_TYPE_TARGETS].filter(x=>x.id!==ownGoal.id),base={...makeDuel(controlled,{player:others[0],cpu:ownGoal}),mission:mode,round:3,board:{ec:2,ev:-1},playerBudget:5,cpuBudget:4};
  const plan=choosePrivateCpuPlan(base,()=>.4);assert(duelActions(base,'cpu').some(x=>JSON.stringify(x)===JSON.stringify(plan)));
  for(const playerGoal of others){const changed={...base,goals:{player:playerGoal,cpu:ownGoal},plan:{kind:'attack',direction:-1,amount:2},pending:{player:{kind:'own',direction:1,amount:2}},history:[{privatePlayerGoal:playerGoal}]};assert.deepEqual(choosePrivateCpuPlan(changed,()=>.4),plan);}
}
console.log('Passed: four CPU modes, both roles and starters, five and twelve rounds, scaled budgets, replay boards, private commitments and mission independence.');
