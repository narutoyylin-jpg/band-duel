import {TEAM_SLOTS,teamSlot,teamOpponent,teamActionInfo,normalizeTeamAction,teamBudget,prepareTeamRound,advanceTeamClock,resolveTeamRound,shuffleTeamGoals,teamDual,teamRoundOrder,teamGoalsForMode} from './team-core.mjs';
import {D1RankingStore,requestPlayerId,publicProfile} from './ranking.mjs';
import {ROOM_CODE_PATTERN,normalizeRoomCode,randomRoomCode} from './room-codes.mjs';
import {isTeamComputer,humanTeamSlots,fillTeamComputers,advanceTeamComputers} from './team-cpu.mjs';
import {D1TeamMatchmaker,teamMembers,TeamQueueError} from './team-matchmaking.mjs';
import {D1TeamRanking} from './team-ranking.mjs';
import {D1EconomyStore,walletIdentity} from './economy.mjs';
import {coinReward} from './cosmetics.mjs';
import {DUEL_MODES,draftDuelSkills,selectDuelSkill} from './duel-core.mjs';
import {teamMvp} from './team-mvp.mjs';
import {claimRoomCode,roomCodeClaimStatement,roomCodeCleanupStatements} from './room-lifecycle.mjs';
class TeamError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const digest=async t=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))),n=>n.toString(16).padStart(2,'0')).join('');
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const all=r=>TEAM_SLOTS.every(s=>r.seats[s.id]);
const minimumTeamHumans=r=>r.computer||r.allowSoloContinuation?1:2;
const canTeamRematch=r=>r.stage==='finished'&&!r.matchmaking&&humanTeamSlots(r).length>=minimumTeamHumans(r);
const teamRematchSettings=r=>r.rematchSettings||{rounds:r.game.roundLimit,abilityMode:r.game.abilityMode||'classic',timed:r.timed!==false,version:0};
function captureTeamParticipants(r){
 if(!r.matchParticipants)r.matchParticipants=TEAM_SLOTS.map(s=>({slot:s.id,accountId:r.players[s.id]||null,seatHash:r.seats[s.id],profile:structuredClone(r.profiles[s.id]||null),wallet:r.wallets?.[s.id]||null}));
}
function captureFinishedRoster(r){
 if(r.stage==='finished'&&!r.finishedRoster)r.finishedRoster=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,{profile:structuredClone(r.profiles[s.id]||null),computer:isTeamComputer(r,s.id)}]));
}
function swapParticipantSlots(r,from,to){
 if(r.matchParticipants){const a=r.matchParticipants.find(p=>p.slot===from),b=r.matchParticipants.find(p=>p.slot===to);if(a){a.slot=to;if(!a.accountId)a.seatHash='computer:'+r.matchId+':'+to;}if(b){b.slot=from;if(!b.accountId)b.seatHash='computer:'+r.matchId+':'+from;}}
 if(r.departedPlayers){const a=r.departedPlayers[from],b=r.departedPlayers[to];delete r.departedPlayers[from];delete r.departedPlayers[to];if(a)r.departedPlayers[to]={...a,slot:to};if(b)r.departedPlayers[from]={...b,slot:from};}
}
function departTeamPlayer(r,actor,requestId,now){
 const seatHash=r.seats[actor],profile=r.profiles[actor],name=profile?.displayName||'訪客',previousHost=r.host,wasClosed=r.stage==='closed',queued=['party','queue'].includes(r.stage);
 if(!queued){if(r.matchmaking||['plan','revealed','finished'].includes(r.stage))captureTeamParticipants(r);captureFinishedRoster(r);}
 r.departureReceipts=[...(r.departureReceipts||[]),{seatHash,requestId,matchId:r.matchId}].slice(-32);
 r.departedPlayers??={};r.departedPlayers[actor]={slot:actor,accountId:r.players[actor],seatHash,profile:structuredClone(profile),wallet:r.wallets?.[actor]||null,at:now};
 r.seats[actor]=null;r.players[actor]=null;r.profiles[actor]=null;r.wallets??={};r.wallets[actor]=null;r.ready[actor]=false;r.receipts[actor]=null;
 const remaining=humanTeamSlots(r);if(wasClosed||!remaining.length){r.stage='closed';r.deadline=null;r.host=null;r.closeReason??='empty';}
 else{
  if(previousHost===actor)r.host=remaining[0].id;
  if(queued){r.cpuFillAt=null;r.cpuFillMembers=[];delete r.matchParticipants;}
  else{r.allowSoloContinuation=true;fillTeamComputers(r,true);if(r.computerState){delete r.computerState.ticks?.[actor];r.computerState.humanLockedAt=null;}}
 }
 if(r.stage==='finished'){const settings=teamRematchSettings(r);r.rematchSettings={...settings,version:settings.version+1};r.receipts=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,null]));delete r.lastRematchSettingsRequest;}
 r.rematchReady={};r.rematchReceipts={};
 r.lastDeparture={at:now,name,slot:actor,hostTransferred:!wasClosed&&!!remaining.length&&previousHost===actor,hostName:r.host?(r.profiles[r.host]?.displayName||'訪客'):null};
}
function resetTeamForRematch(r,now){
 const sourceMatchId=r.matchId,receiptsByHash=Object.fromEntries(humanTeamSlots(r).map(s=>[r.seats[s.id],r.rematchReceipts?.[s.id]])),computers=TEAM_SLOTS.filter(s=>isTeamComputer(r,s.id));
 const settings=teamRematchSettings(r),roundLimit=settings.rounds,abilityMode=settings.abilityMode,empty=value=>Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,value]));
 for(const slot of computers){r.seats[slot.id]=null;r.players[slot.id]=null;r.profiles[slot.id]=null;}
 r.matchId=crypto.randomUUID();r.requireMatchId=true;r.completedRematch={sourceMatchId,receiptsByHash};r.stage='lobby';r.expiresAt=now+7200000;r.timed=settings.timed;
 r.game={rulesVersion:3,round:1,roundLimit,board:{aEc:0,aEv:0,bEc:0,bEv:0},budgets:empty(teamBudget(roundLimit)),history:[]};draftDuelSkills(r.game,TEAM_SLOTS.map(s=>s.id),abilityMode);
 r.goals={a:'Type I',b:'Type II'};r.ready=empty(false);r.locked=empty(false);r.drafts=empty(null);r.sequences=empty(0);r.receipts=empty(null);r.rematchReady=empty(false);r.rematchReceipts={};r.deadline=null;r.planStartedAt=null;r.autoLocks=[];r.computerSeed=crypto.getRandomValues(new Uint32Array(1))[0];
 delete r.computerState;delete r.rating;delete r.rematchSettings;delete r.lastRematchSettingsRequest;delete r.matchParticipants;delete r.departedPlayers;delete r.finishedRoster;fillTeamComputers(r,true);
}
const check=(yes,message,status=400)=>{if(!yes)throw new TeamError(message,status);};
async function actorFor(r,request){const t=request.headers.get('Authorization')?.replace(/^Bearer /,'');check(t&&/^[a-f0-9]{64}$/.test(t),'請使用自己的組隊房間憑證。',401);const h=await digest(t),actor=TEAM_SLOTS.find(s=>r.seats[s.id]===h)?.id;check(actor,'你沒有這個組隊位置的操作權。',403);return actor;}
export function teamView(r,actor,now=Date.now()){
 const s=teamSlot(actor),opponent=teamOpponent(actor),playing=['plan','revealed','finished'].includes(r.stage);
 const rating=r.rating?.participants.find(p=>p.slot===actor),humans=humanTeamSlots(r);captureFinishedRoster(r);
 const rematch={canRematch:canTeamRematch(r),canEditRematchSettings:canTeamRematch(r)&&r.host===actor,rematchSettings:{...teamRematchSettings(r)},rematchReady:!!r.rematchReady?.[actor],rematchReadyCount:humans.filter(s=>r.rematchReady?.[s.id]).length,rematchHumanCount:humans.length};
 return {...rematch,skills:{enabled:r.game.abilityMode==='skills',offers:r.game.skillOffers?.[actor]||[],yours:r.game.characters?.[actor]||null,yourUsed:!!r.game.skillUsed?.[actor]},mvp:teamMvp(r),code:r.code,version:r.version,matchId:r.matchId,matchKind:'team',flow:'team',matchmaking:!!r.matchmaking,queueKind:r.queueKind||null,party:!!r.party,partySize:teamMembers(r).length,queuedAt:r.queuedAt||null,waitingPlayers:r.waitingPlayers||0,cpuFillAt:r.cpuFillAt??null,minimumHumans:minimumTeamHumans(r),humanCount:humanTeamSlots(r).length,hasComputers:TEAM_SLOTS.some(x=>isTeamComputer(r,x.id)),timed:r.timed!==false,turnDuration:r.timed===false?null:30000,ratingResult:rating?{before:rating.before,after:rating.after,change:rating.after-rating.before}:null,rulesVersion:r.game.rulesVersion||1,mode:r.computer?(r.practiceMode||'shuffle'):teamDual(r.game)?'shuffle':'types',revealOrder:teamRoundOrder(r.game),computer:r.computer===true,stage:r.stage,joined:all(r),round:r.game.round,roundLimit:r.game.roundLimit,startingPoints:teamBudget(r.game.roundLimit),yourSlot:actor,yourTeam:s.team,controlled:s.field,material:s.material,host:r.host===actor,hostName:r.profiles[r.host]?.displayName||null,lastDeparture:r.lastDeparture||null,closeReason:r.closeReason||null,goals:r.stage==='finished'?{...r.goals}:{[s.team]:playing?r.goals[s.team]:null},board:{...r.game.board},yourBudget:r.game.budgets[actor],yourLocked:!!r.locked[actor],opponentLocked:!!r.locked[opponent],yourReady:!!r.ready[actor],yourTurn:r.stage==='plan'&&!r.locked[actor],yourDraft:r.stage==='plan'?{...r.drafts[actor]}:null,yourDraftSequence:r.sequences[actor]||0,
  players:TEAM_SLOTS.map(x=>({slot:x.id,team:x.team,field:x.field,material:x.material,computer:r.stage==='finished'?r.finishedRoster?.[x.id]?.computer??isTeamComputer(r,x.id):isTeamComputer(r,x.id),skill:r.game.characters?.[x.id]||null,skillUsed:!!r.game.skillUsed?.[x.id],joined:!!r.seats[x.id],profile:(r.stage==='finished'?r.finishedRoster?.[x.id]?.profile:r.profiles[x.id])||null,host:r.host===x.id,ready:!!r.ready[x.id],locked:!!r.locked[x.id],budget:r.game.budgets[x.id]})),
  visibleOpponent:r.stage==='plan'?{slot:opponent,profile:r.profiles[opponent]||null,locked:!!r.locked[opponent],action:{...r.drafts[opponent]}}:null,
  clock:r.stage==='plan'&&r.timed!==false?{duration:r.turnDuration||30000,startsAt:r.planStartedAt??r.deadline-(r.turnDuration||30000),deadline:r.deadline,serverNow:now,turn:'all'}:null,history:playing?structuredClone(r.game.history):[],autoLocked:r.autoLocks?.includes(actor)||false,ranked:!!r.ranked,coinReward:r.stage==='finished'&&r.matchmaking&&r.wallets?.[actor]?{kind:'random',amount:coinReward('random',r.game.history.at(-1).decision.winner==='draw'?'draw':r.game.history.at(-1).decision.winner===s.team?'win':'loss')}:null};
}
async function loadTeam(store,code,now){
 let redirected=null;for(let i=0;i<12;i++){const r=await store.get(code);check(r,'找不到組隊房間。',404);check(r.matchKind==='team','這是 1v1 房間，請使用原本的房間入口。',409);check(r.expiresAt>now,'組隊房間已到期。',410);if(redirected)check(r.matchId===redirected,'這場組隊配對已失效。',410);
  if(r.stage==='redirect'){code=r.redirectCode;redirected=r.redirectMatchId;continue;}
  if(r.stage==='queue'){if(!await store.matchmaker.partyValid(r)){const expected=r.version;r.stage='closed';r.version++;if(await store.save(r,expected))return r;continue;}await store.matchmaker.pair(r,now);const current=await store.get(code);if(current.version!==r.version)continue;r.waitingPlayers=await store.matchmaker.count(r.queueKind,r.game.roundLimit,now,r.game.abilityMode||'classic');}
  const botsChanged=advanceTeamComputers(r,now),clockChanged=advanceTeamClock(r,now);if(botsChanged||clockChanged){advanceTeamComputers(r,now);const expected=r.version;r.version++;if(await store.save(r,expected))return r;continue;}if(r.stage==='finished')await store.rewards?.(r);return r;}throw new TeamError('組隊正在同步，請再試一次。',409);
}
async function bodyOf(request,allowed){check(request.headers.get('Content-Type')?.includes('application/json'),'操作格式無效。',415);const raw=await request.text();check(raw.length<=2048,'操作資料過長。',413);let b;try{b=JSON.parse(raw);}catch{throw new TeamError('操作內容無效。');}check(b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>allowed.includes(k)),'組隊操作參數無效。');return b;}
export async function handleTeamRequest(request,store,now=Date.now()){
 try{
  const url=new URL(request.url),parts=url.pathname.replace(/^\/api\/team-rooms\/?/,'').split('/').filter(Boolean),code=parts[0],op=parts[1];check(parts.length<=2,'找不到組隊操作。',404);
  if(request.method==='POST')check(!request.headers.get('Origin')||request.headers.get('Origin')===url.origin,'請從對戰網站操作。',403);
  if(!code&&request.method==='GET'){const kind=url.searchParams.get('queue')||'random',rounds=Number(url.searchParams.get('rounds')||5),abilityMode=kind==='ranked'?'classic':url.searchParams.get('abilityMode')||'classic';check(['random','ranked'].includes(kind),'配對類型無效。');teamBudget(rounds);return reply({waitingPlayers:await store.matchmaker.count(kind,rounds,now,abilityMode)});}
  if(!code&&request.method==='POST'){
   const b=await bodyOf(request,['code','computer','queue','party','rounds','mode','abilityMode','timed']),custom=b.code===undefined?null:normalizeRoomCode(b.code);check(b.computer===undefined||typeof b.computer==='boolean','電腦試玩設定無效。');check(b.timed===undefined||typeof b.timed==='boolean','倒數設定無效。');check(!b.queue||b.timed!==false,'隨機與牌位配對使用 30 秒倒數。');check(!custom||ROOM_CODE_PATTERN.test(custom),'房間代號需要 6 碼英文或數字。');check(b.queue===undefined||['random','ranked'].includes(b.queue),'配對類型無效。');check(b.party===undefined||typeof b.party==='boolean','組隊設定無效。');check(!b.queue||!b.computer&&!custom,'配對不能使用電腦或自訂房號。');check(!b.party||b.queue,'請選擇隨機或牌位配對。');check(b.mode===undefined||b.computer&&Object.hasOwn(DUEL_MODES,b.mode),'指定 Type 組合僅限練習模式；正式對戰使用 Shuffle。');check(b.abilityMode===undefined||['classic','skills'].includes(b.abilityMode),'技能模式無效。');check(b.queue!=='ranked'||!b.abilityMode||b.abilityMode==='classic','牌位模式不使用技能。');const budget=teamBudget(b.rounds??5);
   await store.cleanup?.(now);const profile=await store.ranking.ensure(requestPlayerId(request),now);
   for(let i=0;i<(custom?1:6);i++){
    const raw=token(),roomCode=custom||randomRoomCode(),empty=()=>Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,null])),r={code:roomCode,matchId:crypto.randomUUID(),matchKind:'team',version:0,createdAt:now,expiresAt:now+7200000,stage:'lobby',host:'ae',goals:{a:'Type I',b:'Type II'},seats:empty(),players:empty(),profiles:empty(),ready:empty(),locked:empty(),drafts:empty(),sequences:empty(),receipts:empty(),deadline:null,autoLocks:[],game:{rulesVersion:3,round:1,roundLimit:5,board:{aEc:0,aEv:0,bEc:0,bEv:0},budgets:Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,12])),history:[]}};
    r.timed=b.timed!==false;draftDuelSkills(r.game,TEAM_SLOTS.map(s=>s.id),b.abilityMode??'classic');r.seats.ae=await digest(raw);r.players.ae=profile?.account_id||null;r.profiles.ae=publicProfile(profile);r.wallets=empty();r.wallets.ae=await walletIdentity(request);r.game.roundLimit=b.rounds??5;for(const s of TEAM_SLOTS)r.game.budgets[s.id]=budget;
    if(b.queue){check(b.queue!=='ranked'&& !b.party||profile,'請先登入，才能參加牌位或邀請好友組隊。',401);r.matchmaking=true;r.queueKind=b.queue;r.party=!!b.party;r.stage=b.party?'party':'queue';r.queuedAt=b.party?null:now;await store.matchmaker.assertAvailable(teamMembers(r));}
    if(custom)await store.ranking.achievements.recordRoomCode(profile?.account_id,custom,now);if(b.computer){r.computer=true;r.practiceMode=b.mode||'shuffle';r.computerSeed=crypto.getRandomValues(new Uint32Array(1))[0];fillTeamComputers(r);}if(await store.create(r)){const view=await loadTeam(store,r.code,now);return reply({token:raw,view:teamView(view,await actorFor(view,new Request(request.url,{headers:{Authorization:'Bearer '+raw}})),now)},201);}
   }throw new TeamError('這個房號已被使用，請換一組。',409);
  }
  check(code&&ROOM_CODE_PATTERN.test(code),'房間代號需要 6 碼英文或數字。');
  if(request.method==='GET'&&!op){const r=await loadTeam(store,code,now),actor=await actorFor(r,request);return reply(teamView(r,actor,now));}
  check(request.method==='POST','這個操作不適用。',405);
  const allowed={join:[],search:['requestId'],seat:['seat','requestId'],ready:['round','ready','requestId'],skill:['skill','requestId'],settings:['rounds','mode','timed','requestId'],start:['requestId'],draft:['round','sequence','action'],lock:['round','sequence','action','requestId'],next:['round','requestId'],leave:['requestId'],close:['requestId'],rematch:['requestId','matchId','settingsVersion'],'rematch-settings':['requestId','matchId','settingsVersion','rounds','abilityMode','timed']};check(Object.hasOwn(allowed,op),'找不到組隊操作。',404);const b=await bodyOf(request,[...allowed[op],'matchId']);
  const joinToken=op==='join'?token():null,joinHash=joinToken?await digest(joinToken):null,profile=joinToken?await store.ranking.ensure(requestPlayerId(request),now):null;
  for(let retry=0;retry<8;retry++){
   const r=await loadTeam(store,code,now),expected=r.version,expectedMatchId=r.matchId;let actor;
   if(op==='join'){
    check(!r.computer,'電腦試玩房間無法加入，請建立四人房間。',409);check(r.stage==='party'||r.stage==='lobby'&&!r.matchmaking,'這場組隊配對無法使用房號加入。',409);actor=TEAM_SLOTS.find(s=>(!r.party||s.team==='a')&&(!r.seats[s.id]||r.stage==='lobby'&&!r.matchmaking&&isTeamComputer(r,s.id)))?.id;check(actor,'組隊房間已滿。',409);r.seats[actor]=joinHash;r.players[actor]=profile?.account_id||null;r.profiles[actor]=publicProfile(profile);r.wallets??={};r.wallets[actor]=await walletIdentity(request);r.ready[actor]=false;r.receipts[actor]=null;delete r.departedPlayers?.[actor];if(r.game.characters)r.game.characters[actor]=null;if(r.game.skillUsed)r.game.skillUsed[actor]=false;if(r.hasComputers)fillTeamComputers(r);if(r.party){check(await store.matchmaker.partyValid(r),'請由已互相確認的好友加入隊伍。',403);await store.matchmaker.assertAvailable(teamMembers(r),r.code);}
   }else{
    if(op!=='draft')check(typeof b.requestId==='string'&&/^[\w-]{8,64}$/.test(b.requestId),'操作識別無效。');
    if(op==='leave'){const raw=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(raw&&/^[a-f0-9]{64}$/.test(raw)){const hash=await digest(raw);if(r.departureReceipts?.some(x=>x.seatHash===hash&&x.requestId===b.requestId&&x.matchId===b.matchId))return reply({left:true,code:r.code,stage:'left'});}}
    actor=await actorFor(r,request);
    if(op==='rematch'&&r.completedRematch?.sourceMatchId===b.matchId&&r.completedRematch.receiptsByHash?.[r.seats[actor]]===b.requestId)return reply(teamView(r,actor,now));
    if(b.matchId!==undefined||r.requireMatchId||op==='rematch'||op==='rematch-settings')check(typeof b.matchId==='string'&&b.matchId===r.matchId,'對局已更新，請同步後再操作。',409);
    if(op!=='draft'&&r.receipts[actor]===b.requestId)return reply(teamView(r,actor,now));
    if(['draft','lock','next','ready'].includes(op))check(b.round===r.game.round,'回合已更新，請重新同步。',409);
    if(op==='leave')departTeamPlayer(r,actor,b.requestId,now);
    else if(op==='close'){check(!r.matchmaking&&r.host===actor,'只有房主能關閉自訂房間。',403);r.stage='closed';r.deadline=null;r.closeReason='host-closed';}
    else if(op==='rematch-settings'){
     check(canTeamRematch(r)&&r.host===actor,'只有房主能在自訂房結束後調整下一場設定。',403);
     if(r.lastRematchSettingsRequest===b.requestId)return reply(teamView(r,actor,now));
     const current=teamRematchSettings(r);check(Number.isSafeInteger(b.settingsVersion)&&b.settingsVersion===current.version,'再戰設定已更新，請同步後再調整。',409);
     check(['rounds','abilityMode','timed'].some(field=>b[field]!==undefined),'請選擇要調整的再戰設定。');
     if(b.rounds!==undefined)teamBudget(b.rounds);if(b.abilityMode!==undefined)check(['classic','skills'].includes(b.abilityMode),'請選擇經典或技能模式。');if(b.timed!==undefined)check(typeof b.timed==='boolean','倒數設定無效。');
     const next={rounds:b.rounds??current.rounds,abilityMode:b.abilityMode??current.abilityMode,timed:b.timed??current.timed,version:current.version};
     if(next.rounds===current.rounds&&next.abilityMode===current.abilityMode&&next.timed===current.timed)return reply(teamView(r,actor,now));
     next.version++;r.rematchSettings=next;r.lastRematchSettingsRequest=b.requestId;r.rematchReady={};r.rematchReceipts={};r.receipts=Object.fromEntries(TEAM_SLOTS.map(s=>[s.id,null]));
    }
    else if(op==='rematch'){
     check(canTeamRematch(r),'這個房間目前不能再戰。',409);const revision=teamRematchSettings(r).version;if(revision>0||b.settingsVersion!==undefined)check(Number.isSafeInteger(b.settingsVersion)&&b.settingsVersion===revision,'再戰設定已更新，請確認新設定後重新準備。',409);r.rematchReady??={};r.rematchReceipts??={};r.rematchReady[actor]=true;r.rematchReceipts[actor]=b.requestId;
     if(humanTeamSlots(r).every(s=>r.rematchReady[s.id]))resetTeamForRematch(r,now);
    }
    else if(op==='search'){
     check(r.stage==='party'&&r.host===actor,'請由隊長開始配對。',403);check(teamMembers(r).length===2&&teamMembers(r).every(p=>r.ready[p.slot]),'兩位隊員都準備好後才能開始配對。',409);check(await store.matchmaker.partyValid(r),'好友關係已更新，請重新組隊。',409);await store.matchmaker.assertAvailable(teamMembers(r),r.code);r.stage='queue';r.queuedAt=now;
    }
    else if(op==='seat'){
     check((r.stage==='lobby'||r.stage==='party')&&teamSlot(b.seat),'請在等待房間選擇隊伍與角色。',409);if(b.seat===actor)return reply(teamView(r,actor,now));swapParticipantSlots(r,actor,b.seat);if(r.matchmaking){check(teamSlot(actor).team===teamSlot(b.seat).team,'配對後只能與隊友交換角色。',409);const targetComputer=isTeamComputer(r,b.seat);check(!r.ready[actor]&&(!r.ready[b.seat]||targetComputer),'請雙方取消準備後再交換角色。',409);for(const field of ['characters','skillOffers','skillUsed'])if(r.game[field]){const value=r.game[field][actor];r.game[field][actor]=r.game[field][b.seat];r.game[field][b.seat]=value;}for(const field of ['seats','players','profiles','wallets','ready','receipts'])if(r[field]){const value=r[field][actor];r[field][actor]=r[field][b.seat];r[field][b.seat]=value;}if(targetComputer)r.seats[actor]='computer:'+r.matchId+':'+actor;if(r.host===actor)r.host=b.seat;else if(r.host===b.seat)r.host=actor;actor=b.seat;r.ready[actor]=false;r.ready[teamSlot(actor).field==='ec'?actor[0]+'v':actor[0]+'e']=false;fillTeamComputers(r);
     }else{check(!r.seats[b.seat]||isTeamComputer(r,b.seat),'這個位置已有人，請選擇空位。',409);
     for(const field of ['characters','skillOffers','skillUsed'])if(r.game[field]){const value=r.game[field][actor];r.game[field][actor]=r.game[field][b.seat];r.game[field][b.seat]=value;}for(const field of ['seats','players','profiles','ready','receipts','wallets'])if(r[field]){r[field][b.seat]=r[field][actor];r[field][actor]=null;}if(r.host===actor)r.host=b.seat;actor=b.seat;r.ready[actor]=false;fillTeamComputers(r);}
    }else if(op==='skill'){
     check(r.stage==='lobby'&&!r.ready[actor],'請在準備前選擇本場技能。',409);selectDuelSkill(r.game,actor,b.skill);
    }else if(op==='settings'){
     check((r.stage==='party'||r.stage==='lobby'&&!r.matchmaking)&&actor===r.host,'只有房主能在配對前設定房間。',403);if(b.timed!==undefined){check(typeof b.timed==='boolean','倒數設定無效。');check(!r.matchmaking,'隨機與牌位配對使用 30 秒倒數。');r.timed=b.timed;}if(b.mode!==undefined){check(r.computer&&Object.hasOwn(DUEL_MODES,b.mode),'指定 Type 組合僅限練習模式；正式對戰使用 Shuffle。');r.practiceMode=b.mode;}const budget=teamBudget(b.rounds??r.game.roundLimit);r.game.roundLimit=b.rounds??r.game.roundLimit;for(const s of TEAM_SLOTS){r.game.budgets[s.id]=budget;r.ready[s.id]=isTeamComputer(r,s.id);}
    }else if(op==='ready'){
     check(['lobby','party'].includes(r.stage)&&typeof b.ready==='boolean','請在等待房間確認準備。',409);if(b.ready&&r.stage==='lobby'&&r.game.abilityMode==='skills')check(r.game.characters?.[actor],'請先從三種技能中選一個。',409);r.ready[actor]=b.ready;if(r.matchmaking&&r.stage==='lobby'&&all(r)&&TEAM_SLOTS.every(s=>r.ready[s.id])){captureTeamParticipants(r);r.goals=shuffleTeamGoals(()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);prepareTeamRound(r,now);}
    }else if(op==='start'){
     check(r.stage==='lobby'&&actor===r.host,'請由房主開始組隊對戰。',403);const humans=humanTeamSlots(r);check(humans.length>=minimumTeamHumans(r)&&humans.every(s=>r.ready[s.id]),'請等真人玩家準備好後再開始，空位由電腦補上。',409);fillTeamComputers(r,true);captureTeamParticipants(r);if(teamDual(r.game))r.goals=teamGoalsForMode(r.computer?(r.practiceMode||'shuffle'):'shuffle',()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);else if(crypto.getRandomValues(new Uint8Array(1))[0]%2)r.goals={a:'Type II',b:'Type I'};prepareTeamRound(r,now);
    }else if(op==='draft'||op==='lock'){
     check(r.stage==='plan','本回合已揭曉，請確認結果。',409);if(r.locked[actor]){if(op==='draft')return reply(teamView(r,actor,now));throw new TeamError('你已鎖定，請等待揭曉。',409);}
     check(Number.isSafeInteger(b.sequence)&&b.sequence>0&&b.sequence<=1e9,'計畫版本無效。');if(op==='draft'&&b.sequence<=r.sequences[actor])return reply(teamView(r,actor,now));const action=normalizeTeamAction(b.action,actor,teamDual(r.game));teamActionInfo(r.game,actor,action);r.drafts[actor]=action;r.sequences[actor]=Math.max(b.sequence,r.sequences[actor]);if(op==='lock'){r.locked[actor]=true;if(TEAM_SLOTS.every(s=>r.locked[s.id]))resolveTeamRound(r);}
    }else if(op==='next'){
     check(r.stage==='revealed','目前不能進入下一回合。',409);r.ready[actor]=true;if(TEAM_SLOTS.every(s=>r.ready[s.id])){r.game.round++;prepareTeamRound(r,now);}
    }
    advanceTeamComputers(r,now);if(op!=='draft'&&r.matchId===expectedMatchId)r.receipts[actor]=b.requestId;
   }
   r.version++;if(await store.save(r,expected,expectedMatchId))return reply(op==='leave'?{left:true,code:r.code,stage:'left'}:op==='join'?{token:joinToken,view:teamView(r,actor,now)}:teamView(r,actor,now),op==='join'?201:200);
  }throw new TeamError('組隊正在同步，請再試一次。',409);
 }catch(e){return reply({error:e instanceof TeamError||e instanceof TeamQueueError||/組隊|能帶|點數|範圍|回合|積分|技能/.test(e.message)?e.message:'組隊暫時無法同步，請稍後再試。'},e instanceof TeamError||e instanceof TeamQueueError?e.status:400);}
}
export class D1TeamStore{
 constructor(db){this.db=db;this.ranking=new D1RankingStore(db);this.economy=new D1EconomyStore(db);this.matchmaker=new D1TeamMatchmaker(this);this.teamRanking=new D1TeamRanking(this);}
 async cleanup(now){await this.db.prepare('DELETE FROM duel_rooms WHERE expires_at<=?').bind(now).run();await this.db.prepare("DELETE FROM duel_team_queue_members WHERE expires_at<=? OR NOT EXISTS(SELECT 1 FROM duel_rooms r WHERE r.code=duel_team_queue_members.code AND json_extract(r.state,'$.matchId')=duel_team_queue_members.match_id AND json_extract(r.state,'$.stage') IN ('party','queue'))").bind(now).run();}
 async get(code){const r=await this.db.prepare('SELECT state,version FROM duel_rooms WHERE code=?').bind(code).first();return r?{...JSON.parse(r.state),version:r.version}:null;}
 queueStatements(r){
  const gate="EXISTS(SELECT 1 FROM duel_rooms WHERE code=? AND version=? AND json_extract(state,'$.matchId')=? AND json_extract(state,'$.saveTicket')=?)",args=[r.code,r.version,r.matchId,r.saveTicket];
  if(['party','queue'].includes(r.stage)){const members=teamMembers(r),ids=members.map(p=>p.account?'account:'+p.account:p.wallet||p.hash);return [this.db.prepare('DELETE FROM duel_team_queue_members WHERE code=? AND match_id=?'+(ids.length?' AND identity NOT IN ('+ids.map(()=>'?').join(',')+')':'')+' AND '+gate).bind(r.code,r.matchId,...ids,...args),...members.map((p,index)=>{const id=ids[index];return this.db.prepare('INSERT INTO duel_team_queue_members (identity,code,match_id,expires_at) SELECT ?,?,?,? WHERE '+gate+' AND NOT EXISTS(SELECT 1 FROM duel_team_queue_members WHERE identity=? AND code=? AND match_id=?)').bind(id,r.code,r.matchId,r.expiresAt,...args,id,r.code,r.matchId);})];}
  return [this.db.prepare('DELETE FROM duel_team_queue_members WHERE code=? AND match_id=? AND '+gate).bind(r.code,r.matchId,...args)];
 }
 async create(r){try{if(!r.matchmaking)return await claimRoomCode(this.db,r);r.saveTicket=crypto.randomUUID();const sql=roomCodeClaimStatement(this.db,r),result=await this.db.batch([sql,...roomCodeCleanupStatements(this.db,r),...this.queueStatements(r)]);return result[0].meta.changes===1;}catch(e){if(/duel_team_queue_members/i.test(String(e)))throw Error('你或隊友已有等待中的 2v2 配對，請先取消。');if(/UNIQUE|constraint/i.test(String(e)))return false;throw e;}}
 async save(r,version,expectedMatchId=r.matchId){
  captureFinishedRoster(r);let saved;if(r.stage==='finished'&&r.ranked)saved=await this.teamRanking.save(r,version);
  else{if(r.matchmaking)r.saveTicket=crypto.randomUUID();const sql=this.db.prepare("UPDATE duel_rooms SET state=?,version=?,expires_at=? WHERE code=? AND version=? AND json_extract(state,'$.matchId')=?").bind(JSON.stringify(r),r.version,r.expiresAt,r.code,version,expectedMatchId);try{const result=r.matchmaking?await this.db.batch([sql,...this.queueStatements(r)]):[await sql.run()];saved=result[0].meta.changes===1;}catch(e){if(/duel_team_queue_members/i.test(String(e)))throw Error('你或隊友已有等待中的 2v2 配對，請先取消。');throw e;}}
  if(saved&&r.stage==='finished')await this.rewards(r);return saved;
 }
 async rewards(r){
  if(!r.matchmaking||r.computer||r.stage!=='finished'||r.game.history.length!==r.game.roundLimit)return;const winner=r.game.history.at(-1)?.decision?.winner;if(!['a','b','draw'].includes(winner))return;
  for(const s of TEAM_SLOTS){const participant=r.matchParticipants?.find(p=>p.slot===s.id),accountId=participant?participant.accountId:r.players[s.id],wallet=participant?participant.wallet:r.wallets?.[s.id],outcome=winner==='draw'?'draw':winner===s.team?'win':'loss';await this.economy.award(wallet,r.matchId,coinReward('random',outcome));await this.ranking.achievements.recordMatch(accountId,r.matchId,r.ranked?'ranked':'human',outcome,r.game.roundLimit);}
 }
}
