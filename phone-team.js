const teamUi={selectedField:null,key:null,plan:{ec:0,ev:0},sequence:0,lastSent:null,inflight:false,draftTimer:null,syncStatus:'',replayKey:null,replayStep:5,replayFrame:null,replayTask:null,replaying:false,graphKey:null,displayBoard:null,liveTask:null,liveTarget:null,generation:0};
function resetTeamUi(){clearTimeout(teamUi.draftTimer);teamUi.replayTask?.cancel();teamUi.liveTask?.cancel();teamUi.generation++;Object.assign(teamUi,{selectedField:null,key:null,inflight:false,draftTimer:null,lastSent:null,syncStatus:'',replayKey:null,replayFrame:null,replayTask:null,replaying:false,graphKey:null,displayBoard:null,liveTask:null,liveTarget:null});}
async function teamApi(path='',body,credentials=ui.credentials){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
 try{const r=await fetch('/api/team-rooms'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(credentials?{Authorization:'Bearer '+credentials.token}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:abort.signal});const data=await r.json();if(!r.ok){const e=Error(data.error||tx('組隊連線失敗。','Team connection failed.'));e.status=r.status;throw e;}return data;}finally{clearTimeout(timer);}
}
function openTeamEntry(){renderAbilityRules();
 $('teamEntryTitle').textContent=tx('2v2 組隊試玩','2v2 team trial');$('teamEntryClose').textContent=tx('關閉','Close');$('teamEntryText').textContent=tx('每隊一位導帶、一位價帶。點選圖上的導帶或價帶，再調整這次出招；每人每回合只改一條。看得到同角色對手的即時動作，隊友計畫保密。每隊獨立抽 Shuffle 任務，四人同時出招 30 秒。','Each team has a conduction and valence player. Tap a band on the diagram, then adjust your move. Each player moves one band per round. Watch your same-role opponent live; teammate plans stay hidden. Teams draw independent Shuffle missions and plan together for 30 seconds.');$('teamPractice').textContent=tx('2v2 練習模式','2v2 practice');$('teamPracticeNote').textContent=tx('你＋電腦隊友，對上兩位電腦。可選角色與回合數。','You + a CPU teammate versus two CPUs. Choose your role and round count.');$('teamCreate').textContent=tx('建立四人房間','Create a four-player room');$('teamJoinLabel').textContent=tx('加入朋友的組隊房間','Join a friend’s team room');$('teamJoin').textContent=tx('加入','Join');$('teamEntryNote').textContent=tx('可選 5 或 12 回合。組隊試玩不計積分與金幣。','Choose 5 or 12 rounds. Team trials award no rating or coins.');$('teamEntryStatus').textContent='';$('teamEntry').showModal();
}
async function connectTeam(kind,code='',options={},background=false){
 if(ui.busy||ui.data||ui.credentials||ui.queue&&!(background&&kind==='computer'))return;ui.busy=true;ui.error='';
 try{await ensureShop();const normalized=normalizeRoomCode(code);if(kind==='join'&&!ROOM_CODE_PATTERN.test(normalized))throw Error(tx('請輸入完整的六碼房間代號。','Enter the full six-character room code.'));options={...options,abilityMode:options.queue==='ranked'?'classic':options.abilityMode??abilityUi.mode};const result=await teamApi(kind==='join'?'/'+normalized+'/join':'',kind==='computer'?{computer:true,...options}:kind==='queue'?options:kind==='create'?{...(normalized?{code:normalized}:{}),...options}:{},null);resetTeamUi();ui.kind='team';ui.credentials={kind:'team',code:result.view.code,token:result.token};ui.data=null;saveSession();$('teamEntry').close();$('teamMatchEntry').close();receiveTeam(result.view);schedulePoll();}catch(e){ui.error=e.message;$('teamEntryStatus').textContent=translated(e.message);$('teamMatchStatus').textContent=translated(e.message);}finally{ui.busy=false;render();}
}
function receiveTeam(d,allowRedirect=false){
 if(ui.kind!=='team'||!ui.credentials||ui.data?.code===d.code&&ui.data.version>d.version)return;if(ui.credentials.code!==d.code){if(!allowRedirect)return;ui.credentials.code=d.code;saveSession();}if(ui.data?.stage==='queue'&&d.stage==='lobby'){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();stopWaitingAnimation();soundEffect('role');}
 if(ui.data?.matchId&&d.matchId&&ui.data.matchId!==d.matchId)resetRematchPresentation();
 const key=d.matchId+':'+d.round+':'+d.yourSlot,fresh=teamUi.key!==key;if(fresh){teamUi.replayTask?.cancel();teamUi.liveTask?.cancel();teamUi.generation++;clearTimeout(teamUi.draftTimer);teamUi.draftTimer=null;teamUi.inflight=false;teamUi.key=key;teamUi.plan=d.yourDraft||(d.rulesVersion>=2?{ec:0,ev:0}:{direction:1,amount:0});const offsets=teamOffsets(teamUi.plan,d.yourSlot);teamUi.selectedField=offsets.ev&&!offsets.ec?'ev':offsets.ec&&!offsets.ev?'ec':d.controlled;teamUi.sequence=d.yourDraftSequence||0;teamUi.lastSent=null;teamUi.syncStatus='';teamUi.replayStep=5;teamUi.replayFrame=null;teamUi.liveTarget=null;}else if(d.yourLocked&&d.yourDraft)teamUi.plan={...d.yourDraft};
 teamUi.sequence=Math.max(teamUi.sequence,d.yourDraftSequence||0);if(d.stage==='plan'&&JSON.stringify(d.yourDraft)===JSON.stringify(teamUi.plan))teamUi.syncStatus=tx('計畫已同步','Plan synced');ui.data=d;ui.error='';if(socialState.roomPicker&&$('friends').open&&(d.joined||d.stage==='party'&&d.partySize===2))$('friends').close();syncCoinReward(d);render();
 if(['revealed','finished'].includes(d.stage)&&teamUi.replayKey!==key){teamUi.replayKey=key;playTeamReplay();}
}
async function refreshTeam(){
 const credentials=ui.credentials;if(!credentials)return;try{const d=await teamApi('/'+credentials.code,undefined,credentials);if(ui.credentials===credentials)receiveTeam(d,true);}catch(e){if(ui.credentials!==credentials)return;ui.error=e.message;if([401,403,404,410].includes(e.status))clearSession();render();}
}
async function teamCommand(op,extra={}){
 if(ui.kind!=='team'||ui.busy||!ui.data)return;const d=ui.data,credentials=ui.credentials;ui.busy=true;ui.error='';const body={requestId:crypto.randomUUID(),...(d.matchId?{matchId:d.matchId}:{}),...extra};if(['lock','next','ready'].includes(op))body.round=d.round;if(op==='lock'){body.action={...teamUi.plan};body.sequence=++teamUi.sequence;}
 let left=false;render();try{const result=await teamApi('/'+d.code+'/'+op,body,credentials);if(ui.credentials===credentials){if(op==='leave'&&result.left)left=true;else receiveTeam(result,true);}if(op==='lock')soundEffect('lock');}catch(e){await refreshTeam();ui.error=e.message;}finally{ui.busy=false;render();}return {...readPhone(),...(left?{left:true}:{})};
}
function teamCanEdit(){return ui.kind==='team'&&ui.data?.stage==='plan'&&!ui.data.yourLocked&&!ui.busy;}
function teamOffsets(action,slot){if(action?.deltas)return {ec:action.deltas[teamBandKey(slot,'ec')]||0,ev:action.deltas[teamBandKey(slot,'ev')]||0};if(typeof action?.ec==='number')return {ec:action.ec,ev:action.ev};return {ec:0,ev:0,[teamSlot(slot).field]:(action?.delta??((action?.direction||1)*(action?.amount||0)))};}
function teamSelectedField(d=ui.data){return ['ec','ev'].includes(teamUi.selectedField)?teamUi.selectedField:d.controlled;}
function teamMoveLimit(d,field){return Math.max(0,Math.min(d.round===1?4:2,Math.floor(d.yourBudget/(field===d.controlled?1:2))));}
function teamChooseBand(field){
 if(!teamCanEdit()||!['ec','ev'].includes(field)||ui.data.rulesVersion<2&&field!==ui.data.controlled)return;
 const previous=teamSelectedField(),d=ui.data;teamUi.selectedField=field;
 if(previous!==field||teamUi.plan.skill){teamUi.plan=d.rulesVersion>=2?{ec:0,ev:0}:{direction:1,amount:0};queueTeamDraft();}
 soundEffect('tap');renderTeam();
}
function teamMove(value,field=teamSelectedField()){
 if(!teamCanEdit()||teamUi.plan.skill||!['ec','ev'].includes(field))return;const d=ui.data,s=teamSlot(d.yourSlot),key=teamBandKey(s.id,field),baseline=d.board[key],cap=d.rulesVersion>=2?teamMoveLimit(d,field):Math.min(d.round===1?4:2,d.yourBudget),target=Math.max(Math.max(-8,baseline-cap),Math.min(Math.min(8,baseline+cap),Math.round(Number(value)))),delta=target-baseline;
 teamUi.selectedField=field;teamUi.plan=d.rulesVersion>=2?{ec:0,ev:0,[field]:delta}:{direction:delta<0?-1:1,amount:Math.abs(delta)};movementSound();renderTeam();queueTeamDraft();
}
function queueTeamDraft(){
 if(!teamCanEdit())return;const signature=JSON.stringify(teamUi.plan);if(signature===teamUi.lastSent)return;teamUi.syncStatus=tx('同步計畫中…','Syncing plan…');if(!teamUi.draftTimer&&!teamUi.inflight)teamUi.draftTimer=setTimeout(()=>{teamUi.draftTimer=null;sendTeamDraft();},80);
}
async function sendTeamDraft(){
 teamUi.draftTimer=null;if(!teamCanEdit()||teamUi.inflight)return;const key=teamUi.key,credentials=ui.credentials,action={...teamUi.plan},signature=JSON.stringify(action);if(signature===teamUi.lastSent)return;teamUi.inflight=true;teamUi.lastSent=signature;const sequence=++teamUi.sequence;
 try{const d=await teamApi('/'+credentials.code+'/draft',{round:ui.data.round,...(ui.data.matchId?{matchId:ui.data.matchId}:{}),sequence,action},credentials);if(ui.kind==='team'&&teamUi.key===key){teamUi.syncStatus=tx('計畫已同步','Plan synced');receiveTeam(d);}}
 catch(e){if(teamUi.key===key){teamUi.lastSent=null;teamUi.syncStatus=tx('計畫尚未同步','Plan not synced');if(e.status===409)refreshTeam();}}
 finally{if(teamUi.key===key)teamUi.inflight=false;if(teamUi.key===key&&teamCanEdit()&&JSON.stringify(teamUi.plan)!==teamUi.lastSent){clearTimeout(teamUi.draftTimer);teamUi.draftTimer=setTimeout(sendTeamDraft,100);}}
}
function teamRoleLabel(slot){const s=teamSlot(slot);return s.material+' · '+bandLabel(s.field);}
function teamName(team){return tx('隊伍 '+team.toUpperCase(),'Team '+team.toUpperCase());}
function teamPlayerName(p){return p.computer?tx('電腦 · ','CPU · ')+teamRoleLabel(p.slot):p.profile?.displayName||tx('訪客 '+p.slot.toUpperCase(),'Guest '+p.slot.toUpperCase());}
function teamPreviewBoard(d){const board={...d.board};if(d.stage==='plan')for(const [slot,action] of [[d.yourSlot,teamUi.plan],[d.visibleOpponent.slot,d.visibleOpponent.action]])for(const [field,delta] of Object.entries(teamOffsets(action,slot)))board[teamBandKey(slot,field)]+=delta;return board;}
function teamGraphSVG(board,d){
 const width=window.innerWidth<600?390:590,mid=width/2,left=30,right=width-25,cxA=(left+mid)/2,cxB=(mid+right)/2;
 $('teamGraph').setAttribute('viewBox','0 0 '+width+' 340');
 const relative=teamRelativeBoard(board),model=carrierModel(relative.ec*.02,relative.ev*.02),y=e=>38+(2.1-e)*100;
 let svg='<title>'+tx('四人共用的能帶圖','Shared four-player band diagram')+'</title><path d="M20 28V308H'+(width-12)+'" fill="none" stroke="#7788a3"/><path d="M'+mid+' 28V308" stroke="#344157" stroke-dasharray="4 5"/>';
 const txt=(x,yy,t,color='#afbdd0',size=14)=>'<text x="'+x+'" y="'+yy+'" fill="'+color+'" font-size="'+size+'" text-anchor="middle">'+htmlText(t)+'</text>';
 svg+=txt(cxA,14,tx('材料 A','Material A'),'#e7efff',17)+txt(cxB,14,tx('材料 B','Material B'),'#e7efff',17);
 for(const [field,carrier,color,base] of [['ec','e','#7eb6ff',1.6],['ev','h','#ff95a7',0]]){
  const ya=y(base+board['a'+(field==='ec'?'Ec':'Ev')]*.02),yb=y(base+board['b'+(field==='ec'?'Ec':'Ev')]*.02);
  const selectable=teamCanEdit()&&(d.rulesVersion>=2||field===d.controlled),selected=d.stage==='plan'&&teamSelectedField(d)===field,path='M'+left+' '+ya+'H'+mid+'V'+yb+'H'+right;
  if(selected)svg+='<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="13" opacity=".13" pointer-events="none"/>';
  svg+='<path data-band="'+field+'" d="'+path+'" fill="none" stroke="'+color+'" stroke-width="'+(selected?3.5:2)+'" pointer-events="none"/>';
  const fraction=carrier==='e'?model.electronB:model.holeB;
  for(let i=0;i<16;i++){
   const t=(i+.5)/16,blend=Math.max(0,Math.min(1,(fraction-(1-t))/.14+.5)),ease=blend*blend*(3-2*blend);
   const xa=left+8+(mid-left-16)*t,xb=mid+8+(right-mid-16)*t,x=xa+(xb-xa)*ease;
   const yy=ya+(yb-ya)*ease+(carrier==='e'?-1:1)*(14+(i%2)*11);svg+=carrierSkinSVG(activeSkin(carrier),carrier,x,yy,4.5);
  }
  svg+=txt(cxA,ya+48,(carrier==='e'?tx('電子 ','e− '):tx('電洞 ','h+ '))+pct(1-fraction),color,14)+txt(cxB,yb+48,(carrier==='e'?tx('電子 ','e− '):tx('電洞 ','h+ '))+pct(fraction),color,14);
  if(d.stage==='plan')svg+=txt(mid,Math.min(ya,yb)-(field==='ec'?36:10),(field==='ec'?tx('導帶','Conduction'):tx('價帶','Valence'))+(selected?tx(' · 已選擇',' · Selected'):selectable?tx(' · 點選調整',' · Tap to edit'):''),color,11);
  if(selectable)svg+='<g class="team-band-hit" role="button" tabindex="0" data-team-band="'+field+'" aria-pressed="'+selected+'" aria-label="'+htmlText(tx('選擇','Select ')+bandLabel(field))+'"><rect x="22" y="'+(Math.min(ya,yb)-32)+'" width="'+(width-38)+'" height="'+(Math.abs(ya-yb)+64)+'" fill="transparent"/></g>';
 }
 for(const p of d.players.filter(p=>p.joined)){
  const slot=teamSlot(p.slot),xx=slot.team==='a'?cxA:cxB,yy=y((slot.field==='ec'?1.6:0)+board[slot.key]*.02)-42;
  svg+='<g data-band-avatar="'+p.slot+'">'+bandAvatarSVG(p.profile,xx,yy,22,teamPlayerName(p)+' · '+teamRoleLabel(p.slot),p.slot===d.yourSlot)+'</g>';
  if(p.slot===d.yourSlot)svg+=txt(xx+20,yy+4,tx('你','You'),'#ffda87',10);
 }
 return svg;
}
function teamReplayOrder(d){return d.history.at(-1).order||TEAM_SLOTS.map(s=>s.id);}
function teamReplayBoards(d){
 const last=d.history.at(-1);if(last.frames)return [...last.frames,last.board];
 const boards=[{...last.startBoard}],board={...last.startBoard};for(const slot of teamReplayOrder(d)){for(const [key,delta] of Object.entries(teamActionDeltas(last.actions[slot])))board[key]+=delta;boards.push({...board});}return [...boards,last.board];
}
function teamPaintGraph(board){
 if(!ui.data||ui.kind!=='team')return;teamUi.displayBoard={...board};const key=JSON.stringify(board)+ui.data.yourSlot+siteLanguage+window.innerWidth+teamSelectedField()+teamCanEdit();if(key===teamUi.graphKey)return;teamUi.graphKey=key;const focused=$('teamGraph').contains(document.activeElement)?document.activeElement?.closest('[data-team-band]')?.dataset.teamBand:null;$('teamGraph').innerHTML=teamGraphSVG(board,ui.data);if(focused)$('teamGraph').querySelector('[data-team-band="'+focused+'"]')?.focus({preventScroll:true});
}
function animateTeamBoard(from,to,duration=650){
 let frame,start,resolve,done=false;const promise=new Promise(r=>resolve=r),finish=ok=>{if(done)return;done=true;cancelAnimationFrame(frame);resolve(ok);};
 if(reducedMotion()){teamPaintGraph(to);finish(true);}else{
  const paint=now=>{start??=now;const t=Math.min(1,(now-start)/duration),ease=t*t*(3-2*t),board={};for(const k of Object.keys(from))board[k]=from[k]+(to[k]-from[k])*ease;teamPaintGraph(board);if(t===1)finish(true);else frame=requestAnimationFrame(paint);};frame=requestAnimationFrame(paint);
 }return {promise,cancel:()=>finish(false)};
}
function teamShowLiveBoard(board){
 const key=JSON.stringify(board);if(teamUi.liveTarget===key){if(!teamUi.liveTask)teamPaintGraph(board);return;}
 teamUi.liveTask?.cancel();teamUi.liveTarget=key;
 if(!teamUi.displayBoard){teamPaintGraph(board);return;}
 const task=animateTeamBoard(teamUi.displayBoard,board,240);teamUi.liveTask=task;task.promise.then(()=>{if(teamUi.liveTask===task)teamUi.liveTask=null;});
}
function teamReplayCaption(d,step){
 if(step===0)return tx('四人出招前','Before all four moves');if(step===5)return tx('本回合合併結果：','Combined result: ')+translated(d.history.at(-1).type);
 const slot=teamReplayOrder(d)[step-1],p=d.players.find(p=>p.slot===slot);return step+'/4 · '+teamPlayerName(p)+' · '+teamRoleLabel(slot);
}
async function playTeamReplay(){
 const d=ui.data,key=teamUi.key,generation=++teamUi.generation,boards=teamReplayBoards(d);teamUi.replayTask?.cancel();teamUi.liveTask?.cancel();teamUi.liveTask=null;teamUi.replaying=true;teamUi.replayStep=0;renderTeam();
 for(const step of [0,1,2,3,4]){
  if(ui.kind!=='team'||teamUi.key!==key||teamUi.generation!==generation)return;teamUi.replayStep=step;renderTeam();
  if(step>0)movementSound();teamUi.replayTask=animateTeamBoard(teamUi.displayBoard||boards[0],boards[step],step===0?220:700);if(!await teamUi.replayTask.promise)return;
 }
 if(ui.kind==='team'&&teamUi.key===key&&teamUi.generation===generation){teamUi.replaying=false;teamUi.replayTask=null;teamUi.replayStep=5;renderTeam();if(d.stage==='finished')soundEffect(d.history.at(-1).decision.winner===d.yourTeam?'win':d.history.at(-1).decision.winner==='draw'?'draw':'loss');}
}
async function selectTeamReplay(step){
 const key=teamUi.key,generation=++teamUi.generation;teamUi.replayTask?.cancel();teamUi.liveTask?.cancel();teamUi.replayStep=step;teamUi.replaying=true;renderTeam();
 const board=teamReplayBoards(ui.data)[step];teamUi.replayTask=animateTeamBoard(teamUi.displayBoard||board,board,550);await teamUi.replayTask.promise;
 if(teamUi.key===key&&teamUi.generation===generation){teamUi.replaying=false;teamUi.replayTask=null;renderTeam();}
}
function renderTeam(){
 const d=ui.data;for(const id of ['lobby','waiting','versus','role','mode','coinScreen','game','closed','lockScreen'])$(id).hidden=true;$('teamPlay').hidden=false;document.body.classList.add('in-team');document.body.classList.remove('is-cover','role-phase');$('game').inert=false;$('gameBrand').hidden=false;$('greetingOpen').hidden=true;$('resultBadge').hidden=true;
 if(!d){$('teamStatus').textContent=tx('同步組隊房間中…','Syncing team room…');return;}
 renderRoomLifecycle(d,true);
 $('teamPlay').dataset.computer=String(d.computer);$('teamPlay').dataset.stage=d.stage;const playing=['plan','revealed','finished'].includes(d.stage),result=['revealed','finished'].includes(d.stage);document.body.classList.toggle('in-game',playing);$('topbar').classList.toggle('playing',playing);$('scoreHeader').hidden=!playing;$('roundHeader').textContent=tx('回合 ','Round ')+d.round+' / '+d.roundLimit;$('setupLeave').hidden=playing;$('leave').hidden=!playing;$('sync').hidden=false;$('error').hidden=!ui.error;$('error').textContent=translated(ui.error);$('teamLobby').hidden=!['lobby','party'].includes(d.stage);$('teamBattle').hidden=!playing;$('teamResults').hidden=!result;$('teamControls').hidden=d.stage!=='plan';$('teamBack').hidden=!['closed','finished'].includes(d.stage);
 $('teamTitle').textContent=d.computer?tx('2v2 練習模式','2v2 practice'):d.matchmaking?d.queueKind==='ranked'?tx('2v2 牌位配對','2v2 Ranked match'):tx('2v2 隨機配對','2v2 Random match'):tx('2v2 房間','2v2 room');$('teamCode').textContent=d.computer?tx('你＋電腦 vs 雙電腦','You + CPU vs two CPUs'):d.code;$('teamRoomNote').textContent=tx('四人共用一張圖 · 同角色對手即時可見 · 隊友計畫保密','One shared diagram · Live same-role opponent · Hidden teammate plans');$('teamFriends').hidden=d.computer||!['lobby','party'].includes(d.stage)||d.matchmaking&&d.stage!=='party'||!d.host;$('teamCopyCode').parentElement.hidden=d.computer||d.matchmaking;$('teamFriends').textContent=tx('加入好友','Add friends');$('teamCopyCode').textContent=tx('複製房號','Copy code');$('teamCopyLink').textContent=tx('複製邀請連結','Copy invite link');$('teamBack').textContent=tx('回到主頁','Home');$('teamStatus').textContent=d.stage==='closed'?tx('這個房間已關閉。','This room is closed.'):d.computer?tx('2v2 練習 · 不計積分與金幣','2v2 practice · No rating or coins'):d.hasComputers?tx('電腦補位 · ','CPU fill · ')+(d.ranked?tx('牌位照常計分','Ranked results count normally'):tx('不影響積分','No rating changes')):d.matchmaking?'':tx('朋友房間不影響積分','Friend rooms do not affect rating');if(!d.matchmaking&&d.timed===false)$('teamStatus').textContent+=tx(' · 無倒數',' · No timer');
 if(['lobby','party'].includes(d.stage)){renderTeamLobby(d);renderTeamPracticeModes(d);renderTeamSkillSelection(d);}
 if(d.stage==='queue')renderTeamQueue(d);else stopWaitingAnimation();
 if(playing){
  $('teamSummary').textContent=teamName(d.yourTeam)+' · '+practiceModeLabel(d.mode)+' · '+tx('任務 ','Mission ')+translated(d.goals[d.yourTeam])+' · '+tx('你是 ','You are ')+teamRoleLabel(d.yourSlot);
  const own=teamOffsets(teamUi.plan,d.yourSlot),cost=d.stage==='plan'?teamPlanInfo(d).cost:0;
  $('teamPointsHud').innerHTML='<span>'+tx('回合 ','Round ')+d.round+' / '+d.roundLimit+'</span><strong>'+Math.min(d.startingPoints,d.yourBudget-cost+(d.stage==='plan'?teamPlanInfo(d).refund||0:0))+' / '+d.startingPoints+tx(' 點',' pts')+'</strong><small>'+tx('本次 ','Cost ')+cost+tx(' 點',' pts')+'</small>';
  if(d.stage==='plan'){teamShowLiveBoard(teamPreviewBoard(d));renderTeamPlan(d);}
  if(result){if(!teamUi.replaying&&teamUi.replayKey===teamUi.key)teamPaintGraph(teamReplayBoards(d)[teamUi.replayStep]);renderTeamResults(d);}
 }
 renderQueueExtras(d);syncTurnClock(d);renderSound();localizeDOM();syncBattleBackground();updateCoverMotion();
}
function renderTeamPlan(d){
 const role=d.controlled,field=teamSelectedField(d),offsets=teamOffsets(teamUi.plan,d.yourSlot),op=d.visibleOpponent,opp=teamOffsets(op.action,op.slot);
 const base=d.board[teamBandKey(d.yourSlot,field)],cap=d.rulesVersion>=2?teamMoveLimit(d,field):Math.min(d.round===1?4:2,d.yourBudget),range=$('teamMoveRange');
 range.min=Math.max(-8,base-cap);range.max=Math.min(8,base+cap);range.value=base+offsets[field];range.disabled=!teamCanEdit();range.dataset.field=field;range.setAttribute('aria-valuetext',signed((base+offsets[field])*.02)+' eV');
 $('teamMoveLabel').textContent=tx('本次修改：','Editing: ')+bandLabel(field)+' · '+(field===role?tx('每格 1 點','1 pt / step'):tx('每格 2 點','2 pts / step'));
 $('teamMoveValue').textContent=signed((base+offsets[field])*.02)+' eV';
 $('teamMinus').disabled=!teamCanEdit()||Number(range.value)<=Number(range.min);$('teamPlus').disabled=!teamCanEdit()||Number(range.value)>=Number(range.max);
 const cost=teamPlanInfo(d).cost;
 $('teamMoveCost').textContent=tx('本次 ','Cost ')+cost+tx(' 點 · 剩餘 ',' points · Left ')+Math.min(d.startingPoints,d.yourBudget-cost+(d.stage==='plan'?teamPlanInfo(d).refund||0:0))+' / '+d.startingPoints;
 $('teamLock').disabled=!teamCanEdit();$('teamLock').textContent=d.yourLocked?tx('已鎖定 · 仍可觀察對手','Locked · keep watching'):tx('鎖定本次計畫','Lock this plan');$('teamHold').disabled=!teamCanEdit();$('teamHold').textContent=tx('保持不動','Hold');
 $('teamOpponent').textContent=tx('可見對手：','Visible opponent: ')+teamRoleLabel(op.slot)+' · '+bandLabel('ec')+' '+signed(opp.ec*.02)+' / '+bandLabel('ev')+' '+signed(opp.ev*.02)+' eV'+(op.locked?tx(' · 已鎖定',' · Locked'):tx(' · 調整中',' · Live'));
 renderTeamSkillControls(d);$('teamPrivacy').textContent=tx('點圖上的導帶／價帶切換本次出招；每人每回合只改一條。隊友計畫保持隱藏。','Tap a band to choose your move. Each player moves one band per round; teammate plans stay hidden.');
 $('teamLockCount').textContent=d.players.filter(p=>p.locked).length+' / 4 '+tx('已鎖定','locked')+' · '+(d.revealOrder||TEAM_SLOTS.map(s=>s.id)).map(teamRoleLabel).join(' → ');
}
function renderTeamResults(d){renderMvpCard(d);renderSkillCast(teamUi.replayStep>=1&&teamUi.replayStep<=4?d.history.at(-1).actions[teamReplayOrder(d)[teamUi.replayStep-1]]:null);
 renderRematchControls(d,true);$('teamBack').textContent=d.canRematch?tx('離開房間並回到主頁','Leave room and return home'):tx('回到主頁','Home');
 const h=d.history.at(-1),winner=h.decision?.winner,order=teamReplayOrder(d),dec=h.decision;
 $('teamFinal').hidden=d.stage!=='finished'||teamUi.replayStep!==5;
 const outcome=winner==='draw'?tx('平手','Draw'):winner===d.yourTeam?tx('你們獲勝！','Your team wins!'):tx('對方隊伍獲勝','Opponent team wins');
 const missions=tx('我方：','Your team: ')+translated(d.goals[d.yourTeam])+tx(' · 對方：',' · Opponents: ')+translated(d.goals[d.yourTeam==='a'?'b':'a']||tx('暫不公開','Hidden'));
 const reason=dec?.reason==='ratio'?tx('同任務已達成，比較兩隊在各自材料中的電子／電洞平均比例。','Both teams met the same mission. Compare mean electron / hole share in each team’s material.'):dec?.reason==='unmatched'?tx('最終排列沒有達成任何一隊的任務。','The final arrangement meets neither mission.'):dec?.reason==='tie'?tx('兩隊任務相同且平均比例相等。','Both missions and mean carrier shares are equal.'):tx('依最後一回合的排列判定勝負。','The final round’s arrangement decides the winner.');
 const ratios=dec?.ratios?tx('隊伍 A ','Team A ')+pct(dec.ratios.a)+tx(' · 隊伍 B ',' · Team B ')+pct(dec.ratios.b):'';
 $('teamFinal').innerHTML='<strong>'+htmlText(outcome)+'</strong><p>'+htmlText(missions)+'</p><small>'+htmlText(reason+(dec?.reason==='ratio'?' '+ratios:''))+'</small>';if(d.stage==='finished'&&(d.ratingResult||d.coinReward)){const rating=d.ratingResult;$('teamFinal').innerHTML+='<p>'+htmlText((rating?tx('積分 ','Rating ')+rating.before+' → '+rating.after+' ('+(rating.change>0?'+':'')+rating.change+') · ':'')+rewardText(d))+'</p>';}$('teamFinal').dataset.outcome=winner===d.yourTeam?'you':winner==='draw'?'draw':'opponent';
 $('teamReplayCaption').textContent=teamReplayCaption(d,teamUi.replayStep);$('teamNext').hidden=d.stage==='finished';$('teamNext').disabled=ui.busy||d.yourReady||teamUi.replaying;$('teamNext').textContent=d.yourReady?tx('等待其他玩家準備','Waiting for other players'):tx('下一回合','Next round');
 $('teamActionList').innerHTML=order.map((slot,i)=>{const a=h.actions[slot],offsets=teamOffsets(a,slot),p=d.players.find(p=>p.slot===slot);return '<div class="'+(teamUi.replayStep===i+1?'active':'')+'"><b>'+(i+1)+'. '+htmlText(teamPlayerName(p))+'<small>'+htmlText(teamRoleLabel(slot))+'</small></b><span>'+htmlText((a.skill?characterName(a.skill)+' · ':'')+bandLabel('ec')+' '+signed(offsets.ec*.02)+' / '+bandLabel('ev')+' '+signed(offsets.ev*.02)+' eV · '+a.cost+tx(' 點',' pts')+(a.clipped?tx(' · 範圍限制',' · Clipped'):'')+(a.refund?' · +'+a.refund+tx(' 點',' pts'):'')+(h.autoLocked.includes(slot)?tx(' · 自動鎖定',' · Auto-locked'):''))+'</span></div>';}).join('');
 if(d.stage==='finished'&&teamUi.replayStep===5&&!teamUi.replaying)presentTeamVerdict();const labels=[tx('出招前','Before'),...order.map(slot=>teamRoleLabel(slot)),tx('結果','Result')];
 $('teamReplayButtons').innerHTML=labels.map((label,i)=>'<button type="button" data-team-replay="'+i+'" aria-pressed="'+(teamUi.replayStep===i)+'">'+label+'</button>').join('')+'<button type="button" data-team-replay="all">'+tx('四人依序重播','Replay all four')+'</button>';
}
function initTeamMode(){
 $('teamEntryClose').addEventListener('click',()=>closeAnimatedDialog($('teamEntry')));$('teamEntry').addEventListener('cancel',e=>{e.preventDefault();closeAnimatedDialog($('teamEntry'));});$('teamPractice').addEventListener('click',()=>connectTeam('computer'));$('teamCreate').addEventListener('click',()=>connectTeam('create'));$('teamJoinForm').addEventListener('submit',e=>{e.preventDefault();connectTeam('join',$('teamJoinCode').value);});$('teamJoinCode').addEventListener('input',e=>e.target.value=normalizeRoomCode(e.target.value).replace(/[^A-Z0-9]/g,'').slice(0,6));$('teamRoster').addEventListener('click',e=>{const b=e.target.closest('[data-team-seat]');if(b&&!b.disabled)teamCommand('seat',{seat:b.dataset.teamSeat});});$('teamRounds').addEventListener('click',e=>{const b=e.target.closest('[data-team-rounds]');if(b&&!b.disabled)teamCommand('settings',{rounds:Number(b.dataset.teamRounds)});});$('teamReady').addEventListener('click',()=>teamCommand('ready',{ready:!ui.data.yourReady}));$('teamTimedSwitch').addEventListener('click',()=>{if(ui.data?.host&&!ui.busy&&!ui.data.matchmaking)teamCommand('settings',{rounds:ui.data.roundLimit,timed:ui.data.timed===false});});$('teamStart').addEventListener('click',()=>teamCommand(ui.data.stage==='party'?'search':'start'));$('teamGraph').addEventListener('click',e=>{const band=e.target.closest('[data-team-band]');if(band)teamChooseBand(band.dataset.teamBand);});$('teamGraph').addEventListener('keydown',e=>{const band=e.target.closest('[data-team-band]');if(band&&['Enter',' '].includes(e.key)){e.preventDefault();teamChooseBand(band.dataset.teamBand);}});$('teamMoveRange').addEventListener('input',e=>teamMove(e.target.value));$('teamMinus').addEventListener('click',()=>teamMove(Number($('teamMoveRange').value)-1));$('teamPlus').addEventListener('click',()=>teamMove(Number($('teamMoveRange').value)+1));$('teamHold').addEventListener('click',()=>{if(!teamCanEdit())return;teamUi.plan=ui.data.rulesVersion>=2?{ec:0,ev:0}:{direction:1,amount:0};renderTeam();queueTeamDraft();});$('teamLock').addEventListener('click',()=>teamCommand('lock'));$('teamNext').addEventListener('click',()=>teamCommand('next'));$('teamBack').addEventListener('click',leave);$('teamFriends').addEventListener('click',openRoomFriendPicker);
 for(const [id,link] of [['teamCopyCode',false],['teamCopyLink',true]])$(id).addEventListener('click',async()=>{try{await navigator.clipboard.writeText(link?location.origin+'/play?team='+ui.data.code:ui.data.code);$(id).textContent=tx('已複製','Copied');}catch{ui.error=tx('請手動分享房號 ','Share this code manually: ')+ui.data.code;render();}});
 $('teamReplayButtons').addEventListener('click',e=>{const b=e.target.closest('[data-team-replay]');if(!b)return;if(b.dataset.teamReplay==='all')playTeamReplay();else selectTeamReplay(Number(b.dataset.teamReplay));});document.addEventListener('band-language',()=>{if($('teamEntry').open){$('teamEntry').close();openTeamEntry();}});
 window.addEventListener('resize',()=>{if(ui.kind==='team'&&ui.data)renderTeam();});$('teamPracticeModeButtons').addEventListener('click',e=>{const b=e.target.closest('[data-team-practice-mode]');if(b&&!ui.busy)teamCommand('settings',{rounds:ui.data.roundLimit,mode:b.dataset.teamPracticeMode});});
}
