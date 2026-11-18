const room={active:false,credentials:null,data:null,plan:{kind:'own',direction:1,amount:3},poll:null,busy:false,error:'',intent:null};
let beforeRoom=[state.ec,state.ev];
function readRoom(){return {active:room.active,connected:!!room.credentials,data:room.data?structuredClone(room.data):null,yourDraft:{...room.plan},syncError:room.error};}
function roomGame(){const d=room.data;return {controlled:d.controlled,round:d.round,board:d.board,playerBudget:d.yourBudget,plan:room.plan};}
function saveRoomSession(){try{sessionStorage.setItem('band-room-session',JSON.stringify(room.credentials));}catch{}}
function stopRoomPolling(){if(room.poll)clearTimeout(room.poll);room.poll=null;}
function scheduleRoomPoll(){stopRoomPolling();if(room.active&&room.credentials&&room.data?.stage!=='closed'&&room.data?.stage!=='finished')room.poll=setTimeout(async()=>{if(!document.hidden)await refreshRoom();scheduleRoomPoll();},2200);}
async function roomApi(path,body){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const headers={'Content-Type':'application/json'};if(room.credentials?.token)headers.Authorization='Bearer '+room.credentials.token;
    const response=await fetch('/api/rooms'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:controller.signal});
    let data;try{data=await response.json();}catch{throw Error('連線尚未就緒，請稍後重新同步。');}
    if(!response.ok){const error=Error(data.error||'房間同步失敗。');error.status=response.status;throw error;}return data;
  }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('連線中斷，請重新同步；已鎖定的動作仍會保留。');throw e;}finally{clearTimeout(timeout);}
}
function receiveRoom(d){
  if(room.credentials&&d.code!==room.credentials.code)return;
  if(room.data?.code===d.code&&room.data.version>d.version)return;
  const fresh=!room.data||room.data.code!==d.code||room.data.round!==d.round||room.data.stage!=='plan'&&d.stage==='plan';
  room.data=d;room.error='';
  if(fresh&&d.stage==='plan'){
    const direction=d.controlled==='ec'?(d.goal.eSide==='B'?-1:1):(d.goal.hSide==='B'?1:-1),preferred={kind:'own',direction,amount:d.round===1?3:1};
    room.plan=preferred;try{duelActionInfo(roomGame(),'player',preferred);}catch{room.plan=duelActions({...roomGame(),cpuBudget:d.opponentBudget},'player')[0]||{kind:'hold',direction:1,amount:0};}
    room.intent=null;
  }
  if(d.yourLockedAction)room.plan={...d.yourLockedAction};
  if(room.active){state.ec=d.board.ec*.02;state.ev=d.board.ev*.02;}update();
}
async function refreshRoom(){
  if(!room.credentials)return;try{receiveRoom(await roomApi('/'+room.credentials.code));}catch(e){room.error=e.message;if([404,410,401,403].includes(e.status)){room.credentials=null;room.data=null;stopRoomPolling();try{sessionStorage.removeItem('band-room-session');}catch{}}update();}
}
function enterRoom(){if(!room.active)beforeRoom=[state.ec,state.ev];room.active=true;battle.active=false;if(room.data){state.ec=room.data.board.ec*.02;state.ev=room.data.board.ev*.02;}update();if(room.credentials){refreshRoom();scheduleRoomPoll();}return readRoom();}
async function connectRoom(kind,code=''){
  if(room.busy)return;room.busy=true;room.error='';update();
  try{
    if(location.protocol==='file:')throw Error('雙人房間需要連線，請開啟線上網站。');
    if(kind==='join'&&!/^[A-Z2-9]{6}$/.test(code.trim().toUpperCase()))throw Error('請輸入 6 碼房間代號。');
    const result=await roomApi(kind==='create'?'':'/'+code.trim().toUpperCase()+'/join',{});
    room.credentials={code:result.view.code,token:result.token};saveRoomSession();room.data=null;receiveRoom(result.view);scheduleRoomPoll();
  }catch(e){room.error=e.message;}finally{room.busy=false;update();}return readRoom();
}
async function createRoom(){return connectRoom('create');}
async function joinRoom(code=$('roomCodeInput').value){return connectRoom('join',code);}
function planRoom(input){if(!room.active||!room.data||room.data.stage!=='plan'||room.data.yourLocked||room.busy)throw Error('目前不能更改秘密動作。');const plan=normalizeDuelAction(input);duelActionInfo(roomGame(),'player',plan);room.plan=plan;update();return readRoom();}
function setRoomSlider(value){
  if(!room.data||room.data.stage!=='plan'||room.data.yourLocked||room.busy)return;
  const b=battleSliderBounds(roomGame()),target=Math.max(b.min,Math.min(b.max,Math.round(Number(value)))),delta=target-b.baseline;
  room.plan={kind:room.plan.kind,direction:delta<0?-1:1,amount:Math.abs(delta)};update();
}
function changeRoomKind(kind){
  if(!room.data||room.data.stage!=='plan'||room.data.yourLocked||room.busy)return;
  if(kind==='hold')room.plan={kind,direction:1,amount:0};
  else{const b=battleSliderBounds(roomGame(),kind),target=Math.max(b.min,Math.min(b.max,b.baseline+room.plan.direction*(room.plan.amount||1))),delta=target-b.baseline;room.plan={kind,direction:delta<0?-1:1,amount:Math.abs(delta)};}update();
}
async function sendRoomAction(kind){
  if(!room.data||room.busy)return;
  if(kind==='lock'){try{duelActionInfo(roomGame(),'player',room.plan);}catch(e){room.error=e.message;update();return;}}
  room.busy=true;room.error='';const round=room.data.round,signature=JSON.stringify([kind,round,kind==='lock'?room.plan:null]);
  if(room.intent?.signature!==signature)room.intent={signature,id:crypto.randomUUID()};
  const body={round,requestId:room.intent.id};if(kind==='lock')body.action={...room.plan};update();
  try{receiveRoom(await roomApi('/'+room.credentials.code+'/'+kind,body));}catch(e){room.error=e.message;await refreshRoom();}finally{room.busy=false;update();scheduleRoomPoll();}return readRoom();
}
async function leaveRoom(){
  if(room.busy)return;
  if(room.data&&!['finished','closed'].includes(room.data.stage)){await sendRoomAction('leave');if(room.credentials&&room.data?.stage!=='closed')return;}
  room.credentials=null;room.data=null;room.error='';room.intent=null;stopRoomPolling();try{sessionStorage.removeItem('band-room-session');}catch{}state.ec=beforeRoom[0];state.ev=beforeRoom[1];update();
}
async function copyRoomCode(){try{await navigator.clipboard.writeText(room.data.code);$('roomCopy').textContent='已複製';}catch{$('roomCopy').textContent='房間代號：'+room.data.code;}}
function renderRoom(){
  const active=room.active,d=room.data;document.querySelector('main').classList.toggle('room-active',active);document.querySelector('main').classList.toggle('room-lobby',active&&(!d||!d.joined));$('roomPanel').hidden=!active;$('roomControls').hidden=!active||!d||!d.joined;$('roomLobby').hidden=!!d;$('roomMatch').hidden=!d;$('roomHistory').hidden=!active||!d?.history.length;
  $('roomError').hidden=!room.error;$('roomError').textContent=room.error;$('roomCreate').disabled=room.busy;$('roomJoin').disabled=room.busy;
  if(!active)return;
  $('ecSlider').disabled=true;$('evSlider').disabled=true;document.querySelectorAll('.nudge[data-control]').forEach(b=>b.disabled=true);$('controlHeading').textContent='你的秘密動作';
  if(!d)return;
  const planning=d.stage==='plan'&&!d.yourLocked,connected=d.joined,last=d.history.at(-1),q=goalFor(d.goal,d.board);
  $('roomDisplayCode').textContent=d.code;$('roomRound').textContent=d.stage==='finished'?'五回合結束':d.stage==='closed'?'房間已結束':'第 '+d.round+' / 5 回合'+(d.round===1?' · 設計':' · 攻防');
  $('roomRole').textContent='你控制'+bandName(d.controlled)+' · 對方控制'+bandName(otherBand(d.controlled));
  $('roomGoalType').textContent=d.goal.type+' · '+(d.goal.type==='Type I'?'同側聚集':'兩側分離');$('roomGoalSide').textContent='電子在 '+d.goal.eSide+'、電洞在 '+d.goal.hSide;
  $('roomYourScore').textContent=d.yourScore;$('roomOtherScore').textContent=d.opponentScore;$('roomBudget').textContent='你的剩餘點數 '+d.yourBudget+' / 12';
  $('roomStatus').textContent=d.stage==='lobby'?'把代號傳給另一支手機，等待對方加入。':d.stage==='closed'?'有玩家離開，這個房間已結束。':d.stage==='finished'?(d.yourScore>d.opponentScore?'你獲勝':d.yourScore<d.opponentScore?'對方獲勝':'平手'):d.stage==='revealed'?(d.yourReady?'你已準備好，等待對方。':'本回合已揭曉；看完結果後，雙方都按準備。'):d.yourLocked?'你已鎖定。'+(d.opponentLocked?'正在揭曉。':'等待對方鎖定；對方看不到你的動作。'):d.opponentLocked?'對方已鎖定；內容保持秘密。':'雙方正在秘密出招。';
  $('roomOwnShares').innerHTML=last?'<span class="battle-share-e">電子 '+d.goal.eSide+' '+pct(q.eShare)+'</span> · <span class="battle-share-h">電洞 '+d.goal.hSide+' '+pct(q.hShare)+'</span> · 較低 '+pct(q.quality):'開局任務已派發，雙方設計尚未揭曉。';
  $('roomResults').hidden=!last;$('roomResults').innerHTML=last?'<b>'+(d.stage==='plan'?'上一回合':'回合 '+last.round)+'結果 · '+last.type+'</b><br>'+(last.round===1?'設計完成，不計分。':'你 +'+last.yourGain+' 分 ／ 對方 +'+last.opponentGain+' 分。')+'<br>目標比例較低值：你 '+pct(last.yourQuality)+' ／ 對方 '+pct(last.opponentQuality)+(last.reason==='ratio'?' · 同 Type 比較':last.reason==='unmatched'?' · 未達共同 Type':'')+'<br>你的已揭曉動作：'+duelActionText(last.yourAction):'';
  $('roomPrepare').hidden=d.stage!=='revealed';$('roomPrepare').disabled=room.busy||d.yourReady;$('roomNew').hidden=!['closed','finished'].includes(d.stage);$('roomLeave').disabled=room.busy;$('roomShare').hidden=connected;
  $('roomPlanForm').hidden=!planning;$('roomWaiting').hidden=planning||!connected;$('roomWaiting').textContent=d.yourLocked?'你的動作已安全鎖定，等雙方完成後一起揭曉。':d.stage==='revealed'?'本回合已結束；雙方準備好後會進入下一回合。':'這場對戰已結束。';
  $('roomActionField').hidden=d.round===1;document.querySelectorAll('input[name=roomAction]').forEach(r=>{r.checked=r.value===room.plan.kind;r.disabled=room.busy;});
  const b=battleSliderBounds(roomGame()),target=b.baseline+(room.plan.kind==='hold'?0:room.plan.direction*room.plan.amount),sub=b.field==='ec'?'C':'V';
  $('roomOffsetControl').hidden=room.plan.kind==='hold';$('roomOffsetControl').classList.toggle('holes',b.field==='ev');$('roomEditLabel').textContent=(room.plan.kind==='attack'?'干擾對方的':'調整你的')+bandName(b.field)+' · 只有你看得到';
  $('roomOffsetLabel').innerHTML=bandName(b.field)+'位差 ΔE<sub>'+sub+'</sub>';$('roomOffsetValue').innerHTML=signed(target*.02)+' <small>eV</small>';$('roomOffsetFormula').innerHTML='ΔE<sub>'+sub+'</sub> = E<sub>'+sub+',B</sub> − E<sub>'+sub+',A</sub>';
  const slider=$('roomOffset');slider.min=b.min;slider.max=b.max;slider.value=target;slider.disabled=room.busy||b.min===b.max;slider.setAttribute('aria-valuetext',signed(target*.02)+' eV');$('roomOffsetMin').textContent=signed(b.min*.02);$('roomOffsetMid').textContent=signed(b.baseline*.02);$('roomOffsetMax').textContent=signed(b.max*.02)+' eV';
  $('roomBaseline').textContent='公開 '+signed(b.baseline*.02)+' → 計畫 '+signed(target*.02)+' eV（移動 '+signed((target-b.baseline)*.02)+'）';$('roomMinus').disabled=room.busy||target<=b.min;$('roomPlus').disabled=room.busy||target>=b.max;
  let info,error='';try{info=duelActionInfo(roomGame(),'player',room.plan);}catch(e){error=e.message;}if(room.plan.kind!=='hold'&&room.plan.amount===0)error=d.round===1?'請選擇非零位差完成設計。':'未移動；請調整滑桿，或選擇保留點數。';
  $('roomCost').textContent=error||'本次花費 '+info.cost+' 點 · 剩餘 '+(d.yourBudget-info.cost)+' 點';$('roomCost').classList.toggle('over',!!error);$('roomCommit').disabled=room.busy||!!error||!planning;$('roomCommit').textContent=room.busy?'正在鎖定…':'鎖定我的秘密動作';
  $('roomDirection').textContent=b.field==='ec'?'降低 B 導帶，電子偏向 B；提高則偏向 A。':'提高 B 價帶，電洞偏向 B；降低則偏向 A。';
  if(error)$('roomPreview').textContent='調整後才能鎖定。';else if(d.round===1)$('roomPreview').textContent='你的秘密設計不會傳給對方。兩條能帶都揭曉後，才知道 Type 和完整比例。';else{const board={...d.board};board[info.field]+=info.delta;const trial=goalFor(d.goal,board),r=carrierModel(board.ec*.02,board.ev*.02);$('roomPreview').innerHTML='<b>私人試算 · 假設對方不移動</b><br>'+r.type+' · 電子 '+d.goal.eSide+' '+pct(trial.eShare)+'、電洞 '+d.goal.hSide+' '+pct(trial.hShare)+'<br>較低一項 '+pct(trial.quality)+'。雙方揭曉後才確定結果。';}
  $('battlePublicNote').hidden=false;$('battlePublicNote').textContent=last?'主圖與下方比例只顯示已揭曉結果。你的本回合計畫保留在私人操作區。':'目前是零位差起點；雙方秘密設計尚未揭曉。';
  $('roomHistory').hidden=!last;$('roomHistoryBody').innerHTML=d.history.map(h=>'<tr><td>'+h.round+'</td><td>'+duelActionText(h.yourAction)+'</td><td>'+h.type+'<small>ΔEc '+signed(h.board.ec*.02)+' / ΔEv '+signed(h.board.ev*.02)+' eV</small></td><td>你 +'+h.yourGain+' ／ 對方 +'+h.opponentGain+'</td></tr>').join('');
}
$('roomCreate').addEventListener('click',createRoom);$('roomJoin').addEventListener('click',()=>joinRoom());$('roomCodeInput').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());$('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom();});
$('roomCommit').addEventListener('click',()=>sendRoomAction('lock'));$('roomPrepare').addEventListener('click',()=>sendRoomAction('ready'));$('roomSync').addEventListener('click',refreshRoom);$('roomLeave').addEventListener('click',leaveRoom);$('roomNew').addEventListener('click',async()=>{await leaveRoom();if(!room.credentials)await createRoom();});$('roomCopy').addEventListener('click',copyRoomCode);
$('roomOffset').addEventListener('input',e=>setRoomSlider(e.target.value));$('roomMinus').addEventListener('click',()=>setRoomSlider(Number($('roomOffset').value)-1));$('roomPlus').addEventListener('click',()=>setRoomSlider(Number($('roomOffset').value)+1));document.querySelectorAll('input[name=roomAction]').forEach(r=>r.addEventListener('change',()=>changeRoomKind(r.value)));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&room.active&&room.credentials)refreshRoom();});window.addEventListener('pagehide',stopRoomPolling);
try{const saved=JSON.parse(sessionStorage.getItem('band-room-session')||'null');if(saved&&/^[A-Z2-9]{6}$/.test(saved.code)&&/^[a-f0-9]{64}$/.test(saved.token)){room.credentials=saved;room.active=true;refreshRoom();scheduleRoomPoll();}}catch{}
const invitedCode=new URLSearchParams(location.search).get('room');if(invitedCode){$('roomCodeInput').value=invitedCode.toUpperCase().slice(0,6);room.active=true;}
