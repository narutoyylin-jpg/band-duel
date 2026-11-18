function renderQueueExtras(d){
  renderMatchFormat();$('rankedMatchHint').textContent=tx('無技能 · 需登入 · 依積分尋找對手','No abilities · sign-in required · match by rating');
  $('waitingExtras').hidden=!(['lobby','queue'].includes(d?.stage)&&d.matchmaking);$('waitingPractice').textContent=d?.flow==='team'?tx('2v2 練習 · 配對繼續','2v2 practice · stay in queue'):tx('練習模式 · 配對繼續','Practice · stay in queue');
  $('waitingPractice').disabled=ui.busy;$('waitingExtrasHint').textContent=tx('配對不中斷；找到真人後，自動回到對戰。','Your queue stays active. When a player is found, you return to the match.');
  $('queuePracticeBanner').hidden=!ui.queue;document.body.classList.toggle('queue-practicing',!!ui.queue);
  $('queuePracticeStatus').textContent=(ui.queue?.data.matchKind==='ranked'||ui.queue?.data.queueKind==='ranked')?tx('牌位配對等待中…','Ranked queue active…'):tx('隨機配對等待中…','Random queue active…');$('returnQueue').textContent=tx('回到等待','Back to waiting');$('returnQueue').disabled=ui.busy;
}
async function beginRankedMatch(){
  if(shopState.offline){ui.error=tx('牌位配對需要使用線上版並登入。','Ranked matching requires the online game and sign-in.');render();return;}
  if(!leaderboardState.data)await loadProfileCard();
  if(!leaderboardState.data?.viewer?.signedIn){location.href='/login?return_to=%2Fplay';return;}
  if(teamMatchUi.format==='2v2')openTeamMatchEntry('ranked');else await connect('ranked');
}
function resetPracticeView(){resetTeamUi();stopWaitingAnimation();resetMotion();stopReplay();if(ui.cpuTimer)clearTimeout(ui.cpuTimer);Object.assign(ui,{cpuTimer:null,cpuMatch:null,data:null,kind:null,credentials:null,locking:false,intent:null,coinAnimation:null,replayKey:null,autoReplayKey:null});}
async function startQueuePractice(){
  if(ui.busy||!ui.credentials||!['lobby','queue'].includes(ui.data?.stage)||!ui.data.matchmaking)return;
  ui.queue={credentials:{...ui.credentials},data:ui.data};try{sessionStorage.setItem('band-phone-queue',JSON.stringify(ui.queue.credentials));sessionStorage.removeItem('band-phone-session');}catch{}
  const team=ui.queue.credentials.kind==='team',rounds=ui.queue.data.roundLimit;resetPracticeView();if(team)await connectTeam('computer','',{rounds,mode:'shuffle',abilityMode:ui.queue.data.skills?.enabled?'skills':'classic'},true);else await practice(ui.queue.data.skills?.enabled?'skills':'classic');if(!ui.data)await returnQueuePractice();
}
async function returnQueuePractice(){
  if(!ui.queue||ui.busy)return;const queued=ui.queue;closeTeamPracticeLater();resetPracticeView();ui.queue=null;ui.kind=queued.credentials.kind==='team'?'team':'online';ui.credentials=queued.credentials;
  try{sessionStorage.removeItem('band-phone-queue');}catch{}if(ui.kind==='team')receiveTeam(queued.data);else receive(queued.data);saveSession();await refresh();schedulePoll();
}
async function refreshWaitingMatch(){
  const queued=ui.queue;if(!queued)return;
  try{const team=queued.credentials.kind==='team',view=await (team?teamApi:api)('/'+queued.credentials.code,undefined,queued.credentials);if(ui.queue!==queued)return;
    queued.data=view;if(view.stage==='queue'||!view.joined&&view.stage==='lobby'){renderQueueExtras(ui.data);return;}
    if(view.stage==='closed'){ui.queue=null;try{sessionStorage.removeItem('band-phone-queue');}catch{}ui.error=tx('配對已取消；電腦練習可繼續。','The queue closed. You can continue computer practice.');render();return;}
    if(view.joined){const credentials={...queued.credentials,code:view.code};closeTeamPracticeLater();resetPracticeView();ui.queue=null;ui.kind=team?'team':'online';ui.credentials=credentials;ui.busy=false;
      for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();stopTutorialDemo();
      try{sessionStorage.removeItem('band-phone-queue');}catch{}saveSession();if(team)receiveTeam(view);else receive(view);soundEffect('role');
    }
  }catch(e){if(ui.queue!==queued)return;ui.error=e.message;if([401,403,404,410].includes(e.status)){ui.queue=null;try{sessionStorage.removeItem('band-phone-queue');}catch{}}render();}
}
async function cancelBackgroundQueue(){
  const queued=ui.queue;if(!queued)return true;
  try{await (queued.credentials.kind==='team'?teamApi:api)('/'+queued.credentials.code+'/leave',{...(queued.credentials.kind==='team'?{}:{round:queued.data.round}),requestId:crypto.randomUUID()},queued.credentials);ui.queue=null;try{sessionStorage.removeItem('band-phone-queue');}catch{}return true;}
  catch(e){await refreshWaitingMatch();if(!ui.queue)return true;ui.error=e.message;render();return false;}
}
function restoreWaitingQueue(){try{const queued=JSON.parse(sessionStorage.getItem('band-phone-queue')||'null');if(queued&&/^[A-Z0-9]{6}$/.test(queued.code)&&/^[a-f0-9]{64}$/.test(queued.token)){ui.kind=queued.kind==='team'?'team':'online';ui.credentials=queued;sessionStorage.removeItem('band-phone-queue');saveSession();refresh();}}catch{}}
addTranslations([['請先登入，才能參加牌位配對。','Sign in to enter ranked matching.'],['你已有一場等待中的牌位配對，請先取消。','You are already in a ranked queue. Cancel it first.'],['牌位配對正在同步，請再試一次。','Ranked matching is syncing. Please retry.'],['牌位對局請使用牌位配對，不能用房號加入。','Use Ranked match to join a ranked game. Room-code joining is unavailable.'],['已配對成功，請重新同步後再操作。','You have been matched. Reconnect before making a move.']]);

function closeTeamPracticeLater(){if(ui.kind==='team'&&ui.data?.computer&&ui.credentials){const credentials={...ui.credentials};teamApi('/'+credentials.code+'/leave',{requestId:crypto.randomUUID()},credentials).catch(()=>{});}}
