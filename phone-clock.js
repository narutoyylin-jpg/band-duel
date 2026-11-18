const turnClockState={offset:0,key:null,lastRefresh:0,timer:null,countdownKey:null,warnedSecond:null};
const draftSync={key:null,sequence:0,last:null,timer:null,inflight:false,status:''};
function resetDraftSync(){clearTimeout(draftSync.timer);draftSync.timer=null;draftSync.key=null;draftSync.inflight=false;draftSync.last=null;draftSync.status='';}
function syncTurnClock(d){
 const visible=d?.stage==='plan'&&!!d.clock;$('clockPanel').hidden=!visible;document.body.classList.toggle('has-turn-clock',visible);
 if(!visible){turnClockState.key=null;return;}turnClockState.offset=d.clock.serverNow-Date.now();turnClockState.key=d.code+':'+d.round+':'+d.clock.deadline;paintTurnClock();
}
function paintTurnClock(){
 const d=ui.data,c=d?.clock;if(d?.stage!=='plan'||!c)return;const now=Date.now()+turnClockState.offset,remaining=Math.max(0,c.deadline-now),seconds=Math.min(Math.ceil(c.duration/1000),Math.ceil(remaining/1000));
 $('clockValue').textContent=seconds+'s';$('clockWho').textContent=now<c.startsAt?tx('準備出招','Get ready'):c.turn==='all'?tx('四人同時出招','All four are planning'):c.turn==='you'?tx('你的操作時間','Your turn'):tx('對手操作中','Opponent’s turn');$('clockProgress').style.width=Math.min(100,remaining/c.duration*100)+'%';$('clockPanel').classList.toggle('urgent',seconds<=5);$('clockHint').textContent=ui.kind==='team'?teamUi.syncStatus:draftSync.status||tx('時間到自動鎖定','Auto-lock at zero');
 const key=(d.matchId||d.code)+':'+d.round+':'+c.deadline;if(turnClockState.countdownKey!==key){turnClockState.countdownKey=key;turnClockState.warnedSecond=null;}
 if(!document.hidden&&!d.yourLocked&&['all','you'].includes(c.turn)&&seconds>=1&&seconds<=5&&(turnClockState.warnedSecond===null||seconds<turnClockState.warnedSecond)){turnClockState.warnedSecond=seconds;soundEffect(seconds===1?'countdown-final':'countdown');}
 if(remaining===0&&!ui.busy&&Date.now()-turnClockState.lastRefresh>1000){turnClockState.lastRefresh=Date.now();refresh();}
}
function queuePlanDraft(){
 const d=ui.data;if(!['online','cpu'].includes(ui.kind)||!editable()||!ui.coinSeen.has(phoneMatchKey(d)))return;let action;try{action=normalizeDuelAction(ui.plan);duelActionInfo(gameForPlan(),'player',action);}catch{draftSync.status=tx('逾時沿用有效計畫','Last valid plan at zero');return;}
 const key=ui.kind+':'+phoneMatchKey(d)+':'+d.round;if(draftSync.key!==key){resetDraftSync();draftSync.key=key;draftSync.sequence=d.yourDraftSequence||0;}
 draftSync.sequence=Math.max(draftSync.sequence,d.yourDraftSequence||0);const signature=JSON.stringify(action);if(signature===draftSync.last)return;if(!draftSync.timer&&!draftSync.inflight)draftSync.timer=setTimeout(()=>{draftSync.timer=null;sendPlanDraft(key);},100);
}
async function sendPlanDraft(key){
 draftSync.timer=null;if(draftSync.inflight||draftSync.key!==key||!editable())return;let action;try{action=normalizeDuelAction(ui.plan);duelActionInfo(gameForPlan(),'player',action);}catch{return;}
 const signature=JSON.stringify(action);if(signature===draftSync.last)return;const round=ui.data.round,matchId=ui.data.matchId,credentials=ui.credentials,kind=ui.kind,match=ui.cpuMatch;draftSync.inflight=true;draftSync.last=signature;draftSync.status=tx('同步中…','Syncing…');const sequence=++draftSync.sequence;
 try{
  let view;if(kind==='online')view=await api('/'+credentials.code+'/draft',{round,...(matchId?{matchId}:{}),sequence,action},credentials);else if(match.remote)view=await match.run('draft',{sequence,action});else view=match.draft(action,sequence);
  if(draftSync.key===key&&ui.kind===kind){draftSync.status='';receive(view);}
 }catch(e){if(draftSync.key===key){draftSync.last=null;draftSync.status=tx('計畫尚未同步','Plan not synced');if(e.status===409)refresh();}}
 finally{if(draftSync.key===key)draftSync.inflight=false;if(draftSync.key===key&&editable()&&JSON.stringify(ui.plan)!==draftSync.last){clearTimeout(draftSync.timer);draftSync.timer=setTimeout(()=>sendPlanDraft(key),150);}}
}
function timedPlayTick(){
 if(document.hidden)return;if(ui.kind==='cpu'&&ui.cpuMatch&&!ui.cpuMatch.remote&&!ui.busy&&ui.cpuMatch.advanceClock())receive(awardOfflineCpu(ui.cpuMatch.view()));paintTurnClock();if(ui.kind==='cpu'&&ui.cpuMatch?.remote&&ui.data?.stage==='plan'&&!ui.busy&&Date.now()-turnClockState.lastRefresh>1200){turnClockState.lastRefresh=Date.now();refresh();}
}
function initTimedPlay(){
 turnClockState.timer=setInterval(timedPlayTick,150);window.addEventListener('pagehide',()=>{clearInterval(turnClockState.timer);resetDraftSync();});window.addEventListener('pageshow',()=>{clearInterval(turnClockState.timer);turnClockState.timer=setInterval(timedPlayTick,150);});
}
