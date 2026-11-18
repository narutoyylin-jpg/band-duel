(async()=>{
  const status=document.getElementById('status');
  const button=document.getElementById('googleButton'),retry=document.getElementById('loginRetry'),hint=document.getElementById('browserHint');
  retry.href=location.pathname+location.search;
  const embedded=/FBAN|FBAV|Instagram|Line\/|MicroMessenger|; wv\)/i.test(navigator.userAgent);
  if(embedded){hint.hidden=false;hint.textContent='此 App 內的瀏覽器可能無法完成 Google 登入。請從選單選「在 Chrome／Safari 開啟」，再登入。 / Open this page in Chrome or Safari to sign in.';}
  try{
    const response=await fetch('/api/auth/config',{cache:'no-store'});
    const config=await response.json();
    if(!response.ok||config.provider!=='google'||!config.configured||!config.clientId||!button.dataset.nonce)throw Error('Google 登入尚未設定完成。 / Google sign-in is not configured.');
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>{
      google.accounts.id.initialize({client_id:config.clientId,nonce:button.dataset.nonce,ux_mode:'redirect',login_uri:new URL('/api/auth/google',location.origin).href});
      google.accounts.id.renderButton(button,{theme:'filled_black',size:'large',shape:'pill',text:'signin_with',locale:'zh_TW',click_listener:()=>{status.textContent='正在前往 Google；登入後會自動回到遊戲。 / Opening Google; you will return to the game after sign-in.';retry.hidden=false;}});
    };
    script.onerror=()=>{status.textContent='無法載入 Google 登入，請檢查網路後重試。 / Google sign-in could not load. Check your connection and retry.';retry.hidden=false;};
    document.head.append(script);
  }catch(error){status.textContent=error.message;retry.hidden=false;}
})();
