const installState={prompt:null,busy:false,standalone:()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true};
function installEnvironment(){
  const ua=navigator.userAgent||'';
  const ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const ipad=/iPad/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const android=!ios&&/Android/i.test(ua);
  const mac=!ios&&/Macintosh|MacIntel/i.test(ua+' '+(navigator.platform||''));
  const embedded=/FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\/|;\s*wv\)/i.test(ua);
  const browser=embedded?'embedded':/Edg(?:e|A|iOS)?\//i.test(ua)?'edge':/SamsungBrowser\//i.test(ua)?'samsung':/OPR\/|OPiOS\/|Opera/i.test(ua)?'opera':/Firefox\/|FxiOS\//i.test(ua)?'firefox':/Chrome\/|CriOS\//i.test(ua)?'chrome':/Version\/.+Safari\//i.test(ua)?'safari':'other';
  return {ios,ipad,android,mac,embedded,browser,safari:browser==='safari',chrome:browser==='chrome'};
}
function installBrowserName(device){return {chrome:'Chrome',safari:'Safari',edge:'Edge',samsung:'Samsung Internet',opera:'Opera',firefox:'Firefox',embedded:tx('App 內建瀏覽器','In-app browser'),other:tx('目前瀏覽器','Current browser')}[device.browser];}
function installManualSteps(device,nativeAvailable){
  if(nativeAvailable)return tx('點下方「安裝 App」，再確認安裝。','Tap “Install app” below, then confirm installation.');
  if(device.embedded)return device.ios?tx('請從這個 App 的選單選「在瀏覽器開啟」，使用 Safari 或 Chrome；也可以複製下方網址開啟。','Use this app’s menu to open the game in Safari or Chrome, or copy the link below.'):tx('請從這個 App 的選單選「在瀏覽器開啟」，使用 Chrome；也可以複製下方網址開啟。','Use this app’s menu to open the game in Chrome, or copy the link below.');
  if(device.ios)return tx('請用 Safari 或 Chrome 開啟遊戲網址，便會顯示該瀏覽器的加入主畫面步驟。','Open the game in Safari or Chrome to see that browser’s Add to Home Screen steps.');
  if(device.mac&&device.safari)return tx('在 Safari 點「分享」或上方「檔案」選單 →「加入 Dock」→「加入」。此功能需要 macOS Sonoma 14 或更新版本。','In Safari, open Share or the File menu → Add to Dock → Add. Requires macOS Sonoma 14 or later.');
  if(device.chrome&&device.android)return tx('點 Chrome 的 ⋮ 選單 →「安裝並建立捷徑」→「安裝」。較舊版本可能顯示「安裝應用程式」或「新增至主畫面」。','Open Chrome’s ⋮ menu → Add to home screen → Install. Older versions may show Install app or Add to Home screen.');
  if(device.chrome)return tx('點 Chrome 的 ⋮ 選單 →「投放、儲存及分享」→「將頁面安裝為應用程式」。也可以使用網址列出現的安裝圖示。','Open Chrome’s ⋮ menu → Cast, save and share → Install page as app. You can also use the install icon when it appears in the address bar.');
  return tx('在目前瀏覽器選單尋找「安裝應用程式」或「新增至主畫面」。若沒有此選項，請複製下方網址改用 Chrome 開啟。','Look in this browser’s menu for Install app or Add to Home screen. If unavailable, copy the link below and open it in Chrome.');
}
function installGameUrl(){return (location.protocol==='https:'&&location.origin?location.origin:'https://band-duel.bandduel-game.workers.dev')+'/play?install=1';}
function renderInstall(){
  const device=installEnvironment(),installed=installState.standalone(),nativeAvailable=!!installState.prompt&&!device.ios&&!device.embedded;
  const iosGuide=device.ios&&(device.chrome||device.safari),browserName=installBrowserName(device);
  const systemName=device.ios?(device.ipad?'iPad':'iPhone'):device.android?'Android':device.mac?'macOS':/Windows/i.test(navigator.userAgent||'')?'Windows':tx('電腦','Desktop');
  const environmentName=systemName+' · '+browserName;
  $('installApp').hidden=installed;$('installApp').textContent=device.ios?tx('加入主畫面','Add to Home Screen'):tx('安裝 Band Duel','Install Band Duel');
  $('installTitle').textContent=device.ios?tx('加入主畫面','Add to your Home Screen'):tx('安裝 Band Duel','Install Band Duel');$('installClose').textContent=tx('關閉','Close');
  $('installIntro').textContent=iosGuide?tx('在 '+browserName+' 的分享選單完成下列步驟，之後就能點主畫面圖示開啟遊戲。','Use '+browserName+'’s Share menu to complete these steps. Then open the game from its Home Screen icon.'):tx('下次點遊戲圖示就能開啟，以獨立 App 畫面遊玩。','Next time, tap the game icon to open a dedicated app window.');
  $('installPlatformHint').textContent=environmentName;
  $('installAndroidGuide').hidden=iosGuide;$('installIosPanel').hidden=!iosGuide;
  $('installAndroidTitle').textContent=environmentName;$('installIosTitle').textContent=environmentName;
  $('installAndroidSteps').textContent=installManualSteps(device,nativeAvailable);
  $('installIosSteps').textContent=tx('請操作 '+browserName+' 的分享選單：','Use '+browserName+'’s Share menu:');
  $('installIosShareTitle').textContent=tx('打開「分享」','Open Share');
  $('installIosShareText').textContent=device.chrome?tx('點 Chrome 網址列右側的「分享」（方框向上箭頭）。','Tap Share, the square with an upward arrow, on the right of Chrome’s address bar.'):tx('點 Safari 工具列的方框向上箭頭。若沒看到，先點「⋯／頁面選單」，再選「分享」。','Tap the square with an upward arrow in Safari’s toolbar. If it is hidden, open the More (…) or page menu, then choose Share.');
  $('installIosHomeTitle').textContent=tx('選「加入主畫面」','Choose Add to Home Screen');
  $('installIosHomeText').textContent=tx('往下捲動分享選單，找到「加入主畫面」；iPad 可能需先點「更多」。','Scroll down the Share menu to find Add to Home Screen. On iPad, you may need to tap More first.');
  $('installIosAddTitle').textContent=tx('確認後按「加入」','Confirm and tap Add');
  $('installIosAddText').textContent=tx('若有「打開為網頁 App／以網頁 App 開啟」，保持開啟，再按「加入」。回到主畫面即可看到 Band Duel。','If shown, keep Open as Web App enabled, then tap Add. You will find Band Duel on your Home Screen.');
  $('installIosHelpTitle').textContent=tx('沒有看到「加入主畫面」？','Cannot find Add to Home Screen?');
  $('installIosHelpText').textContent=device.chrome?tx('先在分享選單底部查看「編輯動作」。若仍沒有，請更新 iOS 與 Chrome，或複製下方網址用 Safari 開啟。','Check Edit Actions at the bottom of the Share menu. If still unavailable, update iOS and Chrome, or copy the link below and open it in Safari.'):tx('捲到 Safari 分享選單底部，點「編輯動作」，把「加入主畫面」加回列表。','At the bottom of Safari’s Share menu, tap Edit Actions and add Add to Home Screen to the list.');
  $('installNative').hidden=!nativeAvailable||installed;$('installNative').disabled=installState.busy;$('installNative').textContent=tx('安裝 App','Install app');
  $('installCopyLink').textContent=tx('複製遊戲網址','Copy game link');$('installUrl').value=installGameUrl();
  $('installNote').textContent=iosGuide?tx('加入主畫面需由你在 '+browserName+' 確認；遊戲需要網路。','Confirm Add to Home Screen in '+browserName+'. Playing requires internet.'):tx('安裝需要你在瀏覽器確認；遊戲需要網路。','Confirm installation in your browser. Playing requires internet.');
}
async function promptInstall(){
  const prompt=installState.prompt,device=installEnvironment();if(!prompt||installState.busy||device.ios||device.embedded)return;installState.busy=true;renderInstall();
  try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted'&&$('installDialog').open)$('installDialog').close();}catch{}finally{installState.prompt=null;installState.busy=false;renderInstall();}
}
async function copyInstallLink(){
  const feedback=$('installFeedback');
  try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(installGameUrl());feedback.textContent=tx('遊戲網址已複製。','Game link copied.');$('installUrl').hidden=true;}
  catch{$('installUrl').hidden=false;$('installUrl').focus();$('installUrl').select();feedback.textContent=tx('請選取下方網址後複製，再貼到瀏覽器開啟。','Select and copy the link below, then paste it into your browser.');}
}
function openInstallGuide(){renderInstall();$('installFeedback').textContent='';$('installUrl').hidden=true;if(!$('installDialog').open)$('installDialog').showModal();updateCoverMotion();}
function initInstall(){
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installState.prompt=event;renderInstall();});
  window.addEventListener('appinstalled',()=>{installState.prompt=null;$('installApp').hidden=true;if($('installDialog').open)$('installDialog').close();});
  const displayMode=matchMedia('(display-mode: standalone)');if(displayMode.addEventListener)displayMode.addEventListener('change',renderInstall);else displayMode.addListener?.(renderInstall);
  $('installApp').addEventListener('click',()=>{const device=installEnvironment();if(installState.prompt&&!device.ios&&!device.embedded)promptInstall();else openInstallGuide();});
  $('installClose').addEventListener('click',()=>closeAnimatedDialog($('installDialog')));$('installNative').addEventListener('click',promptInstall);$('installCopyLink').addEventListener('click',copyInstallLink);$('installDialog').addEventListener('close',updateCoverMotion);
  document.addEventListener('band-language',renderInstall);renderInstall();
  if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
  if(new URLSearchParams(location.search).get('install')==='1'&&!installState.standalone())openInstallGuide();
}
