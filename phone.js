'use strict';
const $=id=>document.getElementById(id),pct=x=>(x*100).toFixed(1)+'%',signed=x=>(x<0?'−':x>0?'+':'')+Math.abs(x).toFixed(2);
const ui={character:null,kind:null,credentials:null,data:null,queue:null,plan:{kind:'own',direction:1,amount:3},selectedRounds:5,introSeen:new Set(),roleChoicePending:null,busy:false,error:'',poll:null,intent:null,coinSeen:new Set(),coinAnimation:null,queueCount:null,locking:false,cpuMatch:null,cpuTimer:null,replayStep:3,replayKey:null,replayPlaying:false,replayFrame:null,replayTask:null,replayGeneration:0,autoReplayKey:null};
function readPhone(){return {kind:ui.kind,data:ui.data?structuredClone(ui.data):null,yourDraft:{...ui.plan},selectedRounds:ui.selectedRounds,error:ui.error,language:siteLanguage,replay:{step:ui.replayStep,playing:ui.replayPlaying,board:ui.replayFrame?.board||null},effects:{soundEnabled:duelSound.enabled,audioState:duelSound.context?.state||'awaiting-gesture',played:{...duelSound.played},draftAnimating:!!motion.draft?.task,verdictAcknowledged:motion.verdictAcknowledged}};}
function saveSession(){try{sessionStorage.setItem('band-phone-session',JSON.stringify(ui.credentials));sessionStorage.setItem('band-phone-coin-seen',JSON.stringify([...ui.coinSeen]));sessionStorage.setItem('band-phone-intro-seen',JSON.stringify([...ui.introSeen].slice(-30)));}catch{}}
function phoneMatchKey(d){return ui.kind==='cpu'?d.code:d.matchId||d.code;}
function introKey(d){return ui.kind==='cpu'?'CPU:'+ui.cpuCoinId:phoneMatchKey(d);}
function resetRematchPresentation(){
  resetDraftSync();resetTeamUi();resetMotion();stopReplay();ui.intent=null;ui.character=null;ui.roleChoicePending=null;ui.coinAnimation=null;ui.replayKey=null;ui.autoReplayKey=null;ui.replayStep=3;
  for(const id of ['skillDraft','resultInfo'])if($(id).open)$(id).close();
}
function renderRematchControls(d,team=false){
  const prefix=team?'team':'room',button=$(prefix+'Rematch'),status=$(prefix+'RematchStatus');
  const replaying=team?teamUi.replaying:ui.replayPlaying,visible=d.stage==='finished'&&!!d.canRematch&&motion.verdictAcknowledged&&!replaying;
  if(!team){$('roomCloseResult').hidden=!visible||!canClosePrivateRoom(d);$('roomCloseResult').disabled=ui.busy;$('roomCloseResult').textContent=tx('關閉房間','Close room');}
  button.hidden=!visible;status.hidden=!visible;renderRematchSettings(d,team,visible);if(!visible)return;
  const ready=d.rematchReadyCount||0,total=d.rematchHumanCount||2;
  button.disabled=ui.busy||!!d.rematchReady;button.textContent=d.rematchReady?tx('已準備再戰','Ready to rematch')+' · '+ready+' / '+total:tx('原房再戰','Rematch in this room');
  status.textContent=d.rematchReady?tx('等待其他玩家同意再戰 · 房號 '+d.code,'Waiting for the other players · Room '+d.code):tx('所有真人同意後，在房號 '+d.code+' 開始新的一場。','When all human players agree, start a new match in room '+d.code+'.');
}
function nextRoomSettings(d){const settings=d.rematchSettings||{};return {rounds:settings.rounds??d.roundLimit??5,abilityMode:settings.abilityMode??(d.skills?.enabled?'skills':'classic'),timed:settings.timed??d.timed!==false,version:settings.version||0};}
function renderRematchSettings(d,team,visible){
  const prefix=team?'team':'room',panel=$(prefix+'RematchSettings');panel.hidden=!visible;if(!visible)return;
  const settings=nextRoomSettings(d),editable=!!d.canEditRematchSettings,disabled=ui.busy||!editable;
  $(prefix+'RematchSettingsTitle').textContent=tx('下一場設定','Next match settings');$(prefix+'RematchSettingsOwner').textContent=editable?tx('由你調整','You are the host'):tx('由房主調整','Set by the host');
  $(prefix+'RematchSettingsSummary').textContent=settings.rounds+tx(' 回合 · ',' rounds · ')+(settings.rounds===12?30:12)+tx(' 點／人',' points each')+' · '+(settings.abilityMode==='skills'?tx('技能模式','Abilities'):tx('經典模式','Classic'))+' · '+(settings.timed?tx('30 秒倒數','30-second timer'):tx('無倒數','No timer'));
  $(prefix+'RematchRoundsLabel').textContent=tx('回合數／每人點數','Rounds / points each');$(prefix+'RematchAbilityLabel').textContent=tx('對戰規則','Match rules');$(prefix+'RematchTimerLabel').textContent=tx('30 秒倒數','30-second timer');
  for(const button of document.querySelectorAll('#'+prefix+'RematchSettings [data-rematch-setting]')){
    const field=button.dataset.rematchSetting,value=button.dataset.rematchValue;button.disabled=disabled;
    if(field==='rounds'){const rounds=Number(value);button.textContent=rounds+tx(' 回合 · ',' rounds · ')+(rounds===12?30:12)+tx(' 點',' pts');button.setAttribute('aria-pressed',String(settings.rounds===rounds));}
    else if(field==='abilityMode'){button.textContent=value==='skills'?tx('技能模式','Abilities'):tx('經典模式','Classic');button.setAttribute('aria-pressed',String(settings.abilityMode===value));}
    else if(field==='timed'){button.textContent=settings.timed?tx('開啟','On'):tx('關閉','Off');button.dataset.rematchValue=String(!settings.timed);button.setAttribute('aria-checked',String(settings.timed));}
  }
  $(prefix+'RematchSettingsHint').textContent=tx('只影響下一場。房主修改後，所有人都需重新同意再戰。','Applies to the next match only. Any host change asks everyone to confirm the rematch again.');
}
function changeRematchSetting(field,value){
  const d=ui.data;if(ui.busy||d?.stage!=='finished'||!d.canRematch||!d.canEditRematchSettings)return;
  const settings=nextRoomSettings(d);let next;
  if(field==='rounds'&&[5,12].includes(Number(value)))next=Number(value);else if(field==='abilityMode'&&['classic','skills'].includes(value))next=value;else if(field==='timed'&&['true','false'].includes(String(value)))next=String(value)==='true';else return;
  if(settings[field]===next)return;return command('rematch-settings',{settingsVersion:settings.version,[field]:next});
}
function requestRoomRematch(){if(ui.busy||ui.data?.stage!=='finished'||!ui.data.canRematch||ui.data.rematchReady)return;return command('rematch',{settingsVersion:nextRoomSettings(ui.data).version});}
function canClosePrivateRoom(d){return !!ui.credentials&&!!d?.host&&!d.matchmaking&&!d.computer&&d.stage!=='closed';}
function roomDepartureText(d,team=false){
  if(d?.departureNotice&&typeof d.departureNotice==='string')return d.departureNotice;
  const departure=d?.lastDeparture;if(!departure||d.stage==='closed')return '';
  const name=departure.name||tx('一位玩家','A player'),hostName=departure.hostName||d.hostName||tx('新房主','the new host');
  const cpuTakesOver=team&&!['party','queue'].includes(d.stage)&&!!d.hasComputers;
  const message=cpuTakesOver?tx(name+' 已離開，由電腦接手。',name+' left. A CPU takes over the seat.'):tx(name+' 已離開，房間仍保留。',name+' left. The room remains open.')+(['lobby','party'].includes(d.stage)?tx('可邀請其他朋友加入。',' You can invite another friend.'):'');
  return message+(departure.hostTransferred?tx(' '+hostName+' 接任房主。',' '+hostName+' is now the host.'):'');
}
function renderRoomLifecycle(d,team=false){
  const prefix=team?'team':'room',close=$(prefix+'Close'),notice=$(prefix+'DepartureNotice');
  close.hidden=!canClosePrivateRoom(d)||!team&&d?.stage!=='lobby';close.disabled=ui.busy;close.textContent=tx('關閉房間','Close room');
  const departure=roomDepartureText(d,team);notice.hidden=!departure;notice.textContent=departure;
  const privateRoom=!!d&&!d.matchmaking&&!d.computer;for(const id of ['setupLeave','leave'])$(id).textContent=privateRoom?tx('離開房間','Leave room'):tx('離開對戰','Leave match');
  if(!team)$('cancelWait').textContent=d?.matchmaking?tx('取消配對','Cancel matching'):tx('離開房間','Leave room');
}
function acknowledgeVersus(){if(!ui.data)return;ui.introSeen.add(introKey(ui.data));saveSession();render();}
function gameForPlan(){const d=ui.data;return {abilityMode:d.skills?.enabled?'skills':'classic',controlled:d.controlled,round:d.round,board:d.board,playerBudget:d.yourBudget,cpuBudget:d.opponentBudget,roundLimit:d.roundLimit,characters:{player:d.skills?.yours,cpu:d.skills?.opponent},skillUsed:{player:!!d.skills?.yourUsed,cpu:!!d.skills?.opponentUsed},plan:ui.plan};}
const editable=()=>ui.data?.stage==='plan'&&ui.data.yourTurn&&!ui.data.yourLocked&&!ui.busy;
function stopPoll(){if(ui.poll)clearTimeout(ui.poll);ui.poll=null;}
function schedulePoll(){stopPoll();if(ui.queue||ui.data?.stage==='finished'&&ui.data.canRematch||!['finished','closed'].includes(ui.data?.stage))ui.poll=setTimeout(async()=>{if(!document.hidden){if(ui.queue){const queued=ui.queue;await refreshWaitingMatch();if(ui.queue===queued&&ui.kind==='team'&&ui.data?.computer&&!ui.busy)await refreshTeam();}else if(ui.credentials)await refresh();else if(!ui.data)await refreshQueue();}schedulePoll();},ui.kind==='team'?(ui.data?.stage==='queue'?1200:500):ui.credentials||ui.queue?1200:5000);}
async function refreshQueue(){try{const q=teamMatchUi.format==='2v2'?await teamApi('?queue=random&rounds='+teamMatchUi.rounds+'&abilityMode='+abilityUi.mode):await api('/queue?abilityMode='+abilityUi.mode);ui.queueCount=q.waitingPlayers;if(!ui.data)$('lobbyQueue').textContent=tx('等待人數：','Waiting line: ')+ui.queueCount;}catch{if(!ui.data)$('lobbyQueue').textContent=tx('等待人數：','Waiting line: ')+'—';}}
async function api(path,body,credentials=ui.credentials){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
  try{const headers={'Content-Type':'application/json'};if(credentials)headers.Authorization='Bearer '+credentials.token;
    const response=await fetch('/api/rooms'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:abort.signal});
    let data;try{data=await response.json();}catch{throw Error('連線尚未就緒，請再同步一次。');}
    if(!response.ok){const e=Error(data.error||'無法完成操作。');e.status=response.status;throw e;}return data;
  }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('連線中斷。已鎖定的動作仍會保留，請重新同步。');throw e;}finally{clearTimeout(timer);}
}
function receive(d){
  if(ui.kind==='online'&&ui.credentials&&d.code!==ui.credentials.code)return;
  if(ui.data?.code===d.code&&ui.data.version>d.version)return;
  const newMatch=ui.data?.matchId&&d.matchId&&ui.data.matchId!==d.matchId;if(newMatch)resetRematchPresentation();
  const fresh=newMatch||!ui.data||ui.data.code!==d.code||ui.data.round!==d.round||ui.data.stage!=='plan'&&d.stage==='plan';
  if(ui.data?.stage==='lobby'&&d.joined){if(socialState.roomPicker&&$('friends').open)$('friends').close();$('tutorial').close();stopTutorialDemo();soundEffect('role');}
  const replayKey=phoneMatchKey(d)+':'+d.round;if(ui.replayKey!==replayKey||d.stage==='plan'&&ui.data?.stage!=='plan'){stopReplay();ui.replayKey=replayKey;ui.replayStep=3;}
  ui.data=d;ui.error='';if(fresh&&d.stage!=='plan')ui.selectedRounds=d.roundLimit||5;
  syncCoinReward(d);
  if(fresh&&d.stage==='plan'){
    const direction=goalDirection(d.goal,d.controlled,d.board,d.controlled==='ec'?1:-1),preferred={kind:'own',direction,amount:d.round===1?3:1};
    try{const restored=d.yourDraft||preferred;duelActionInfo(gameForPlan(),'player',restored);ui.plan={...restored};}catch{ui.plan=duelActions(gameForPlan(),'player')[0]||{kind:'hold',direction:1,amount:0};}ui.intent=null;
  }
  if(d.yourLockedAction)ui.plan={...d.yourLockedAction};if(['revealed','finished'].includes(d.stage)&&ui.autoReplayKey!==replayKey)ui.replayStep=0;render();
  if(['revealed','finished'].includes(d.stage)&&ui.autoReplayKey!==replayKey){ui.autoReplayKey=replayKey;playReplay();}
}
async function refresh(){
  if(ui.kind==='team')return refreshTeam();
  if(ui.kind==='cpu'&&ui.cpuMatch?.remote){const match=ui.cpuMatch;try{const view=await match.run('view');if(ui.cpuMatch===match){receive(view);scheduleCpuTurn();}}catch(e){if(ui.cpuMatch===match){ui.error=e.message;render();}}return;}
  if(ui.kind!=='online'||!ui.credentials)return;
  const credentials=ui.credentials,code=credentials.code;try{const d=await api('/'+code,undefined,credentials);if(ui.credentials===credentials){if(d.code!==code&&d.matchKind==='ranked'){ui.credentials.code=d.code;saveSession();}receive(d);}}catch(e){if(ui.credentials!==credentials)return;ui.error=e.message;if([401,403,404,410].includes(e.status)){clearSession();}render();}
}
function clearSession(){resetDraftSync();resetTeamUi();resetMotion();stopReplay();stopTutorialDemo();stopWaitingAnimation();if(ui.cpuTimer)clearTimeout(ui.cpuTimer);ui.cpuTimer=null;ui.kind=null;ui.credentials=null;ui.data=null;ui.queue=null;ui.cpuMatch=null;ui.intent=null;ui.locking=false;ui.coinAnimation=null;ui.replayKey=null;ui.autoReplayKey=null;ui.replayStep=3;ui.selectedRounds=5;ui.roleChoicePending=null;stopPoll();try{sessionStorage.removeItem('band-phone-session');sessionStorage.removeItem('band-phone-queue');}catch{}}
async function connect(kind,code='',options={}){
  if(ui.busy||ui.credentials)return readPhone();ui.busy=true;ui.error='';render();
  try{
    await ensureShop();
    if(kind==='join'&&!/^[A-Z0-9]{6}$/.test(code.trim().toUpperCase()))throw Error('請輸入完整的六碼房間代號。');
    const result=await api(kind==='create'?'':['match','ranked'].includes(kind)?'/'+kind:'/'+code.trim().toUpperCase()+'/join',kind==='create'?{...(code?{code:normalizeRoomCode(code)}:{}),...options,abilityMode:options.abilityMode??abilityUi.mode}:kind==='match'?{abilityMode:abilityUi.mode}:{});
    ui.kind='online';ui.credentials={code:result.view.code,token:result.token};ui.data=null;saveSession();receive(result.view);schedulePoll();
  }catch(e){if(kind==='join'&&e.status===409&&e.message.includes('2v2')){ui.busy=false;await connectTeam('join',normalizeRoomCode(code));}else ui.error=e.message;}finally{ui.busy=false;render();}return readPhone();
}
async function command(kind,extra={}){
  if(ui.kind==='team')return teamCommand(kind,extra);
  if(ui.busy||!ui.data)return readPhone();
  if(kind==='lock'&&editable()){try{duelActionInfo(gameForPlan(),'player',ui.plan);soundEffect('lock');}catch{}}
  if(ui.kind==='cpu')return cpuCommand(kind,extra);
  if(kind==='lock'){try{if(!editable())throw Error('現在還不能鎖定。');duelActionInfo(gameForPlan(),'player',ui.plan);}catch(e){ui.error=e.message;render();return readPhone();}}
  const credentials=ui.credentials;ui.busy=true;ui.locking=kind==='lock';ui.error='';const body={round:ui.data.round,...(ui.data.matchId?{matchId:ui.data.matchId}:{}),...extra};if(kind==='lock')body.action={...ui.plan};
  const signature=JSON.stringify([kind,body]);if(ui.intent?.signature!==signature)ui.intent={signature,id:crypto.randomUUID()};body.requestId=ui.intent.id;render();
  let left=false;try{const result=await api('/'+credentials.code+'/'+kind,body,credentials);if(ui.credentials===credentials){if(kind==='leave'&&result.left)left=true;else receive(result);}}catch(e){if(ui.credentials===credentials){await refresh();ui.error=e.message;}}finally{ui.busy=false;ui.locking=false;render();schedulePoll();}return {...readPhone(),...(left?{left:true}:{})};
}
async function leave(){
  if(ui.busy)return;if(ui.queue&&!await cancelBackgroundQueue())return;if(ui.credentials&&ui.data&&ui.data.stage!=='closed'){const result=await command('leave');if(ui.credentials&&!result?.left&&ui.data?.stage!=='closed')return;}
  exitCurrentRoom();
}
function exitCurrentRoom(){
  clearSession();ui.error='';$('tutorial').close();$('resultInfo').close();render();refreshQueue();schedulePoll();loadProfileCard();
}
async function requestRoomClose(){
  const d=ui.data;if(ui.busy||!canClosePrivateRoom(d))return;
  await command('close');if(ui.credentials&&ui.data?.stage!=='closed')return;exitCurrentRoom();
}
function planAction(input){if(!editable())throw Error('請等到你的操作時間，再調整秘密計畫。');const p=normalizeDuelAction(input);duelActionInfo(gameForPlan(),'player',p);ui.plan=p;ui.error='';render();return readPhone();}
function chooseBand(field){
  if(!editable()||!['ec','ev'].includes(field))return;
  const d=ui.data,kind=field===d.controlled?'own':'attack';if(d.round===1&&kind==='attack')return;
  const b=battleSliderBounds(gameForPlan(),kind),desired=goalDirection(d.goal,field,d.board,field==='ec'?1:-1),delta=desired*(d.round===1?3:1),target=Math.max(b.min,Math.min(b.max,b.baseline+delta)),move=target-b.baseline;
  ui.plan={kind,direction:move<0?-1:1,amount:Math.abs(move)};render();
}
function slider(value){if(!editable()||ui.plan.skill)return;const b=battleSliderBounds(gameForPlan()),target=Math.max(b.min,Math.min(b.max,Math.round(Number(value)))),move=target-b.baseline;ui.plan={kind:ui.plan.kind==='hold'?'own':ui.plan.kind,direction:move<0?-1:1,amount:Math.abs(move)};render();}
function toggleHold(){if(!editable()||ui.data.round===1)return;if(ui.plan.kind==='hold')chooseBand(ui.data.controlled);else{ui.plan={kind:'hold',direction:1,amount:0};render();}}
function acknowledgeCoin(){if(!ui.data)return;ui.coinSeen.add(phoneMatchKey(ui.data));saveSession();render();scheduleCpuTurn();}
async function practice(abilityMode=abilityUi.mode){if(ui.data||ui.credentials||ui.busy)return readPhone();ui.busy=true;render();try{await ensureShop();resetMotion();stopPoll();ui.kind='cpu';ui.cpuCoinId=crypto.randomUUID();if(shopState.offline)ui.cpuMatch=new PhoneCpuMatch(Math.random,abilityMode);else{const r=await shopApi('/cpu',{operation:'start',abilityMode});ui.cpuMatch=new RemoteCpuMatch(r.matchId,r.view);}ui.coinSeen.delete('CPU');ui.coinAnimation=null;ui.data=null;ui.error='';receive(ui.cpuMatch.view());}catch(e){ui.kind=null;ui.error=e.message;}finally{ui.busy=false;render();if(ui.queue)schedulePoll();}return readPhone();}
function scheduleCpuTurn(){
  if(ui.kind!=='cpu'||ui.cpuTimer||!ui.cpuMatch.needsCpuTurn()||!ui.coinSeen.has('CPU'))return;
  const match=ui.cpuMatch;ui.cpuTimer=setTimeout(async()=>{ui.cpuTimer=null;if(ui.cpuMatch===match){try{const view=match.remote?await match.run('turn'):awardOfflineCpu(match.finishCpuTurn());if(ui.cpuMatch===match){receive(view);scheduleCpuTurn();}}catch(e){ui.error=e.message;render();}}},650);
}
async function cpuCommand(kind,extra){
  const match=ui.cpuMatch;ui.busy=true;ui.locking=kind==='lock';ui.error='';
  try{
    if(kind==='leave'){clearSession();ui.busy=false;render();return readPhone();}
    let view;if(match.remote){if(kind==='lock')duelActionInfo(gameForPlan(),'player',ui.plan);render();view=await match.run(kind,kind==='lock'?{action:{...ui.plan}}:extra);}else if(kind==='role')view=match.chooseRole(extra.controlled,extra.character);else if(kind==='ready')view=match.next();else if(kind==='mode')view=match.chooseMode(extra.mode,extra.rounds);else if(kind==='lock')view=match.lock(ui.plan);else throw Error('對戰操作無效。');
    if(ui.cpuMatch===match){receive(match.remote?view:awardOfflineCpu(view));scheduleCpuTurn();}
  }catch(e){if(ui.cpuMatch!==match)return readPhone();if(match?.remote)try{const latest=await match.run('view');if(ui.cpuMatch===match)receive(latest);else return readPhone();}catch{}ui.error=e.message;}finally{if(ui.cpuMatch===match){ui.busy=false;ui.locking=false;}render();}return readPhone();
}
function actionText(a){if(['pulse','jam'].includes(a.skill))return characterName(a.skill)+' · '+bandLabel(a.field)+' '+signed(a.delta*.02)+' eV'+tx('（1 點）',' (1 point)');if(a.skill==='charge')return tx('蓄能 · 本回合不移動，回復 '+a.refund+' 點','Recharge · no movement, +'+a.refund+' points');if(a.skill==='split')return tx('分流 · ','Split · ')+bandLabel(a.field)+' '+signed(a.delta*.02)+' / '+bandLabel(a.secondaryField)+' '+signed(a.secondaryDelta*.02)+tx('（3 點）',' (3 points)');return a.kind==='hold'?tx('保留點數（0 點）','Hold (0 points)'):(a.kind==='attack'?tx('干擾','Interfere with '):tx('修改','Edit '))+bandLabel(a.field)+' '+signed(a.delta*.02)+' eV'+tx('（'+a.cost+' 點）',' ('+a.cost+' points)');}
