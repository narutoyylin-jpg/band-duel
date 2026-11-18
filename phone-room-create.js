const roomCreateState={busy:false,error:'',secretPending:null,format:'1v1',rounds:5,timed:true};
function renderRoomCreate(){renderAbilityRules();
 $('roomCreateTitle').textContent=tx('建立房間','Create room');$('roomCreateClose').textContent=tx('關閉','Close');$('roomCreateLabel').textContent=tx('房間代號','Room code');$('roomCreateHint').textContent=tx('6 碼英文或數字，可自訂或隨機產生。朋友房間不影響積分。','Choose or generate six letters / digits. Friend rooms do not affect ratings.');$('roomCreateRandom').textContent=tx('隨機產生','Random code');$('roomCreateSubmit').textContent=roomCreateState.busy?tx('建立中…','Creating…'):tx('建立房間','Create room');$('roomCreateStatus').textContent=translated(roomCreateState.error);
 const count=roomCreateState.format==='2v2'?4:2,profile=leaderboardState.data?.viewer?.profile;$('roomSetupRoster').innerHTML=Array.from({length:count},(_,i)=>'<div class="room-slot">'+(i===0?avatarMarkup(profile,'large'):'<span class="empty-room-slot">+</span>')+'<strong>'+htmlText(i===0?tx('你','You'):tx('等待好友','Open seat'))+'</strong></div>').join('');
 $('roomSetupMode').textContent=tx('正式對戰 · Shuffle · 最多 ','Official rules · Shuffle · up to ')+count+tx(' 人',' players')+(count===4?tx(' · 至少兩位真人，空位由電腦補上',' · At least two humans; CPUs fill empty seats'):'');$('roomSetupRoundsLabel').textContent=tx('回合數／每人點數','Rounds / points per player');
 $('roomSetupTimerLabel').textContent=tx('30 秒思考倒數','30-second planning timer');$('roomSetupTimer').textContent=roomCreateState.timed?tx('開啟','On'):tx('關閉','Off');$('roomSetupTimer').setAttribute('aria-checked',String(roomCreateState.timed));$('roomSetupTimerHint').textContent=roomCreateState.timed?tx('每次思考限時 30 秒；最後 5 秒會有聲音提示。','Each planning turn lasts 30 seconds, with sound cues in the final 5 seconds.'):tx('沒有倒數，可以慢慢思考；鎖定後等待其他玩家完成。','No countdown. Take your time; after locking in, wait for the other players.');
 for(const b of document.querySelectorAll('[data-room-format]')){b.setAttribute('aria-pressed',String(b.dataset.roomFormat===roomCreateState.format));b.disabled=roomCreateState.busy;}
 $('roomSetupRounds').innerHTML=[5,12].map(n=>'<button type="button" data-room-rounds="'+n+'" aria-pressed="'+(n===roomCreateState.rounds)+'" '+(roomCreateState.busy?'disabled':'')+'>'+n+tx(' 回合 · ',' rounds · ')+DUEL_LENGTHS[n]+tx(' 點',' pts')+'</button>').join('');$('roomSetupInvite').textContent=tx('加入好友','Add friends');
 for(const id of ['roomCreateInput','roomCreateRandom','roomCreateSubmit','roomCreateClose','roomSetupInvite','roomSetupTimer'])$(id).disabled=roomCreateState.busy;
}
function openRoomCreate(){if(ui.data||ui.busy)return;roomCreateState.format=teamMatchUi.format;roomCreateState.error='';$('roomCreateInput').value=randomRoomCode();renderRoomCreate();stopCoverMotion();$('roomCreate').showModal();loadProfileCard().then(()=>{if($('roomCreate').open)renderRoomCreate();});}
async function submitRoomCreate(invite=false){
 if(roomCreateState.busy)return;const code=normalizeRoomCode($('roomCreateInput').value);if(!ROOM_CODE_PATTERN.test(code)){roomCreateState.error=tx('請輸入完整的六碼房間代號。','Enter all six characters of the room code.');renderRoomCreate();return;}
 roomCreateState.busy=true;roomCreateState.error='';renderRoomCreate();await checkSecretRoomCode(code);
 if(roomCreateState.format==='2v2')await connectTeam('create',code,{rounds:roomCreateState.rounds,abilityMode:abilityUi.mode,timed:roomCreateState.timed});else await connect('create',code,{rounds:roomCreateState.rounds,abilityMode:abilityUi.mode,timed:roomCreateState.timed});
 roomCreateState.busy=false;if(ui.credentials){$('roomCreate').close();if(invite)await openRoomFriendPicker();}else roomCreateState.error=ui.error;renderRoomCreate();
}
async function openRoomFriendPicker(){socialState.roomPicker=true;await openFriends();}
function renderRoomWaiting(d){
 const enabled=ui.kind==='online'&&d?.stage==='lobby'&&!d.matchmaking;$('roomWaitingRoster').hidden=!enabled;$('roomWaitingInvite').hidden=!enabled||!d.host;if(!enabled)return;
 const me=d.yourProfile||leaderboardState.data?.viewer?.profile;$('roomWaitingRoster').innerHTML='<div class="room-slot">'+avatarMarkup(me,'large')+'<strong>'+tx('你','You')+'</strong></div><div class="room-slot"><span class="empty-room-slot">+</span><strong>'+tx('等待好友','Open seat')+'</strong></div>';$('roomWaitingInvite').textContent=tx('加入好友','Add friends');
}
async function checkSecretRoomCode(code){
 if(normalizeRoomCode(code)!=='114514'||shopState.offline)return;
 if(roomCreateState.secretPending)return roomCreateState.secretPending;
 roomCreateState.secretPending=(async()=>{try{await ensureShop();if(!shopState.data?.signedIn)return;await shopApi('/room-code',{code});await loadProfileCard();}catch{}})();
 try{await roomCreateState.secretPending;}finally{roomCreateState.secretPending=null;}
}
function initRoomCreate(){
 $('roomCreateRandom').addEventListener('click',()=>{$('roomCreateInput').value=randomRoomCode();soundEffect('click');});
 $('roomSetupTimer').addEventListener('click',()=>{if(roomCreateState.busy)return;roomCreateState.timed=!roomCreateState.timed;renderRoomCreate();});
 $('roomCreateInput').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);checkSecretRoomCode(e.target.value);});
 $('roomCreateForm').addEventListener('submit',e=>{e.preventDefault();submitRoomCreate();});$('roomSetupInvite').addEventListener('click',()=>submitRoomCreate(true));$('roomWaitingInvite').addEventListener('click',openRoomFriendPicker);
 for(const b of document.querySelectorAll('[data-room-format]'))b.addEventListener('click',()=>{roomCreateState.format=b.dataset.roomFormat;renderRoomCreate();});$('roomSetupRounds').addEventListener('click',e=>{const b=e.target.closest('[data-room-rounds]');if(b){roomCreateState.rounds=Number(b.dataset.roomRounds);renderRoomCreate();}});document.addEventListener('band-language',()=>{if($('roomCreate').open)renderRoomCreate();});
 $('roomCreateClose').addEventListener('click',()=>closeAnimatedDialog($('roomCreate')));$('roomCreate').addEventListener('cancel',e=>{e.preventDefault();if(!roomCreateState.busy)closeAnimatedDialog($('roomCreate'));});$('roomCreate').addEventListener('close',()=>{updateCoverMotion();showAchievementNotice();});
}
