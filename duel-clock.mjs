import {duelActions,duelActionInfo,goalDirection,otherBand,normalizeDuelAction,resolveTerminalDuel,DUEL_THINK_MS} from './duel-core.mjs';
export const DUEL_TURN_MS=DUEL_THINK_MS;
export function defaultTimedAction(g,actor){
 const field=actor==='player'?g.controlled:otherBand(g.controlled),action={kind:'own',direction:goalDirection(g.goals[actor],field,g.board,field==='ec'?1:-1),amount:g.round===1?3:1};
 try{duelActionInfo(g,actor,action);return action;}catch{return duelActions(g,actor)[0]||{kind:'hold',direction:1,amount:0};}
}
export function prepareRoomDrafts(r){
 if(r.draftRound===r.game.round)return;r.draftRound=r.game.round;r.drafts={player:defaultTimedAction(r.game,'player'),cpu:defaultTimedAction(r.game,'cpu')};r.draftSequences={player:0,cpu:0};
}
export function startRoomClock(r,now,grace=0){
 prepareRoomDrafts(r);r.clock=r.timed===false?null:{round:r.game.round,actor:r.pending[r.firstStarter||'player']?(r.firstStarter==='cpu'?'player':'cpu'):(r.firstStarter||'player'),startsAt:now+grace,deadline:now+grace+DUEL_TURN_MS};
}
export function afterRoomLock(r,at){
 if(r.pending.player&&r.pending.cpu){r.game=resolveTerminalDuel(r.game,r.pending.player,r.pending.cpu);r.stage=r.game.stage;r.pending={player:null,cpu:null};r.ready={player:false,cpu:false};r.clock=null;}
 else startRoomClock(r,at);
}
export function advanceRoomClock(r,now){
 if(r.flow!==2||r.stage!=='plan')return false;if(r.timed===false){const changed=!!r.clock;prepareRoomDrafts(r);r.clock=null;return changed;}let changed=false;
 if(!r.clock||r.clock.round!==r.game.round){startRoomClock(r,now);changed=true;}
 while(r.stage==='plan'&&now>=r.clock.deadline){
  const actor=r.clock.actor,at=r.clock.deadline;let action=r.drafts?.[actor]||defaultTimedAction(r.game,actor);
  try{action=normalizeDuelAction(action);duelActionInfo(r.game,actor,action);}catch{action=defaultTimedAction(r.game,actor);}
  r.pending[actor]=action;r.autoLocks=[...(r.autoLocks||[]),{round:r.game.round,actor}].slice(-24);afterRoomLock(r,at);changed=true;
 }return changed;
}
export function roomClockView(r,actor,now){return r.stage==='plan'&&r.timed!==false&&r.clock?{duration:r.clock.deadline-r.clock.startsAt,startsAt:r.clock.startsAt,deadline:r.clock.deadline,serverNow:now,turn:r.clock.actor===actor?'you':'opponent'}:null;}
