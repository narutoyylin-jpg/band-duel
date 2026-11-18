let siteLanguage='cn';
try{siteLanguage=new URLSearchParams(location.search).get('lang')||localStorage.getItem('band-language')||'cn';}catch{}
if(!['cn','en'].includes(siteLanguage))siteLanguage='cn';
const tx=(cn,en)=>siteLanguage==='en'?en:cn;
const translationPairs=new Map(),localizedNodes=new WeakMap(),localizedAttributes=new WeakMap();
function addTranslations(pairs){for(const [cn,en] of pairs){translationPairs.set(cn,[cn,en]);if(!translationPairs.has(en))translationPairs.set(en,[cn,en]);}}
function translated(value){
  const core=value.trim(),pair=translationPairs.get(core);
  if(pair)return value.replace(core,tx(...pair));
  if(siteLanguage==='cn')return value;
  let out=value;for(const [pattern,replace] of translationPatterns)out=out.replace(pattern,replace);return out;
}
const translationPatterns=[[/請手動輸入房號 ([A-Z2-9]+)/g,'Please enter room code $1 manually.'],[/電子伏特/g,'eV']];
addTranslations([
 ['2v2 組隊試玩','2v2 team trial'],['這是 2v2 房間，請使用組隊入口。','This is a 2v2 room. Use the team entry.'],['這是 1v1 房間，請使用原本的房間入口。','This is a 1v1 room. Use the original room entry.'],['組隊正在同步，請再試一次。','The team room is syncing. Please retry.'],['組隊房間已滿。','This team room is full.'],['組隊房間已到期。','This team room expired.'],['找不到組隊房間。','Team room not found.'],['這個位置已有人，請選擇空位。','This seat is taken. Choose an empty seat.'],['四位玩家都準備好後才能開始。','All four players must be ready before starting.'],['請等到你的操作時間。','Please wait for your turn.'],['計畫版本無效。','Invalid plan version.'],['回合已更新，請重新同步。','The round changed. Please reconnect.'],['你已鎖定，請等待揭曉。','Your move is locked. Wait for the reveal.'],['組隊暫時無法同步，請稍後再試。','The team room is unavailable. Please retry.'],['組隊動作無效。','Invalid team move.'],['點數不足或超過本回合改動上限。','Not enough points or the move exceeds this round’s limit.'],

 ['音樂不存在。','Track not found.'],['請選擇有效的音樂與使用場景。','Choose a valid track and scene.'],['請先購買這首音樂。','Buy this track first.'],
 ['請先登入，才能使用好友聊天。','Sign in to message friends.'],['目前無法與這位玩家聊天，請確認好友關係。','Messaging is unavailable. Check your friendship status.'],['請輸入訊息。','Enter a message.'],['訊息需 1～400 字，請移除無效字元。','Use 1–400 characters and remove invalid characters.'],['聊天分頁無效。','Invalid chat page.'],['訊息識別無效。','Invalid message identifier.'],['這則訊息已送出，請勿重複使用識別碼。','This message was already sent. Do not reuse its identifier.'],['訊息傳送太快，請稍後再試。','Messages are being sent too quickly. Please wait.'],['已讀位置無效。','Invalid read position.'],['訊息資料過長。','Message data is too long.'],['聊天操作無效。','Invalid chat operation.'],['聊天暫時無法同步，請稍後再試。','Messages are unavailable. Please retry later.'],

 ['好友','Friends'],['發送戰鬥問候','Send a battle greeting'],
 ['請選擇有效角色技能。','Choose a valid character ability.'],['技能尚不可用或本場已經使用。','This ability is unavailable or already used this match.'],['技能動作無效。','Invalid ability action.'],['點數已滿，不需要蓄能。','Points are full; recharge is unnecessary.'],['分流需要 3 點。','Split requires 3 points.'],['這個技能會超出 ±0.16 eV 範圍。','This ability would exceed the ±0.16 eV limit.'],
 ['問候內容無效。','Invalid greeting.'],['對手加入後才能發送問候。','You can greet after an opponent joins.'],['問候已送出，請稍等 4 秒。','Greeting sent. Please wait 4 seconds.'],
 ['請先登入，才能使用好友功能。','Sign in to use friends.'],['請輸入完整的 10 碼玩家代碼。','Enter the full 10-character player code.'],['找不到這位玩家，或這是你自己的代碼。','Player not found, or this is your own code.'],['目前無法向這位玩家發送邀請。','You cannot send this player an invitation.'],['好友與待確認邀請已達上限。','Your friend and pending-request limit has been reached.'],['邀請太頻繁，請稍後再試。','Too many invitations. Try again later.'],['好友邀請已更新，請重新整理。','The friend request changed. Please refresh.'],['只有收到邀請的玩家可以接受。','Only the recipient can accept a friend request.'],['目前無法接受這個邀請。','This invitation cannot be accepted.'],['請先成為好友，才能邀請對戰。','Become friends before sending a match invitation.'],['請先建立自己的好友房間，或等待目前對局結束。','Create your own friend room or finish the current match.'],['對戰邀請無效。','Invalid match invitation.'],['好友暫時無法同步，請稍後再試。','Friends are unavailable. Please try again later.'],
 ['訪客','Guest'],['登入查看牌位','Sign in to view your rating'],['牌位配對','Ranked match'],['對手已加入','Opponent joined'],['確認雙方資料後選擇陣營','See both profiles, then choose a band'],['選擇陣營','Choose a band'],['回合數','Match length'],['5 回合','5 rounds'],['12 回合','12 rounds'],['每人 12 行動點','12 action points each'],['玩家資料與牌位','Player profile and rating'],['對戰雙方資料','Player matchup'],['玩家選單','Player menu'],['關閉成就通知','Dismiss achievement notification'],['照片頭像預覽','Photo avatar preview'],['造型分類','Skin categories'],
 ['Band Duel 動態標誌','Animated Band Duel mark'],['開始','Start'],['能帶','Bands'],['點數','Points'],['商店','Shop'],['出招','Moves'],['揭曉','Reveal'],['勝負','Winning'],
 ['造型不存在。','Skin not found.'],['金幣不足，完成對戰可取得金幣。','Not enough coins. Finish matches to earn coins.'],['商店正在同步，請再試一次。','Shop is syncing; try again.'],['請先購買這個造型。','Buy this skin first.'],['這場電腦對戰已到期。','This computer match expired.'],['商店暫時無法同步，請稍後再試。','Shop is unavailable; try again later.'],['對戰正在同步，請再試一次。','Match is syncing; try again.'],
 ['玩家積分榜','Player ratings'],['請輸入玩家暱稱。','Enter a player nickname.'],['暱稱需 2～20 字，可用中英文字、數字、空格、底線或短橫線。','Use 2–20 letters, numbers, spaces, underscores or hyphens.'],['積分資料尚未就緒，請重新同步。','Rating data is not ready. Please reconnect.'],['對戰尚未完成，不能結算積分。','The match must finish before ratings are settled.'],['請先登入，才能設定玩家暱稱。','Sign in before setting your nickname.'],['操作格式無效。','Invalid request format.'],['暱稱資料過長。','Nickname data is too long.'],['只能修改玩家暱稱。','Only the player nickname can be changed.'],['排行榜暫時無法連線，請稍後再試。','Leaderboard unavailable. Please try again.'],
 ['等待朋友加入','Waiting for friend'],
 ['配對正在同步，請稍後再試。','Matchmaking is syncing. Try again shortly.'],['房間代號需要 6 碼英文或數字。','Room codes need six letters or digits.'],['這個操作不適用。','This operation is not supported.'],['找不到這個對戰操作。','Duel action not found.'],['回合或操作識別無效。','Invalid round or action identifier.'],['回合已更新，請確認最新結果。','The round has changed. Check the latest result.'],['角色已確認，請等另一位玩家。','Role confirmed. Wait for the other player.'],['請選擇導帶或價帶。','Choose conduction or valence.'],['對方已選擇這條能帶，請點另一半確認角色。','Opponent chose this band. Tap the other half to confirm your role.'],['請由房主在模式畫面選擇。','The host must choose the mode.'],['請等待雙方加入或進入下一回合。','Wait for both players to join or enter the next round.'],['你已鎖定，請等待對方。','Your move is locked. Wait for the opponent.'],['先讓本回合先手鎖定，才輪到你操作。','The first player must lock before your turn.'],['目前不能進入下一回合。','Cannot start the next round yet.'],['請先點選導帶或價帶。','Choose a band first.'],
 ['零位差','Zero offset'],['邊界排列','Boundary alignment'],['導帶','Conduction'],['價帶','Valence'],['（電子）','(electron)'],['（電洞）','(hole)'],['Band Duel｜手機能帶對戰','Band Duel | Mobile band game'],['Band Duel 手機能帶對戰。秘密出招，一起揭曉。','Band Duel mobile band game. Secret moves, shared reveal.'],
 ['回到主頁','Home'],['首頁','Home'],['回到主頁 · 能帶講解','Home · Band lesson'],['切換語言','Switch language'],
 ['建立房間','Create room'],['建立','Create'],['房間代號','Room number'],['隨機配對','Random match'],['電腦對戰','Vs computer'],['六碼房號，輸入後自動加入','Six-character room code; joins automatically'],['6 碼房號','6-character code'],
 ['對戰大廳','Duel lobby'],['等待對手','Waiting for opponent'],['複製房號','Copy code'],['複製連結','Copy link'],['對方加入後自動繼續。','Continues automatically when your opponent joins.'],['取消','Cancel'],
 ['能帶角色','Band roles'],['選擇 Conduction band · 導帶','Choose the conduction band'],['選擇 Valence band · 價帶','Choose the valence band'],['模式','Mode'],['秘密出招與回合結果','Secret moves and round results'],
 ['材料 A、B 的導帶、價帶、電子與電洞','Bands, electrons and holes in materials A and B'],['剩餘點數','Remaining action points'],['秘密位差減少 0.02 eV','Decrease private offset by 0.02 eV'],['秘密位差增加 0.02 eV','Increase private offset by 0.02 eV'],
 ['保留點數','Hold'],['鎖定','Lock in'],['按住確認','Hold to confirm'],['動作回放','Movement replay'],['你的動作','Your move'],['對手動作','Opponent move'],['最終結果','Final result'],['播放動畫','Play animation'],['暫停動畫','Pause animation'],['下一回合','Next round'],['再開一局','New game'],
 ['此步能帶結果，點選查看動作與勝負詳情','Band result; open movement and winner details'],['擲硬幣決定先手','Opening coin determines who starts'],['開始回合','Start round'],['已鎖定','Locked'],['等待雙方完成後一起揭曉','Both players must finish before the reveal'],['這場對戰已結束','This duel has ended'],['回到大廳','Back to lobby'],
 ['Band Duel 教學','Band Duel tutorial'],['Tutorial · 怎麼玩','Tutorial · How to play'],['關閉','Close'],['教學主題','Tutorial topics'],['開始與操作','Getting started'],['讀懂能帶','Reading bands'],['勝負與點數','Winning and points'],['重新同步','Reconnect'],['離開對戰','Leave duel'],['動作與勝負詳情','Movement and winner details'],['本回合詳情','Round details'],['電子','Electrons'],['電洞','Holes'],['回合紀錄','Round history'],['目前回合','Current round'],
 ['連線尚未就緒，請再同步一次。','Connection is not ready. Please reconnect.'],['連線中斷。已鎖定的動作仍會保留，請重新同步。','Connection lost. Locked moves are saved; please reconnect.'],['請輸入完整的六碼房間代號。','Please enter the complete six-character room code.'],['現在還不能鎖定。','You cannot lock a move yet.'],['請等到你的操作時間，再調整秘密計畫。','Wait for your turn before editing your private move.'],['對戰操作無效。','Invalid duel action.'],['請在 Result 選擇回放步驟。','Choose a replay step on the Result screen.'],['教學主題無效。','Invalid tutorial topic.'],
 ['任務無效。','Invalid mission.'],['對戰模式無效。','Invalid duel mode.'],['請選擇有效的能帶。','Choose a valid band.'],['雙方需要不同的收集目標。','The collection targets must differ.'],['動作、方向或幅度無效。','Invalid action, direction or amount.'],['第一回合只能設計自身能帶。','Round 1 only allows designing your own band.'],['每次最多改動 0.04 eV。','Each later move is limited to 0.04 eV.'],['剩餘點數不足，請縮小幅度或保留點數。','Not enough points. Reduce the move or hold.'],['這個動作會超出 ±0.16 eV 範圍。','This move exceeds the ±0.16 eV range.'],['目前不能提交對戰動作。','Moves cannot be submitted at this stage.'],['請在角色畫面選擇導帶或價帶。','Choose a band on the role screen.'],['請在浮窗選擇有效模式。','Choose a valid mode in the overlay.'],['請等電腦先完成出招。','Wait for the computer to lock its move.'],['請先完成這個回合。','Finish the current round first.'],
 ['請用自己的手機建立或加入房間。','Create or join a room on your own phone.'],['這支手機沒有此房間的操作權。','This phone does not have a seat in this room.'],['請使用有效的對戰操作。','Use a valid duel action.'],['資料過長。','Request is too large.'],['操作內容無效。','Invalid request.'],['操作參數無效。','Invalid action parameters.'],['找不到房間，請確認 6 碼代號。','Room not found. Check the six-character code.'],['這個房間已到期，請開新房間。','This room expired. Create a new room.'],['雙方正在同步，請再試一次。','Both players are syncing. Please try again.'],['暫時無法建立房間，請再試一次。','Could not create a room. Please try again.'],['房間已有人加入或已結束，請建立新的房間。','Room is full or closed. Create a new room.'],['請從對戰網站操作。','Use the duel website to submit actions.'],['已複製','Copied'],['無法完成操作。','Could not complete this action.']
]);
function localizeDOM(root=document){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
    if(node.parentElement?.closest('script,style,[data-no-translate]'))continue;
    let record=localizedNodes.get(node);if(!record||node.nodeValue!==record.last)record={source:node.nodeValue};
    record.last=translated(record.source);if(node.nodeValue!==record.last)node.nodeValue=record.last;localizedNodes.set(node,record);
  }
  root.querySelectorAll('[aria-label],[aria-valuetext],[title],[alt],[placeholder],meta[name=description]').forEach(el=>{
    const records=localizedAttributes.get(el)||{};
    for(const attr of ['aria-label','aria-valuetext','title','alt','placeholder',...(el.matches('meta')?['content']:[])])if(el.hasAttribute(attr)){
      const current=el.getAttribute(attr);let r=records[attr];if(!r||current!==r.last)r={source:current};r.last=translated(r.source);el.setAttribute(attr,r.last);records[attr]=r;
    }localizedAttributes.set(el,records);
  });
  document.documentElement.lang=siteLanguage==='en'?'en':'zh-Hant';
  const toggle=document.getElementById('languageToggle');if(toggle){toggle.innerHTML=siteLanguage==='en'?'<b>EN</b> / CN':'EN / <b>CN</b>';toggle.setAttribute('aria-label',tx('切換為英文','Switch to Chinese'));}
}
function setSiteLanguage(lang){if(!['cn','en'].includes(lang))throw Error('Invalid language');siteLanguage=lang;try{localStorage.setItem('band-language',lang);const u=new URL(location.href);if(u.searchParams.has('lang')){u.searchParams.set('lang',lang);history.replaceState(null,'',u);}}catch{}localizeDOM();document.dispatchEvent(new CustomEvent('band-language'));return lang;}
function initializeLanguage(){document.getElementById('languageToggle')?.addEventListener('click',()=>setSiteLanguage(siteLanguage==='en'?'cn':'en'));localizeDOM();}
addTranslations([
 ['這個房號已被使用，請換一組或隨機產生。','This room code is taken. Choose another or generate a random code.'],
 ['賽季代幣不足，參加牌位月結可獲得。','Not enough season medals. Earn them through monthly Ranked seasons.'],
 ['賽季兌換需要登入帳號。','Season exchange requires a signed-in account.'],
 ['這是月結冠軍限定獎勵，無法購買。','This is an earned monthly champion reward and cannot be purchased.'],
 ['這個造型只能裝備在電子。','This skin can only be equipped on electrons.'],
 ['背景不存在。','This background does not exist.'],
 ['請先購買這個背景。','Purchase this background first.'],
 ['房間代號需要 6 碼英文或數字。','Room codes need six letters or digits.'],
 ['請先登入，才能保存成就。','Sign in to save achievements.']
]);
addTranslations([
 ['電腦試玩設定無效。','Invalid computer practice setting.'],
 ['電腦試玩房間無法加入，請建立四人房間。','Computer practice rooms cannot be joined. Create a four-player room instead.'],
 ['減少能帶位移','Decrease band offset'],
 ['增加能帶位移','Increase band offset'],
 ['每人每回合只能調整一條能帶，請點選要修改的導帶或價帶。','Each player can move only one band per round. Tap the conduction or valence band to choose.']
]);
addTranslations([
 ['練習模式','Practice'],
 ['指定 Type 組合僅限練習模式；正式對戰使用 Shuffle。','Fixed Type pairings are for practice only. Official matches use Shuffle.'],
 ['配對類型無效。','Invalid matchmaking type.'],
 ['組隊設定無效。','Invalid party setting.'],
 ['配對不能使用電腦或自訂房號。','Matchmaking cannot use CPUs or a custom room code.'],
 ['請選擇隨機或牌位配對。','Choose Random or Ranked matchmaking.'],
 ['請先登入，才能參加牌位或邀請好友組隊。','Sign in to play Ranked or form a party.'],
 ['你或隊友已有等待中的 2v2 配對，請先取消。','You or your teammate already have a 2v2 queue. Cancel it first.'],
 ['每個位置必須由不同玩家加入。','Each seat requires a different player.'],
 ['這場組隊配對已失效。','This team match has expired.'],
 ['這場組隊配對無法使用房號加入。','This match cannot be joined using its room code.'],
 ['請由已互相確認的好友加入隊伍。','Only accepted friends can join the party.'],
 ['請由隊長開始配對。','The party leader starts matchmaking.'],
 ['兩位隊員都準備好後才能開始配對。','Both party members must ready up before matchmaking.'],
 ['好友關係已更新，請重新組隊。','The friendship changed. Please form a new party.'],
 ['配對後只能與隊友交換角色。','Matched players can swap roles only with their teammate.'],
 ['請雙方取消準備後再交換角色。','Both teammates must unready before swapping roles.'],
 ['只有房主能在配對前設定回合數。','Only the leader can set the round count before matching.'],
 ['牌位對戰需要四個不同的登入帳號。','Team Ranked requires four different signed-in accounts.']
]);
