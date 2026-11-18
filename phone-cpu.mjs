import {DUEL_TYPE_TARGETS,DUEL_TERMINAL_TARGETS,DUEL_MODES,makeTerminalDuel,otherBand,terminalGoalsForMode,isTypeOnlyGoal,goalDirection,duelActions,duelActionInfo,replayDuelRound,terminalVerdict,phoneRoundHistory,normalizeDuelAction,resolveTerminalDuel,duelRoundLimit,duelStartingPoints,setDuelLength,validDuelCharacter,duelSkillView,draftDuelSkills,selectDuelSkill} from './duel-core.mjs';
import {DUEL_TURN_MS,defaultTimedAction} from './duel-clock.mjs';

// Only the public board, budgets, mode and computer's own mission inform its move.
export function choosePrivateCpuPlan(g,random=Math.random){
  const q=g.goals.cpu,own=otherBand(g.controlled);
  if(g.round===1)return {kind:'own',direction:goalDirection(q,own,g.board,isTypeOnlyGoal(q)?(random()<.5?-1:1):1),amount:random()<.5?2:3};
  const candidates=(g.mission==='shuffle'?DUEL_TERMINAL_TARGETS:DUEL_TYPE_TARGETS).filter(x=>g.mission==='types'?x.type!==q.type:g.mission==='shuffle'||x.type===q.type);
  const publicState={abilityMode:g.abilityMode,round:g.round,roundLimit:g.roundLimit,characters:g.characters,skillUsed:g.skillUsed,firstActor:g.firstActor,controlled:g.controlled,board:{...g.board},playerBudget:g.playerBudget,cpuBudget:g.cpuBudget};
  const playerActions=duelActions(publicState,'player');
  const ranked=duelActions(publicState,'cpu').map(a=>{
    const c=duelActionInfo(publicState,'cpu',a),values=[];
    for(const pAction of playerActions){const p=duelActionInfo(publicState,'player',pAction),replay=replayDuelRound(publicState,p,c);
      for(const goal of candidates){const r=terminalVerdict({...publicState,goals:{player:goal,cpu:q}},replay);values.push((r.winner==='cpu'?4:r.winner==='player'?-4:0)+.5*(r.cpuRatio-r.playerRatio));}
    }
    const remaining=duelRoundLimit(g)-g.round;
    return {a,value:Math.min(...values)*.65+values.reduce((s,v)=>s+v,0)/values.length*.35-c.cost*.1+(c.refund||0)*(remaining>0?.18:0)-(a.skill&&remaining>1?.12:0)};
  }).sort((a,b)=>b.value-a.value);
  const close=ranked.filter(x=>x.value>=ranked[0].value-.12);return {...close[Math.min(close.length-1,Math.floor(random()*close.length))].a};
}

