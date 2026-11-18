const victoryState={shown:null,acknowledged:null};
function victoryKey(){return (ui.data?.matchId||ui.data?.code)+':'+(ui.kind==='cpu'?ui.cpuCoinId:'')+':'+ui.kind;}
function victoryOutcome(){const d=ui.data,w=d.history.at(-1).decision?.winner;return ui.kind==='team'?(w==='draw'?'draw':w===d.yourTeam?'you':'opponent'):w;}
function victoryAvatars(){
 const d=ui.data,outcome=victoryOutcome();if(ui.kind==='team'){const winner=d.history.at(-1).decision.winner;return d.players.filter(p=>winner==='draw'||p.team===winner).map(p=>({profile:p.profile,name:teamPlayerName(p)}));}
 const me={profile:d.yourProfile||leaderboardState.data?.viewer?.profile,name:d.yourProfile?.displayName||tx('你','You')},other={profile:d.opponentProfile,name:d.opponentProfile?.displayName||tx('對手','Opponent')};return outcome==='draw'?[me,other]:[outcome==='you'?me:other];
}
function mvpMarkup(d,large=false){
 if(!d.mvp)return '';const p=d.players.find(p=>p.slot===d.mvp.slot);return '<div class="mvp-person">'+avatarMarkup(p.profile,large?'large':'small')+'<div><small>★ '+tx('本場 MVP','MATCH MVP')+'</small><strong>'+htmlText(teamPlayerName(p))+'</strong><span>'+htmlText(teamRoleLabel(p.slot))+'</span></div></div><p>'+tx(d.mvp.decisive?'關鍵貢獻：省略其已執行動作後，勝隊將不再獲勝。':'依其動作對最終勝負及載子比例的貢獻獲選。',d.mvp.decisive?'Decisive contribution: removing their recorded moves changes the winning outcome.':'Selected for contribution to the final outcome and carrier shares.')+'</p><details><summary>'+tx('評選依據','How MVP is selected')+'</summary><p>'+tx('只評選勝隊。依序省略一位玩家的已執行改動，保留其餘動作順序與能帶範圍，比較最終勝負及比例；同分再比各回合貢獻、耗點，完全相同時使用本場固定抽籤。MVP 不額外加牌位分或金幣。','Winning team only. Replay the other recorded moves in order within the band limits, comparing the final outcome and shares. Ties use round contributions, points spent, then a stable match draw. MVP adds no rating or coins.')+'</p></details>';
}
function renderMvpCard(d){$('teamMvp').hidden=d.stage!=='finished'||teamUi.replayStep!==5||!d.mvp;if(!$('teamMvp').hidden)$('teamMvp').innerHTML=mvpMarkup(d);}
function renderVictory(){
 const d=ui.data,team=ui.kind==='team',outcome=victoryOutcome(),last=d.history.at(-1);$('verdict').dataset.outcome=outcome;
 $('verdictTitle').textContent=outcome==='you'?team?tx('隊伍勝利','TEAM VICTORY'):tx('勝利','VICTORY'):outcome==='opponent'?tx('對手獲勝','OPPONENT VICTORY'):tx('勢均力敵','DRAW');
 $('verdictRound').textContent=tx(d.roundLimit+' 回合對戰結束',d.roundLimit+' ROUNDS COMPLETE');$('verdictType').textContent=tx('最終排列：','Final alignment: ')+visualType({type:last.type});
 $('verdictYourMission').textContent=tx(team?'我方任務：':'你的任務：',team?'Your team mission: ':'Your mission: ')+(team?translated(d.goals[d.yourTeam]):missionText(d.goal));$('verdictOpponentMission').textContent=tx('對手任務：','Opponent mission: ')+(team?translated(d.goals[d.yourTeam==='a'?'b':'a']):missionText(d.opponentGoal));
 const rating=team&&d.ratingResult?tx('積分 ','Rating ')+d.ratingResult.before+' → '+d.ratingResult.after:team?'':ratingSummary(d);$('verdictRating').textContent=[rating,rewardText(d)].filter(Boolean).join(' · ');
 $('victoryRoster').innerHTML=victoryAvatars().map(p=>'<div>'+avatarMarkup(p.profile,'large')+'<strong>'+htmlText(p.name)+'</strong></div>').join('');$('victoryMvp').hidden=!team||!d.mvp;if(team&&d.mvp)$('victoryMvp').innerHTML=mvpMarkup(d,true);
 $('victoryDecor').innerHTML=Array.from({length:24},(_,i)=>'<i style="--angle:'+(i*15)+'deg;--delay:'+(i%6)*.06+'s;--distance:'+(110+(i%4)*25)+'px"></i>').join('');$('verdictConfirm').textContent=tx('查看完整結算','View full results');
}
function showVictory(){
 const key=victoryKey();if(victoryState.shown===key)return;victoryState.shown=key;motion.verdictSeen=true;renderVictory();if($('skillDraft').open)$('skillDraft').close();$('skillCastBanner').hidden=true;$('verdict').showModal();$('verdictConfirm').disabled=true;const w=victoryOutcome();soundEffect(w==='you'?'win':w==='opponent'?'loss':'draw');clearTimeout(motion.verdictTimer);motion.verdictTimer=setTimeout(()=>{$('verdictConfirm').disabled=false;motion.verdictTimer=null;},reducedMotion()?100:900);
}
function presentTeamVerdict(){showVictory();}
