const battle=makeDuel();
let beforeBattle=[state.ec,state.ev];
function setBattleSlider(value){
  if(!battle.active||battle.stage!=='plan')return;
  const bounds=battleSliderBounds(battle),target=Math.max(bounds.min,Math.min(bounds.max,Math.round(Number(value)))),delta=target-bounds.baseline;
  battle.plan={kind:battle.plan.kind,direction:delta<0?-1:1,amount:Math.abs(delta)};update();
}
function changeBattleKind(kind){
  if(!battle.active||battle.stage!=='plan')return;
  if(kind==='hold')battle.plan={kind:'hold',direction:1,amount:0};
  else{const bounds=battleSliderBounds(battle,kind),delta=battle.plan.direction*(battle.plan.amount||1),target=Math.max(bounds.min,Math.min(bounds.max,bounds.baseline+delta));battle.plan={kind,direction:target<bounds.baseline?-1:1,amount:Math.abs(target-bounds.baseline)};}
  update();
}
function duelActionText(a){return a.kind==='hold'?'保留點數（0 點）':(a.kind==='attack'?'干擾':'設計／調整')+bandName(a.field)+' '+signed(a.delta*.02)+' eV（'+a.cost+' 點）';}
function leaveBattle(){if(battle.active){battle.active=false;state.ec=beforeBattle[0];state.ev=beforeBattle[1];}}
function syncBattle(){state.ec=Math.round(battle.board.ec*2)/100;state.ev=Math.round(battle.board.ev*2)/100;update();}
function enterBattle(){if(!battle.active)beforeBattle=[state.ec,state.ev];room.active=false;stopRoomPolling();if(!battle.started)return startBattle();battle.active=true;syncBattle();return readBattle();}
function prepareBattleRound(){
  battle.cpuPlan=chooseCpuPlan(battle);
  const q=duelGoal(battle,'player'),desired=battle.controlled==='ec'?(q.eSide==='B'?-1:1):(q.hSide==='B'?1:-1);
  const preferred={kind:'own',direction:desired,amount:battle.round===1?3:1},legal=duelActions(battle,'player');
  battle.plan=legal.find(a=>a.kind===preferred.kind&&a.direction===preferred.direction&&a.amount===preferred.amount)||legal.find(a=>a.kind==='own')||{kind:'hold',direction:1,amount:0};battle.tip=false;
}
function startBattle(controlled=Math.random()<.5?'ec':'ev',goals=shuffleGoals()){
  const fresh=makeDuel(controlled,goals);if(!battle.active)beforeBattle=[state.ec,state.ev];
  Object.assign(battle,fresh,{started:true,active:true,stage:'plan'});room.active=false;stopRoomPolling();prepareBattleRound();syncBattle();return readBattle();
}
function planBattle(input){if(!battle.active||!battle.started||battle.stage!=='plan')throw Error('請先開始一個可出招的回合。');const plan=normalizeDuelAction(input);duelActionInfo(battle,'player',plan);battle.plan=plan;update();return readBattle();}
function commitBattle(){const next=resolveDuel(battle,battle.plan,battle.cpuPlan);Object.assign(battle,next);syncBattle();return readBattle();}
function nextBattle(){if(!battle.active||battle.stage!=='revealed')throw Error('請先揭曉目前回合，或開始新對戰。');battle.round++;battle.stage='plan';prepareBattleRound();syncBattle();return readBattle();}
function readBattle(){
  return {active:battle.active,started:battle.started,round:battle.round,totalRounds:5,stage:battle.stage,controlledBand:battle.controlled,mission:battle.mission,revealedOffsets_eV:{conduction:battle.board.ec*.02,valence:battle.board.ev*.02},playerBudget:battle.playerBudget,computerBudget:battle.cpuBudget,playerScore:battle.playerScore,computerScore:battle.cpuScore,playerGoal:duelGoal(battle,'player'),computerGoal:duelGoal(battle,'cpu'),yourPlan:{...battle.plan},computerCommitted:battle.stage==='plan',history:battle.history.map(e=>({...e,board:{conduction_eV:e.board.ec*.02,valence_eV:e.board.ev*.02}}))};
}
function battleAnalysis(){
  if(!battle.started||battle.round===1&&battle.stage==='plan')return '第一回合還沒有對手的公開設計。先選擇導向目標載子的方向；較大的台階會消耗更多點數，設計回合不計分。';
  const q=duelGoal(battle,'player'),weak=q.eShare<=q.hShare?'ec':'ev',own=weak===battle.controlled;
  return '就已揭曉的圖，你最接近的目標是電子在 '+q.eSide+'、電洞在 '+q.hSide+'。目前較弱的是'+(weak==='ec'?'電子分布':'電洞分布')+'（'+pct(Math.min(q.eShare,q.hShare))+'）；調整'+bandName(weak)+'往有利方向最能補強。'+(own?'這是你的能帶，修改較省點數。':'這是對手的能帶，要透過干擾修改，花費較高。')+' 這個分析不含對手本回合的秘密動作。';
}
function renderBattle(){
  const active=battle.active;$('battlePanel').hidden=!active;$('battleControls').hidden=!active;$('battleHistory').hidden=!active||!battle.history.length;$('battlePublicNote').hidden=!active;$('battleFeedback').hidden=!active;
  $('battlePanel').classList.toggle('playing',battle.started&&battle.stage!=='finished');$('battleReset').hidden=!battle.started;
  document.querySelector('main').classList.toggle('battle-active',active);$('battleMode').setAttribute('aria-pressed',String(active));$('controlHeading').textContent=active?'你的秘密動作':'調整能帶位差';
  $('ecSlider').disabled=active;$('evSlider').disabled=active;document.querySelectorAll('[data-control]').forEach(b=>b.disabled=active);
  if(!active)return;
  $('battleStart').textContent='Shuffle · 再開一局';
  $('battleRound').textContent=!battle.started?'設定任務':battle.stage==='finished'?'結束 · '+(battle.playerScore>battle.cpuScore?'你獲勝':battle.playerScore<battle.cpuScore?'電腦獲勝':'平手'):'第 '+battle.round+' / 5 回合'+(battle.round===1?' · 設計':' · 攻防');
  const publicOutcome=duelOutcome(battle),planning=battle.started&&battle.stage==='plan';
  $('battleVisibility').textContent=!battle.history.length?'雙方設計尚未揭曉 · 當回合動作保密':planning?'上方比例是上一回合已揭曉的結果 · 當回合新動作保密':'上方比例是本回合揭曉的結果 · 雙方動作已公開';
  for(const [actor,prefix] of [['player','battlePlayer'],['cpu','battleCpu']]){
    const q=battle.goals[actor],r=duelGoal(battle,actor),own=actor==='player'?battle.controlled:otherBand(battle.controlled),budget=actor==='player'?battle.playerBudget:battle.cpuBudget,score=actor==='player'?battle.playerScore:battle.cpuScore;
    $(prefix+'Role').textContent=(actor==='player'?'你':'電腦')+' · '+bandName(own);$(prefix+'Score').textContent=score+' 分';$(prefix+'Goal').textContent=q.type+' · '+(q.type==='Type I'?'同側聚集':'兩側分離');
    $(prefix+'Target').textContent=q.eSide?'電子在 '+q.eSide+'、電洞在 '+q.hSide:q.type==='Type I'?'可聚在 A 或 B；電子與電洞需在同一側':'電子與電洞偏向不同側，方向不限';
    const unrevealed=!battle.history.length,gain=actor==='player'?publicOutcome.playerGain:publicOutcome.cpuGain;
    $(prefix+'Shares').innerHTML=unrevealed?'設計尚未揭曉':'<span class="battle-share-e">電子 '+r.eSide+' '+pct(r.eShare)+'</span> · <span class="battle-share-h">電洞 '+r.hSide+' '+pct(r.hShare)+'</span>';
    $(prefix+'Quality').textContent=unrevealed?'':'較低一項 '+pct(r.quality);$(prefix+'Bar').style.width=(unrevealed?0:r.quality*100)+'%';$(prefix+'Budget').textContent='剩餘 '+budget+' / 12 點';
    const standing=!r.typeMatches?'Type 未達標':publicOutcome.sameType?(publicOutcome.reason==='tie'?'比例相同 · 平手':gain?'比例領先':'比例落後'):r.aligned?'目標達標':'收集位置未達標';
    $(prefix+'Points').textContent=battle.round===1?'設計回合不計分':standing+(planning?' · 公開狀態':' · 本回合 +'+gain+' 分');
    $(prefix+'Card').classList.toggle('met',!unrevealed&&gain>0);
  }
  $('battlePlanForm').hidden=!planning;$('battleNext').hidden=battle.stage!=='revealed';$('battleReplay').hidden=battle.stage!=='finished';$('battleSecretStatus').textContent=planning?'電腦已鎖定，本回合動作隱藏':battle.started?'雙方動作已揭曉':'先設定任務，再開始對戰';$('battleActionField').hidden=battle.round===1;
  document.querySelectorAll('input[name=battleAction]').forEach(r=>r.checked=r.value===battle.plan.kind);
  const bounds=battleSliderBounds(battle),field=bounds.field,target=bounds.baseline+(battle.plan.kind==='hold'?0:battle.plan.direction*battle.plan.amount),sub=field==='ec'?'C':'V';
  $('battleOffsetControl').hidden=battle.plan.kind==='hold';$('battleOffsetControl').classList.toggle('holes',field==='ev');
  $('battleEditLabel').textContent=(battle.plan.kind==='attack'?'干擾電腦的':'設計／調整你的')+bandName(field)+' · 私人計畫';
  $('battleOffsetLabel').innerHTML=bandName(field)+'位差 ΔE<sub>'+sub+'</sub>';$('battleOffsetValue').innerHTML=signed(target*.02)+' <small>eV</small>';
  $('battleOffsetFormula').innerHTML='ΔE<sub>'+sub+'</sub> = E<sub>'+sub+',B</sub> − E<sub>'+sub+',A</sub>';
  const slider=$('battleOffset');slider.min=bounds.min;slider.max=bounds.max;slider.value=target;slider.disabled=!planning||bounds.min===bounds.max;
  slider.setAttribute('aria-valuetext',signed(target*.02)+' eV，移動 '+signed((target-bounds.baseline)*.02)+' eV');
  $('battleOffsetMin').textContent=signed(bounds.min*.02);$('battleOffsetMid').textContent=signed(bounds.baseline*.02);$('battleOffsetMax').textContent=signed(bounds.max*.02)+' eV';
  $('battleOffsetBaseline').textContent=(battle.round===1?'起點':'公開位差')+' '+signed(bounds.baseline*.02)+' → 計畫 '+signed(target*.02)+' eV（移動 '+signed((target-bounds.baseline)*.02)+'）';
  $('battleMinus').disabled=!planning||target<=bounds.min;$('battlePlus').disabled=!planning||target>=bounds.max;
  let info,error='';try{info=duelActionInfo(battle,'player',battle.plan);}catch(e){error=e.message;}
  if(battle.plan.kind!=='hold'&&battle.plan.amount===0)error=battle.round===1?'請用滑桿選擇非零位差，完成秘密設計。':'目前沒有移動；請調整滑桿，或選擇「保留點數」。';
  $('battleCost').textContent=error||'本次花費 '+info.cost+' 點 · 提交後剩餘 '+(battle.playerBudget-info.cost)+' 點';$('battleCost').classList.toggle('over',!!error);$('battleCommit').disabled=!!error||!planning;$('battleCommit').textContent=battle.round===1?'鎖定設計並揭曉':'鎖定動作並揭曉';
  $('battleDirectionHelp').textContent=battle.plan.kind==='hold'?'保留點數，能帶仍可能被對手的動作改變。':'本次改動'+bandName(field)+'。'+(field==='ec'?'降低 B 的導帶 → 電子偏向 B；提高 → 偏向 A。':'提高 B 的價帶 → 電洞偏向 B；降低 → 偏向 A。');
  const preview=$('battlePreview');if(error)preview.textContent='主圖仍保留公開狀態；調整滑桿後才能鎖定。';else if(battle.round===1)preview.innerHTML='<b>你的秘密設計</b><br>'+bandName(field)+'計畫位差 '+signed(target*.02)+' eV。對手的能帶尚未揭曉，現在不能判定最終 Type 或完整比例。';else{const board={...battle.board};board[info.field]+=info.delta;const r=calculate(board.ec*.02,board.ev*.02),trial=duelOutcome(battle,board),q=trial.player;preview.innerHTML='<b>私人試算 · 假設對手不移動</b><br>排列：'+r.type+'<br><span class="battle-share-e">電子在 '+q.eSide+' '+pct(q.eShare)+'</span> · <span class="battle-share-h">電洞在 '+q.hSide+' '+pct(q.hShare)+'</span><br>你的比較值 '+pct(q.quality)+(trial.sameType?' ／ 電腦 '+pct(trial.cpu.quality):'')+'<br>預估：你 +'+trial.playerGain+'、電腦 +'+trial.cpuGain+' 分。雙方揭曉後才確定。';}
  $('battlePublicNote').textContent=!battle.history.length?'初始圖為零位差示意；雙方的秘密設計尚未揭曉。':planning?'主圖是上一回合已揭曉的能帶；你的秘密計畫另列於出招區試算。':'主圖已更新為雙方動作同時生效後的能帶。';
  let feedback,tone='info';
  if(!battle.started)feedback='<b>按 Shuffle，隨機派發雙方任務。</b><br>你和電腦各有 12 點；第一回合不計分，之後有四次攻防機會。';
  else if(planning)feedback='<b>'+(battle.round===1?'秘密設計：只調整自己控制的能帶。':'根據公開能帶，選擇修改、干擾或保留點數。')+'</b><br>電腦已先鎖定動作；你改選方案時，電腦不會重新選招。';
  else{const h=battle.history.at(-1);feedback='<b>回合 '+h.round+' 揭曉 · '+h.type+'</b><br>你：'+duelActionText(h.player)+'。電腦：'+duelActionText(h.cpu)+'。<br>'+(h.round===1?'設計完成，不計分。現在可以根據公開位差與比例開始攻防。':'本回合你 +'+h.playerGain+' 分、電腦 +'+h.cpuGain+' 分。'+(h.reason==='ratio'?' 同 Type 比較：你 '+pct(h.playerQuality)+'、電腦 '+pct(h.cpuQuality)+'；目標比例較高者得分。':h.reason==='tie'?' 目標比例相同，本回合平手。':h.reason==='unmatched'?' 排列未達共同的 Type，雙方不加分。':Math.max(h.playerGain,h.cpuGain)===1?' Type 達標，兩種載子的目標比例尚未都達 90%。':''));
    if(battle.stage==='finished'){const won=battle.playerScore>battle.cpuScore,lost=battle.playerScore<battle.cpuScore;tone=won?'success':lost?'error':'info';feedback='<b>最終比分 '+battle.playerScore+' : '+battle.cpuScore+' · '+(won?'你獲勝':lost?'電腦獲勝':'平手')+'</b><br>'+feedback+'<br>回顧下方紀錄，看看資源花在補強或干擾時，如何改變載子分布。';}}
  $('battleFeedback').innerHTML=feedback;$('battleFeedback').dataset.tone=tone;$('battleTipText').hidden=!battle.tip;$('battleTipText').textContent=battleAnalysis();
  $('battleHistoryBody').innerHTML=battle.history.map(h=>'<tr><td>'+h.round+(h.round===1?'<small>設計</small>':'')+'</td><td>'+duelActionText(h.player)+'</td><td>'+duelActionText(h.cpu)+'</td><td>'+h.type+'<small>ΔEc '+signed(h.board.ec*.02)+' / ΔEv '+signed(h.board.ev*.02)+' eV</small><small>目標比例比較值：你 '+pct(h.playerQuality)+' / 電腦 '+pct(h.cpuQuality)+'</small></td><td>你 +'+h.playerGain+' / 電腦 +'+h.cpuGain+'</td></tr>').join('');
}
