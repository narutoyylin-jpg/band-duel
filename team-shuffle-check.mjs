import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {TEAM_SLOTS,shuffleTeamGoals,teamVerdict,teamActionInfo,prepareTeamRound,resolveTeamRound,teamRoundOrder} from './team-core.mjs';
import {teamView} from './team-service.mjs';
import {chooseTeamComputerAction} from './team-cpu.mjs';
import {terminalGoalsForMode,SHUFFLE_BOUNDARY_CHANCE} from './duel-core.mjs';

const make=()=>({matchKind:'team',matchId:'shuffle-check',code:'SHUF22',host:'ae',stage:'lobby',version:0,goals:{a:'Type I',b:'Type II'},seats:{ae:'a',av:'b',be:'c',bv:'d'},players:{ae:'a',av:'b',be:'c',bv:'d'},profiles:{},ready:{},locked:{},drafts:{},sequences:{},game:{rulesVersion:2,round:1,roundLimit:5,board:{aEc:0,aEv:0,bEc:0,bEv:0},budgets:{ae:12,av:12,be:12,bv:12},history:[]}});
for(const a of ['Type I','Type II','邊界排列'])for(const b of ['Type I','Type II','邊界排列']){
 if(a==='邊界排列'&&b==='邊界排列')continue;
 const values=a==='邊界排列'?[.05,.1,b==='Type I'?.1:.9]:b==='邊界排列'?[.05,.9,a==='Type I'?.1:.9]:[.9,a==='Type I'?.1:.9,b==='Type I'?.1:.9];
 let draw=0;assert.deepEqual(shuffleTeamGoals(()=>values[draw++]),{a,b});
 const r=make();r.goals={a,b};prepareTeamRound(r,1000);for(const actor of TEAM_SLOTS){const v=teamView(r,actor.id,1000);assert.deepEqual(Object.keys(v.goals),[actor.team],'only own shared mission is visible before finish');}
 r.stage='finished';assert.deepEqual(teamView(r,'ae').goals,{a,b});
}
let seed=4711,boundaries=0;const combinations=new Set(),random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<20000;i++){
 const snapshot=seed,team=shuffleTeamGoals(random);seed=snapshot;const solo=terminalGoalsForMode('shuffle',random);
 assert.deepEqual(team,{a:solo.player.type,b:solo.cpu.type},'1v1 and 2v2 share the weighted mission distribution');
 const count=Object.values(team).filter(goal=>goal==='邊界排列').length;assert(count<=1);boundaries+=count;combinations.add(team.a+'/'+team.b);
}
assert.equal(combinations.size,8);assert(Math.abs(boundaries/20000-SHUFFLE_BOUNDARY_CHANCE)<.015,'boundary occurs in about 10% of matches');
const r=make();prepareTeamRound(r,1000);assert.deepEqual(r.game.budgets,{ae:12,av:12,be:12,bv:12});
assert.equal(teamActionInfo(r.game,'ae',{ec:1,ev:-1}).cost,3);assert.equal(teamActionInfo(r.game,'av',{ec:1,ev:-1}).cost,3);
assert.throws(()=>teamActionInfo(r.game,'ae',{ec:3,ev:2}));r.game.budgets.ae=2;assert.throws(()=>teamActionInfo(r.game,'ae',{ec:1,ev:1}));r.game.budgets.ae=12;
r.drafts={ae:{ec:1,ev:-1},av:{ec:-1,ev:1},be:{ec:-2,ev:1},bv:{ec:1,ev:-2}};resolveTeamRound(r);
assert.deepEqual(r.game.board,{aEc:0,aEv:0,bEc:-1,bEv:-1});assert.deepEqual(r.game.budgets,{ae:9,av:9,be:8,bv:8});assert.equal(r.game.history[0].frames.length,5);
const round=r.game.history[0],board={...round.startBoard};for(const [i,slot] of round.order.entries()){for(const [key,delta] of Object.entries(round.actions[slot].deltas))board[key]+=delta;assert.deepEqual(board,round.frames[i+1]);}assert.deepEqual(board,round.board);
for(let n=1;n<=4;n++){const g={rulesVersion:2,round:n};assert.equal(new Set(teamRoundOrder(g)).size,4);assert.equal(teamRoundOrder(g)[0],['ae','be','av','bv'][n-1]);}
const clipped=make();clipped.game.board.aEc=7;prepareTeamRound(clipped,1000);clipped.drafts.ae={ec:1,ev:0};clipped.drafts.av={ec:1,ev:0};resolveTeamRound(clipped);assert.equal(clipped.game.board.aEc,8);assert.equal(clipped.game.budgets.ae,11);assert.equal(clipped.game.budgets.av,12);assert.equal(clipped.game.history[0].actions.av.clipped,true);
// New rooms restore one selected band per actor; existing version 2 rooms keep their rule.
const single=make();single.game.rulesVersion=3;prepareTeamRound(single,1000);
assert.throws(()=>teamActionInfo(single.game,'ae',{ec:1,ev:1}),/只能調整一條/);
assert.equal(teamActionInfo(single.game,'ae',{ec:0,ev:2}).cost,4);
assert.equal(teamActionInfo(single.game,'av',{ec:0,ev:2}).cost,2);
for(const actor of TEAM_SLOTS)for(const goal of ['Type I','Type II','邊界排列']){
 const input={rulesVersion:3,slot:actor.id,goal,board:single.game.board,budget:12,round:1,roundLimit:5,visibleOpponent:{ec:0,ev:0}},action=chooseTeamComputerAction(input,987,2);
 assert(!(action.ec&&action.ev));teamActionInfo(single.game,actor.id,action);
}
const goals=make();goals.goals={a:'Type I',b:'Type I'};assert.equal(teamVerdict(goals,{aEc:-2,aEv:2,bEc:0,bEv:0}).winner,'a');assert.equal(teamVerdict(goals,{aEc:2,aEv:-2,bEc:0,bEv:0}).winner,'b');
goals.goals={a:'Type II',b:'Type II'};assert.equal(teamVerdict(goals,{aEc:0,aEv:0,bEc:2,bEv:2}).winner,'draw');
goals.goals={a:'邊界排列',b:'Type I'};assert.equal(teamVerdict(goals,{aEc:0,aEv:0,bEc:0,bEv:0}).winner,'a');assert.equal(teamVerdict(goals,{aEc:0,aEv:0,bEc:0,bEv:2}).winner,'a');
for(const slot of TEAM_SLOTS)for(const goal of ['Type I','Type II','邊界排列'])for(const budget of [0,1,12]){
 const o={rulesVersion:2,slot:slot.id,goal,board:{aEc:8,aEv:-8,bEc:-8,bEv:8},budget,round:3,roundLimit:5,visibleOpponent:{ec:0,ev:0}};
 teamActionInfo({rulesVersion:2,round:3,board:o.board,budgets:{[slot.id]:budget}},slot.id,chooseTeamComputerAction(o,987,2));
}
// Countdown warnings are once per visible second, use the effects channel and stop after lock.
let clockNow=0;const sounds=[],elements=new Map(),context={Date:{now:()=>clockNow},document:{hidden:false},ui:{kind:'team',busy:false,data:{code:'timer',round:1,stage:'plan',yourLocked:false,clock:{duration:20000,startsAt:0,deadline:20000,serverNow:0,turn:'all'}}},teamUi:{syncStatus:''},tx:(cn,en)=>en,soundEffect:name=>sounds.push(name),refresh(){},$:(id)=>{if(!elements.has(id))elements.set(id,{style:{},classList:{toggle(){}}});return elements.get(id);}};
vm.createContext(context);vm.runInContext(fs.readFileSync('phone-clock.js','utf8'),context);
for(const n of [6,5,5,4,5,4,3,2,1,1]){clockNow=20000-n*1000;vm.runInContext('paintTurnClock()',context);}
assert.deepEqual(sounds,['countdown','countdown','countdown','countdown','countdown-final']);
context.ui.data.round=2;context.ui.data.yourLocked=true;clockNow=15000;vm.runInContext('paintTurnClock()',context);assert.equal(sounds.length,5);
context.ui.data.yourLocked=false;context.document.hidden=true;vm.runInContext('paintTurnClock()',context);assert.equal(sounds.length,5);
console.log('Passed: eight weighted Shuffle pairings, 10% boundary rate without double boundary, shared 1v1/2v2 distribution, mission privacy, carrier ratios, costs, rotating frames, refunds, CPU legality and countdown alerts.');
