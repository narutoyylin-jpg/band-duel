const musicShopState={scene:'home',preview:null,timer:null};
function renderMusicShop(){
 const w=shopState.data?.wallet,owned=w?.music||FREE_MUSIC,scene=musicShopState.scene;
 $('shopMusicPlayer').hidden=shopState.section!=='music';if($('shopMusicPlayer').hidden)return;
 const current=musicById(w?.[scene+'Music']||DEFAULT_MUSIC[scene]);
 $('musicShopContent').innerHTML='<div><small>'+tx('你的播放清單','YOUR SOUNDTRACK')+'</small><h3>'+tx('為每場對決選一首歌','Set the tone for your next duel')+'</h3><p>'+tx('10 首原創配樂。先試聽 20 秒，再決定購買；主頁與決鬥可分開裝備。','10 original tracks. Preview for 20 seconds before buying. Equip home and duel music separately.')+'</p></div><div class="music-scene-tabs">'+['home','duel'].map(s=>'<button type="button" data-music-scene="'+s+'" aria-pressed="'+(s===scene)+'">'+tx(s==='home'?'主頁音樂':'決鬥音樂',s==='home'?'Home music':'Duel music')+'</button>').join('')+'</div><p class="music-equipped">'+tx('目前使用：','Equipped: ')+tx(current.cn,current.en)+'</p>';
 $('musicVolumeOpen').textContent=tx('音量設定','Sound settings');$('musicPreviewStatus').textContent=(musicShopState.preview?tx('正在試聽：','Previewing: ')+tx(musicById(musicShopState.preview).cn,musicById(musicShopState.preview).en):tx('使用音量設定調整主頁與決鬥音量。','Adjust home and duel volumes in sound settings.'));
 $('shopMusicPlayer').querySelectorAll('[data-music-scene]').forEach(b=>b.addEventListener('click',()=>{musicShopState.scene=b.dataset.musicScene;stopShopMusicPreview();renderMusicShop();}));
 $('shopItems').classList.add('music-items');$('shopItems').innerHTML=MUSIC_TRACKS.map(t=>{
  const has=owned.includes(t.id),equipped=(w?.[scene+'Music']||DEFAULT_MUSIC[scene])===t.id,preview=musicShopState.preview===t.id;
  return '<article class="music-item '+(preview?'is-previewing ':'')+(equipped?'is-equipped':'')+'" style="--track-color:'+t.color+'"><div class="music-art" aria-hidden="true"><i class="music-disc"></i><span>'+t.icon+'</span><div class="music-bars">'+[8,18,12,25,16,22,10].map((h,i)=>'<i style="height:'+h+'px;animation-delay:'+(-i*.13)+'s"></i>').join('')+'</div></div><div class="music-item-copy"><small>'+t.genre+' · '+t.bpm+' BPM</small><h3>'+tx(t.cn,t.en)+'</h3><p>'+(t.price===0?tx('免費收藏','Free collection'):has?tx('已擁有','Owned'):t.price+' '+tx('金幣','coins'))+'</p></div><div class="music-item-actions"><button type="button" data-music-preview="'+t.id+'" aria-pressed="'+preview+'">'+(preview?tx('■ 停止','■ Stop'):tx('▶ 試聽','▶ Preview'))+'</button><button type="button" '+(has?'data-music-equip':'data-music-buy')+'="'+t.id+'" '+(shopState.busy||equipped||!has&&(!w||w.coins<t.price)?'disabled':'')+'>'+(equipped?tx('使用中','Equipped'):has?tx(scene==='home'?'用於主頁':'用於決鬥',scene==='home'?'Set for home':'Set for duels'):tx('購買','Buy'))+'</button></div></article>';
 }).join('');
 $('shopItems').querySelectorAll('[data-music-preview]').forEach(b=>b.addEventListener('click',()=>previewShopMusic(b.dataset.musicPreview)));
 $('shopItems').querySelectorAll('[data-music-buy]').forEach(b=>b.addEventListener('click',()=>musicShopAction('buy',b.dataset.musicBuy)));
 $('shopItems').querySelectorAll('[data-music-equip]').forEach(b=>b.addEventListener('click',()=>musicShopAction('equip',b.dataset.musicEquip)));
}
function stopShopMusicPreview(){clearTimeout(musicShopState.timer);musicShopState.timer=null;musicShopState.preview=null;stopMusicPreview();}
function previewShopMusic(id){
 const same=musicShopState.preview===id;stopShopMusicPreview();if(same){renderMusicShop();return;}
 if(!duelSound.enabled||duelSound[musicShopState.scene+'Volume']===0){renderMusicShop();$('musicPreviewStatus').textContent=tx('目前已靜音。請先在喇叭設定開啟對應的音樂音量。','Music is muted. Enable this scene’s volume in sound settings first.');return;}
 musicShopState.preview=id;duelSound.previewTrack=id;duelSound.previewScene=musicShopState.scene;unlockSound();syncMusic();renderMusicShop();
 musicShopState.timer=setTimeout(()=>{stopShopMusicPreview();if($('shop').open&&shopState.section==='music')renderMusicShop();},20000);
}
async function musicShopAction(operation,track){
 if(shopState.busy)return;shopState.busy=true;shopState.error='';stopShopMusicPreview();renderShop();
 try{
  if(shopState.offline){const w=offlineWallet(),item=musicById(track);if(!item)throw Error(tx('音樂不存在。','Track not found.'));if(operation==='buy'&&!w.music.includes(track)){if(w.coins<item.price)throw Error(tx('金幣不足','Not enough coins'));w.coins-=item.price;w.music.push(track);}if(operation==='equip'&&w.music.includes(track))w[musicShopState.scene+'Music']=track;localStorage.setItem(offlineWalletKey,JSON.stringify(w));shopState.data.wallet=w;}
  else shopState.data.wallet=(await shopApi('/music/'+operation,operation==='buy'?{track}:{track,scene:musicShopState.scene})).wallet;
  soundEffect('role');renderShopBalance();syncMusic();
 }catch(e){shopState.error=e.message;}finally{shopState.busy=false;renderShop();}
}
function initMusicShop(){
 $('musicVolumeOpen').addEventListener('click',openAudioSettings);
 $('shop').addEventListener('close',stopShopMusicPreview);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopShopMusicPreview();});window.addEventListener('pagehide',stopShopMusicPreview);
}
