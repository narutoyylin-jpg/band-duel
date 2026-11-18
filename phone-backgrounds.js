function sceneryMarkup(id){return '<div class="battle-scene" data-scene="'+id+'" aria-hidden="true"><i class="ss-orb"></i><i class="ss-geometry"></i><i class="ss-beam"></i></div>';}
function syncBattleBackground(){
 const id=shopState.data?.wallet?.background||'classic',valid=BATTLE_BACKGROUNDS.some(b=>b.id===id)?id:'classic';
 const playing=['plan','revealed','finished'].includes(ui.data?.stage);
 $('battleScenery').hidden=!playing||valid==='classic';document.body.classList.toggle('has-battle-background',playing&&valid!=='classic');
 if($('battleScenery').dataset.background!==valid){$('battleScenery').innerHTML=sceneryMarkup(valid);$('battleScenery').dataset.background=valid;}
}
function renderBackgroundShop(){
 const w=shopState.data?.wallet,seasonal=shopState.section==='season';
 const items=BATTLE_BACKGROUNDS.filter(b=>seasonal?b.currency==='medals':b.currency==='coins');
 if(!items.some(b=>b.id===shopState.preview))shopState.preview=items[0].id;
 const selected=items.find(b=>b.id===shopState.preview),owned=w?.backgrounds?.includes(selected.id),equipped=w?.background===selected.id;
 $('shopBackgroundPreview').hidden=false;
 $('shopBackgroundPreview').innerHTML='<div class="background-preview-heading"><span>'+tx('試看背景','BACKGROUND PREVIEW')+'</span><strong>'+tx(selected.cn,selected.en)+'</strong></div><div class="background-preview-stage">'+sceneryMarkup(selected.id)+'<svg viewBox="0 0 440 300" role="img" aria-label="'+tx('背景搭配能帶圖的預覽','Preview of the background behind the band diagram')+'">'+bandSVG({ec:-1,ev:1},{controlled:ui.data?.controlled||'ec'})+'</svg></div><div class="background-preview-actions"><p>'+tx('只改變你看到的戰鬥場景；不影響能帶、勝負或對手畫面。','Personal scenery only. Bands, outcomes and the opponent’s view stay unchanged.')+'</p><button id="backgroundShopAction" '+(shopState.busy||equipped||!owned&&(!w||(w[selected.currency]||0)<selected.price||seasonal&&!shopState.data?.signedIn)?'disabled':'')+'>'+(equipped?tx('使用中','Equipped'):owned?tx('使用這個背景','Equip background'):selected.price+' '+(seasonal?tx('賽季代幣 · 兌換','medals · Redeem'):tx('金幣 · 購買','coins · Buy')))+'</button></div>';
 $('shopBackgroundPreview').querySelector('button').addEventListener('click',()=>backgroundShopAction(owned?'equip':'buy',selected.id));
 $('shopItems').innerHTML=items.map(b=>'<button class="background-item" data-background-preview="'+b.id+'" aria-pressed="'+(b.id===selected.id)+'"><span class="background-thumb">'+sceneryMarkup(b.id)+'</span><span class="background-item-name">'+tx(b.cn,b.en)+'</span><small>'+(w?.background===b.id?tx('使用中','Equipped'):w?.backgrounds?.includes(b.id)?tx('已擁有','Owned'):b.price+' '+(seasonal?tx('代幣','medals'):tx('金幣','coins')))+'</small></button>').join('');
 $('shopItems').querySelectorAll('[data-background-preview]').forEach(b=>b.addEventListener('click',()=>{shopState.preview=b.dataset.backgroundPreview;renderShop();}));
}
async function backgroundShopAction(operation,background){
 if(shopState.busy)return;shopState.busy=true;shopState.error='';renderShop();
 try{
  if(shopState.offline){const w=offlineWallet(),item=BATTLE_BACKGROUNDS.find(b=>b.id===background);if(item.currency==='medals')throw Error(tx('賽季兌換需要登入帳號。','Season rewards require a signed-in account.'));if(operation==='buy'&&!w.backgrounds.includes(background)){if(w.coins<item.price)throw Error(tx('金幣不足','Not enough coins'));w.coins-=item.price;w.backgrounds.push(background);}if(operation==='equip'&&w.backgrounds.includes(background))w.background=background;localStorage.setItem(offlineWalletKey,JSON.stringify(w));shopState.data.wallet=w;}
  else shopState.data.wallet=(await shopApi('/background/'+operation,{background})).wallet;
  soundEffect('role');renderShopBalance();syncBattleBackground();
 }catch(e){shopState.error=e.message;}finally{shopState.busy=false;renderShop();}
}
