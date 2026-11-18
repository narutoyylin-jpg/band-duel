const achievementState={filter:'all',queue:[],timer:null,completed:new Set()};
function achievementArtwork(a){return a.image?'<img src="'+a.image+'" alt="" width="64" height="64" loading="lazy">':achievementIcon(a.icon);}
function achievementIcon(kind){
  const paths={start:'M12 3 20 8v8l-8 5-8-5V8Z M10 8l6 4-6 4Z',win:'M8 3h8v7a4 4 0 0 1-8 0Z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 14v5 M8 21h8',endurance:'M12 3a9 9 0 1 0 9 9 M12 7v5l4 3 M16 3h5v5',coin:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z M14 8h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-3 M12 6v12',crystal:'M7 3h10l5 7-10 11L2 10Z M2 10h20 M7 3l5 18 5-18 M7 3l-2 7 M17 3l2 7',rank:'M5 20v-6h4v6 M10 20V9h4v11 M15 20V4h4v16',crown:'M3 6l5 4 4-7 4 7 5-4-3 12H6Z M6 21h12'};
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[kind]||paths.win)+'"/></svg>';
}
function renderAchievements(){
  const summary=leaderboardState.data?.viewer?.achievements,signed=!!leaderboardState.data?.viewer?.signedIn,items=summary?.items||[],unlocked=items.filter(a=>a.unlockedAt).length;
  $('achievementHeading').textContent=tx('成就','Achievements');$('achievementCount').textContent=unlocked+' / '+ACHIEVEMENTS.length;
  $('achievementIntro').textContent=signed?tx('完整對戰才計入；電腦與真人都能累積對戰成就，同帳號互打不計。金幣看曾達到的餘額，花掉也會保留；排名與牌位成就也永久保存。','Only finished games count. Human and computer games count; same-account games do not. Coin milestones use your highest balance. Unlocked badges stay, even after spending coins or losing rank.'):tx('使用帳號登入後，開始保存你的成就。訪客與離線紀錄不會轉入帳號。','Sign in to save achievements. Guest and offline records do not transfer to your account.');
  const filters=[['all','全部','All'],['play','對戰','Games'],['coins','金幣','Coins'],['collection','收藏','Collection'],['rank','排名','Rank']];
  $('achievementFilters').innerHTML=filters.map(([key,cn,en])=>'<button data-achievement-filter="'+key+'" aria-pressed="'+(achievementState.filter===key)+'">'+tx(cn,en)+'</button>').join('');
  $('achievementFilters').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{achievementState.filter=b.dataset.achievementFilter;renderAchievements();}));
  $('achievementGrid').innerHTML=ACHIEVEMENTS.filter(a=>achievementState.filter==='all'||a.group===achievementState.filter).map(a=>{
    const item=items.find(i=>i.id===a.id),done=!!item?.unlockedAt,value=item?.progress||0,progress=done?100:value/a.target*100;
    if(a.hidden&&!done)return '<article class="achievement-card locked secret-locked"><span class="achievement-emblem">?</span><div class="achievement-content"><div class="achievement-card-heading"><h4>？？？</h4><span class="achievement-state">'+tx('隱藏成就','Hidden achievement')+'</span></div><p>'+tx('一個等待被發現的秘密。','A secret waiting to be discovered.')+'</p></div></article>';
    const date=done?new Intl.DateTimeFormat(siteLanguage==='en'?'en':'zh-TW',{year:'numeric',month:'short',day:'numeric'}).format(new Date(item.unlockedAt)):null;
    return '<article class="achievement-card '+(done?'unlocked':'locked')+'"><span class="achievement-emblem">'+achievementArtwork(a)+'</span><div class="achievement-content"><div class="achievement-card-heading"><h4>'+tx(a.cn,a.en)+'</h4><span class="achievement-state">'+(done?'✓':tx('未解鎖','Locked'))+'</span></div><p>'+tx(a.detailCn,a.detailEn)+'</p><div class="achievement-meter" role="progressbar" aria-label="'+htmlText(tx(a.cn,a.en))+'" aria-valuemin="0" aria-valuemax="'+a.target+'" aria-valuenow="'+(done?a.target:value)+'"><span style="width:'+progress+'%"></span></div><small>'+(done?tx('解鎖於 ','Unlocked ')+date:signed?value.toLocaleString()+' / '+a.target.toLocaleString():tx('登入後記錄','Sign in to track'))+'</small></div></article>';
  }).join('');
  $('achievementToastClose').setAttribute('aria-label',tx('關閉成就通知','Dismiss achievement notification'));
}
function noticeAchievements(){
  const a=leaderboardState.data?.viewer?.achievements;if(!a)return;const unlocked=a.items.filter(i=>i.unlockedAt).map(i=>i.id),key='band-duel-achievements-seen:'+a.key;
  let previous=null;try{previous=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,JSON.stringify(unlocked));}catch{}
  if(Array.isArray(previous))for(const id of unlocked.filter(id=>!previous.includes(id)))if(!achievementState.queue.includes(id))achievementState.queue.push(id);
  showAchievementNotice();
}
function showAchievementNotice(){
  if(achievementState.timer||!achievementState.queue.length)return;
  // Let the final verdict and any open editor finish before showing a notification.
  if(document.querySelector('dialog[open]')||ui.data?.stage==='finished'&&!motion.verdictAcknowledged){achievementState.timer=setTimeout(()=>{achievementState.timer=null;showAchievementNotice();},1000);return;}
  const id=achievementState.queue.shift(),badge=ACHIEVEMENTS.find(a=>a.id===id);if(!badge)return;
  $('achievementToastIcon').innerHTML=achievementArtwork(badge);$('achievementToastLabel').textContent=tx('成就解鎖','ACHIEVEMENT UNLOCKED');$('achievementToastName').textContent=tx(badge.cn,badge.en);$('achievementAnnouncement').textContent=tx('成就解鎖：','Achievement unlocked: ')+tx(badge.cn,badge.en);$('achievementToast').hidden=false;
  achievementState.timer=setTimeout(dismissAchievementNotice,6500);
}
function dismissAchievementNotice(){clearTimeout(achievementState.timer);achievementState.timer=null;$('achievementToast').hidden=true;showAchievementNotice();}
function initAchievements(){
  $('achievementToastClose').addEventListener('click',dismissAchievementNotice);
  $('achievementToastOpen').addEventListener('click',()=>{openLeaderboard('achievements');dismissAchievementNotice();});
}
