import {advanceRoomClock,startRoomClock,afterRoomLock,roomClockView} from './duel-clock.mjs';
import { makeTerminalDuel, otherBand, duelActionInfo, normalizeDuelAction, resolveDuel, resolveTerminalDuel, terminalGoalsForMode, phoneRoundHistory, typeOnlyGoal, DUEL_MODES, setDuelLength, duelRoundLimit, duelStartingPoints } from './duel-core.mjs';
import {D1RankingStore,requestPlayerId,ratingForSeat,RankingError,publicProfile} from './ranking.mjs';
import {D1EconomyStore,walletIdentity} from './economy.mjs';
import {D1RankedMatchmaker,rankedSearchRange} from './ranked-matchmaking.mjs';
import {ROOM_CODE_PATTERN,normalizeRoomCode} from './room-codes.mjs';
import {validDuelCharacter,duelSkillView,draftDuelSkills,selectDuelSkill} from './duel-core.mjs';
import {BATTLE_GREETINGS,GREETING_COOLDOWN} from './social.mjs';
import {claimRoomCode} from './room-lifecycle.mjs';

const TTL=2*60*60*1000;
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
class RoomError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join('');
const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const ownField=(r,actor)=>actor==='player'?r.game.controlled:otherBand(r.game.controlled);
const opposite=actor=>actor==='player'?'cpu':'player';
const starter=r=>r.firstStarter;
const acting=r=>r.pending[starter(r)]?opposite(starter(r)):starter(r);
const roomHost=r=>r.host==='cpu'?'cpu':'player';
const roomHostName=r=>r.names?.[roomHost(r)]||r.profiles?.[roomHost(r)]?.displayName||null;
const friendRoom=r=>!r.matchmaking&&(!r.matchKind||r.matchKind==='friend');
const canRematch=r=>friendRoom(r)&&typeof r.matchId==='string'&&r.matchId.length>0&&r.stage==='finished'&&!!r.seats.player&&!!r.seats.cpu;
function friendRematchSettings(r){return {rounds:r.rematchSettings?.rounds??duelRoundLimit(r.game),abilityMode:r.rematchSettings?.abilityMode??r.game.abilityMode??'classic',timed:r.rematchSettings?.timed??(r.timed!==false),version:r.rematchSettings?.version??0};}
function checkMatch(r,body){if((r.requireMatchId||body.matchId!==undefined)&&body.matchId!==r.matchId)throw new RoomError('對局已更新，請重新同步後再操作。',409);}
function resetFriendMatch(r,now,stage='role'){
  const previousMatchId=r.matchId,completedReceipts={...r.rematchRequests},settings=friendRematchSettings(r);
  const game=setDuelLength(makeTerminalDuel(r.game.controlled||'ec'),settings.rounds);
  Object.assign(game,{started:true,active:true,stage:'plan'});draftDuelSkills(game,['player','cpu'],settings.abilityMode);
  r.game=game;r.timed=settings.timed;delete r.rematchSettings;delete r.rematchSettingsReceipt;r.matchId=crypto.randomUUID();r.requireMatchId=true;r.expiresAt=now+TTL;r.flow=2;r.stage=stage;r.mode='shuffle';r.roleChoice=null;r.firstStarter=null;
  r.pending={player:null,cpu:null};r.ready={player:false,cpu:false};r.receipts={player:null,cpu:null};r.clock=null;r.drafts=null;r.draftSequences={player:0,cpu:0};r.draftRound=null;r.autoLocks=[];r.greetings=[];
  r.rematchReady={player:false,cpu:false};r.rematchRequests={player:null,cpu:null};r.completedRematch={matchId:previousMatchId,receipts:completedReceipts};r.ranked=false;r.rankingReason='casual';delete r.rating;
}
async function repeatedDeparture(r,request,body,now){
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const hash=await digest(token),receipt=r.departureReceipts?.find(x=>x.hash===hash&&x.requestId===body.requestId&&x.sourceMatchId===body.matchId&&x.expiresAt>now);
  return receipt?{left:true,code:r.code,stage:receipt.stage}:null;
}
function leaveFriendRoom(r,actor,body,now){
  const sourceMatchId=r.matchId,hash=r.seats[actor],name=r.names?.[actor]||r.profiles?.[actor]?.displayName||null,wasHost=roomHost(r)===actor,wasClosed=r.stage==='closed';
  for(const field of ['seats','players','names','profiles','wallets','skins'])if(r[field])r[field][actor]=null;
  const remaining=['player','cpu'].filter(slot=>r.seats[slot]);
  if(remaining.length&&!wasClosed){if(wasHost)r.host=remaining[0];resetFriendMatch(r,now,'lobby');delete r.completedRematch;}
  else{r.stage='closed';r.pending={player:null,cpu:null};r.ready={player:false,cpu:false};r.clock=null;r.rematchReady={player:false,cpu:false};}
  r.lastDeparture={at:now,name,slot:actor,hostTransferred:wasHost&&remaining.length>0&&!wasClosed,hostName:remaining.length&&!wasClosed?roomHostName(r):null};
  r.departureReceipts=[...(r.departureReceipts||[]).filter(x=>x.expiresAt>now),{hash,requestId:body.requestId,sourceMatchId,expiresAt:now+120000,stage:r.stage}].slice(-16);
}
export function roomView(r,actor,now=Date.now()){
  const other=actor==='player'?'cpu':'player',mine=actor==='player',host=roomHost(r)===actor;
  const playing=!r.flow||['plan','revealed','finished'].includes(r.stage);
  return {code:r.code,version:r.version,matchId:r.matchId,canRematch:canRematch(r),rematchSettings:friendRematchSettings(r),canEditRematchSettings:canRematch(r)&&host,host,hostName:roomHostName(r),lastDeparture:r.lastDeparture||null,rematchReady:!!r.rematchReady?.[actor],rematchHumanCount:2,yourRematchReady:!!r.rematchReady?.[actor],opponentRematchReady:!!r.rematchReady?.[other],rematchReadyCount:Object.values(r.rematchReady||{}).filter(Boolean).length,rematchPlayerCount:2,timed:r.timed!==false,expiresAt:r.expiresAt,joined:!!r.seats.player&&!!r.seats.cpu,flow:r.flow||1,matchmaking:!!r.matchmaking,matchKind:r.matchKind||'legacy',queuedAt:r.queuedAt||null,searchRange:r.matchKind==='ranked'&&r.stage==='lobby'?rankedSearchRange(now-r.queuedAt):null,waitingPlayers:r.matchmaking&&r.stage==='lobby'?1:0,mode:r.mode||'shuffle',roundLimit:duelRoundLimit(r.game),startingPoints:duelStartingPoints(r.game),clock:roomClockView(r,actor,now),yourDraft:r.stage==='plan'?r.drafts?.[actor]||null:null,yourDraftSequence:r.draftSequences?.[actor]||0,autoLocked:!!r.autoLocks?.some(x=>x.round===r.game.round&&x.actor===actor),skills:duelSkillView(r.game,actor),greetings:(r.greetings||[]).map(m=>({id:m.id,phrase:m.phrase,at:m.at,sender:m.actor===actor?'you':'opponent'})),canChooseMode:host,firstStarter:r.firstStarter? (r.firstStarter===actor?'you':'opponent'):null,roundStarter:r.firstStarter?(starter(r)===actor?'you':'opponent'):null,yourTurn:r.stage==='plan'&&(r.flow!==2||acting(r)===actor),round:r.game.round,stage:r.stage,controlled:r.roleChoice===null&&!playing?null:ownField(r,actor),goal:playing?{...r.game.goals[actor]}:null,...(r.stage==='finished'?{opponentGoal:{...r.game.goals[other]}}:{}),ranked:!!r.ranked,rankingReason:r.rankingReason||'sign-in',yourProfile:r.profiles?.[actor]||null,opponentProfile:r.profiles?.[other]||null,carrierSkins:{e:r.skins?.[r.game.controlled==='ec'?'player':'cpu']?.electron||'classic',h:r.skins?.[r.game.controlled==='ev'?'player':'cpu']?.hole||'classic'},yourName:r.names?.[actor]||null,opponentName:r.names?.[other]||null,ratingResult:r.stage==='finished'?ratingForSeat(r.rating,actor):null,board:{...r.game.board},yourBudget:mine?r.game.playerBudget:r.game.cpuBudget,opponentBudget:mine?r.game.cpuBudget:r.game.playerBudget,yourLocked:!!r.pending[actor],opponentLocked:r.pending[other]!=null,yourReady:r.ready[actor],opponentReady:r.ready[other],yourLockedAction:r.pending[actor]?{...r.pending[actor]}:null,history:phoneRoundHistory(r.game,actor,r.firstStarter||'player')};
}
async function authenticate(r,request){
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!token||!/^[a-f0-9]{64}$/.test(token))throw new RoomError('請用自己的手機建立或加入房間。',401);
  const hash=await digest(token),actor=Object.keys(r.seats).find(k=>r.seats[k]===hash);
  if(!actor)throw new RoomError('這支手機沒有此房間的操作權。',403);return actor;
}
async function readBody(request,allowed){
  if(!request.headers.get('Content-Type')?.includes('application/json'))throw new RoomError('請使用有效的對戰操作。',415);
  const raw=await request.text();if(raw.length>2048)throw new RoomError('資料過長。',413);
  let body;try{body=JSON.parse(raw);}catch{throw new RoomError('操作內容無效。');}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))throw new RoomError('操作參數無效。');return body;
}
async function load(store,roomCode,now){
  for(let attempt=0;attempt<8;attempt++){const r=await store.get(roomCode);if(!r)throw new RoomError('找不到房間，請確認 6 碼代號。',404);
  if(r.expiresAt<=now)throw new RoomError('這個房間已到期，請開新房間。',410);
  if(r.matchKind==='team')throw new RoomError('這是 2v2 房間，請使用組隊入口。',409);
  if(r.stage==='redirect')return r;
  // Preserve assigned Types and the opening coin when updating existing phone rooms.
  if(r.flow===2){r.game.winRule='terminal';r.game.firstActor=r.firstStarter||'player';for(const actor of ['player','cpu'])r.game.goals[actor]=typeOnlyGoal(r.game.goals[actor]);}
  if(advanceRoomClock(r,now)){const expected=r.version;r.version++;if(await store.save(r,expected))return r;continue;}return r;}throw new RoomError('雙方正在同步，請再試一次。',409);
}
async function mutate(store,roomCode,now,operation){
  for(let attempt=0;attempt<8;attempt++){
    const r=await load(store,roomCode,now),expected=r.version,previousMatchId=r.matchId,actor=await operation(r);
    if(actor.unchanged)return actor.result;
    r.version=expected+1;if(await store.save(r,expected,previousMatchId))return actor.result(r);
  }
  throw new RoomError('雙方正在同步，請再試一次。',409);
}
async function createRoomRecord(store,now,matchmaking=false,profile=null,wallet=null,matchKind='friend',customCode=null,rounds=5,abilityMode='classic',timed=true){
  for(let tries=0;tries<(customCode?1:6);tries++){
    const token=secret(),roomCode=customCode||code(),game=setDuelLength(makeTerminalDuel(crypto.getRandomValues(new Uint8Array(1))[0]%2?'ec':'ev'),rounds);
    Object.assign(game,{started:true,active:true,stage:'plan'});draftDuelSkills(game,['player','cpu'],abilityMode);
    const r={code:roomCode,matchId:crypto.randomUUID(),players:{player:profile?.account_id||null,cpu:null},names:{player:profile?.display_name||null,cpu:null},profiles:{player:publicProfile(profile),cpu:null},ranked:false,rankingReason:'waiting',version:0,createdAt:now,expiresAt:now+TTL,flow:2,matchmaking,mode:'shuffle',roleChoice:null,firstStarter:null,seats:{player:await digest(token),cpu:null},stage:'lobby',game,pending:{player:null,cpu:null},ready:{player:false,cpu:false},receipts:{player:null,cpu:null}};
    r.host='player';r.timed=timed;r.wallets={player:wallet,cpu:null};r.skins={player:wallet?await store.economy?.view(wallet):null,cpu:null};
    r.matchKind=matchKind;r.queuedAt=matchmaking?now:null;
    if(await store.create(r))return {r,token};
  }
  throw new RoomError(customCode?'這個房號已被使用，請換一組或隨機產生。':'暫時無法建立房間，請再試一次。',customCode?409:503);
}
async function joinSeat(store,roomCode,hash,now,profile=null,wallet=null,expectedMatchId=null,randomOnly=false,abilityMode='classic'){return mutate(store,roomCode,now,async r=>{
  if(expectedMatchId&&r.matchId!==expectedMatchId)throw new RoomError('這場配對已更新，請重新配對。',409);
  if(randomOnly&&(!r.matchmaking||r.matchKind!=='random'||(r.game.abilityMode||'classic')!==abilityMode))throw new RoomError('這個房間不在目前的隨機配對中。',409);
  if(r.matchKind==='ranked')throw new RoomError('牌位對局請使用牌位配對，不能用房號加入。',403);
  const actor=friendRoom(r)?['player','cpu'].find(slot=>!r.seats[slot]):'cpu';
  if(r.stage!=='lobby'||!actor||r.seats[actor])throw new RoomError('房間已有人加入或已結束，請建立新的房間。',409);
  r.seats[actor]=hash;r.players??={player:null,cpu:null};r.names??={player:null,cpu:null};r.players[actor]=profile?.account_id||null;r.names[actor]=profile?.display_name||null;
  r.profiles??={player:null,cpu:null};r.profiles[actor]=publicProfile(profile);
  r.wallets??={player:null,cpu:null};r.wallets[actor]=wallet;
  r.skins??={player:null,cpu:null};r.skins[actor]=wallet?await store.economy?.view(wallet):null;
  r.ranked=!!(!r.matchKind&&r.matchId&&r.players.player&&r.players.cpu&&r.players.player!==r.players.cpu);r.rankingReason=r.ranked?'rated':r.players.player&&r.players.player===r.players.cpu?'same-account':r.matchKind?'casual':'sign-in';
  r.stage=r.flow===2?'role':'plan';return {result:x=>roomView(x,actor)};
});}
export async function handleRoomRequest(request,store,now=Date.now()){
  try{
    const url=new URL(request.url),path=url.pathname.replace(/^\/api\/rooms\/?/,'').split('/').filter(Boolean),roomCode=path[0],operation=path[1];
    if(request.method==='POST'){
      const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)throw new RoomError('請從對戰網站操作。',403);
    }
    if(roomCode==='queue'&&path.length===1&&request.method==='GET')return json({waitingPlayers:url.searchParams.get('kind')==='ranked'?await store.rankedMatchmaker?.count(now)||0:await store.waitingCount(now,url.searchParams.get('abilityMode')||'classic')});
    if(roomCode==='ranked'&&path.length===1&&request.method==='POST'){
      await readBody(request,[]);const id=requestPlayerId(request);if(!id)throw new RoomError('請先登入，才能參加牌位配對。',401);await store.cleanup(now);
      const profile=await store.ranking.ensure(id,now),wallet=await walletIdentity(request),{r,token}=await createRoomRecord(store,now,true,profile,wallet,'ranked');
      try{await store.rankedMatchmaker.enqueue(r,profile,now);}catch(e){r.stage='closed';r.version++;await store.save(r,0);throw new RoomError(/已有/.test(e.message)?e.message:'牌位配對正在同步，請再試一次。',409);}
      await store.rankedMatchmaker.pair(r,now);let current=await load(store,r.code,now);if(current.stage==='redirect'){const expectedMatchId=current.redirectMatchId;current=await load(store,current.redirectCode,now);if(expectedMatchId&&current.matchId!==expectedMatchId)throw new RoomError('這場配對已結束，請重新配對。',410);}return json({token,view:roomView(current,await authenticate(current,new Request(url,{headers:{Authorization:'Bearer '+token}})))},201);
    }
    if((!roomCode||roomCode==='match'&&path.length===1)&&request.method==='POST'){
      const body=await readBody(request,roomCode==='match'?['abilityMode']:['code','rounds','abilityMode','timed']),customCode=body.code===undefined?null:normalizeRoomCode(body.code);if(body.timed!==undefined&&typeof body.timed!=='boolean')throw new RoomError('倒數設定無效。');if(customCode!==null&&!ROOM_CODE_PATTERN.test(customCode))throw new RoomError('房間代號需要 6 碼英文或數字。');await store.cleanup(now);
      const profile=await store.ranking?.ensure(requestPlayerId(request),now),wallet=store.economy?await walletIdentity(request):null;if(customCode)await store.ranking?.achievements.recordRoomCode(requestPlayerId(request),customCode,now);const {r,token}=await createRoomRecord(store,now,roomCode==='match',profile,wallet,roomCode==='match'?'random':'friend',customCode,body.rounds??5,body.abilityMode??'classic',body.timed!==false);
      if(roomCode!=='match')return json({token,view:roomView(r,'player')},201);
      for(let tries=0;tries<8;tries++){
        const candidate=await store.claimQueue(r.code,r.expiresAt,now,r.game.abilityMode,r.matchId);
        if(!candidate)continue;
        const waiting=typeof candidate==='string'?candidate:candidate.code;
        const expectedMatchId=typeof candidate==='string'?(await store.get(waiting))?.matchId:candidate.matchId;
        if(!waiting||!expectedMatchId)continue;
        if(waiting===r.code){if(expectedMatchId!==r.matchId)continue;return json({token,view:roomView(r,'player')},201);}
        try{
          const view=await joinSeat(store,waiting,r.seats.player,now,profile,wallet,expectedMatchId,true,r.game.abilityMode||'classic');await store.releaseQueue(waiting,view.matchId);
          r.stage='closed';r.version++;await store.save(r,0);return json({token,view});
        }catch(error){if(!(error instanceof RoomError)||![404,409,410].includes(error.status))throw error;await store.releaseQueue(waiting,expectedMatchId);}
      }
      throw new RoomError('配對正在同步，請稍後再試。',503);
    }
    if(!roomCode||!ROOM_CODE_PATTERN.test(roomCode)||path.length>2)throw new RoomError('房間代號需要 6 碼英文或數字。');
    if(request.method==='GET'&&!operation){let r=await load(store,roomCode,now);await authenticate(r,request);if(r.matchKind==='ranked'&&r.stage==='lobby'){await store.rankedMatchmaker.pair(r,now);r=await load(store,roomCode,now);}if(r.stage==='redirect'){const expectedMatchId=r.redirectMatchId;r=await load(store,r.redirectCode,now);if(expectedMatchId&&r.matchId!==expectedMatchId)throw new RoomError('這場配對已結束，請重新配對。',410);}const actor=await authenticate(r,request),view=roomView(r,actor,now);view.coinReward=await store.economy?.roomReward(r,actor)||null;return json(view);}
    if(request.method!=='POST')throw new RoomError('這個操作不適用。',405);
    if(operation==='join'){
      await readBody(request,[]);const token=secret(),hash=await digest(token);
      await store.ranking?.achievements.recordRoomCode(requestPlayerId(request),roomCode,now);
      const profile=await store.ranking?.ensure(requestPlayerId(request),now),wallet=store.economy?await walletIdentity(request):null;const view=await joinSeat(store,roomCode,hash,now,profile,wallet);await store.releaseQueue(roomCode,view.matchId);return json({token,view});
    }
    const initial=await load(store,roomCode,now);if(initial.stage==='redirect'){await authenticate(initial,request);throw new RoomError('已配對成功，請重新同步後再操作。',409);}
    if(operation==='draft'){
      const body=await readBody(request,['round','sequence','action','matchId']);if(!Number.isInteger(body.round)||!Number.isSafeInteger(body.sequence)||body.sequence<1||body.sequence>1e9)throw new RoomError('計畫版本無效。');
      return json(await mutate(store,roomCode,now,async r=>{const actor=await authenticate(r,request);checkMatch(r,body);if(r.stage!=='plan'||r.game.round!==body.round)throw new RoomError('回合已更新，請確認最新結果。',409);if(r.pending[actor]||body.sequence<=(r.draftSequences?.[actor]||0))return {unchanged:true,result:roomView(r,actor,now)};if(acting(r)!==actor)throw new RoomError('請等到你的操作時間。',409);const action=normalizeDuelAction(body.action);duelActionInfo(r.game,actor,action);r.drafts[actor]=action;r.draftSequences[actor]=body.sequence;return {result:x=>roomView(x,actor,now)};}));
    }
    if(operation==='greeting'){
      const body=await readBody(request,['phrase','requestId','matchId']);if(!BATTLE_GREETINGS.some(p=>p.id===body.phrase)||typeof body.requestId!=='string'||!/^[A-Za-z0-9-]{8,64}$/.test(body.requestId))throw new RoomError('問候內容無效。');
      return json(await mutate(store,roomCode,now,async r=>{
        const actor=await authenticate(r,request);checkMatch(r,body);if(!r.seats.cpu||!['role','mode','plan','revealed','finished'].includes(r.stage))throw new RoomError('對手加入後才能發送問候。',409);
        r.greetings??=[];if(r.greetings.some(m=>m.id===body.requestId&&m.actor===actor))return {unchanged:true,result:roomView(r,actor,now)};
        const last=r.greetings.findLast(m=>m.actor===actor);if(last&&now-last.at<GREETING_COOLDOWN)throw new RoomError('問候已送出，請稍等 4 秒。',429);
        r.greetings.push({id:body.requestId,phrase:body.phrase,at:now,actor});r.greetings=r.greetings.slice(-16);return {result:x=>roomView(x,actor,now)};
      }));
    }
    if(!['lock','ready','leave','close','mode','role','rematch','rematch-settings'].includes(operation))throw new RoomError('找不到這個對戰操作。',404);
    const body=await readBody(request,operation==='rematch-settings'?['round','requestId','matchId','settingsVersion','rounds','abilityMode','timed']:operation==='rematch'?['round','requestId','matchId','settingsVersion']:operation==='lock'?['round','requestId','action','matchId']:operation==='mode'?['round','requestId','mode','rounds','matchId']:operation==='role'?['round','requestId','controlled','character','matchId']:['round','requestId','matchId']);
    if(!Number.isInteger(body.round)||body.round<1||body.round>12||typeof body.requestId!=='string'||!/^[A-Za-z0-9-]{8,64}$/.test(body.requestId))throw new RoomError('回合或操作識別無效。');
    const view=await mutate(store,roomCode,now,async r=>{
      if(operation==='leave'){const repeated=await repeatedDeparture(r,request,body,now);if(repeated)return {unchanged:true,result:repeated};}
      const actor=await authenticate(r,request);
      if(operation==='rematch'&&body.matchId!==r.matchId&&r.completedRematch&&r.completedRematch.matchId===body.matchId&&r.completedRematch.receipts?.[actor]===body.requestId)return {unchanged:true,result:roomView(r,actor,now)};
      checkMatch(r,body);
      if(operation==='rematch-settings'){
        if(!canRematch(r)||actor!==roomHost(r))throw new RoomError('只有房主能在好友房結束後調整再戰設定。',403);
        if(typeof body.matchId!=='string'||body.round!==r.game.round)throw new RoomError('對局已更新，請重新同步後再操作。',409);
        if(!Number.isSafeInteger(body.settingsVersion)||body.settingsVersion<0||body.rounds!==undefined&&![5,12].includes(body.rounds)||body.abilityMode!==undefined&&!['classic','skills'].includes(body.abilityMode)||body.timed!==undefined&&typeof body.timed!=='boolean')throw new RoomError('再戰設定無效。');
        const current=friendRematchSettings(r),next={rounds:body.rounds??current.rounds,abilityMode:body.abilityMode??current.abilityMode,timed:body.timed??current.timed};
        if(r.rematchSettingsReceipt?.matchId===body.matchId&&r.rematchSettingsReceipt.requestId===body.requestId)return {unchanged:true,result:roomView(r,actor,now)};
        if(body.settingsVersion!==current.version)throw new RoomError('再戰設定已更新，請確認最新設定。',409);
        if(next.rounds===current.rounds&&next.abilityMode===current.abilityMode&&next.timed===current.timed)return {unchanged:true,result:roomView(r,actor,now)};
        r.rematchSettings={...next,version:current.version+1};r.rematchSettingsReceipt={matchId:r.matchId,requestId:body.requestId};r.rematchReady={player:false,cpu:false};r.rematchRequests={player:null,cpu:null};r.receipts={player:null,cpu:null};
        return {result:x=>roomView(x,actor,now)};
      }
      if(operation==='rematch'){
        if(typeof body.matchId!=='string'||!canRematch(r))throw new RoomError('請在好友房對戰結束後邀請原房再戰。',409);
        if(body.round!==r.game.round)throw new RoomError('回合已更新，請確認最新結果。',409);
        const settingsVersion=friendRematchSettings(r).version;if((settingsVersion>0||body.settingsVersion!==undefined)&&body.settingsVersion!==settingsVersion)throw new RoomError('再戰設定已更新，請確認最新設定後再同意。',409);
        if(r.rematchReady?.[actor])return {unchanged:true,result:roomView(r,actor,now)};
        r.rematchReady??={player:false,cpu:false};r.rematchRequests??={player:null,cpu:null};r.rematchReady[actor]=true;r.rematchRequests[actor]=body.requestId;
        if(r.rematchReady.player&&r.rematchReady.cpu)resetFriendMatch(r,now);
        return {result:x=>roomView(x,actor,now)};
      }
      if(r.receipts[actor]===body.requestId)return {unchanged:true,result:roomView(r,actor,now)};
      if(body.round!==r.game.round)throw new RoomError('回合已更新，請確認最新結果。',409);
      if(operation==='leave'&&friendRoom(r)){leaveFriendRoom(r,actor,body,now);return {result:x=>({...roomView(x,actor,now),left:true})};}
      if(operation==='leave'||operation==='close'){
        if(operation==='close'&&(!friendRoom(r)||actor!==roomHost(r)))throw new RoomError('只有房主可以關閉好友房間。',403);
        r.stage='closed';r.pending={player:null,cpu:null};r.clock=null;
      }
      else if(operation==='role'){
        if(r.stage!=='role'||r.ready[actor])throw new RoomError('角色已確認，請等另一位玩家。',409);
        if(!['ec','ev'].includes(body.controlled))throw new RoomError('請選擇導帶或價帶。');
        selectDuelSkill(r.game,actor,body.character??r.game.skillOffers?.[actor]?.[0]??null);
        if(r.roleChoice===null){r.game.controlled=actor==='player'?body.controlled:otherBand(body.controlled);r.roleChoice=actor;}
        else if(ownField(r,actor)!==body.controlled)throw new RoomError('對方已選擇這條能帶，請點另一半確認角色。',409);
        r.ready[actor]=true;
        if(r.ready.player&&r.ready.cpu){r.stage='mode';r.ready={player:false,cpu:false};}
      }
      else if(operation==='mode'){
        if(r.stage!=='mode'||actor!==roomHost(r))throw new RoomError('請由房主在模式畫面選擇。',409);
        if(typeof body.mode!=='string'||!Object.hasOwn(DUEL_MODES,body.mode))throw new RoomError('對戰模式無效。');
        if(body.mode!=='shuffle')throw new RoomError('指定 Type 組合僅限練習模式；正式對戰使用 Shuffle。');r.mode=body.mode;r.game=setDuelLength(r.game,body.rounds??duelRoundLimit(r.game));r.game.mission=body.mode;r.game.goals=terminalGoalsForMode(body.mode);if(!r.firstStarter)r.firstStarter=crypto.getRandomValues(new Uint8Array(1))[0]%2?'player':'cpu';r.game.firstActor=r.firstStarter;r.game.winRule='terminal';r.stage='plan';startRoomClock(r,now,2500);
      }
      else if(operation==='lock'){
        if(r.stage!=='plan')throw new RoomError('請等待雙方加入或進入下一回合。',409);
        if(r.pending[actor])throw new RoomError('你已鎖定，請等待對方。',409);
        if(r.flow===2&&acting(r)!==actor)throw new RoomError('先讓本回合先手鎖定，才輪到你操作。',409);
        if(r.flow===2&&r.game.round===1)r.game.countFirstRound=true;
        const action=normalizeDuelAction(body.action);duelActionInfo(r.game,actor,action);r.pending[actor]=action;
        if(r.flow===2)afterRoomLock(r,now);else if(r.pending.player&&r.pending.cpu){r.game=resolveDuel(r.game,r.pending.player,r.pending.cpu);r.stage=r.game.stage;r.pending={player:null,cpu:null};r.ready={player:false,cpu:false};}
      }else{
        if(!['role','revealed'].includes(r.stage))throw new RoomError('目前不能進入下一回合。',409);
        if(r.stage==='role'&&r.roleChoice===null)throw new RoomError('請先點選導帶或價帶。',409);
        r.ready[actor]=true;
        if(r.ready.player&&r.ready.cpu){if(r.stage==='role')r.stage='mode';else{r.game.round++;r.game.stage='plan';r.stage='plan';startRoomClock(r,now);}r.ready={player:false,cpu:false};}
      }
      r.receipts[actor]=body.requestId;return {result:x=>({...roomView(x,actor,now),...(operation==='leave'?{left:true}:{})})};
    });if((operation==='leave'||operation==='close')&&view.matchId)await store.releaseQueue(roomCode,view.matchId);if(view.stage==='finished'&&store.economy){const r=await load(store,roomCode,now),actor=await authenticate(r,request);view.coinReward=await store.economy.roomReward(r,actor);}return json(view);
  }catch(error){return json({error:error instanceof RoomError||error instanceof RankingError||error?.message&&/能帶|動作|點數|改動|範圍|技能|分流|蓄能/.test(error.message)?error.message:'房間同步暫時失敗，請稍後再試。'},error instanceof RoomError||error instanceof RankingError?error.status:400);}
}
export class D1RoomStore {
  constructor(db){this.db=db;this.ranking=new D1RankingStore(db);this.economy=new D1EconomyStore(db);this.rankedMatchmaker=new D1RankedMatchmaker(this);}
  async get(code){const row=await this.db.prepare('SELECT state,version FROM duel_rooms WHERE code = ?').bind(code).first();if(!row)return null;return {...JSON.parse(row.state),version:row.version};}
  async create(r){return claimRoomCode(this.db,r);}
  async save(r,expected,previousMatchId=r.matchId){let saved;if(r.stage==='finished'&&r.ranked&&r.matchId)saved=await this.ranking.saveFinishedRoom(r,expected);else{const result=await this.db.prepare("UPDATE duel_rooms SET state = ?,version = ?,expires_at = ? WHERE code = ? AND version = ? AND json_extract(state,'$.matchId') IS ?").bind(JSON.stringify(r),r.version,r.expiresAt,r.code,expected,previousMatchId??null).run();saved=result.meta.changes===1;}if(saved&&r.stage==='finished')await this.ranking.achievements.recordRoom(r);return saved;}
  async claimQueue(code,expiresAt,now,abilityMode='classic',expectedMatchId=null){
    const slot=abilityMode==='skills'?2:1;
    await this.db.prepare("DELETE FROM duel_match_queue WHERE expires_at<=? OR NOT EXISTS(SELECT 1 FROM duel_rooms r WHERE r.code=duel_match_queue.code AND r.expires_at>? AND json_extract(r.state,'$.matchmaking')=1 AND json_extract(r.state,'$.matchKind')='random' AND json_extract(r.state,'$.stage')='lobby' AND COALESCE(json_extract(r.state,'$.game.abilityMode'),'classic')=CASE WHEN duel_match_queue.id=2 THEN 'skills' ELSE 'classic' END)").bind(now,now).run();
    await this.db.prepare("INSERT INTO duel_match_queue (id,code,expires_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM duel_rooms WHERE code=? AND (? IS NULL OR json_extract(state,'$.matchId')=?) AND json_extract(state,'$.matchmaking')=1 AND json_extract(state,'$.matchKind')='random' AND json_extract(state,'$.stage')='lobby') ON CONFLICT(id) DO NOTHING").bind(slot,code,expiresAt,code,expectedMatchId,expectedMatchId).run();
    const row=await this.db.prepare("SELECT q.code,json_extract(r.state,'$.matchId') AS matchId FROM duel_match_queue q JOIN duel_rooms r ON r.code=q.code WHERE q.id=? AND q.expires_at>? AND r.expires_at>? AND json_extract(r.state,'$.matchmaking')=1 AND json_extract(r.state,'$.matchKind')='random' AND json_extract(r.state,'$.stage')='lobby'").bind(slot,now,now).first();return row||null;
  }
  async releaseQueue(code,matchId=null){const gate=matchId?" AND EXISTS(SELECT 1 FROM duel_rooms WHERE code=? AND json_extract(state,'$.matchId')=?)":'',args=matchId?[code,code,matchId]:[code];await this.db.batch([this.db.prepare('DELETE FROM duel_match_queue WHERE code = ?'+gate).bind(...args),this.db.prepare('DELETE FROM duel_ranked_queue WHERE code = ?'+gate).bind(...args)]);}
  async waitingCount(now,abilityMode='classic'){const row=await this.db.prepare('SELECT COUNT(*) AS count FROM duel_match_queue q JOIN duel_rooms r ON r.code=q.code WHERE q.expires_at > ? AND r.expires_at > ? AND q.id = ? AND json_extract(r.state,\'$.stage\')=\'lobby\'').bind(now,now,abilityMode==='skills'?2:1).first();return Number(row?.count||0);}
  async cleanup(now){await this.db.prepare('DELETE FROM duel_rooms WHERE expires_at <= ?').bind(now).run();await this.db.prepare('DELETE FROM duel_match_queue WHERE expires_at <= ?').bind(now).run();await this.rankedMatchmaker.cleanup(now);}
}

