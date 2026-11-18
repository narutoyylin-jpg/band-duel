import assert from 'node:assert/strict';
import {makeTerminalDuel,terminalGoalsForMode,terminalVerdict,resolveTerminalDuel,phoneRoundHistory,DUEL_TYPE_TARGETS,DUEL_BOUNDARY_TARGET,DUEL_TERMINAL_TARGETS,duelActions,setDuelLength} from './duel-core.mjs';
const I=DUEL_TYPE_TARGETS[0],II=DUEL_TYPE_TARGETS[1];
function judge(start,middle,final,{player=I,cpu=I,firstActor='player',controlled='ec'}={}){
 return terminalVerdict({goals:{player,cpu},controlled},{startBoard:start,afterFirstBoard:middle,board:final,firstActor});
}
// Same-Type missions compare controlled carriers in the final bands.
assert.equal(judge({ec:1,ev:1},{ec:-1,ev:1},{ec:1,ev:1}).winner,'draw');
assert.equal(judge({ec:1,ev:1},{ec:-1,ev:1},{ec:-2,ev:1}).winner,'player');
assert.equal(judge({ec:1,ev:-1},{ec:1,ev:1},{ec:1,ev:-1}).winner,'draw');
assert.equal(judge({ec:1,ev:1},{ec:-1,ev:1},{ec:-2,ev:1},{firstActor:'cpu'}).winner,'player');
assert.equal(judge({ec:0,ev:1},{ec:-1,ev:1},{ec:-1,ev:2}).reason,'ratio');
assert.equal(judge({ec:-1,ev:1},{ec:-1,ev:2},{ec:0,ev:2}).winner,'draw');
// Exact share equality draws even when a move newly formed the Type.
assert.equal(judge({ec:3,ev:-1},{ec:3,ev:-2},{ec:3,ev:-2}).reason,'ratio');
assert.equal(judge({ec:3,ev:-1},{ec:3,ev:-2},{ec:3,ev:-2}).winner,'player');
assert.equal(judge({ec:3,ev:-1},{ec:3,ev:-2},{ec:3,ev:-2},{controlled:'ev'}).winner,'cpu');
assert.equal(judge({ec:2,ev:-2},{ec:2,ev:-2},{ec:2,ev:-2}).winner,'draw');
assert.equal(judge({ec:1,ev:1},{ec:-1,ev:1},{ec:-2,ev:2}).winner,'draw');
assert.equal(judge({ec:-2,ev:-1},{ec:-3,ev:-1},{ec:-3,ev:-1},{player:II,cpu:II}).winner,'player');
assert.equal(judge({ec:1,ev:1},{ec:-1,ev:1},{ec:1,ev:1},{player:I,cpu:II}).winner,'cpu');
assert.equal(judge({ec:1,ev:1},{ec:-1,ev:1},{ec:-1,ev:0},{player:I,cpu:II}).winner,'draw');
for(const mode of ['types','together','separate','shuffle'])for(const random of [()=>.1,()=>.9]){
 const goals=terminalGoalsForMode(mode,random);for(const q of Object.values(goals)){assert.equal(q.eSide,null);assert.equal(q.hSide,null);}
 if(mode==='types')assert.notEqual(goals.player.type,goals.cpu.type);else assert.equal(goals.player.type,goals.cpu.type);
}
// All nine combinations are available in Shuffle, including identical boundary goals.
for(const a of [.1,.5,.9])for(const b of [.1,.5,.9]){let i=0;const g=terminalGoalsForMode('shuffle',()=>[a,b][i++]);assert.equal(g.player.type,DUEL_TERMINAL_TARGETS[Math.floor(a*3)].type);assert.equal(g.cpu.type,DUEL_TERMINAL_TARGETS[Math.floor(b*3)].type);}
for(const final of [{ec:0,ev:2},{ec:-2,ev:0},{ec:0,ev:0}]){const d=judge({ec:1,ev:1},{ec:0,ev:1},final,{player:DUEL_BOUNDARY_TARGET,cpu:I});assert.equal(d.winner,'player');assert.equal(d.reason,'boundary');}
assert.equal(judge({ec:2,ev:2},{ec:0,ev:2},{ec:1,ev:2},{player:DUEL_BOUNDARY_TARGET,cpu:I}).winner,'draw','intermediate 50/50 does not count');
assert.equal(judge({ec:2,ev:2},{ec:0,ev:2},{ec:0,ev:0},{player:DUEL_BOUNDARY_TARGET,cpu:DUEL_BOUNDARY_TARGET}).winner,'draw');
for(const rounds of [5,12])for(const firstActor of ['player','cpu'])for(const controlled of ['ec','ev']){
 let g={...setDuelLength(makeTerminalDuel(controlled,{player:I,cpu:I}),rounds),started:true,active:true,stage:'plan',firstActor};assert.equal(g.playerBudget,rounds===5?12:30);
 for(let round=1;round<=rounds;round++){
  g.round=round;g.stage='plan';const start={...g.board};g=resolveTerminalDuel(g,duelActions(g,'player')[0],duelActions(g,'cpu')[0]);
  assert.equal(g.playerScore,0);assert.equal(g.cpuScore,0);assert.deepEqual(g.history.at(-1).startBoard,start);
  const a=phoneRoundHistory(g,'player'),b=phoneRoundHistory(g,'cpu');assert.deepEqual(a.at(-1).yourAction,b.at(-1).opponentAction);assert.deepEqual(a.at(-1).afterFirstBoard,b.at(-1).afterFirstBoard);
  if(round<rounds){assert.equal(a.at(-1).decision,null);assert.equal(g.stage,'revealed');}else{assert(a.at(-1).decision);assert.equal(g.stage,'finished');assert.equal(a.at(-1).decision.winner==='draw',b.at(-1).decision.winner==='draw');}
 }
}
console.log('Passed: final-Type gate, same-Type carrier shares and ties, 5/12-round budgets, secret Shuffle goals, no cumulative scores and symmetric movement replay.');