export class PhoneCpuMatch {
  #game;#stage='role';#first=null;#chosen=false;#cpuAction=null;#playerAction=null;#cpuLocked=false;#version=0;#random;
  #clock=null;#draft=null;#draftSequence=0;#cpuReadyAt=null;#autoRound=null;
  constructor(random=Math.random,abilityMode='classic'){this.#random=random;this.#game=draftDuelSkills(makeTerminalDuel('ec'),['player','cpu'],abilityMode,random);if(abilityMode==='skills')selectDuelSkill(this.#game,'cpu',this.#game.skillOffers.cpu[Math.min(2,Math.floor(random()*3))]);}
  // Saved only on the server. Pending computer actions are never sent to players.
  snapshot(){return {game:this.#game,stage:this.#stage,first:this.#first,chosen:this.#chosen,cpuAction:this.#cpuAction,playerAction:this.#playerAction,cpuLocked:this.#cpuLocked,version:this.#version,clock:this.#clock,draft:this.#draft,draftSequence:this.#draftSequence,cpuReadyAt:this.#cpuReadyAt,autoRound:this.#autoRound};}
  static restore(s){const m=new PhoneCpuMatch();m.#game=s.game;m.#stage=s.stage;m.#first=s.first;m.#chosen=s.chosen;m.#cpuAction=s.cpuAction;m.#playerAction=s.playerAction;m.#cpuLocked=s.cpuLocked;m.#version=s.version;m.#clock=s.clock||null;m.#draft=s.draft||null;m.#draftSequence=s.draftSequence||0;m.#cpuReadyAt=s.cpuReadyAt??null;m.#autoRound=s.autoRound??null;return m;}
  view(){
    const g=this.#game,playing=['plan','revealed','finished'].includes(this.#stage);
    return {code:'CPU',version:this.#version,flow:2,joined:true,matchmaking:false,mode:g.mission,roundLimit:duelRoundLimit(g),startingPoints:duelStartingPoints(g),clock:this.#stage==='plan'&&this.#clock?{...this.#clock,duration:this.#clock.deadline-this.#clock.startsAt,serverNow:Date.now(),turn:'you'}:null,yourDraft:this.#stage==='plan'?this.#draft:null,yourDraftSequence:this.#draftSequence,autoLocked:this.#autoRound===g.round,skills:duelSkillView(g),canChooseMode:true,firstStarter:this.#first,roundStarter:this.#first,yourTurn:this.#stage==='plan'&&!this.#playerAction&&(this.#first==='you'||this.#cpuLocked),round:g.round,stage:this.#stage,controlled:this.#chosen?g.controlled:null,goal:playing?{...g.goals.player}:null,...(this.#stage==='finished'?{opponentGoal:{...g.goals.cpu}}:{}),ranked:false,rankingReason:'computer',yourProfile:null,opponentProfile:{displayName:'Band Bot',avatarId:'spark',rating:null,tier:'computer'},board:{...g.board},yourBudget:g.playerBudget,opponentBudget:g.cpuBudget,yourLocked:!!this.#playerAction,opponentLocked:this.#cpuLocked,yourReady:false,opponentReady:false,yourLockedAction:this.#playerAction?{...this.#playerAction}:null,history:phoneRoundHistory(g)};
  }
  #startClock(now){const startsAt=now+(this.#game.round===1?2500:0);this.#clock={startsAt,deadline:startsAt+DUEL_TURN_MS};}
  advanceClock(now=Date.now()){
    let changed=false;
    for(let i=0;i<4&&this.#stage==='plan';i++){
      if(this.needsCpuTurn()){
        if(this.#cpuReadyAt===null){this.#cpuReadyAt=now+650;this.#version++;changed=true;break;}
        if(now>=this.#cpuReadyAt){this.finishCpuTurn(this.#cpuReadyAt);changed=true;continue;}
      }
      if(this.view().yourTurn){if(!this.#clock){this.#draft??=defaultTimedAction(this.#game,'player');this.#startClock(now);this.#version++;changed=true;}
        if(now>=this.#clock.deadline){const at=this.#clock.deadline;this.#autoRound=this.#game.round;this.lock(this.#draft||defaultTimedAction(this.#game,'player'),at);changed=true;continue;}}
      break;
    }return changed;
  }
  draft(action,sequence){
    if(this.#stage!=='plan'||!this.view().yourTurn)throw Error('請等到你的操作時間。');if(!Number.isSafeInteger(sequence)||sequence<1||sequence>1e9)throw Error('計畫版本無效。');if(sequence<=this.#draftSequence)return this.view();
    const a=normalizeDuelAction(action);duelActionInfo(this.#game,'player',a);this.#draft=a;this.#draftSequence=sequence;this.#version++;return this.view();
  }
  #prepare(now=Date.now()){
    this.#game={...this.#game,started:true,active:true,stage:'plan'};this.#stage='plan';this.#playerAction=null;this.#cpuLocked=false;
    this.#draft=defaultTimedAction(this.#game,'player');this.#draftSequence=0;this.#clock=null;this.#cpuReadyAt=now+650;if(this.#first==='you')this.#startClock(now);
    // Commit before the human edits; changing a human draft cannot change this plan.
    this.#cpuAction=choosePrivateCpuPlan(this.#game,this.#random);
  }
  chooseRole(controlled,character=null){
    if(this.#stage!=='role'||!['ec','ev'].includes(controlled))throw Error('請在角色畫面選擇導帶或價帶。');
    selectDuelSkill(this.#game,'player',character??this.#game.skillOffers?.player?.[0]??null);
    this.#game.controlled=controlled;this.#chosen=true;this.#stage='mode';this.#version++;return this.view();
  }
  chooseMode(mode,rounds=5){
    if(this.#stage!=='mode'||!Object.hasOwn(DUEL_MODES,mode))throw Error('請在浮窗選擇有效模式。');
    this.#game=setDuelLength(this.#game,rounds);this.#game.mission=mode;this.#game.goals=terminalGoalsForMode(mode,this.#random);this.#first=this.#random()<.5?'you':'opponent';this.#game.firstActor=this.#first==='you'?'player':'cpu';this.#prepare();this.#version++;return this.view();
  }
  needsCpuTurn(){return this.#stage==='plan'&&!this.#cpuLocked&&(this.#first==='opponent'||!!this.#playerAction);}
  finishCpuTurn(now=Date.now()){
    if(!this.needsCpuTurn())return this.view();this.#cpuLocked=true;if(this.#playerAction)this.#resolve();else this.#startClock(now);this.#version++;return this.view();
  }
  lock(action,now=Date.now()){
    if(!this.view().yourTurn)throw Error('請等電腦先完成出招。');
    const normalized=normalizeDuelAction(action);duelActionInfo(this.#game,'player',normalized);this.#playerAction=normalized;
    this.#clock=null;this.#cpuReadyAt=now+650;
    if(this.#cpuLocked)this.#resolve();this.#version++;return this.view();
  }
  #resolve(){this.#game=resolveTerminalDuel(this.#game,this.#playerAction,this.#cpuAction);this.#stage=this.#game.stage;this.#playerAction=null;this.#cpuAction=null;this.#cpuLocked=false;this.#clock=null;}
  next(){
    if(this.#stage!=='revealed')throw Error('請先完成這個回合。');this.#game.round++;this.#prepare();this.#version++;return this.view();
  }
}
