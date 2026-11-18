function bandAvatarSVG(profile,x,y,size,label,own=false){
 return '<foreignObject x="'+(x-size/2)+'" y="'+(y-size/2)+'" width="'+size+'" height="'+size+'" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" class="band-avatar'+(own?' own':'')+'" title="'+htmlText(label)+'">'+avatarMarkup(profile)+'</div></foreignObject>';
}
function renderDuelHud(d){
 const result=['revealed','finished'].includes(d.stage),q=d.goal;let info=null;try{if(!result&&(editable()||d.yourLocked))info=duelActionInfo(gameForPlan(),'player',ui.plan);}catch{}
 const remaining=info?Math.min(d.startingPoints||12,d.yourBudget-info.cost+(info.refund||0)):d.yourBudget;
 $('missionTitle').textContent=tx('任務：','Mission: ')+translated(q.type);$('missionRound').textContent=d.round+' / '+(d.roundLimit||5);$('holeTarget').hidden=true;$('electronTarget').textContent=goalDescription(q);$('electronTarget').parentElement.hidden=result;
 $('missionRank').hidden=false;$('missionRank').textContent=ui.kind==='cpu'?tx('練習模式 · 不計積分','Practice · unranked'):d.ranked?tx('牌位對戰','Ranked match'):tx('休閒對戰 · Shuffle','Casual match · Shuffle');
 $('points').innerHTML='<span class="points-label">'+(info?tx('預計剩餘','After this move'):tx('剩餘點數','Points left'))+'</span><strong>'+remaining+' / '+(d.startingPoints||12)+'</strong>'+(info?'<small>'+tx('本次 ','Cost ')+info.cost+tx(' 點',' pts')+'</small>':'');$('points').setAttribute('aria-label',tx('剩餘 ','Points left: ')+remaining);
}
function playBandSVG(board,{controlled,can=false,trial=board,previous=null,movement=null,activeField=null,round=1}={}){
 const width=window.innerWidth<600?400:560,left=40,mid=width*.47,end=width-96,legend=width-45,y=e=>44+(2.1-e)*100;
 const txt=(x,yy,t,color='#aebdd0',size=12,anchor='middle')=>'<text x="'+x+'" y="'+yy+'" fill="'+color+'" font-size="'+size+'" text-anchor="'+anchor+'" pointer-events="none">'+htmlText(t)+'</text>';
 const m=carrierModel(trial.ec*.02,trial.ev*.02),d=ui.data;let svg='<title>'+tx('能帶圖，頭像標示雙方陣營','Band diagram; avatars identify each player’s band')+'</title>';
 svg+=txt((left+mid)/2,19,tx('材料 A','Material A'),'#e8efff',15)+txt((mid+end)/2,19,tx('材料 B','Material B'),'#e8efff',15)+txt(17,20,'eV','#b8c8de',11);
 svg+='<path d="M'+left+' 30V320H'+end+'" fill="none" stroke="#71839d"/><path d="M'+mid+' 30V320" stroke="#344157" stroke-dasharray="4 5"/>';
 for(const e of [2,1.5,1,.5,0,-.5]){const yy=y(e);if(yy<320)svg+=txt(left-8,yy+4,e.toFixed(1),'#8fa2bc',10,'end');}
 for(const [field,carrier,color,base] of [['ec','e','#7eb6ff',1.6],['ev','h','#ff95a7',0]]){
  const a=y(base),b=y(base+board[field]*.02),preview=y(base+trial[field]*.02),active=activeField===field,path='M'+left+' '+a+'H'+mid+'V'+preview+'H'+end;
  if(active)svg+='<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="11" opacity=".13"/>';
  svg+='<path data-play-band="'+field+'" d="'+path+'" fill="none" stroke="'+color+'" stroke-width="'+(active?3.2:2)+'" pointer-events="none"/>';
  if(board[field]!==trial[field])svg+='<path d="M'+mid+' '+b+'H'+end+'" fill="none" stroke="'+color+'" stroke-dasharray="4 4" opacity=".6"/>';
  if(previous&&previous[field]!==board[field]){const old=y(base+previous[field]*.02);svg+='<path d="M'+mid+' '+old+'H'+end+'" fill="none" stroke="'+color+'" stroke-dasharray="4 4" opacity=".5"/>';}
  const fraction=carrier==='e'?m.electronB:m.holeB;
  for(let i=0;i<12;i++){const t=(i+.5)/12,blend=Math.max(0,Math.min(1,(fraction-(1-t))/.17+.5)),ease=blend*blend*(3-2*blend),xa=left+8+(mid-left-16)*t,xb=mid+8+(end-mid-16)*t,x=xa+(xb-xa)*ease,yy=a+(preview-a)*ease+(carrier==='e'?-1:1)*(14+(i%2)*10);svg+=carrierSkinSVG(d?.carrierSkins?.[carrier]||activeSkin(carrier),carrier,x,yy,4);}
  svg+=txt((left+mid)/2,a+48,(carrier==='e'?tx('電子 ','e− '):tx('電洞 ','h+ '))+pct(1-fraction),color,12)+txt((mid+end)/2,preview+48,(carrier==='e'?tx('電子 ','e− '):tx('電洞 ','h+ '))+pct(fraction),color,12);
  svg+=txt(legend,preview-8,field==='ec'?tx('導帶','Ec'):tx('價帶','Ev'),color,13);
  const own=field===controlled,profile=own?(d.yourProfile||leaderboardState.data?.viewer?.profile):d.opponentProfile;
  svg+=bandAvatarSVG(profile,legend,preview+16,28,own?tx('你','You'):tx('對手','Opponent'),own)+txt(legend,preview+44,own?tx('你','You'):tx('對手','Opponent'),color,10);
  if(can&&(round>1||field===controlled))svg+='<g role="button" tabindex="0" data-graph-band="'+field+'" aria-pressed="'+active+'" aria-label="'+htmlText((own?tx('修改你的','Edit your '):tx('干擾對手的','Interfere with opponent’s '))+bandLabel(field))+'"><rect x="'+left+'" y="'+(Math.min(a,preview)-30)+'" width="'+(width-left-8)+'" height="'+(Math.abs(a-preview)+64)+'" fill="transparent" style="cursor:pointer"/></g>';
 }
 $('playGraph').setAttribute('viewBox','0 0 '+width+' 355');return svg;
}
function renderHomeLayout(){renderAbilityRules();
 $('coverProfile').setAttribute('aria-label',tx('個人資料','Profile'));$('leaderboardOpen').textContent=tx('積分榜','Rankings');
 $('practice').textContent=tx('練習模式','Practice');$('homeJoinOpen').textContent=tx('加入房間','Join room');$('homeMoreTitle').textContent=tx('更多','More');$('create').textContent=tx('建立房間','Create room');$('homeFormatLabel').textContent=tx('真人對戰','Play online');
 $('homeJoinTitle').textContent=tx('加入房間','Join room');$('homeJoinClose').textContent=tx('關閉','Close');$('homeJoinHint').textContent=tx('輸入 6 碼房號，會自動辨識 1v1 或 2v2。','Enter the 6-character code. The game detects 1v1 or 2v2.');
 $('homeJoinOpen').disabled=ui.busy||!!ui.data||!!ui.queue;$('codeInput').placeholder=tx('6 碼房號','6-character code');$('codeInput').setAttribute('aria-label',tx('六碼房號，輸入後自動加入','Six-character room code; joins when complete'));
 $('homeJoinSubmit').textContent=ui.busy?tx('加入中…','Joining…'):tx('加入房間','Join room');$('homeJoinSubmit').disabled=ui.busy||!!ui.data||!!ui.queue;$('homeJoinClose').disabled=ui.busy;
}
async function joinRoomFromCode(){
 const code=normalizeRoomCode($('codeInput').value);if(ui.busy)return;if(!ROOM_CODE_PATTERN.test(code)){$('homeJoinStatus').textContent=tx('請輸入完整的六碼房間代號。','Enter the full six-character room code.');return;}await checkSecretRoomCode(code);await connect('join',code);$('homeJoinStatus').textContent=translated(ui.error);if(ui.credentials)$('homeJoin').close();
}
function initHomeLayout(){
 $('homeJoinOpen').addEventListener('click',()=>{if(ui.data||ui.busy)return;$('codeInput').value='';$('homeJoinStatus').textContent='';renderHomeLayout();$('homeJoin').showModal();});$('homeJoinSubmit').addEventListener('click',joinRoomFromCode);$('homeJoinClose').addEventListener('click',()=>closeAnimatedDialog($('homeJoin')));$('homeJoin').addEventListener('cancel',e=>{e.preventDefault();if(!ui.busy)closeAnimatedDialog($('homeJoin'));});document.addEventListener('band-language',renderHomeLayout);renderHomeLayout();
}
