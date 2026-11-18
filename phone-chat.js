const chatState={code:null,profile:null,messages:[],before:null,olderLoaded:false,generation:0,loading:null,sending:false,allowed:true,error:'',timer:null,lastRead:0,renderKey:'',drafts:new Map(),intents:new Map()};
function chatUnreadCount(){return Object.values(socialState.data?.unread||{}).reduce((sum,n)=>sum+n,0);}
function renderChatNotice(){
 const n=chatUnreadCount();$('friendMessagesOpen').textContent=tx('好友聊天','Friend messages')+(n?' · '+Math.min(99,n)+(n>99?'+':''):'');$('friendMessagesOpen').hidden=!shopState.data?.signedIn;
 $('greetingOpen').classList.toggle('has-unread-messages',n>0);$('greetingOpen').setAttribute('aria-label',tx('戰鬥問候與好友訊息','Battle greetings and friend messages')+(n?tx('，'+n+' 則未讀',', '+n+' unread'):''));
}
function chatClock(at){return new Intl.DateTimeFormat(siteLanguage==='en'?'en':'zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));}
function updateChatViewport(){if(!$('friendChat').open)return;const v=window.visualViewport,h=v?.height||window.innerHeight,desired=Math.min(740,h-32);$('friendChat').style.setProperty('--chat-viewport-height',h+'px');$('friendChat').style.setProperty('--chat-top',((v?.offsetTop||0)+Math.max(12,(h-desired)/2))+'px');}
function renderFriendChat(force=false){
 updateChatViewport();
 $('chatTitle').textContent=chatState.profile?.displayName||tx('好友聊天','Friend messages');$('chatPeerCode').textContent=chatState.code||'';$('chatPeerAvatar').innerHTML=avatarMarkup(chatState.profile,'small');$('chatBack').textContent=tx('‹ 好友','‹ Friends');$('chatClose').textContent=tx('關閉','Close');$('chatOlder').textContent=tx('載入更早訊息','Load older messages');$('chatOlder').hidden=!chatState.before;$('chatOlder').disabled=chatState.loading===chatState.generation;
 $('chatInput').placeholder=tx('輸入訊息…','Write a message…');$('chatInput').setAttribute('aria-label',tx('訊息內容','Message text'));$('chatSend').textContent=chatState.sending?tx('傳送中…','Sending…'):tx('傳送','Send');$('chatInput').disabled=!chatState.allowed;
 const length=Array.from($('chatInput').value.trim()).length;$('chatCounter').textContent=length+' / 400';$('chatCounter').classList.toggle('over-limit',length>400);$('chatSend').disabled=chatState.sending||!chatState.allowed||length===0||length>400;
 $('chatStatus').textContent=translated(chatState.error)||(chatState.loading===chatState.generation&&!chatState.messages.length?tx('載入訊息中…','Loading messages…'):'');$('chatHint').textContent=tx('Enter 傳送 · Shift+Enter 換行 · 僅限互相確認的好友','Enter to send · Shift+Enter for a new line · Accepted friends only');
 const key=siteLanguage+':'+chatState.messages.map(m=>m.id).join(',');if(!force&&key===chatState.renderKey)return;chatState.renderKey=key;
 const stream=$('chatScroll'),bottom=stream.scrollHeight-stream.clientHeight-stream.scrollTop<80,first=chatState.messages.length&&!$('chatMessages').children.length,list=$('chatMessages');list.replaceChildren();
 if(!chatState.messages.length){const empty=document.createElement('p');empty.className='chat-empty';empty.textContent=chatState.allowed?tx('打個招呼，開始你們的第一段對話。','Say hello to start your conversation.'):tx('目前無法讀取這段對話。','This conversation is currently unavailable.');list.append(empty);}
 for(const m of chatState.messages){const row=document.createElement('article'),bubble=document.createElement('p'),time=document.createElement('time');row.className='chat-message '+(m.sender==='you'?'mine':'theirs');row.dataset.messageId=String(m.id);bubble.textContent=m.text;time.dateTime=new Date(m.createdAt).toISOString();time.textContent=chatClock(m.createdAt);row.append(bubble,time);list.append(row);}
 if(bottom||first)stream.scrollTop=stream.scrollHeight;
}
function scheduleChat(){clearTimeout(chatState.timer);if(!$('friendChat').open||document.hidden||!chatState.allowed)return;chatState.timer=setTimeout(()=>loadFriendChat(),2500);}
async function markChatRead(generation){
 if(document.hidden||!$('friendChat').open||generation!==chatState.generation)return;const last=chatState.messages.at(-1)?.id||0;if(last<=chatState.lastRead)return;
 try{await socialApi('chat',{operation:'read',code:chatState.code,lastId:last});if(generation!==chatState.generation)return;chatState.lastRead=last;if(socialState.data?.unread)socialState.data.unread[chatState.code]=0;renderSocialEntry();}catch{}
}
async function loadFriendChat(older=false){
 const generation=chatState.generation,code=chatState.code;if(!code||chatState.loading===generation||older&&!chatState.before)return;chatState.loading=generation;renderFriendChat();const oldHeight=$('chatScroll').scrollHeight,oldTop=$('chatScroll').scrollTop;
 try{
  const data=await socialApi('chat?code='+encodeURIComponent(code)+(older?'&before='+chatState.before:''));if(generation!==chatState.generation)return;chatState.profile=data.profile;chatState.allowed=true;chatState.error='';const merged=new Map(chatState.messages.map(m=>[m.id,m]));for(const m of data.messages)merged.set(m.id,m);chatState.messages=[...merged.values()].sort((a,b)=>a.id-b.id);
  if(older||!chatState.olderLoaded)chatState.before=data.beforeCursor;if(older)chatState.olderLoaded=true;renderFriendChat();if(older)$('chatScroll').scrollTop=oldTop+$('chatScroll').scrollHeight-oldHeight;await markChatRead(generation);
 }catch(e){if(generation!==chatState.generation)return;chatState.error=['AbortError','TypeError'].includes(e.name)?tx('連線逾時，訊息仍保留，請重試。','Connection timed out. Your draft is safe; retry.'):e.message;if([401,403,404].includes(e.status)){chatState.allowed=false;chatState.messages=[];}}
 finally{if(generation===chatState.generation){chatState.loading=null;renderFriendChat();scheduleChat();}}
}
async function openFriendChat(code){
 const friend=socialState.data?.friends.find(f=>f.code===code);if(!friend)return;clearTimeout(chatState.timer);chatState.generation++;Object.assign(chatState,{code,profile:friend.profile,messages:[],before:null,olderLoaded:false,lastRead:0,renderKey:'',allowed:true,error:'',sending:false,loading:null});$('chatInput').value=chatState.drafts.get(code)||'';
 if($('friends').open)$('friends').close();if($('greetingPanel').open)$('greetingPanel').close();if(!$('friendChat').open)$('friendChat').showModal();renderFriendChat(true);await loadFriendChat();
}
async function sendFriendMessage(){
 if(chatState.sending||!chatState.allowed)return;const code=chatState.code,text=$('chatInput').value.trim(),generation=chatState.generation;if(!text||Array.from(text).length>400)return;
 const previous=chatState.intents.get(code),intent=previous?.text===text?previous:{text,id:crypto.randomUUID()};chatState.intents.set(code,intent);chatState.sending=true;chatState.error='';renderFriendChat();
 try{
  const data=await socialApi('chat',{operation:'send',code,text,clientId:intent.id});if(generation!==chatState.generation)return;chatState.intents.delete(code);if($('chatInput').value.trim()===text){chatState.drafts.delete(code);$('chatInput').value='';}else chatState.drafts.set(code,$('chatInput').value);if(!chatState.messages.some(m=>m.id===data.message.id))chatState.messages.push(data.message);chatState.messages.sort((a,b)=>a.id-b.id);renderFriendChat();$('chatScroll').scrollTop=$('chatScroll').scrollHeight;await markChatRead(generation);
 }catch(e){if(generation===chatState.generation)chatState.error=['AbortError','TypeError'].includes(e.name)?tx('尚未確認送出。可重按傳送，不會重複寄出。','Delivery is unconfirmed. Retry safely without duplicate messages.'):e.message;}
 finally{if(generation===chatState.generation){chatState.sending=false;renderFriendChat();scheduleChat();}}
}
function initChat(){
 window.visualViewport?.addEventListener('resize',updateChatViewport);window.visualViewport?.addEventListener('scroll',updateChatViewport);window.addEventListener('resize',updateChatViewport);
 $('chatClose').addEventListener('click',()=>closeAnimatedDialog($('friendChat')));$('chatBack').addEventListener('click',()=>{$('friendChat').close();openFriends();});$('friendChat').addEventListener('cancel',e=>{e.preventDefault();closeAnimatedDialog($('friendChat'));});$('friendChat').addEventListener('close',()=>{clearTimeout(chatState.timer);chatState.generation++;chatState.loading=null;if(shopState.data?.signedIn)refreshFriends(true);updateCoverMotion();});
 $('chatForm').addEventListener('submit',e=>{e.preventDefault();sendFriendMessage();});$('chatInput').addEventListener('input',()=>{if(chatState.code)chatState.drafts.set(chatState.code,$('chatInput').value);renderFriendChat();});$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();sendFriendMessage();}});$('chatOlder').addEventListener('click',()=>loadFriendChat(true));
 $('friendMessagesOpen').addEventListener('click',()=>{$('greetingPanel').close();openFriends();});document.addEventListener('band-language',()=>{renderChatNotice();if($('friendChat').open)renderFriendChat(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(chatState.timer);else if($('friendChat').open)loadFriendChat();});window.addEventListener('pagehide',()=>clearTimeout(chatState.timer));window.addEventListener('pageshow',scheduleChat);
}
