import assert from 'node:assert/strict';
import {makeTerminalDuel,terminalGoalsForMode,setDuelLength,duelActionInfo,duelActions,resolveTerminalDuel,normalizeDuelAction,phoneRoundHistory,applyDuelAction,terminalVerdict} from './duel-core.mjs';
import {PhoneCpuMatch,choosePrivateCpuPlan} from './phone-cpu.mjs';
const hold={kind:'hold',amount:0,direction:1},charge={...hold,skill:'charge'},split={kind:'own',amount:1,direction:1,skill:'split',splitDirection:-1};
function game(controlled='ec',rounds=5){return {...setDuelLength(makeTerminalDuel(controlled,terminalGoalsForMode('together')),rounds),round:2,active:true,started:true,stage:'plan',board:{ec:2,ev:-2},playerBudget:3,cpuBudget:4,characters:{player:'charge',cpu:'split'},skillUsed:{player:false,cpu:false}};}
for(const controlled of ['ec','ev'])for(const rounds of [5,12]){
 const g=game(controlled,rounds),c=duelActionInfo(g,'cpu',split),r=resolveTerminalDuel(g,charge,split),h=r.history.at(-1);
 assert.equal(r.playerBudget,5);assert.equal(r.cpuBudget,1);assert.deepEqual(r.skillUsed,{player:true,cpu:true});assert.deepEqual(r.board,applyDuelAction({...g.board},c));assert.deepEqual(h.afterFirstBoard,g.board);assert.equal(h.player.refund,2);assert.equal(h.cpu.cost,3);
 assert.throws(()=>duelActionInfo({...r,round:3,stage:'plan'},'player',charge),/技能/);assert.throws(()=>duelActionInfo({...r,round:3,stage:'plan'},'cpu',split),/技能/);
 const view=phoneRoundHistory(r,'cpu')[0];assert.equal(view.yourAction.skill,'split');assert.equal(view.opponentAction.skill,'charge');assert.equal(view.decision,null);
 const final=resolveTerminalDuel({...g,round:rounds},charge,split);assert.equal(final.stage,'finished');assert.deepEqual(final.history.at(-1).decision,terminalVerdict(g,final.history.at(-1)));
 const max=rounds===5?12:30;assert.equal(duelActionInfo({...g,playerBudget:max-1},'player',charge).refund,1);assert.equal(resolveTerminalDuel({...g,playerBudget:max-1},charge,hold).playerBudget,max);assert.throws(()=>duelActionInfo({...g,playerBudget:max},'player',charge),/點數已滿/);
}
assert.throws(()=>normalizeDuelAction({...split,cost:0}));assert.throws(()=>normalizeDuelAction({...split,amount:2}));assert.throws(()=>normalizeDuelAction({...hold,splitDirection:1}));assert.throws(()=>normalizeDuelAction({...charge,amount:1}));assert.throws(()=>normalizeDuelAction({...split,splitDirection:0}));assert.throws(()=>normalizeDuelAction({...charge,skill:'god'}));
const g=game();for(const change of [{round:1},{characters:null},{skillUsed:{player:true}}])assert.throws(()=>duelActionInfo({...g,...change},'player',charge));
assert.throws(()=>duelActionInfo({...g,cpuBudget:2},'cpu',split),/3 點/);assert.throws(()=>duelActionInfo({...g,board:{ec:-8,ev:8}},'cpu',split),/範圍/);
assert.equal(duelActions({...g,characters:undefined},'player').some(a=>a.skill),false,'old games retain their existing rule');
for(const seed of [.1,.9])for(const character of ['charge','split'])for(const rounds of [5,12]){
 let match=new PhoneCpuMatch(()=>seed,'skills');const saved=match.snapshot();saved.game.skillOffers.player=['charge','split','pulse'];match=PhoneCpuMatch.restore(saved);match.chooseRole('ec',character);let v=match.chooseMode('shuffle',rounds),used=false;
 for(let round=1;round<=rounds;round++){
  if(!v.yourTurn)v=match.finishCpuTurn();const before=match.snapshot(),actions=duelActions(before.game,'player'),action=round>1&&!used?actions.find(a=>a.skill)||actions[0]:actions.find(a=>a.kind==='own')||hold;
  const cpuSecret=structuredClone(before.cpuAction);v=match.lock(action);if(action.skill)used=true;
  if(v.stage==='plan'){assert.equal(v.skills.yourUsed,!!before.game.skillUsed?.player,'pending activation remains unrevealed');assert.deepEqual(match.snapshot().cpuAction,cpuSecret);assert.equal(v.opponentBudget,before.game.cpuBudget);assert(!JSON.stringify(v).includes('cpuAction'));v=match.finishCpuTurn();}
  assert(v.yourBudget>=0);assert(v.yourBudget<=(rounds===5?12:30));assert.equal(v.skills.yourUsed,used);match=PhoneCpuMatch.restore(JSON.parse(JSON.stringify(match.snapshot())));v=match.view();
  if(round<rounds)v=match.next();else assert.equal(v.stage,'finished');
 }
 assert(used);
}
// Even with public ability choices, secret missions and drafts cannot affect the bot.
const base={...game(),mission:'shuffle',goals:terminalGoalsForMode('shuffle',()=>.1)};const plan=choosePrivateCpuPlan(base,()=>.3);assert.deepEqual(choosePrivateCpuPlan({...base,goals:{...base.goals,player:{type:'邊界排列',eSide:null,hSide:null}},plan:split,pending:{player:charge}},()=>.3),plan);
console.log('Passed: once-per-match abilities, both bands and match lengths, bounds, exact costs/refunds, persistence, private commitments, CPU independence and unchanged final verdicts.');
