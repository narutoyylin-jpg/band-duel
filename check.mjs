import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {DUEL_TARGETS,shuffleGoals,makeDuel,carrierModel,goalFor,duelOutcome,normalizeDuelAction,duelActions,resolveDuel,chooseCpuPlan,battleSliderBounds} from './duel-core.mjs';
const html=fs.readFileSync('lab.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach(s=>new vm.Script(s));
const staticHtml=html.replace(/<script>[\s\S]*?<\/script>/g,'');
const ids=[...staticHtml.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
assert(html.includes('lang="zh-Hant"'));
assert(!/三回合挑戰|3 回合挑戰|id="challenge|DUEL_MISSIONS|CHALLENGES|submit_band_challenge/.test(html));
const calculate=vm.runInNewContext('const KBT=8.617333262e-5*300;function calculate'+scripts[0].split('function calculate')[1].split('function renderImpact')[0]+';calculate');
for(const [ec,ev,type,e,h] of [[-.12,.1,'Type I','B','B'],[.12,-.1,'Type I','A','A'],[-.12,-.1,'Type II','B','A'],[.12,.1,'Type II','A','B'],[0,0,'零位差','equal','equal'],[0,.1,'邊界排列','equal','B']]){
  const r=carrierModel(ec,ev),ui=calculate(ec,ev);assert.equal(r.type,type);assert.equal(r.eSide,e);assert.equal(r.hSide,h);
  for(const key of ['electronB','holeB','eSide','hSide','type'])assert.equal(ui[key],r[key]);
}
assert.equal(carrierModel(0,0).electronB,.5);assert.equal(carrierModel(0,0).holeB,.5);
assert(carrierModel(-.1,0).electronB>carrierModel(-.01,0).electronB);
const pairs=[];for(let a=0;a<4;a++)for(let b=0;b<3;b++){let n=0;const q=shuffleGoals(()=>n++? (b+.5)/3:(a+.5)/4);assert.notEqual(q.player.id,q.cpu.id);pairs.push(q);}
assert.equal(new Set(pairs.map(q=>q.player.id+':'+q.cpu.id)).size,12);
const goals={player:DUEL_TARGETS[1],cpu:DUEL_TARGETS[2]},hold={kind:'hold',direction:1,amount:0};
const active=(controlled='ec',g=goals)=>({...makeDuel(controlled,g),active:true,started:true,stage:'plan'});
let d=active();assert.throws(()=>resolveDuel(d,{kind:'attack',direction:1,amount:1},hold));
d=resolveDuel(d,{kind:'own',direction:-1,amount:3},{kind:'own',direction:1,amount:3});
assert.deepEqual(d.board,{ec:-3,ev:3});assert.equal(d.playerBudget,9);assert.equal(d.cpuBudget,9);assert.equal(d.playerScore,2);assert.equal(d.cpuScore,0);
assert.throws(()=>resolveDuel(d,hold,hold));d={...d,round:2,stage:'plan'};
assert.equal(goalFor(goals.player,d.board).points,2);assert.equal(goalFor(goals.player,{ec:3,ev:-3}).points,0);assert.equal(goalFor(goals.player,{ec:0,ev:3}).points,0);
const cancelled=resolveDuel(d,{kind:'attack',direction:-1,amount:2},{kind:'own',direction:1,amount:2});assert.equal(cancelled.board.ev,3);assert.equal(cancelled.playerBudget,5);assert.equal(cancelled.cpuBudget,7);
assert.throws(()=>resolveDuel(d,{kind:'own',direction:1,amount:3},hold));assert.throws(()=>resolveDuel({...d,playerBudget:1},{kind:'attack',direction:1,amount:1},hold));
assert.throws(()=>normalizeDuelAction({kind:'own',direction:1,amount:NaN}));assert.throws(()=>normalizeDuelAction({...hold,extra:1}));
assert.equal(resolveDuel({...d,board:{ec:7,ev:3}},{kind:'own',direction:1,amount:1},{kind:'attack',direction:1,amount:1}).board.ec,8);
assert.deepEqual(chooseCpuPlan({...d,plan:{kind:'own',direction:1,amount:1}},()=>.25),chooseCpuPlan({...d,plan:{kind:'attack',direction:-1,amount:2}},()=>.25));
const same=active('ec',{player:DUEL_TARGETS[1],cpu:DUEL_TARGETS[0]});
let r=duelOutcome(same,{ec:-3,ev:1});assert.equal(r.reason,'ratio');assert.equal(r.playerGain,1);assert.equal(r.cpuGain,0);assert.equal(r.player.quality,Math.min(r.player.eShare,r.player.hShare));
r=duelOutcome(same,{ec:3,ev:-3});assert.equal(r.playerGain,0);assert.equal(r.cpuGain,2);assert.equal(duelOutcome(same,{ec:-3,ev:-3}).reason,'unmatched');
const separate=active('ec',{player:DUEL_TARGETS[3],cpu:DUEL_TARGETS[2]});assert.equal(duelOutcome(separate,{ec:-3,ev:-3}).playerGain,2);
const bounds=battleSliderBounds({...d,board:{ec:8,ev:-7},playerBudget:1,plan:{kind:'own'}});assert.equal(bounds.min,7);assert.equal(bounds.max,8);assert.equal(battleSliderBounds({...d,board:{ec:8,ev:-7},playerBudget:1},'attack').min,-7);
for(const controlled of ['ec','ev'])for(const goals of pairs)for(let seed=1;seed<=3;seed++){
  let counter=seed;const random=()=>((counter=counter*16807%2147483647)-1)/2147483646;let g=active(controlled,goals);
  for(let round=1;round<=5;round++){g.round=round;g.stage='plan';const options=duelActions(g,'player');g=resolveDuel(g,options[Math.floor(random()*options.length)],chooseCpuPlan(g,random));assert(g.playerBudget>=0&&g.cpuBudget>=0&&Math.abs(g.board.ec)<=8&&Math.abs(g.board.ev)<=8);assert.equal(g.history.length,round);assert.equal(g.playerScore,g.history.reduce((s,h)=>s+h.playerGain,0));}
  assert.equal(g.stage,'finished');assert(g.playerScore<=10&&g.cpuScore<=10);assert.throws(()=>resolveDuel(g,hold,hold));
}
console.log('HTML, physics, 12 Shuffle pairs, simultaneous scoring, budgets, limits and secret-plan independence passed.');
