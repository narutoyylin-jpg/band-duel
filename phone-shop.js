const shopState={data:null,pending:null,busy:false,error:'',carrier:'electron',category:'all',section:'skins',preview:'lattice',offline:location.protocol==='file:',rewarded:new Set()};
const offlineWalletKey='band-duel-offline-wallet-v1';
function offlineWallet(){try{const w=JSON.parse(localStorage.getItem(offlineWalletKey));if(w&&Number.isInteger(w.coins)&&w.coins>=0&&Array.isArray(w.owned))return {...w,medals:0,backgrounds:w.backgrounds||['classic'],background:w.background||'classic',music:w.music||[...FREE_MUSIC],homeMusic:w.homeMusic||DEFAULT_MUSIC.home,duelMusic:w.duelMusic||DEFAULT_MUSIC.duel};}catch{}return {coins:0,medals:0,backgrounds:['classic'],background:'classic',music:[...FREE_MUSIC],homeMusic:DEFAULT_MUSIC.home,duelMusic:DEFAULT_MUSIC.duel,owned:['classic'],electron:'classic',hole:'classic',receipts:[]};}
async function shopApi(path='',body){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);try{const response=await fetch('/api/shop'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:abort.signal});const data=await response.json();if(!response.ok)throw Error(data.error||tx('商店無法同步','Shop unavailable'));return data;}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error(tx('連線中斷，請重新同步。','Connection interrupted; reconnect.'));throw e;}finally{clearTimeout(timer);}}
async function ensureShop(refresh=false){
 if(shopState.pending)return shopState.pending;if(shopState.data&&!refresh)return shopState.data;
 shopState.pending=(async()=>{shopState.data=shopState.offline?{wallet:offlineWallet(),signedIn:false,catalog:SKINS,rewards:COIN_REWARDS}:await shopApi();renderShopBalance();syncBattleBackground();renderSeasons();syncMusic();return shopState.data;})();
 try{return await shopState.pending;}finally{shopState.pending=null;}
}
function activeSkin(carrier){return shopState.data?.wallet?.[carrier==='e'?'electron':'hole']||'classic';}
function renderShopBalance(){if($('shopBalance'))$('shopBalance').textContent=shopState.data?String(shopState.data.wallet.coins):'—';}
function renderShop(){
 const d=shopState.data,c=shopState.carrier,w=d?.wallet,skins=shopState.section==='skins',music=shopState.section==='music';$('shopTitle').textContent=tx('商店','Shop');$('shopClose').textContent=tx('關閉','Close');
 $('shopWallet').textContent=tx('金幣：','Coins: ')+(w?.coins??'—')+'   ·   '+tx('賽季代幣：','Season medals: ')+(w?.medals??'—');$('shopIntro').textContent=music?tx('收藏新的背景音樂，打造自己的主頁與決鬥播放清單。','Collect new soundtracks for your home screen and duels.'):skins?tx('電子與電洞分開裝備；造型不影響勝負。','Equip electrons and holes separately. Skins do not affect outcomes.'):shopState.section==='season'?tx('參加牌位月結取得代幣；兌換限定場景。冠軍電子只頒給月結第一名。','Earn medals from monthly Ranked seasons and redeem exclusive scenery. The champion electron is reserved for monthly #1.'):tx('點選場景先試看，再決定購買或使用。背景只顯示在你的戰鬥畫面。','Select a scene to preview before buying or equipping. Scenery appears only in your battle view.');
 $('shopSections').innerHTML=[['skins','載子造型','Carriers'],['backgrounds','戰鬥背景','Backgrounds'],['music','音樂','Music'],['season','賽季兌換','Season exchange']].map(([id,cn,en])=>'<button data-shop-section="'+id+'" aria-pressed="'+(shopState.section===id)+'">'+tx(cn,en)+'</button>').join('');$('shopSections').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(shopState.section==='music')stopShopMusicPreview();shopState.section=b.dataset.shopSection;renderShop();}));
 $('shopCarrierTabs').hidden=!skins;$('shopCategories').hidden=!skins;$('shopBackgroundPreview').hidden=skins||music;$('shopMusicPlayer').hidden=!music;$('shopItems').classList.toggle('music-items',music);$('seasonShop').hidden=shopState.section!=='season';
 $('shopIdentity').textContent=shopState.offline?tx('離線金幣與造型只保存在這個瀏覽器。','Offline coins and skins stay in this browser.'):d?.signedIn?tx('金幣與造型保存在你的登入帳號。','Coins and skins are saved to your signed-in account.'):tx('訪客金幣保存在這個瀏覽器的訪客身分；登入後使用獨立的帳號錢包。','Guest coins belong to this browser identity. Signing in uses a separate account wallet.');
 $('shopSignIn').hidden=shopState.offline||!!d?.signedIn;$('shopSignIn').textContent=authState.provider==='google'?tx('使用 Google 登入','Sign in with Google'):tx('登入使用帳號錢包','Sign in for an account wallet');
 $('shopCarrierTabs').innerHTML=['electron','hole'].map(f=>'<button data-shop-carrier="'+f+'" aria-pressed="'+(c===f)+'">'+(f==='electron'?tx('電子','Electrons'):tx('電洞','Holes'))+'</button>').join('');
 const categories=[['all','全部','All'],['emoji','Emoji','Emoji'],['countryball','國家球','Countryballs'],['crystal','水晶','Crystals'],['classic','經典','Classic'],['owned','已擁有','Owned']];
 $('shopCategories').setAttribute('aria-label',tx('造型分類','Skin categories'));$('shopCategories').innerHTML=categories.map(([id,cn,en])=>'<button data-shop-category="'+id+'" aria-pressed="'+(shopState.category===id)+'">'+tx(cn,en)+'</button>').join('');
 const items=SKINS.filter(s=>!s.earned&&(shopState.category==='all'||(shopState.category==='owned'?w?.owned.includes(s.id):s.category===shopState.category)));
 $('shopItems').innerHTML=items.map(s=>{const owned=w?.owned.includes(s.id),equipped=w?.[c]===s.id;return '<article class="shop-item '+(equipped?'equipped':'')+'"><svg viewBox="0 0 80 56" aria-hidden="true">'+carrierSkinSVG(s.id,c==='electron'?'e':'h',40,28,11)+'</svg><h3>'+tx(s.cn,s.en)+'</h3><p>'+(owned?tx('已擁有','Owned'):s.price+' '+tx('金幣','coins'))+'</p><button data-shop-skin="'+s.id+'" data-shop-operation="'+(owned?'equip':'buy')+'" '+(shopState.busy||equipped||!owned&&(!w||w.coins<s.price)?'disabled':'')+'>'+(equipped?tx('使用中','Equipped'):owned?tx('使用','Equip'):tx('購買','Buy'))+'</button></article>';}).join('');
 $('shopRewardsTitle').textContent=tx('如何賺金幣？','How do I earn coins?');$('shopRewards').innerHTML='<div><b>'+tx('隨機／牌位配對','Random / Ranked match')+'</b><span>'+tx('勝 30 · 平 20 · 負 10','Win 30 · Draw 20 · Lose 10')+'</span></div><div><b>'+tx('電腦對戰','Vs computer')+'</b><span>'+tx('勝 15 · 平 10 · 負 5','Win 15 · Draw 10 · Lose 5')+'</span></div><p>'+tx('完整打完選定的 5 或 12 回合才領取。朋友房間、教學與提前離開不給金幣。金幣不能用真錢購買。','Finish the selected five or twelve rounds to receive coins. Friend rooms, tutorials and early exits award none. Coins cannot be bought with real money.')+'</p>';
 $('shopStatus').textContent=shopState.busy?tx('正在同步…','Saving…'):translated(shopState.error);
 if(music)renderMusicShop();else if(!skins)renderBackgroundShop();renderSeasons();
 document.querySelectorAll('[data-shop-carrier]').forEach(b=>b.addEventListener('click',()=>{shopState.carrier=b.dataset.shopCarrier;renderShop();}));document.querySelectorAll('[data-shop-category]').forEach(b=>b.addEventListener('click',()=>{shopState.category=b.dataset.shopCategory;renderShop();}));document.querySelectorAll('[data-shop-skin]').forEach(b=>b.addEventListener('click',()=>shopAction(b.dataset.shopOperation,b.dataset.shopSkin)));
}
async function openShop(){stopCoverMotion();$('shop').showModal();renderShop();try{await ensureShop(true);shopState.error='';}catch(e){shopState.error=e.message;}renderShop();}
async function shopAction(operation,skin){if(shopState.busy)return;shopState.busy=true;shopState.error='';renderShop();try{
  if(shopState.offline){const w=offlineWallet(),item=SKINS.find(s=>s.id===skin);if(item.earned)throw Error(tx('此獎勵需要線上帳號。','This reward requires an online account.'));if(operation==='buy'&&!w.owned.includes(skin)){if(w.coins<item.price)throw Error(tx('金幣不足','Not enough coins'));w.coins-=item.price;w.owned.push(skin);}if(operation==='equip'&&w.owned.includes(skin))w[shopState.carrier]=skin;localStorage.setItem(offlineWalletKey,JSON.stringify(w));shopState.data.wallet=w;}
  else{const result=await shopApi('/'+operation,operation==='buy'?{skin}:{skin,carrier:shopState.carrier});shopState.data.wallet=result.wallet;}
  soundEffect('role');renderShopBalance();if(ui.data)render();if(operation==='buy'&&!shopState.offline)await loadProfileCard();
 }catch(e){shopState.error=e.message;}finally{shopState.busy=false;renderShop();}
}
function rewardText(d){return d?.coinReward?tx('本局獲得 +','Coins earned +')+d.coinReward.amount+' '+tx('金幣','coins'):'';}
async function syncCoinReward(d){
 if(d.stage!=='finished'||shopState.rewarded.has(d.code+':'+(d.matchId||ui.cpuCoinId||'')+':'+d.round))return;
 shopState.rewarded.add(d.code+':'+(d.matchId||ui.cpuCoinId||'')+':'+d.round);
 try{if(d.coinReward){await ensureShop(true);if($('shop').open)renderShop();}await loadProfileCard();}catch{}
}
function awardOfflineCpu(view){
 if(view.stage!=='finished')return view;const w=offlineWallet(),id=ui.cpuCoinId,amount=coinReward('computer',view.history.at(-1).decision.winner==='you'?'win':view.history.at(-1).decision.winner==='opponent'?'loss':'draw');
 if(!w.receipts?.includes(id)){w.coins+=amount;w.receipts=[...(w.receipts||[]),id].slice(-200);localStorage.setItem(offlineWalletKey,JSON.stringify(w));}view.coinReward={amount,kind:'computer'};return view;
}
class RemoteCpuMatch{
 constructor(id,view){this.id=id;this.current=view;this.remote=true;}
 view(){return this.current;}
 needsCpuTurn(){const d=this.current;return d.stage==='plan'&&!d.opponentLocked&&(d.firstStarter==='opponent'||d.yourLocked);}
 async run(operation,extra={}){const body={operation,matchId:this.id,requestId:crypto.randomUUID(),...(['draft','lock','ready'].includes(operation)?{round:this.current.round}:{}),...extra},result=await shopApi('/cpu',body);if((result.view.version||0)>=(this.current.version||0))this.current=result.view;this.current.matchId=this.id;return this.current;}
}
