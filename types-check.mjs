import assert from 'node:assert/strict';
import {DUEL_TARGETS,DUEL_TYPE_TARGETS,goalsForMode,makeDuel,goalFor,goalDirection,duelOutcome,resolveDuel} from './duel-core.mjs';

// All four collection orientations must score, for either assignment and either role.
for(const assignment of [0,1])for(const controlled of ['ec','ev']){
  const goals=goalsForMode('types',()=>assignment),game=makeDuel(controlled,goals);
  assert.equal(goals.player.eSide,null);assert.equal(goals.player.hSide,null);
  assert.notEqual(goals.player.type,goals.cpu.type);
  for(let ec=-8;ec<=8;ec++)for(let ev=-8;ev<=8;ev++){
    const actual=duelOutcome(game,{ec,ev}),type=ec*ev===0?null:ec*ev<0?'Type I':'Type II';
    const points=type?(Math.min(Math.abs(ec),Math.abs(ev))>=3?2:1):0;
    assert.equal(actual.playerGain,type===goals.player.type?points:0);
    assert.equal(actual.cpuGain,type===goals.cpu.type?points:0);
    const mirrored=duelOutcome(game,{ec:-ec,ev:-ev});
    assert.equal(mirrored.playerGain,actual.playerGain);assert.equal(mirrored.cpuGain,actual.cpuGain);
    assert(Math.abs(mirrored.player.quality-actual.player.quality)<1e-12);
  }
}
// First round scores in either direction; later, modifying one's own band can switch Type.
for(const direction of [-1,1]){
  const game={...makeDuel('ec',goalsForMode('types',()=>0)),started:true,active:true,stage:'plan'};
  const revealed=resolveDuel(game,{kind:'own',direction,amount:3},{kind:'own',direction:-direction,amount:3});
  assert.equal(revealed.playerScore,2);assert.equal(revealed.cpuScore,0);
}
for(const controlled of ['ec','ev']){
  const game={...makeDuel(controlled,goalsForMode('types',()=>0)),started:true,active:true,stage:'plan',round:2,board:controlled==='ec'?{ec:1,ev:3}:{ec:3,ev:1}};
  const revealed=resolveDuel(game,{kind:'own',direction:-1,amount:2},{kind:'hold',direction:1,amount:0});
  assert.equal(revealed.playerScore,1);assert.equal(revealed.cpuScore,0);assert.equal(revealed.playerBudget,10);
}
for(const q of DUEL_TYPE_TARGETS)for(const field of ['ec','ev'])for(const sign of [-1,1]){
  const other=field==='ec'?'ev':'ec',board={ec:0,ev:0,[other]:sign};
  assert.equal(goalDirection(q,field,board),sign*(q.type==='Type I'?-1:1));
  assert.equal(goalDirection(q,field,{ec:0,ev:0},-1),-1);
}
// Direction restrictions and same-Type comparisons in the other modes remain in place.
for(const q of DUEL_TARGETS){
  const board={ec:q.eSide==='A'?3:-3,ev:q.hSide==='B'?3:-3};
  assert.equal(goalFor(q,board).points,2);assert.equal(goalFor(q,{ec:-board.ec,ev:-board.ev}).points,0);
}
for(const mode of ['together','separate']){
  const game=makeDuel('ec',goalsForMode(mode,()=>0)),q=game.goals.player;
  const out=duelOutcome(game,{ec:q.eSide==='A'?3:-3,ev:q.hSide==='B'?3:-3});
  assert.equal(out.playerGain,2);assert.equal(out.cpuGain,0);assert.equal(out.reason,'ratio');
}
console.log('Passed: unrestricted Type I/II in all four orientations, 1/2-point thresholds, zero-offset boundaries, both roles, first-round scores, strategy reversal and unchanged directional modes.');
