export const DUEL_TARGETS=[
  {id:'I-A',type:'Type I',eSide:'A',hSide:'A'},
  {id:'I-B',type:'Type I',eSide:'B',hSide:'B'},
  {id:'II-AB',type:'Type II',eSide:'A',hSide:'B'},
  {id:'II-BA',type:'Type II',eSide:'B',hSide:'A'}
];
export const DUEL_TYPE_TARGETS=[
  {id:'I-any',type:'Type I',eSide:null,hSide:null},
  {id:'II-any',type:'Type II',eSide:null,hSide:null}
];
export const DUEL_BOUNDARY_TARGET={id:'boundary-any',type:'邊界排列',eSide:null,hSide:null};
export const DUEL_TERMINAL_TARGETS=[...DUEL_TYPE_TARGETS,DUEL_BOUNDARY_TARGET];
export const DUEL_LENGTHS={5:12,12:30};
export const DUEL_THINK_MS=30000;
export const SHUFFLE_BOUNDARY_CHANCE=.10;
export const duelRoundLimit=g=>DUEL_LENGTHS[g?.roundLimit]?g.roundLimit:5;
export const duelStartingPoints=g=>DUEL_LENGTHS[duelRoundLimit(g)];
export function setDuelLength(g,rounds){
  if(!Number.isInteger(rounds)||!Object.hasOwn(DUEL_LENGTHS,rounds))throw Error('請選擇 5 或 12 回合。');
  if(g.round!==1||g.history.length)throw Error('對局開始後不能更改回合數。');
  return {...g,roundLimit:rounds,playerBudget:DUEL_LENGTHS[rounds],cpuBudget:DUEL_LENGTHS[rounds]};
}
export const isTypeOnlyGoal=q=>q.eSide===null&&q.hSide===null;
export function typeOnlyGoal(q){
  const goal=DUEL_TERMINAL_TARGETS.find(x=>x.type===q.type);
  if(!goal)throw Error('任務無效。');return {...goal};
}
export function shuffleGoals(random=Math.random){
  const first=Math.min(3,Math.max(0,Math.floor(random()*4))),rest=DUEL_TARGETS.filter((_,i)=>i!==first);
  return {player:{...DUEL_TARGETS[first]},cpu:{...rest[Math.min(2,Math.max(0,Math.floor(random()*3)))]}};
}
export const DUEL_MODES={types:'Type I vs Type II',together:'Type I',separate:'Type II',shuffle:'Shuffle'};
export function goalsForMode(mode='shuffle',random=Math.random){
  if(!Object.hasOwn(DUEL_MODES,mode))throw Error('對戰模式無效。');
  if(mode==='shuffle')return shuffleGoals(random);
  if(mode==='types'){
    const first=random()<.5?0:1;
    return {player:{...DUEL_TYPE_TARGETS[first]},cpu:{...DUEL_TYPE_TARGETS[1-first]}};
  }
  const start=mode==='together'?0:2,swap=random()<.5;
  return {player:{...DUEL_TARGETS[start+(swap?1:0)]},cpu:{...DUEL_TARGETS[start+(swap?0:1)]}};
}
export const otherBand=field=>field==='ec'?'ev':'ec';
export const DUEL_CHARACTERS=[
  {id:'charge',name:'蓄能',en:'Recharge',icon:'⚡',skill:'蓄能',skillEn:'Recharge',description:'本回合不移動，回復 2 點，最多回到初始點數。每場一次，第二回合起可用。',descriptionEn:'Skip movement to restore 2 points, up to the starting budget. Once per match, from round 2.'},
  {id:'split',name:'分流',en:'Split',icon:'⇄',skill:'分流',skillEn:'Split',description:'本職能帶與另一條能帶各移動一格，方向可分別選擇，花費 3 點。每場一次，第二回合起可用。',descriptionEn:'Move your primary band and the other band one step each. Choose both directions. Costs 3 points. Once per match, from round 2.'},
  {id:'pulse',name:'脈衝',en:'Pulse',icon:'◈',skill:'脈衝',skillEn:'Pulse',description:'本職能帶移動兩格，只花 1 點。每場一次，第二回合起可用。',descriptionEn:'Move your primary band two steps for 1 point. Once per match, from round 2.'},
  {id:'jam',name:'精準干擾',en:'Precision',icon:'◎',skill:'精準干擾',skillEn:'Precision',description:'另一條能帶移動一格，只花 1 點。每場一次，第二回合起可用。',descriptionEn:'Move the other band one step for 1 point. Once per match, from round 2.'}
];
export function draftDuelSkills(g,actors,mode='classic',random=Math.random){
 if(!['classic','skills'].includes(mode))throw Error('技能模式無效。');g.abilityMode=mode;g.characters={};g.skillUsed={};g.skillOffers={};
 for(const actor of actors){g.characters[actor]=null;g.skillUsed[actor]=false;const deck=DUEL_CHARACTERS.map(c=>c.id);for(let i=deck.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[deck[i],deck[j]]=[deck[j],deck[i]];}g.skillOffers[actor]=mode==='skills'?deck.slice(0,3):[];}return g;
}
export function selectDuelSkill(g,actor,id){
 if(g.abilityMode==='classic'||!g.abilityMode&&!g.characters){if(id)throw Error('經典與牌位模式不使用技能。');return;}
 if(!g.abilityMode)id??=g.characters?.[actor]||'charge';
 if(!validDuelCharacter(id)||g.skillOffers&&!g.skillOffers[actor]?.includes(id))throw Error('請從本場抽到的三種技能中選一個。');g.characters??={};g.characters[actor]=id;
}
export const validDuelCharacter=id=>DUEL_CHARACTERS.some(c=>c.id===id);
export function duelSkillView(g,actor='player'){
  const other=actor==='player'?'cpu':'player';return {enabled:g.abilityMode==='skills'||!g.abilityMode&&!!g.characters,offers:g.skillOffers?.[actor]||[],yours:g.characters?.[actor]||null,opponent:g.characters?.[other]||null,yourUsed:!!g.skillUsed?.[actor],opponentUsed:!!g.skillUsed?.[other]};
}
export function duelActionDeltas(a){return {[a.field]:a.delta,...(a.secondaryField?{[a.secondaryField]:a.secondaryDelta}:{})};}
export function applyDuelAction(board,a){for(const [field,delta] of Object.entries(duelActionDeltas(a)))board[field]+=delta;return board;}
function resolvedDuelResources(g,p,c){
  const cap=duelStartingPoints(g);return {playerBudget:Math.min(cap,g.playerBudget-p.cost+(p.refund||0)),cpuBudget:Math.min(cap,g.cpuBudget-c.cost+(c.refund||0)),...(g.characters?{skillUsed:{player:!!g.skillUsed?.player||!!p.skill,cpu:!!g.skillUsed?.cpu||!!c.skill}}:{})};
}
export const bandName=field=>field==='ec'?'導帶':'價帶';
export function makeDuel(controlled='ec',goals=shuffleGoals()){
  if(!['ec','ev'].includes(controlled))throw Error('請選擇有效的能帶。');
  for(const actor of ['player','cpu'])if(![...DUEL_TARGETS,...DUEL_TYPE_TARGETS].some(q=>q.id===goals?.[actor]?.id&&q.type===goals[actor].type&&q.eSide===goals[actor].eSide&&q.hSide===goals[actor].hSide))throw Error('任務無效。');
  if(goals.player.id===goals.cpu.id)throw Error('雙方需要不同的收集目標。');
  return {started:false,active:false,countFirstRound:true,controlled,mission:'shuffle',goals:structuredClone(goals),round:1,roundLimit:5,stage:'setup',board:{ec:0,ev:0},playerBudget:12,cpuBudget:12,playerScore:0,cpuScore:0,history:[],cpuPlan:null,plan:{kind:'own',direction:controlled==='ec'?-1:1,amount:3},tip:false};
}
export function carrierModel(ec,ev){
  const thermal=8.617333262e-5*300,electronB=1/(1+Math.exp(ec/thermal)),holeB=1/(1+Math.exp(-ev/thermal));
  const eSide=ec===0?'equal':ec<0?'B':'A',hSide=ev===0?'equal':ev>0?'B':'A';
  return {electronB,holeB,eSide,hSide,type:eSide==='equal'&&hSide==='equal'?'零位差':eSide==='equal'||hSide==='equal'?'邊界排列':eSide===hSide?'Type I':'Type II'};
}
export function goalFor(q,board){
  const r=carrierModel(board.ec*.02,board.ev*.02),any=isTypeOnlyGoal(q),eShare=any?Math.max(r.electronB,1-r.electronB):q.eSide==='B'?r.electronB:1-r.electronB,hShare=any?Math.max(r.holeB,1-r.holeB):q.hSide==='B'?r.holeB:1-r.holeB,quality=Math.min(eShare,hShare),aligned=r.type===q.type&&(any||r.eSide===q.eSide&&r.hSide===q.hSide);
  return {...q,eShare,hShare,quality,typeMatches:r.type===q.type,aligned,strong:aligned&&quality>=.9,points:aligned?(quality>=.9?2:1):0};
}
// A type-only task can change collection direction to fit the public opposite band.
export function goalDirection(q,field,board,fallback=1){
  if(q.type==='邊界排列')return board[field]===0?fallback:-Math.sign(board[field]);
  if(!isTypeOnlyGoal(q))return field==='ec'?(q.eSide==='B'?-1:1):(q.hSide==='B'?1:-1);
  const opposite=board[otherBand(field)];
  return opposite===0?fallback:Math.sign(opposite)*(q.type==='Type I'?-1:1);
}
export function duelGoal(g,actor,board=g.board){return goalFor(g.goals[actor],board);}
export function duelOutcome(g,board=g.board){
  const player=duelGoal(g,'player',board),cpu=duelGoal(g,'cpu',board),sameType=player.type===cpu.type;
  let playerGain=player.points,cpuGain=cpu.points,reason='type';
  if(sameType){playerGain=cpuGain=0;if(!player.typeMatches)reason='unmatched';else if(Math.abs(player.quality-cpu.quality)<1e-9)reason='tie';else{reason='ratio';if(player.quality>cpu.quality)playerGain=player.quality>=.9?2:1;else cpuGain=cpu.quality>=.9?2:1;}}
  return {player,cpu,sameType,playerGain,cpuGain,reason};
}
export function normalizeDuelAction(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['kind','direction','amount','skill','splitDirection'].includes(k))||!['own','attack','hold'].includes(a.kind)||![1,-1].includes(a.direction)||!Number.isInteger(a.amount)||a.amount<0||a.amount>4||(a.kind!=='hold'&&a.amount===0))throw Error('動作、方向或幅度無效。');
  if(a.skill!==undefined){
    if(a.skill==='charge'&&a.kind==='hold'&&a.amount===0&&a.splitDirection===undefined)return {kind:'hold',direction:1,amount:0,skill:'charge'};
    if(a.skill==='split'&&a.kind==='own'&&a.amount===1&&[-1,1].includes(a.splitDirection))return {kind:'own',direction:a.direction,amount:1,skill:'split',splitDirection:a.splitDirection};
    if(a.skill==='pulse'&&a.kind==='own'&&a.amount===2&&a.splitDirection===undefined)return {kind:'own',direction:a.direction,amount:2,skill:'pulse'};
    if(a.skill==='jam'&&a.kind==='attack'&&a.amount===1&&a.splitDirection===undefined)return {kind:'attack',direction:a.direction,amount:1,skill:'jam'};
    throw Error('技能動作無效。');
  }
  if(a.splitDirection!==undefined)throw Error('技能動作無效。');
  return a.kind==='hold'?{kind:'hold',direction:1,amount:0}:{kind:a.kind,direction:a.direction,amount:a.amount};
}
export function duelActionInfo(g,actor,input){
  const a=normalizeDuelAction(input),own=actor==='player'?g.controlled:otherBand(g.controlled),field=a.kind==='attack'?otherBand(own):own,cost=a.kind==='hold'?0:a.amount*(a.kind==='attack'?2:1),budget=actor==='player'?g.playerBudget:g.cpuBudget;
  if(a.skill){
    if(g.abilityMode==='classic'||g.round<2||g.characters?.[actor]!==a.skill||g.skillUsed?.[actor])throw Error('技能尚不可用或本場已經使用。');
    if(a.skill==='charge'){
      const refund=Math.min(2,duelStartingPoints(g)-budget);if(refund<=0)throw Error('點數已滿，不需要蓄能。');
      return {...a,field:own,cost:0,delta:0,refund};
    }
    if(['pulse','jam'].includes(a.skill)){const target=a.skill==='pulse'?own:otherBand(own),delta=a.direction*a.amount;if(budget<1)throw Error('技能需要 1 點。');if(Math.abs(g.board[target]+delta)>8)throw Error('這個技能會超出 ±0.16 eV 範圍。');return {...a,field:target,cost:1,delta};}
    if(budget<3)throw Error('分流需要 3 點。');
    const secondaryField=otherBand(own);if(Math.abs(g.board[own]+a.direction)>8||Math.abs(g.board[secondaryField]+a.splitDirection)>8)throw Error('這個技能會超出 ±0.16 eV 範圍。');
    return {...a,field:own,cost:3,delta:a.direction,secondaryField,secondaryDelta:a.splitDirection};
  }
  if(g.round===1&&a.kind!=='own')throw Error('第一回合只能設計自身能帶。');
  if(g.round>1&&a.amount>2)throw Error('每次最多改動 0.04 eV。');
  if(cost>budget)throw Error('剩餘點數不足，請縮小幅度或保留點數。');
  const delta=a.direction*a.amount;
  if(a.kind!=='hold'&&Math.abs(g.board[field]+delta)>8)throw Error('這個動作會超出 ±0.16 eV 範圍。');
  return {...a,field,cost,delta};
}
export function duelActions(g,actor){
  const actions=[];
  for(const kind of g.round===1?['own']:['own','attack'])for(const direction of [-1,1])for(let amount=1;amount<=(g.round===1?4:2);amount++){const a={kind,direction,amount};try{duelActionInfo(g,actor,a);actions.push(a);}catch{}}
  if(g.round>1){actions.push({kind:'hold',direction:1,amount:0});
    const skill=g.characters?.[actor],extra=skill==='charge'?[{kind:'hold',direction:1,amount:0,skill}]:skill==='split'?[-1,1].flatMap(direction=>[-1,1].map(splitDirection=>({kind:'own',direction,amount:1,skill,splitDirection}))):['pulse','jam'].includes(skill)?[-1,1].map(direction=>({kind:skill==='pulse'?'own':'attack',direction,amount:skill==='pulse'?2:1,skill})):[];
    for(const a of extra)try{duelActionInfo(g,actor,a);actions.push(a);}catch{}
  }return actions;
}
export function battleSliderBounds(g,kind=g.plan.kind){
  const field=kind==='attack'?otherBand(g.controlled):g.controlled,baseline=g.board[field],limit=kind==='hold'?0:Math.min(g.round===1?4:2,Math.floor(g.playerBudget/(kind==='attack'?2:1)));
  return {field,baseline,min:Math.max(-8,baseline-limit),max:Math.min(8,baseline+limit)};
}
export function combinedDuelBoard(g,p,c){
  const board={...g.board};for(const a of [p,c])applyDuelAction(board,a);
  for(const f of ['ec','ev'])board[f]=Math.max(-8,Math.min(8,board[f]));return board;
}
export function resolveDuel(g,playerInput,cpuInput){
  if(!g.active||!g.started||g.stage!=='plan')throw Error('目前不能提交對戰動作。');
  const p=duelActionInfo(g,'player',playerInput),c=duelActionInfo(g,'cpu',cpuInput),board=combinedDuelBoard(g,p,c),outcome=duelOutcome(g,board),scored=g.round!==1||g.countFirstRound===true,playerGain=scored?outcome.playerGain:0,cpuGain=scored?outcome.cpuGain:0;
  const entry={round:g.round,player:p,cpu:c,board:{...board},type:carrierModel(board.ec*.02,board.ev*.02).type,playerGain,cpuGain,playerQuality:outcome.player.quality,cpuQuality:outcome.cpu.quality,reason:scored?outcome.reason:'design'};
  return {...g,board,playerBudget:g.playerBudget-p.cost,cpuBudget:g.cpuBudget-c.cost,playerScore:g.playerScore+playerGain,cpuScore:g.cpuScore+cpuGain,stage:g.round===duelRoundLimit(g)?'finished':'revealed',cpuPlan:null,history:[...g.history,entry],tip:false};
}
// Phone matches use Type-only missions and a single verdict after the selected final round.
// Keep the classroom scoring API above independent of this rule.
export function terminalGoalsForMode(mode='shuffle',random=Math.random){
  if(!Object.hasOwn(DUEL_MODES,mode))throw Error('對戰模式無效。');
  let p,c;
  if(mode==='types'){p=random()<.5?0:1;c=1-p;}
  else if(mode==='shuffle'){
    if(random()<SHUFFLE_BOUNDARY_CHANCE){const left=random()<.5,regular=random()<.5?0:1;p=left?2:regular;c=left?regular:2;}
    else{p=random()<.5?0:1;c=random()<.5?0:1;}
  }
  else p=c=mode==='together'?0:1;
  return {player:{...DUEL_TERMINAL_TARGETS[p]},cpu:{...DUEL_TERMINAL_TARGETS[c]}};
}
export function makeTerminalDuel(controlled='ec',goals=terminalGoalsForMode()){
  const g=makeDuel(controlled,{player:DUEL_TYPE_TARGETS[0],cpu:DUEL_TYPE_TARGETS[1]});
  g.goals={player:typeOnlyGoal(goals.player),cpu:typeOnlyGoal(goals.cpu)};
  g.winRule='terminal';g.firstActor='player';return g;
}
export function replayDuelRound(g,p,c,firstActor=g.firstActor||'player'){
  const startBoard={...g.board},first=firstActor==='player'?p:c,afterFirstBoard={...startBoard};
  applyDuelAction(afterFirstBoard,first);
  return {startBoard,afterFirstBoard,board:combinedDuelBoard(g,p,c),firstActor};
}
export function terminalVerdict(g,replay){
  const model=b=>carrierModel(b.ec*.02,b.ev*.02),final=model(replay.board);
  const electron=Math.max(final.electronB,1-final.electronB),hole=Math.max(final.holeB,1-final.holeB);
  const playerRatio=g.controlled==='ec'?electron:hole,cpuRatio=g.controlled==='ec'?hole:electron;
  let winner='draw',reason='unmatched';
  const matches=goal=>goal.type==='邊界排列'?replay.board.ec===0||replay.board.ev===0:final.type===goal.type;
  if(g.goals.player.type!==g.goals.cpu.type){
    if(matches(g.goals.player))winner='player';else if(matches(g.goals.cpu))winner='cpu';
    reason=winner==='draw'?'unmatched':(g.goals[winner].type==='邊界排列'?'boundary':'type');
  }else if(matches(g.goals.player)){
    // Matching missions compare each player's controlled carrier in its favored material.
    if(Math.abs(playerRatio-cpuRatio)>1e-9){winner=playerRatio>cpuRatio?'player':'cpu';reason='ratio';}
    else reason='tie';
  }
  return {winner,reason,type:final.type,playerRatio,cpuRatio};
}
export function resolveTerminalDuel(g,playerInput,cpuInput){
  if(!g.active||!g.started||g.stage!=='plan')throw Error('目前不能提交對戰動作。');
  const player=duelActionInfo(g,'player',playerInput),cpu=duelActionInfo(g,'cpu',cpuInput),replay=replayDuelRound(g,player,cpu);
  const entry={round:g.round,player,cpu,...replay,type:carrierModel(replay.board.ec*.02,replay.board.ev*.02).type};
  if(g.round===duelRoundLimit(g))entry.decision=terminalVerdict(g,replay);
  return {...g,board:{...replay.board},...resolvedDuelResources(g,player,cpu),playerScore:0,cpuScore:0,stage:g.round===duelRoundLimit(g)?'finished':'revealed',cpuPlan:null,history:[...g.history,entry],tip:false};
}
// Completed moves are public. Pending moves and the opponent's mission are absent.
export function phoneRoundHistory(g,actor='player',firstActor=g.firstActor||'player'){
  let previous={ec:0,ev:0};
  return g.history.map(h=>{
    const start=h.startBoard||previous,first=h.firstActor||firstActor;
    const replay=h.afterFirstBoard?{startBoard:start,afterFirstBoard:h.afterFirstBoard,board:h.board,firstActor:first}:replayDuelRound({...g,board:start},h.player,h.cpu,first);
    const mine=actor==='player',decision=h.decision||(g.stage==='finished'&&h===g.history.at(-1)?terminalVerdict(g,replay):null);
    previous={...h.board};
    return {round:h.round,startBoard:{...replay.startBoard},afterFirstBoard:{...replay.afterFirstBoard},board:{...h.board},type:h.type,firstStarter:first===actor?'you':'opponent',yourAction:{...(mine?h.player:h.cpu)},opponentAction:{...(mine?h.cpu:h.player)},decision:decision?{winner:decision.winner==='draw'?'draw':decision.winner===actor?'you':'opponent',reason:decision.reason,type:decision.type,yourRatio:mine?decision.playerRatio:decision.cpuRatio,opponentRatio:mine?decision.cpuRatio:decision.playerRatio}:null};
  });
}
export function chooseCpuPlan(g,random=Math.random){
  if(g.round===1){const q=g.goals.cpu,field=otherBand(g.controlled);return {kind:'own',direction:goalDirection(q,field,g.board,isTypeOnlyGoal(q)?(random()<.5?-1:1):1),amount:random()<.5?2:3};}
  const possible=duelActions(g,'player'),ranked=duelActions(g,'cpu').map(a=>{const c=duelActionInfo(g,'cpu',a),values=possible.map(x=>{const p=duelActionInfo(g,'player',x),r=duelOutcome(g,combinedDuelBoard(g,p,c));return 4*(r.cpuGain-r.playerGain)+3*(r.cpu.quality-r.player.quality);});return {a,value:Math.min(...values)*.65+values.reduce((s,v)=>s+v,0)/values.length*.35-c.cost*.10};}).sort((a,b)=>b.value-a.value);
  const close=ranked.filter(x=>x.value>=ranked[0].value-.12);return {...close[Math.min(close.length-1,Math.floor(random()*close.length))].a};
}
