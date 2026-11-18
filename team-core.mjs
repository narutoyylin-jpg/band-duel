import {carrierModel,DUEL_LENGTHS,terminalGoalsForMode,DUEL_THINK_MS,validDuelCharacter} from './duel-core.mjs';
export const TEAM_SLOTS=[
 {id:'ae',team:'a',field:'ec',material:'A',key:'aEc'},
 {id:'av',team:'a',field:'ev',material:'A',key:'aEv'},
 {id:'be',team:'b',field:'ec',material:'B',key:'bEc'},
 {id:'bv',team:'b',field:'ev',material:'B',key:'bEv'}
];
export const teamSlot=id=>TEAM_SLOTS.find(x=>x.id===id);
export const teamOpponent=id=>TEAM_SLOTS.find(x=>x.field===teamSlot(id).field&&x.team!==teamSlot(id).team).id;
export const teamRelativeBoard=b=>({ec:b.bEc-b.aEc,ev:b.bEv-b.aEv});
export const teamBandKey=(slot,field)=>teamSlot(slot).team+(field==='ec'?'Ec':'Ev');
export const teamDual=g=>g.rulesVersion>=2;
export const teamSingle=g=>g.rulesVersion>=3;
export function teamGoalsForMode(mode='shuffle',random=Math.random){const goals=terminalGoalsForMode(mode,random);return {a:goals.player.type,b:goals.cpu.type};}
export function shuffleTeamGoals(random=Math.random){return teamGoalsForMode('shuffle',random);}
export function normalizeTeamAction(a,slot,dual=false){
 if(dual){
  if(a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).every(k=>['ec','ev','skill'].includes(k))&&['ec','ev'].every(k=>Number.isInteger(a[k])&&Math.abs(a[k])<=4)&&(a.skill===undefined||validDuelCharacter(a.skill)))return {ec:a.ec,ev:a.ev,...(a.skill?{skill:a.skill}:{})};
  // Accept an older client's single-band action without changing its meaning.
  const legacy=normalizeTeamAction(a);return {ec:0,ev:0,[teamSlot(slot).field]:legacy.direction*legacy.amount};
 }
 if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['direction','amount'].includes(k))||![-1,1].includes(a.direction)||!Number.isInteger(a.amount)||a.amount<0||a.amount>4)throw Error('組隊動作無效。');
 return {direction:a.amount?a.direction:1,amount:a.amount};
}
export function teamActionInfo(g,slot,input){
 const s=teamSlot(slot);if(!s)throw Error('組隊位置無效。');const a=normalizeTeamAction(input,slot,teamDual(g)),cap=g.round===1?4:2;
 if(teamDual(g)){
  if(a.skill){
   if(g.abilityMode!=='skills'||g.characters?.[slot]!==a.skill||g.skillUsed?.[slot]||g.round<2)throw Error('技能尚不可用或本場已經使用。');
   const own=a[s.field],other=a[s.field==='ec'?'ev':'ec'];let cost=0,refund=0;
   if(a.skill==='charge'){if(own||other)throw Error('蓄能本回合不能移動。');refund=Math.min(2,teamBudget(g.roundLimit)-g.budgets[slot]);if(refund<=0)throw Error('點數已滿，不需要蓄能。');}
   else if(a.skill==='split'){if(Math.abs(own)!==1||Math.abs(other)!==1)throw Error('分流需要兩條能帶各移動一格。');cost=3;}
   else if(a.skill==='pulse'){if(Math.abs(own)!==2||other)throw Error('脈衝需要本職能帶移動兩格。');cost=1;}
   else if(a.skill==='jam'){if(own||Math.abs(other)!==1)throw Error('精準干擾需要另一條能帶移動一格。');cost=1;}
   const deltas=Object.fromEntries(['ec','ev'].map(f=>[teamBandKey(slot,f),a[f]]));if(cost>g.budgets[slot]||Object.entries(deltas).some(([key,delta])=>Math.abs(g.board[key]+delta)>8))throw Error('技能點數不足或超出能帶範圍。');return {...a,slot,field:s.field,material:s.material,deltas,cost,refund,steps:Math.abs(own)+Math.abs(other)};
  }
  if(teamSingle(g)&&a.ec!==0&&a.ev!==0)throw Error('每人每回合只能調整一條能帶，請點選要修改的導帶或價帶。');
  const steps=Math.abs(a.ec)+Math.abs(a.ev),cost=Math.abs(a[s.field])+2*Math.abs(a[s.field==='ec'?'ev':'ec']);
  if(steps>cap||cost>g.budgets[slot])throw Error('點數不足或超過本回合改動上限。');
  const deltas=Object.fromEntries(['ec','ev'].map(f=>[teamBandKey(slot,f),a[f]]));
  if(Object.entries(deltas).some(([key,delta])=>Math.abs(g.board[key]+delta)>8))throw Error('這個動作會超出 ±0.16 eV 範圍。');
  return {...a,slot,field:s.field,material:s.material,deltas,cost,steps};
 }
 if(a.amount>cap||a.amount>g.budgets[slot])throw Error('點數不足或超過本回合改動上限。');const delta=a.direction*a.amount;
 if(Math.abs(g.board[s.key]+delta)>8)throw Error('這個動作會超出 ±0.16 eV 範圍。');return {...a,slot,field:s.field,material:s.material,key:s.key,delta,cost:a.amount};
}
export function teamActionDeltas(a){return a.deltas||{[a.key]:a.delta};}
export function teamSkillActions(g,slot){
 const s=teamSlot(slot),skill=g.characters?.[slot],other=s.field==='ec'?'ev':'ec',list=[];
 if(skill==='charge')list.push({ec:0,ev:0,skill});
 else for(const direction of [-1,1]){if(skill==='split')for(const second of [-1,1])list.push({ec:0,ev:0,[s.field]:direction,[other]:second,skill});else if(skill==='pulse')list.push({ec:0,ev:0,[s.field]:2*direction,skill});else if(skill==='jam')list.push({ec:0,ev:0,[other]:direction,skill});}
 return list.filter(a=>{try{teamActionInfo(g,slot,a);return true;}catch{return false;}});
}
export function teamRoundOrder(g){const order=['ae','be','av','bv'],n=(g.round-1)%4;return teamDual(g)?[...order.slice(n),...order.slice(0,n)]:TEAM_SLOTS.map(s=>s.id);}
export function teamVerdict(r,board){
 const relative=teamRelativeBoard(board),model=carrierModel(relative.ec*.02,relative.ev*.02),matches=goal=>goal==='邊界排列'?relative.ec===0||relative.ev===0:model.type===goal;
 const ratios={a:((1-model.electronB)+(1-model.holeB))/2,b:(model.electronB+model.holeB)/2};let winner='draw',reason='unmatched';
 if(r.goals.a!==r.goals.b){if(matches(r.goals.a))winner='a';else if(matches(r.goals.b))winner='b';if(winner!=='draw')reason='mission';}
 else if(matches(r.goals.a)){reason='tie';if(Math.abs(ratios.a-ratios.b)>1e-9){winner=ratios.a>ratios.b?'a':'b';reason='ratio';}}
 return {winner,reason,type:model.type,ratios,goals:{...r.goals}};
}
export function resolveTeamRound(r){
 const g=r.game,startBoard={...g.board},board={...startBoard},actions={},order=teamRoundOrder(g),frames=[{...startBoard}],planned=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,teamActionInfo(g,s.id,r.drafts[s.id])]));
 for(const slot of order){let a=planned[slot];if(teamDual(g)){
   const deltas={};for(const [key,delta] of Object.entries(a.deltas)){const value=Math.max(-8,Math.min(8,board[key]+delta));deltas[key]=value-board[key];board[key]=value;}
   const ec=deltas[teamBandKey(slot,'ec')],ev=deltas[teamBandKey(slot,'ev')],s=teamSlot(slot),cost=['pulse','jam'].includes(a.skill)?(ec||ev?1:0):Math.abs(s.field==='ec'?ec:ev)+2*Math.abs(s.field==='ec'?ev:ec);
   a={...a,ec,ev,deltas,cost,requested:{ec:a.ec,ev:a.ev},clipped:ec!==a.ec||ev!==a.ev};
  }else board[a.key]+=a.delta;
  actions[slot]=a;g.budgets[slot]=Math.min(teamBudget(g.roundLimit),g.budgets[slot]-a.cost+(a.refund||0));if(a.skill){g.skillUsed??={};g.skillUsed[slot]=true;}frames.push({...board});
 }
 const relative=teamRelativeBoard(board),type=carrierModel(relative.ec*.02,relative.ev*.02).type,entry={round:g.round,startBoard,board:{...board},actions,order,frames,type,autoLocked:TEAM_SLOTS.filter(s=>r.autoLocks?.includes(s.id)).map(s=>s.id)};
 if(g.round===g.roundLimit)entry.decision=teamDual(g)?teamVerdict(r,board):{winner:type===r.goals.a?'a':type===r.goals.b?'b':'draw',type};
 g.board=board;g.history.push(entry);r.stage=g.round===g.roundLimit?'finished':'revealed';r.deadline=null;r.ready=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,false]));
}
export function prepareTeamRound(r,now){
 r.stage='plan';r.turnDuration=r.timed===false?null:DUEL_THINK_MS;r.planStartedAt=now;r.deadline=r.timed===false?null:now+DUEL_THINK_MS;r.drafts=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,teamDual(r.game)?{ec:0,ev:0}:{direction:1,amount:0}]));r.sequences=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,0]));r.locked=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,false]));r.autoLocks=[];
}
export function advanceTeamClock(r,now){
 if(r.stage!=='plan'||r.timed===false||!Number.isFinite(r.deadline)||now<r.deadline)return false;for(const s of TEAM_SLOTS)if(!r.locked[s.id]){r.locked[s.id]=true;r.autoLocks.push(s.id);}resolveTeamRound(r);return true;
}
export function teamBudget(rounds){if(!Number.isInteger(rounds)||!Object.hasOwn(DUEL_LENGTHS,rounds))throw Error('請選擇 5 或 12 回合。');return DUEL_LENGTHS[rounds];}
