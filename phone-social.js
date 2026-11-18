const socialState={roomPicker:false,data:null,busy:false,error:'',notice:'',timer:null,loading:false};
const greetingState={seen:new Set(),session:null,lastSent:0,sending:false,muted:false,timer:null,cpuTimer:null};
async function socialApi(path='',body){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
 try{const r=await fetch('/api/friends'+(path?'/'+path:''),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:abort.signal});const data=await r.json();if(!r.ok){const e=Error(data.error||tx('好友無法同步。','Friends could not sync.'));e.status=r.status;throw e;}return data;}finally{clearTimeout(timer);}
}
function renderSocialEntry(){const n=(socialState.data?.incoming.length||0)+(socialState.data?.invites.filter(i=>i.expiresAt>Date.now()).length||0)+chatUnreadCount();$('friendsOpen').textContent=tx('好友','Friends')+(n?' · '+n:'');$('friendsOpen').classList.toggle('has-notice',!!n);renderChatNotice();}
function socialRows(entries,kind){
 return entries.map(e=>{
  const p=e.profile,code=htmlText(e.code),button=(op,label,cls='quiet')=>'<button type="button" class="'+cls+'" data-social-op="'+op+'" data-player-code="'+code+'" '+(socialState.busy?'disabled':'')+'>'+label+'</button>';
  let buttons=kind==='friends'?button('chat',tx('聊天','Chat')+((socialState.data?.unread?.[e.code]||0)?' · '+socialState.data.unread[e.code]:''),'invite')+button('invite',tx('邀請對戰','Invite'),'invite')+button('remove',tx('移除','Remove'))+button('block',tx('封鎖','Block')):kind==='incoming'?button('accept',tx('接受','Accept'),'invite')+button('remove',tx('略過','Decline'))+button('block',tx('封鎖','Block')):kind==='outgoing'?button('remove',tx('取消邀請','Cancel')):kind==='blocked'?button('unblock',tx('解除封鎖','Unblock')):'<button type="button" class="invite" data-join-invite="'+htmlText(e.id)+'" '+(socialState.busy?'disabled':'')+'>'+tx('加入','Join')+'</button><button type="button" class="quiet" data-dismiss-invite="'+htmlText(e.id)+'" '+(socialState.busy?'disabled':'')+'>'+tx('略過','Decline')+'</button>';
  if(socialState.roomPicker&&kind==='friends')buttons=button('invite',tx('邀請加入','Invite to room'),'invite');
  return '<div class="friend-row">'+avatarMarkup(p,'small')+'<div class="friend-row-copy"><strong>'+htmlText(p?.displayName||tx('玩家','Player'))+'</strong><small>'+htmlText(kind==='invites'?tx('邀你進房間 ','Invites you to room ')+e.roomCode:code+' · '+(p?.rating??1000)+tx(' 積分',' pts'))+'</small></div><div class="friend-row-actions">'+buttons+'</div></div>';
 }).join('');
}
function renderFriends(){
 renderSocialEntry();$('friendsTitle').textContent=socialState.roomPicker?tx('選擇要加入房間的好友','Choose friends for this room'):tx('好友','Friends');$('friendsClose').textContent=tx('關閉','Close');$('friendCodeLabel').textContent=tx('你的玩家代碼','Your player code');$('friendCopyCode').textContent=tx('複製','Copy');$('friendCode').textContent=socialState.data?.code||'—';$('friendAddCode').placeholder=tx('輸入 10 碼玩家代碼','Enter a 10-character code');$('friendAddCode').setAttribute('aria-label',tx('好友的玩家代碼','Friend’s player code'));$('friendAddSubmit').textContent=tx('加好友','Add friend');$('friendsRefresh').textContent=tx('重新整理','Refresh');
 $('friendsSignedOut').hidden=!!socialState.data;$('friendsContent').hidden=!socialState.data;$('friendsSignIn').textContent=tx('以 Google 登入','Sign in with Google');$('friendsSignInNote').textContent=tx('登入後就能取得玩家代碼、加好友與邀請對戰。','Sign in to get a player code, add friends and send match invitations.');
 $('friendNote').textContent=tx('互相確認後成為好友。房間邀請保留 2 分鐘；朋友房間不計積分；好友組隊參加牌位配對則會計分。','Friend requests require acceptance. Room invitations last 2 minutes. Friend rooms are unranked; parties entering Ranked match do change rating.');
 $('friendAddForm').hidden=socialState.roomPicker;$('friendCode').parentElement.parentElement.hidden=socialState.roomPicker;const d=socialState.data;for(const [key,title,en] of [['invites','對戰邀請','Match invitations'],['incoming','收到的好友邀請','Friend requests'],['friends','我的好友','My friends'],['outgoing','等待對方接受','Sent requests'],['blocked','已封鎖','Blocked']]){
  const list=key==='invites'?d?.invites.filter(i=>i.expiresAt>Date.now())||[]:d?.[key]||[],section=$('friends'+key);section.hidden=socialState.roomPicker?key!=='friends':!list.length&&key!=='friends';section.innerHTML='<h3>'+tx(title,en)+(list.length?' · '+list.length:'')+'</h3>'+(list.length?socialRows(list,key):'<p class="social-empty">'+tx('還沒有好友。把上方的代碼分享給朋友，或輸入他的代碼。','No friends yet. Share your code above, or enter a friend’s code.')+'</p>');
 }
 $('friendsStatus').textContent=translated(socialState.error)||socialState.notice||(socialState.loading?tx('同步中…','Syncing…'):'');$('friendAddSubmit').disabled=socialState.busy;$('friendsRefresh').disabled=socialState.busy||socialState.loading;
}
async function refreshFriends(quiet=false){
 if(socialState.loading)return;socialState.loading=true;if(!quiet)socialState.error='';
 try{socialState.data=await socialApi();}catch(e){if(e.status===401)socialState.data=null;else if(!quiet)socialState.error=e.name==='AbortError'?tx('連線逾時，請再試一次。','Connection timed out. Please retry.'):e.message;}finally{socialState.loading=false;renderSocialEntry();if($('friends').open)renderFriends();}
}
async function openFriends(){if(!$('friends').open)$('friends').showModal();renderFriends();await refreshFriends();}
async function socialCommand(operation,body){
 if(socialState.busy)return;socialState.busy=true;socialState.error='';socialState.notice='';renderFriends();
 try{socialState.data=await socialApi(operation,body);socialState.notice=operation==='request'?tx('已送出好友邀請。','Friend request sent.'):operation==='accept'?tx('你們已成為好友！','You are now friends!'):operation==='invite'?tx('已送出房間邀請，2 分鐘內有效。','Room invitation sent. Valid for 2 minutes.'):tx('已更新。','Updated.');return true;}catch(e){socialState.error=e.message;return false;}finally{socialState.busy=false;renderFriends();}
}
const socialCanJoin=()=>!ui.busy&&!ui.queue&&(!ui.data||['finished','closed'].includes(ui.data.stage));
async function inviteFriend(code){
 if(socialState.busy)return;
 if(ui.queue||ui.busy||ui.data&&!(['lobby','party'].includes(ui.data.stage)&&(ui.kind==='online'&&ui.data.matchKind==='friend'||ui.kind==='team'&&ui.data.host))&&!['finished','closed'].includes(ui.data.stage)){socialState.error=tx('請先完成目前對局或取消配對，再邀請好友。','Finish your match or cancel matching before inviting a friend.');renderFriends();return;}
 if(ui.data&&['finished','closed'].includes(ui.data.stage))await leave();
 if(!ui.data){if(teamMatchUi.format==='2v2')await connectTeam('create');else await connect('create');}
 if(!['online','team'].includes(ui.kind)||!['lobby','party'].includes(ui.data?.stage)||!['friend','team'].includes(ui.data.matchKind)){socialState.error=ui.error||tx('房間尚未就緒。','The room is not ready.');renderFriends();return;}
 await socialCommand('invite',{code,roomCode:ui.data.code});
}
async function joinFriendInvite(id){
 if(socialState.busy)return;if(!socialCanJoin()){socialState.error=tx('請先完成目前對局或取消配對，再加入好友。','Finish your match or cancel matching before joining a friend.');renderFriends();return;}
 await refreshFriends(true);const invite=socialState.data?.invites.find(i=>i.id===id&&i.expiresAt>Date.now());if(!invite){socialState.error=tx('邀請已失效，請好友重新邀請。','This invitation expired. Ask for a new one.');renderFriends();return;}
 if(ui.data)await leave();if(invite.kind==='team')await connectTeam('join',invite.roomCode);else await connect('join',invite.roomCode);
 if(ui.credentials?.code===invite.roomCode){closeAnimatedDialog($('friends'));await socialCommand('dismiss-invite',{id});}else{socialState.error=ui.error;renderFriends();}
}
function scheduleFriends(){clearTimeout(socialState.timer);if(document.hidden)return;socialState.timer=setTimeout(async()=>{if(!document.hidden&&(shopState.data?.signedIn||$('friends').open))await refreshFriends(true);scheduleFriends();},$('friends').open?8000:20000);}
function greetingText(id){const p=BATTLE_GREETINGS.find(x=>x.id===id);return p?tx(p.zh,p.en):'';}
function showGreeting(m){
 if(m.sender==='opponent'&&greetingState.muted)return;clearTimeout(greetingState.timer);const box=$('greetingBubble');box.dataset.sender=m.sender;box.innerHTML='<small>'+htmlText(m.sender==='you'?tx('你','You'):ui.data?.opponentProfile?.displayName||tx('對手','Opponent'))+'</small><strong>'+htmlText(greetingText(m.phrase))+'</strong>';box.hidden=false;greetingState.timer=setTimeout(()=>box.hidden=true,3400);
}
function syncGreetings(d){
 const enabled=!!d&&(d.joined||shopState.data?.signedIn)&&['lobby','role','mode','plan','revealed','finished'].includes(d.stage);$('greetingOpen').hidden=!enabled;$('greetingOpen').setAttribute('aria-label',tx('發送戰鬥問候','Send a battle greeting'));
 const session=d?(ui.kind==='cpu'?'CPU:'+ui.cpuCoinId:d.code):null;
 if(greetingState.session!==session){greetingState.session=session;greetingState.seen.clear();greetingState.lastSent=0;clearTimeout(greetingState.timer);clearTimeout(greetingState.cpuTimer);$('greetingBubble').hidden=true;}
 if(!enabled){if($('greetingPanel').open)$('greetingPanel').close();return;}
 for(const m of d.greetings||[])if(!greetingState.seen.has(m.sender+':'+m.id)){greetingState.seen.add(m.sender+':'+m.id);if(m.sender==='you')greetingState.lastSent=Math.max(greetingState.lastSent,m.at);if(Date.now()-m.at<6500)showGreeting(m);}
}
function renderGreetingPanel(){
 $('greetingTitle').textContent=tx('打個招呼','Say hello');$('greetingClose').textContent=tx('關閉','Close');$('greetingMuteLabel').textContent=tx('隱藏對手的問候','Hide opponent greetings');$('greetingMute').checked=greetingState.muted;
 const waiting=Date.now()-greetingState.lastSent<GREETING_COOLDOWN||!ui.data?.joined;renderChatNotice();
 $('greetingOptions').innerHTML=BATTLE_GREETINGS.map(p=>'<button type="button" data-greeting="'+p.id+'" '+(waiting||greetingState.sending?'disabled':'')+'>'+htmlText(tx(p.zh,p.en))+'</button>').join('');$('greetingHint').textContent=waiting?tx('稍等一下，下一句馬上就能送出。','Please wait a moment before sending another.'):tx('每 4 秒可送一句，對方也能隱藏問候。','Send one every 4 seconds. Players can hide greetings.');
}
async function sendGreeting(phrase){
 if(!ui.data?.joined||greetingState.sending||Date.now()-greetingState.lastSent<GREETING_COOLDOWN)return;const session=greetingState.session;greetingState.sending=true;renderGreetingPanel();
 try{
  if(ui.kind==='online'){const view=await api('/'+ui.credentials.code+'/greeting',{phrase,requestId:crypto.randomUUID()});if(greetingState.session===session)receive(view);}
  else{greetingState.lastSent=Date.now();showGreeting({phrase,sender:'you'});const reply=phrase==='hello'?'hello':phrase==='good-luck'?'good-luck':phrase==='again'?'well-played':'thanks';greetingState.cpuTimer=setTimeout(()=>{if(greetingState.session===session)showGreeting({phrase:reply,sender:'opponent'});},1900);}
  closeAnimatedDialog($('greetingPanel'));
 }catch(e){$('greetingHint').textContent=translated(e.message);}finally{greetingState.sending=false;}
}
function initSocial(){
 $('friends').addEventListener('close',()=>{socialState.roomPicker=false;});
 $('friendsOpen').addEventListener('click',e=>tapAction(e.currentTarget,openFriends));$('friendsClose').addEventListener('click',()=>closeAnimatedDialog($('friends')));$('friendsRefresh').addEventListener('click',()=>refreshFriends());$('friends').addEventListener('cancel',e=>{e.preventDefault();closeAnimatedDialog($('friends'));});$('friends').addEventListener('close',()=>{scheduleFriends();updateCoverMotion();});
 $('friendAddForm').addEventListener('submit',e=>{e.preventDefault();socialCommand('request',{code:$('friendAddCode').value.trim()}).then(ok=>{if(ok)$('friendAddCode').value='';});});
 $('friendAddCode').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10));
 $('friendCopyCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(socialState.data?.code||'');socialState.notice=tx('已複製玩家代碼。','Player code copied.');}catch{socialState.notice=tx('請複製上方玩家代碼。','Copy the player code above.');}renderFriends();});
 $('friendsContent').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.joinInvite)joinFriendInvite(b.dataset.joinInvite);else if(b.dataset.dismissInvite)socialCommand('dismiss-invite',{id:b.dataset.dismissInvite});else if(b.dataset.socialOp==='chat')openFriendChat(b.dataset.playerCode);else if(b.dataset.socialOp==='invite')inviteFriend(b.dataset.playerCode);else if(b.dataset.socialOp)socialCommand(b.dataset.socialOp,{code:b.dataset.playerCode});});
 try{greetingState.muted=localStorage.getItem('band-hide-greetings')==='1';}catch{}
 $('greetingOpen').addEventListener('click',()=>{renderGreetingPanel();$('greetingPanel').showModal();setTimeout(()=>{if($('greetingPanel').open)renderGreetingPanel();},GREETING_COOLDOWN);});$('greetingClose').addEventListener('click',()=>closeAnimatedDialog($('greetingPanel')));$('greetingPanel').addEventListener('cancel',e=>{e.preventDefault();closeAnimatedDialog($('greetingPanel'));});$('greetingOptions').addEventListener('click',e=>{const b=e.target.closest('[data-greeting]');if(b&&!b.disabled)sendGreeting(b.dataset.greeting);});$('greetingMute').addEventListener('change',e=>{greetingState.muted=e.target.checked;try{localStorage.setItem('band-hide-greetings',greetingState.muted?'1':'0');}catch{}if(greetingState.muted)$('greetingBubble').hidden=true;});
 document.addEventListener('band-language',()=>{renderSocialEntry();if($('friends').open)renderFriends();if($('greetingPanel').open)renderGreetingPanel();});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(socialState.timer);else{if(shopState.data?.signedIn)refreshFriends(true);scheduleFriends();}});window.addEventListener('pagehide',()=>{clearTimeout(socialState.timer);clearTimeout(greetingState.timer);clearTimeout(greetingState.cpuTimer);});window.addEventListener('pageshow',scheduleFriends);renderSocialEntry();scheduleFriends();
}
