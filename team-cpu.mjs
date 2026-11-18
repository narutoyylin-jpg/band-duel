import {TEAM_SLOTS,teamSlot,teamOpponent,teamActionInfo,resolveTeamRound,teamBandKey,teamRelativeBoard,teamSkillActions} from './team-core.mjs';
import {carrierModel} from './duel-core.mjs';

export const isTeamComputer=(r,slot)=>r.seats?.[slot]==='computer:'+r.matchId+':'+slot;
export const humanTeamSlots=r=>TEAM_SLOTS.filter(s=>r.seats[s.id]&&!isTeamComputer(r,s.id));
export function fillTeamComputers(r,allowMixed=false){
 if(!r.computer&&!allowMixed&&!r.hasComputers)return;
 r.computerSeed??=crypto.getRandomValues(new Uint32Array(1))[0];
 const humans=humanTeamSlots(r),ratings=humans.map(s=>r.profiles[s.id]?.rating).filter(Number.isFinite),rating=ratings.length?Math.round(ratings.reduce((sum,n)=>sum+n,0)/ratings.length):1000;
 for(const s of TEAM_SLOTS){
  if(!r.seats[s.id]){r.seats[s.id]='computer:'+r.matchId+':'+s.id;r.players[s.id]=null;r.wallets??={};r.wallets[s.id]=null;r.profiles[s.id]={displayName:'CPU '+s.id.toUpperCase(),avatarId:'robot',avatarBackground:'midnight',rating};}
  if(isTeamComputer(r,s.id)){r.ready[s.id]=true;if(r.game.abilityMode==='skills'&&!r.game.characters[s.id])r.game.characters[s.id]=r.game.skillOffers[s.id][noise(r.computerSeed||0,s.id,0)%3];}
 }
 r.computers=TEAM_SLOTS.filter(s=>isTeamComputer(r,s.id)).map(s=>s.id);r.hasComputers=r.computers.length>0;
}
const noise=(seed,slot,tick)=>{
 let n=(seed+TEAM_SLOTS.findIndex(s=>s.id===slot)*2654435761+tick*2246822519)>>>0;
 n=Math.imul(n^(n>>>16),2246822507);n=Math.imul(n^(n>>>13),3266489909);return (n^(n>>>16))>>>0;
};

// The chooser receives only the public board, its own resources and the visible
// same-role opponent. No teammate plan is available to the strategy.
export function chooseTeamComputerAction(o,seed=0,tick=0,settled=false){
 if(o.rulesVersion>=2)return chooseTeamDualAction(o,seed,tick,settled);
 const s=teamSlot(o.slot),enemy=teamSlot(teamOpponent(o.slot)),board={...o.board};
 board[enemy.key]+=o.visibleOpponent.direction*o.visibleOpponent.amount;
 const other=s.field==='ec'?board.bEv-board.aEv:board.bEc-board.aEc;
 const preferred=s.team==='a'?1:-1;
 const target=other?Math.sign(other)*(o.goal==='Type I'?-1:1):s.field==='ec'?preferred:preferred*(o.goal==='Type I'?-1:1);
 const cap=Math.min(o.round===1?4:2,o.budget),remaining=o.roundLimit-o.round;
 const spendCap=remaining?Math.min(cap,Math.ceil(o.budget/(remaining+1))+1):cap;
 const game={round:o.round,board:o.board,budgets:{[o.slot]:o.budget}},candidates=[];
 for(let delta=-spendCap;delta<=spendCap;delta++){
  const action={direction:delta<0?-1:1,amount:Math.abs(delta)};
  try{teamActionInfo(game,o.slot,action);}catch{continue;}
  const value=board[s.key]+delta,relative=s.team==='a'?board[enemy.key]-value:value-board[enemy.key];
  const score=5*Math.tanh(target*relative/2)-action.amount*(remaining ? .32 : .04);
  candidates.push({action,score});
 }
 candidates.sort((a,b)=>b.score-a.score||a.action.amount-b.action.amount||a.action.direction-b.action.direction);
 const variation=!settled&&tick<5&&candidates.length>1&&candidates[0].score-candidates[1].score<1.5?noise(seed,o.slot,tick)%2:0;
 return candidates[variation].action;
}
function chooseTeamDualAction(o,seed,tick,settled){
 const enemy=teamOpponent(o.slot),board={...o.board};for(const f of ['ec','ev'])board[teamBandKey(enemy,f)]+=o.visibleOpponent[f];
 const cap=o.round===1?4:2,remaining=o.roundLimit-o.round,candidates=[],game={rulesVersion:o.rulesVersion,abilityMode:o.abilityMode,characters:o.characters,skillUsed:o.skillUsed,round:o.round,roundLimit:o.roundLimit,board:o.board,budgets:{[o.slot]:o.budget}};
 const allowance=remaining?Math.min(o.budget,Math.ceil(o.budget/(remaining+1))+2):o.budget;
 const options=teamSkillActions(game,o.slot);for(let ec=-cap;ec<=cap;ec++)for(let ev=-cap;ev<=cap;ev++)options.push({ec,ev});for(const action of options){
  let info;try{info=teamActionInfo(game,o.slot,action);}catch{continue;}if(info.cost>allowance)continue;
  const b={...board};for(const [key,delta] of Object.entries(info.deltas))b[key]+=delta;const relative=teamRelativeBoard(b),m=carrierModel(relative.ec*.02,relative.ev*.02),alignment=4*(m.electronB-.5)*(m.holeB-.5);
  const matched=o.goal==='邊界排列'?relative.ec===0||relative.ev===0:m.type===o.goal;
  const quality=o.goal==='邊界排列'?-Math.min(Math.abs(relative.ec),Math.abs(relative.ev)):alignment*(o.goal==='Type I'?1:-1);
  const score=(matched?3:0)+quality*4-info.cost*(remaining ? .20 : .025)+(info.refund||0)*(remaining?.22:0);
  candidates.push({action,score,cost:info.cost});
 }
 candidates.sort((a,b)=>b.score-a.score||a.cost-b.cost||a.action.ec-b.action.ec||a.action.ev-b.action.ev);
 const n=!settled&&tick<5&&candidates.length>1&&candidates[0].score-candidates[1].score<1?noise(seed,o.slot,tick)%2:0;return candidates[n].action;
}

