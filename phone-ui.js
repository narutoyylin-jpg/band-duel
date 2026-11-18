function privateBoard(d){
  const board={...d.board};if(d.stage==='plan'&&(editable()||d.yourLocked))try{const info=duelActionInfo(gameForPlan(),'player',ui.plan);applyDuelAction(board,info);}catch{}return board;
}
function particlePositions(board,carrier,y){
  const r=carrierModel(board.ec*.02,board.ev*.02),fb=carrier==='e'?r.electronB:r.holeB,nA=Math.round((1-fb)*12);
  return Array.from({length:12},(_,i)=>{const inA=i<nA,n=inA?nA:12-nA,index=inA?i:i-nA,x=(inA?43:202)+12+127*(index+.5)/Math.max(1,n),edge=y((carrier==='e'?1.6:0)+(inA?0:board[carrier==='e'?'ec':'ev']*.02));return {x,y:edge+(carrier==='e'?-1:1)*(8+(i%2)*7)};});
}
function bandSVG(board,{controlled=null,can=false,trial=board,previous=null,movement=null,tween=null,activeField=null,round=1}={}){
  const r=carrierModel(trial.ec*.02,trial.ev*.02),y=e=>30+(2.2-e)*66;
  const text=(x,yy,s,color='var(--muted)',anchor='start',size=10)=>'<text x="'+x+'" y="'+yy+'" fill="'+color+'" text-anchor="'+anchor+'" font-size="'+size+'" pointer-events="none">'+s+'</text>';
  let svg='<title>'+tx('能帶與載子分布','Bands and carrier distribution')+'</title><desc>'+tx('藍色導帶、實心電子；紅色價帶、空心電洞。虛線是改動前的位置；標記顯示各自控制的能帶。','Blue: conduction band and filled electrons. Red: valence band and hollow holes. Dashed lines show the previous position; badges identify who controls each band.')+'</desc>'+text(118,17,tx('材料 A','Material A'),'var(--text)','middle',15)+text(275,17,tx('材料 B','Material B'),'var(--text)','middle',15)+text(6,17,'E (eV)','var(--text)','start',12);
  for(let e=-.5;e<=2;e+=.5){const yy=y(e);svg+='<path d="M39 '+yy+'H43" stroke="var(--muted)"/>'+text(34,yy+3,e.toFixed(1),'var(--muted)','end',11);}
  svg+='<path d="M43 25V242H357m-5-4 5 4-5 4M39 30l4-5 4 5" stroke="var(--axis)" fill="none"/><path d="M202 27V242" stroke="var(--line)" stroke-dasharray="2 3"/>';
  for(const [f,color,carrier] of [['ec','var(--ec)','e'],['ev','var(--ev)','h']]){
    const aa=y(f==='ec'?1.6:0),bb=y((f==='ec'?1.6:0)+board[f]*.02),pb=y((f==='ec'?1.6:0)+trial[f]*.02),active=activeField===f;
    if(can&&(round>1||f===controlled))svg+='<g role="button" tabindex="0" data-graph-band="'+f+'" aria-pressed="'+active+'" aria-label="'+(f===controlled?tx('修改你的','Edit your '):tx('干擾對手的','Interfere with opponent’s '))+bandLabel(f)+'"><rect x="43" y="'+(Math.min(aa,bb,pb)-24)+'" width="389" height="'+(Math.max(aa,bb,pb)-Math.min(aa,bb,pb)+65)+'" fill="transparent" style="cursor:pointer"/></g>';
    const name=f==='ec'?tx('導帶','Conduction'):tx('價帶','Valence');
    svg+='<path d="M43 '+aa+'H202V'+bb+'H347" stroke="'+color+'" stroke-width="'+(can&&active?'2.4':'1.7')+'" fill="none" pointer-events="none"/>'+text(357,bb+3,name,color,'start',13);
    if(siteLanguage==='en')svg+=text(357,bb+18,'band',color,'start',12);
    if(controlled){const mine=f===controlled,label=mine?tx('你','YOU'):tx('對手','OPPONENT');if(mine)svg+='<rect x="353" y="'+(bb+23)+'" width="78" height="18" rx="5" fill="var(--surface)" stroke="'+color+'"/>';svg+=text(392,bb+36,label,mine?color:'var(--muted)','middle',11);}
    if(previous&&previous[f]!==board[f]){
      const old=y((f==='ec'?1.6:0)+previous[f]*.02),delta=(tween?tween.to[f]-tween.from[f]:board[f]-previous[f])*.02;
      svg+='<path d="M202 '+old+'H347" stroke="'+color+'" stroke-opacity=".5" stroke-dasharray="4 3" fill="none"/>'+text(275,Math.min(old,bb)-23,(movement==='you'?tx('你的改動 ','Your move '):tx('對手改動 ','Opponent move '))+signed(delta)+' eV',color,'middle',11);
    }
    if(trial[f]!==board[f])svg+='<path d="M202 '+pb+'H347" stroke="'+color+'" stroke-width="1.4" stroke-dasharray="3 3" fill="none"/>'+text(345,pb-23,tx('你的秘密改動','Your private move'),color,'end',11);
    const fb=carrier==='e'?r.electronB:r.holeB,points=particlePositions(trial,carrier,y),start=tween?(tween.startPoints?.[carrier]||particlePositions(tween.from,carrier,y)):null,end=tween?particlePositions(tween.to,carrier,y):null;
    points.forEach((point,i)=>{if(tween)point={x:start[i].x+(end[i].x-start[i].x)*tween.progress,y:start[i].y+(end[i].y-start[i].y)*tween.progress};svg+=carrierSkinSVG(ui.data?.carrierSkins?.[carrier]||activeSkin(carrier),carrier,point.x,point.y);});
    const label=carrier==='e'?tx('電子 ','e− '):tx('電洞 ','h+ ');svg+=text(118,aa+32,label+pct(1-fb),color,'middle',13)+text(275,pb+32,label+pct(fb),color,'middle',13);
  }
  return svg+text(202,261,tx('介面','Interface'),'var(--muted)','middle',10)+text(348,276,tx('位置 x','Position x'),'var(--muted)','end',11);
}
const bandLabel=f=>f==='ec'?tx('導帶','conduction band'):tx('價帶','valence band');
function graph(board,showDraft,previous=null,movement=null,tween=null){
  if(ui.data.stage==='plan'){renderDraftGraph(ui.data,showDraft);return;}stopDraftMotion();
  const d=ui.data;$('playGraph').innerHTML=playBandSVG(board,{controlled:d.controlled,can:editable(),trial:showDraft?privateBoard(d):board,previous,movement,tween,activeField:ui.plan.kind==='hold'?null:ui.plan.kind==='attack'?otherBand(d.controlled):d.controlled,round:d.round});
}
function fillResultInfo(d,r,last){
  const q=d.goal,decision=last.decision,who=decision?.winner==='you'?tx('你','you'):tx('對手','your opponent');
  $('gains').textContent=tx('第 ','Round ')+d.round+' / '+(d.roundLimit||5)+' · '+(d.stage==='finished'?tx('本局最終判定','Final verdict'):tx('尚未決勝','No winner yet'));
  $('resultMission').textContent=tx('你的任務：','Your mission: ')+missionText(q);
  $('resultOpponentMission').hidden=d.stage!=='finished';$('resultOpponentMission').textContent=d.stage==='finished'?tx('對手任務：','Opponent mission: ')+missionText(d.opponentGoal):'';
  $('resultRating').hidden=d.stage!=='finished';$('resultRating').textContent=d.stage==='finished'?ratingSummary(d):'';
  $('resultVerdict').textContent=d.stage!=='finished'?tx('前面回合只公開能帶與動作；第 '+(d.roundLimit||5)+' 回合完成後才決勝。','Earlier rounds reveal bands and moves; only round '+(d.roundLimit||5)+' decides the winner.'):decision?.reason==='boundary'?tx('最後電子或電洞在 A、B 各 50%，'+who+'達成邊界任務，因此獲勝。','The final electrons or holes are 50/50 in A and B. '+who+' wins the Boundary mission.'):decision?.reason==='ratio'?tx('最後符合共同任務；'+who+'控制的載子集中比例較高，因此獲勝。','The final bands match both missions. '+who+' won with the higher controlled-carrier share.'):decision?.reason==='type'?tx('最後 Type 符合'+who+'的任務，因此獲勝。','The final Type matches the mission of '+who+', who won.'):decision?.reason==='tie'?tx('最後符合共同任務，但雙方控制的載子比例相同，所以平手。','Both missions are achieved, but controlled-carrier shares are equal: a draw.'):tx('最後不符合任何人的任務，所以平手；途中曾達成也不算獲勝。','The final bands match neither mission: a draw, even if a move briefly reached the target.');
  for(const [prefix,fb] of [['electron',r.electronB],['hole',r.holeB]]){$(prefix+'Shares').textContent='A '+pct(1-fb)+' / B '+pct(fb);$(prefix+'A').style.width=(1-fb)*100+'%';$(prefix+'B').style.width=fb*100+'%';}
  $('quality').textContent=decision?tx('最終比較比例：你 ','Final comparison: you ')+pct(decision.yourRatio)+' / '+tx('對手 ','opponent ')+pct(decision.opponentRatio)+tx('。同 Type 時直接依這兩個比例決勝。','. Matching missions always compare these shares.'):tx('這是目前回放步驟的比例。','These shares belong to the selected replay step.');
  $('ownMove').textContent=tx('你的動作：','Your move: ')+actionText(last.yourAction);$('opponentMove').textContent=tx('對手動作：','Opponent move: ')+actionText(last.opponentAction);
  $('revealOrder').textContent=tx('實際出招順序：','Actual turn order: ')+(last.firstStarter==='you'?tx('你 → 對手','you → opponent'):tx('對手 → 你','opponent → you'))+tx('。動畫先播放你的改動；勝負只依最後的 Type 與載子比例判定。','. The animation shows your move first. Victory depends on the final Type and carrier shares.');
  $('history').innerHTML=d.history.map(h=>'<li>'+tx('第 ','Round ')+h.round+' · '+visualType(h)+'<br>'+tx('你：','You: ')+actionText(h.yourAction)+'<br>'+tx('對手：','Opponent: ')+actionText(h.opponentAction)+'</li>').join('');
}
function renderGame(d){
  const result=['revealed','finished'].includes(d.stage),can=editable(),showDraft=!result&&(can||d.yourLocked),q=d.goal;
  $('game').classList.toggle('result-view',result);$('resultBadge').hidden=!result;$('roundHeader').textContent=tx('回合 ','Round ')+d.round+' / '+(d.roundLimit||5);
  $('planning').hidden=result;$('results').hidden=!result;$('missionCard').hidden=false;renderDuelHud(d);$('preview').hidden=result;
  if(result){
    const last=d.history.at(-1),boards=resultBoards(last),step=ui.replayStep,selected=ui.replayFrame?.board||boards[Math.min(2,step)],r=carrierModel(selected.ec*.02,selected.ev*.02),actor=step===1?'you':'opponent';
    graph(selected,false,step>0&&step<3?boards[step-1]:null,step>0&&step<3?actor:null,ui.replayFrame?{from:ui.replayFrame.from,to:ui.replayFrame.to,progress:ui.replayFrame.progress}:null);
    document.querySelectorAll('[data-replay-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.replayStep)===step)));
    $('replayToggle').textContent=ui.replayPlaying?'Ⅱ':'▶';$('replayToggle').setAttribute('aria-label',ui.replayPlaying?tx('暫停動畫','Pause animation'):tx('播放動畫','Play animation'));
    $('replayCaption').textContent=step===0?tx('出招前的公開能帶','Public bands before the moves'):step===3?tx('雙方改動合併後的結果','Result after both moves'):tx(actor==='you'?'你 · ':'對手 · ',actor==='you'?'You · ':'Opponent · ')+actionText(actor==='you'?last.yourAction:last.opponentAction);
    renderSkillCast(step===1?last.yourAction:step===2?last.opponentAction:null);$('resultType').textContent=(step===3?tx('回合結果：','Round result: '):tx('此步結果：','Step result: '))+visualType(r);fillResultInfo(d,r,last);
    const decision=last.decision;$('next').hidden=d.stage==='finished';$('next').disabled=ui.busy||d.yourReady||ui.replayPlaying;$('newGame').hidden=d.stage!=='finished'||!motion.verdictAcknowledged;$('newGame').disabled=ui.busy||ui.replayPlaying;$('newGame').textContent=d.canRematch?tx('離開房間並回到主頁','Leave room and return home'):tx('回到主頁','Home');renderRematchControls(d);$('final').hidden=d.stage!=='finished'||step!==3;
    $('final').innerHTML=(decision?.winner==='you'?tx('你獲勝！','You win!'):decision?.winner==='opponent'?tx('對手獲勝','Opponent wins'):tx('平手','Draw'))+' · '+tx('最終 ','Final ')+visualType({type:last.type})+(d.goal?.type===d.opponentGoal?.type?'<small>'+tx('你 ','You ')+pct(decision.yourRatio)+' · '+tx('對手 ','Opponent ')+pct(decision.opponentRatio)+'</small>':'');
    $('finalMissions').hidden=d.stage!=='finished'||step!==3;$('finalMissions').textContent=d.stage==='finished'?tx('你：','You: ')+q.type+' · '+tx('對手：','Opponent: ')+(d.opponentGoal?.type||'—'):'';
    $('ratingResult').hidden=d.stage!=='finished'||step!==3||ui.kind==='cpu';$('ratingResult').textContent=ratingSummary(d);
    $('coinReward').hidden=d.stage!=='finished'||step!==3||!d.coinReward;$('coinReward').textContent=rewardText(d);
    $('final').dataset.outcome=decision?.winner||'draw';$('resultStatus').textContent=d.stage==='finished'?'':d.yourReady?tx('等待對方準備下一回合','Waiting for opponent to get ready'):'';presentVerdict();return;
  }
  graph(d.board,showDraft);const r=carrierModel((showDraft?privateBoard(d):d.board).ec*.02,(showDraft?privateBoard(d):d.board).ev*.02);
  $('preview').innerHTML='<strong>'+tx('目前結果：','Current result: ')+visualType(r)+'</strong><span class="private-mark">'+(showDraft?tx('私人預測','Private preview'):tx('已公開','Public'))+'</span>';
  const b=battleSliderBounds(gameForPlan()),target=b.baseline+(ui.plan.kind==='hold'?0:ui.plan.direction*ui.plan.amount);let info,error='';try{info=duelActionInfo(gameForPlan(),'player',ui.plan);}catch(e){error=e.message;}
  $('control').classList.toggle('ev',b.field==='ev');$('offsetLabel').textContent=(ui.plan.kind==='attack'?tx('干擾 · ','Interfere · '):'')+bandLabel(b.field)+(b.field==='ec'?' ΔEc':' ΔEv');$('offsetValue').innerHTML=signed(target*.02)+' <small>eV</small>';
  $('offset').min=b.min;$('offset').max=b.max;$('offset').value=target;$('offset').disabled=!can||ui.plan.kind==='hold';$('offset').setAttribute('aria-valuetext',signed(target*.02)+' eV');$('minus').disabled=!can||target<=b.min||ui.plan.kind==='hold';$('plus').disabled=!can||target>=b.max||ui.plan.kind==='hold';
  $('offsetScale').innerHTML=Array.from({length:b.max-b.min+1},(_,i)=>'<span>'+signed((b.min+i)*.02)+'</span>').join('');$('cost').textContent=error?translated(error):can||d.yourLocked?tx('本次 '+info.cost+' 點 · 剩 '+(d.yourBudget-info.cost)+' 點','Cost '+info.cost+' · '+(d.yourBudget-info.cost)+' left'):'';
  $('hold').hidden=d.round===1;$('hold').disabled=!can;$('hold').textContent=ui.plan.kind==='hold'?tx('返回修改','Edit move'):tx('保留點數','Hold');$('lock').hidden=!can;$('lock').disabled=!!error;
  renderSkillControls(d);
  $('turnStatus').hidden=can||d.yourLocked;$('turnStatus').textContent=ui.busy?tx('同步中…','Syncing…'):ui.kind==='cpu'?tx('電腦正在出招…','Computer is choosing…'):tx('等待先手鎖定，之後輪到你','Waiting for the first player to lock');
}
function renderRoles(d){
  $('role').hidden=false;renderCharacterSelection(d);const mine=d.yourProfile||leaderboardState.data?.viewer?.profile,avatar=$('roleAvatar'),chosen=d.controlled||ui.roleChoicePending;setAvatarElement(avatar,mine,'role-flying-avatar'+(chosen?' to-'+chosen:''));for(const f of ['ec','ev']){const own=f===d.controlled,el=$(f==='ec'?'roleEc':'roleEv');el.classList.toggle('pending',!!d.controlled&&!own);el.setAttribute('aria-pressed',String(own));el.disabled=ui.busy||d.stage==='mode'||d.yourReady||!!d.controlled&&!own;$(f==='ec'?'roleEcWho':'roleEvWho').textContent=own?tx('你','You'):'';const other=$(f==='ec'?'roleEcOpponent':'roleEvOpponent');other.innerHTML=d.controlled&&!own?avatarMarkup(d.opponentProfile,'small')+'<span>'+htmlText(d.opponentProfile?.displayName||d.opponentName||tx('對手','Opponent'))+'</span>':'';}
  $('roleStatus').textContent=d.stage==='mode'?'':d.yourReady?tx('等待對方確認','Waiting for confirmation'):d.controlled?tx('對方已選擇角色，點選另一半確認','Tap the remaining band to confirm'):'';
}
function renderModeChoices(d){
 const practice=ui.kind==='cpu',heading=$('mode').querySelector('h2');if(heading)heading.textContent=practice?tx('練習組合','Practice pairing'):tx('正式對戰 · Shuffle','Official match · Shuffle');
 $('roundsLabel').textContent=tx('選擇回合數','Choose match length');$('roundsBudget').textContent=tx('每人 '+DUEL_LENGTHS[ui.selectedRounds]+' 行動點',DUEL_LENGTHS[ui.selectedRounds]+' action points each');
 document.querySelectorAll('[data-rounds]').forEach(b=>{const n=Number(b.dataset.rounds);b.textContent=tx(n+' 回合',n+' rounds');b.setAttribute('aria-pressed',String(ui.selectedRounds===n));b.disabled=ui.busy||!d.canChooseMode;});
 document.querySelectorAll('[data-mode]').forEach(b=>{b.hidden=!practice&&b.dataset.mode!=='shuffle';b.textContent=practice?practiceModeLabel(b.dataset.mode):tx('開始 Shuffle 對戰','Start Shuffle match');});
}
function render(){
  if(ui.kind==='team'){renderTeam();return;}document.body.classList.remove('in-team');$('teamPlay').hidden=true;$('teamQueueRoster').hidden=true;
  const previousPanels=beforeMotionRender();
  const d=ui.data,stage=d?.stage,playing=['plan','revealed','finished'].includes(stage),showCoin=stage==='plan'&&d.round===1&&!ui.coinSeen.has(phoneMatchKey(d)),locked=stage==='plan'&&(d.yourLocked||ui.locking);
  for(const id of ['lobby','waiting','versus','role','mode','coinScreen','game','closed'])$(id).hidden=true;
  document.body.classList.toggle('in-game',playing);document.body.classList.toggle('role-phase',['role','mode'].includes(stage));document.body.classList.toggle('is-cover',!d);$('topbar').classList.toggle('playing',playing);$('scoreHeader').hidden=!playing;$('gameBrand').hidden=!d;$('resultBadge').hidden=!['revealed','finished'].includes(stage);
  $('lockScreen').hidden=!locked;$('lockStatus').textContent=ui.locking&&!d?.yourLocked?tx('鎖定中…','Locking…'):tx('已鎖定','Locked');$('game').inert=locked||showCoin;$('topbar').inert=false;
  $('setupLeave').hidden=!d||playing;$('leave').hidden=!playing;$('sync').hidden=!ui.credentials;$('error').hidden=!ui.error;$('error').textContent=translated(ui.error);for(const id of ['create','match','rankedMatch','practice','codeInput'])$(id).disabled=ui.busy;
  renderQueueExtras(d);renderHomeLayout();renderRoomWaiting(d);renderRoomLifecycle(d);
  if(!d){$('lobby').hidden=false;$('lobbyQueue').textContent=tx('等待人數：','Waiting line: ')+(ui.queueCount??'—');}
  else if(stage==='lobby'){
    $('waiting').hidden=false;$('waitingTitle').textContent=d.matchKind==='ranked'?tx('牌位配對','Ranked match'):d.matchmaking?tx('隨機配對','Random match'):tx('房間代號','Room number');$('waitingHeading').textContent=d.matchmaking?tx('等待配對','Waiting for match'):tx('等待朋友加入','Waiting for friend');$('waitingText').textContent=d.matchKind==='ranked'?tx('尋找積分接近的玩家 · 目前範圍 ±'+d.searchRange+' 分','Finding a similar rating · current range ±'+d.searchRange+' pts'):d.matchmaking?tx('等待另一位玩家','Waiting for another player'):tx('讓另一支手機輸入房號','Enter this code on the other phone');$('waitingCode').textContent=d.code;$('waitingCode').hidden=d.matchmaking;$('copyCode').hidden=d.matchmaking;$('copyInvite').hidden=d.matchmaking;$('queueCount').hidden=!d.matchmaking;$('queueCount').textContent=d.matchKind==='ranked'?tx('等待越久，搜尋範圍逐步擴大。','The search range expands with waiting time.'):tx('等待人數：','Waiting line: ')+d.waitingPlayers;$('cancelWait').disabled=ui.busy;
  }else if(['role','mode'].includes(stage)){
    if(!ui.introSeen.has(introKey(d))){$('versus').hidden=false;renderVersus(d);}else{renderRoles(d);if(stage==='mode'){$('mode').hidden=false;renderModeChoices(d);$('modeStatus').hidden=d.canChooseMode;$('modeStatus').textContent=tx('等待房主選擇','Waiting for host to choose');document.querySelectorAll('[data-mode]').forEach(b=>b.disabled=ui.busy||!d.canChooseMode);}}
  }else if(stage==='closed')$('closed').hidden=false;
  else{
    $('game').hidden=false;renderGame(d);if(showCoin){
      $('coinScreen').hidden=false;const firstBand=d.firstStarter==='you'?d.controlled:otherBand(d.controlled);$('coin').classList.toggle('ev',firstBand==='ev');$('coinBand').innerHTML=firstBand==='ec'?tx('導帶','Conduction<br>band'):tx('價帶','Valence<br>band');$('coinTitle').textContent=bandLabel(firstBand)+' · '+(d.firstStarter==='you'?tx('你先操作','You start'):tx('對手先操作','Opponent starts'));$('coinText').textContent=tx('本局每回合都由這條能帶先出招','This band starts every round');
      const coinKey=phoneMatchKey(d);if(ui.coinAnimation!==coinKey){ui.coinAnimation=coinKey;soundEffect('coin');$('coinCard').classList.add('tossing');$('coinContinue').disabled=true;setTimeout(()=>{if(ui.coinAnimation===coinKey){$('coinCard').classList.remove('tossing');$('coinContinue').disabled=false;}},1500);}
    }
  }renderCoverProfile();localizeDOM();renderCoverInteraction();afterMotionRender(previousPanels);updateCoverMotion();syncWaitingAnimation();syncBattleBackground();syncGreetings(d);syncTurnClock(d);queuePlanDraft();
}