export function advanceTeamComputers(r,now){
 if(!TEAM_SLOTS.some(s=>isTeamComputer(r,s.id)))return false;let changed=false;
 const markReady=()=>{for(const s of TEAM_SLOTS)if(isTeamComputer(r,s.id)&&!r.ready[s.id]){r.ready[s.id]=true;changed=true;}};
 if(r.stage==='revealed'){markReady();return changed;}
 if(r.stage!=='plan')return false;
 if(r.computerState?.round!==r.game.round){r.computerState={round:r.game.round,ticks:{},humanLockedAt:null};changed=true;}
 const state=r.computerState,start=r.planStartedAt??r.deadline-(r.turnDuration||30000),at=Number.isFinite(r.deadline)?Math.min(now,r.deadline):now,tick=Math.floor(Math.max(0,at-start)/1700);
 if(humanTeamSlots(r).every(s=>r.locked[s.id])&&state.humanLockedAt===null){state.humanLockedAt=at;changed=true;}
 // Snapshot once: CPU teammates never react to each other's private updates.
 const visible=structuredClone(r.drafts);
 for(const s of TEAM_SLOTS){
  if(!isTeamComputer(r,s.id)||r.locked[s.id])continue;
  const duration=r.turnDuration||30000,natural=start+duration*.6+noise(r.computerSeed,s.id,0)%Math.floor(duration*.2);
  const lockAt=Math.min(natural,state.humanLockedAt===null?Infinity:state.humanLockedAt+1000+noise(r.computerSeed,s.id,1)%500);
  const settling=at>=lockAt;
  if(at-start>=700&&(tick!==state.ticks[s.id]||settling)){
   r.drafts[s.id]=chooseTeamComputerAction({abilityMode:r.game.abilityMode,characters:r.game.characters,skillUsed:r.game.skillUsed,rulesVersion:r.game.rulesVersion||1,slot:s.id,goal:r.goals[s.team],board:r.game.board,budget:r.game.budgets[s.id],round:r.game.round,roundLimit:r.game.roundLimit,visibleOpponent:visible[teamOpponent(s.id)]},r.computerSeed,tick,settling);
   r.sequences[s.id]++;state.ticks[s.id]=tick;changed=true;
  }
  if(settling){r.locked[s.id]=true;changed=true;}
 }
 if(TEAM_SLOTS.every(s=>r.locked[s.id])){resolveTeamRound(r);if(r.stage==='revealed')markReady();changed=true;}
 return changed;
}
