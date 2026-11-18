const photoDraft={image:null,url:null,zoom:1,x:0,y:0,drag:null,busy:false};
let previewAvatarBackground=null;
addTranslations([['請選擇有效的頭像背景。','Choose a valid avatar background.'],['只能修改玩家暱稱、頭像、背景或國籍。','Only nickname, avatar, background or nationality can be changed.']]);
function renderBackgroundPicker(viewer,profile){
  $('avatarBackgroundControls').hidden=!viewer?.signedIn;$('avatarBackgroundTitle').textContent=tx('頭像背景','Avatar background');
  $('avatarBackgroundHint').textContent=tx('選取即保存，會顯示於個人資料、對戰與積分榜。','Saves when selected. Shown in your profile, matches and rankings.');
  const selected=avatarBackgroundId(profile?.avatarBackground);
  $('avatarBackgroundPicker').innerHTML=AVATAR_BACKGROUNDS.map(bg=>'<button type="button" data-background="'+bg.id+'" aria-label="'+tx(bg.cn,bg.en)+'" aria-pressed="'+(bg.id===selected)+'" '+(leaderboardState.busy?'disabled':'')+'><span class="background-swatch" data-avatar-background="'+bg.id+'" aria-hidden="true"><span>●</span></span><span>'+tx(bg.cn,bg.en)+'</span></button>').join('');
  const preview=id=>{previewAvatarBackground=id;$('profileHeroAvatar').dataset.avatarBackground=id||selected;};
  $('avatarBackgroundPicker').querySelectorAll('[data-background]').forEach(button=>{
    button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!leaderboardState.busy)preview(button.dataset.background);});
    button.addEventListener('pointerleave',()=>preview(null));button.addEventListener('focus',()=>preview(button.dataset.background));button.addEventListener('blur',()=>preview(null));
    button.addEventListener('click',()=>{previewAvatarBackground=null;mutateProfile({avatarBackground:button.dataset.background});});
  });
}
function renderProfileControls(viewer,profile){
  const busy=leaderboardState.busy;$('profileControls').hidden=!viewer?.signedIn;$('profileMediaActions').hidden=!viewer?.signedIn;
  $('avatarUpload').textContent=tx('從相簿／電腦選照片','Choose a photo');$('avatarUpload').disabled=busy;
  $('avatarRemove').textContent=tx('移除照片','Remove photo');$('avatarRemove').hidden=!profile?.avatarUrl;$('avatarRemove').disabled=busy;
  $('photoHint').textContent=tx('選取照片後可裁切、預覽；確認同意公開後才會上傳。','Crop and preview your selected photo. It uploads only after you agree to show it publicly.');
  $('countryLabel').textContent=tx('國籍（選填）','Nationality (optional)');$('countryHint').textContent=tx('選擇後自動保存，顯示於配對與排行榜；也可選擇不顯示。','Saved automatically and shown in matchups and rankings. You can choose not to display it.');
  const select=$('countrySelect');if(select.dataset.language!==siteLanguage){
    const codes=[...COUNTRY_CODES].sort((a,b)=>countryName(a,siteLanguage).localeCompare(countryName(b,siteLanguage),siteLanguage==='en'?'en':'zh-Hant'));
    select.innerHTML='<option value="">'+tx('不顯示','Not shown')+'</option>'+codes.map(c=>'<option value="'+c+'">'+htmlText(countryName(c,siteLanguage))+'</option>').join('');select.dataset.language=siteLanguage;
  }
  select.value=profile?.countryCode||'';select.disabled=busy;
  $('countryFlagPreview').innerHTML=flagMarkup(select.value)||'<span aria-hidden="true">◎</span>';
  renderBackgroundPicker(viewer,profile);
}
function renderProfileCard(viewer,profile){
  setAvatarElement($('profileHeroAvatar'),profile,'avatar-shell profile-hero-avatar');
  if(previewAvatarBackground)$('profileHeroAvatar').dataset.avatarBackground=previewAvatarBackground;
  $('profileEyebrow').textContent=tx('玩家檔案','PLAYER PROFILE');$('profileName').textContent=profile?.displayName||tx('訪客','Guest');
  $('profileTagline').textContent=viewer?.signedIn?tx('你的能帶，你的風格。','Your band. Your style.'):tx('登入後，保存你的資料與成就。','Sign in to keep your profile and achievements.');
  const google=authState.provider==='google';
  $('profileAccount').innerHTML='<span class="account-mark" aria-hidden="true">'+(google?'G':'✓')+'</span><span><small>'+tx('帳號驗證','ACCOUNT STATUS')+'</small><strong>'+(viewer?.signedIn?(google?tx('Google 已驗證登入','Verified Google sign-in'):tx('已登入遊戲帳號','Signed-in game account')):tx('尚未登入','Not signed in'))+'</strong></span>';
  const stat=(label,value,cls='')=>'<div class="'+cls+'"><small>'+label+'</small><strong>'+value+'</strong></div>';
  $('profileStats').innerHTML=stat(tx('牌位','TIER'),profile?tierLabel(profile.tier):'—','profile-tier')+stat(tx('積分','RATING'),profile?.rating??'—')+stat(tx('排名','RANK'),viewer?.rank?'#'+viewer.rank:'—')+stat(tx('勝','WINS'),profile?.wins??0,'stat-win')+stat(tx('敗','LOSSES'),profile?.losses??0,'stat-loss')+stat(tx('平','DRAWS'),profile?.draws??0);
  $('profileRecordHint').textContent=tx('勝敗紀錄為真人積分對戰；電腦對戰另計入成就進度。','This record counts rated human games. Computer games also count toward achievements.');
  const a=viewer?.achievements,unlocked=a?.items.filter(x=>x.unlockedAt)||[];
  $('profileAchievementSummary').innerHTML='<div><small>'+tx('已解鎖成就','ACHIEVEMENTS')+'</small><strong>'+unlocked.length+' <span>/ '+ACHIEVEMENTS.length+'</span></strong></div><div class="profile-badges">'+unlocked.slice(-3).map(item=>{const badge=ACHIEVEMENTS.find(b=>b.id===item.id);return '<span title="'+htmlText(tx(badge.cn,badge.en))+'">'+achievementArtwork(badge)+'</span>';}).join('')+'</div>';
}
function renderPhotoEditor(){
  $('avatarEditorTitle').textContent=tx('裁切照片頭像','Crop your avatar');$('avatarEditorHint').textContent=tx('拖曳移動照片，調整縮放。也可用方向鍵移動。','Drag to position your photo and adjust the zoom. Arrow keys also move the photo.');
  $('avatarZoomLabel').textContent=tx('縮放','Zoom');$('avatarConsentText').textContent=tx('我同意將頭像公開於對戰與排行榜，並確認我有權使用這張照片。','I agree to show this avatar in matches and rankings, and confirm I have permission to use this photo.');
  $('avatarEditorCancel').textContent=tx('取消','Cancel');$('avatarPhotoSave').textContent=photoDraft.busy?tx('上傳中…','Uploading…'):tx('使用這張照片','Use this photo');
  $('avatarPhotoSave').disabled=photoDraft.busy||!photoDraft.image||!$('avatarConsent').checked;$('avatarEditorCancel').disabled=photoDraft.busy;
  $('avatarZoom').disabled=photoDraft.busy;
}
function avatarCropGeometry(width=320){
  const img=photoDraft.image;if(!img)return null;const scale=Math.max(width/img.naturalWidth,width/img.naturalHeight)*photoDraft.zoom;
  const w=img.naturalWidth*scale,h=img.naturalHeight*scale;photoDraft.x=Math.max(-(w-width)/2,Math.min((w-width)/2,photoDraft.x));photoDraft.y=Math.max(-(h-width)/2,Math.min((h-width)/2,photoDraft.y));
  return {w,h,x:(width-w)/2+photoDraft.x,y:(width-h)/2+photoDraft.y};
}
function paintAvatarCrop(){const canvas=$('avatarCanvas'),g=avatarCropGeometry(canvas.width);if(!g)return;const c=canvas.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(photoDraft.image,g.x,g.y,g.w,g.h);}
async function chooseAvatarPhoto(file){
  if(!file)return;try{
    if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error(tx('請選擇 20 MB 以內的圖片。','Choose an image smaller than 20 MB.'));
    clearPhotoDraft();photoDraft.url=URL.createObjectURL(file);const img=new Image();img.src=photoDraft.url;
    try{await img.decode();}catch{throw Error(tx('無法讀取這張照片，請改用 JPG、PNG 或 WebP。','Cannot read this photo. Try JPG, PNG or WebP.'));}
    if(img.naturalWidth*img.naturalHeight>50000000)throw Error(tx('照片尺寸太大，請選擇較小的圖片。','This photo is too large. Choose a smaller image.'));
    photoDraft.image=img;$('avatarZoom').value='1';$('avatarConsent').checked=false;$('avatarEditorStatus').textContent='';renderPhotoEditor();paintAvatarCrop();$('avatarEditor').showModal();
  }catch(e){clearPhotoDraft();leaderboardState.error=e.message;renderLeaderboard();}finally{$('avatarFile').value='';}
}
function clearPhotoDraft(){if(photoDraft.url)URL.revokeObjectURL(photoDraft.url);Object.assign(photoDraft,{image:null,url:null,zoom:1,x:0,y:0,drag:null,busy:false});}
async function mutateProfile(body){
  if(leaderboardState.busy)return;let saved=false;const previousBackground=leaderboardState.data?.viewer?.profile?.avatarBackground;if(body.avatarBackground&&leaderboardState.data?.viewer?.profile)leaderboardState.data.viewer.profile.avatarBackground=body.avatarBackground;leaderboardState.busy=true;leaderboardState.error='';renderLeaderboard();
  try{const result=await rankingApi(body);saved=true;if(result.profile&&leaderboardState.data?.viewer)leaderboardState.data.viewer.profile=result.profile;leaderboardState.data=await rankingApi();}catch(e){if(body.avatarBackground&&!saved&&leaderboardState.data?.viewer?.profile)leaderboardState.data.viewer.profile.avatarBackground=previousBackground;leaderboardState.error=translated(e.message);}
  finally{leaderboardState.busy=false;renderLeaderboard();renderCoverProfile();}
}
async function uploadAvatarPhoto(){
  if(!photoDraft.image||photoDraft.busy||!$('avatarConsent').checked)return;
  photoDraft.busy=true;renderPhotoEditor();try{
    const out=document.createElement('canvas');out.width=out.height=192;const g=avatarCropGeometry(),scale=192/320,c=out.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,192,192);c.drawImage(photoDraft.image,g.x*scale,g.y*scale,g.w*scale,g.h*scale);
    let image=out.toDataURL('image/jpeg',.86);if(image.length>65000)image=out.toDataURL('image/jpeg',.65);
    await rankingApi({avatarImage:image,consent:true});leaderboardState.data=await rankingApi();$('avatarEditor').close();clearPhotoDraft();renderLeaderboard();renderCoverProfile();
  }catch(e){$('avatarEditorStatus').textContent=translated(e.message);photoDraft.busy=false;renderPhotoEditor();}
}
function initProfileControls(){
  $('leaderboard').addEventListener('close',()=>{previewAvatarBackground=null;});
  $('avatarUpload').addEventListener('click',()=>$('avatarFile').click());$('avatarFile').addEventListener('change',e=>chooseAvatarPhoto(e.target.files[0]));
  $('avatarRemove').addEventListener('click',()=>mutateProfile({removePhoto:true}));$('countrySelect').addEventListener('change',e=>mutateProfile({countryCode:e.target.value}));
  $('avatarZoom').addEventListener('input',e=>{photoDraft.zoom=Number(e.target.value);paintAvatarCrop();});$('avatarConsent').addEventListener('change',renderPhotoEditor);
  $('avatarPhotoSave').addEventListener('click',uploadAvatarPhoto);$('avatarEditorCancel').addEventListener('click',()=>{$('avatarEditor').close();clearPhotoDraft();});
  $('avatarEditor').addEventListener('cancel',e=>{if(photoDraft.busy)e.preventDefault();});$('avatarEditor').addEventListener('close',clearPhotoDraft);
  const canvas=$('avatarCanvas');canvas.tabIndex=0;canvas.addEventListener('keydown',e=>{if(!photoDraft.image||photoDraft.busy||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')photoDraft.x-=8;if(e.key==='ArrowRight')photoDraft.x+=8;if(e.key==='ArrowUp')photoDraft.y-=8;if(e.key==='ArrowDown')photoDraft.y+=8;paintAvatarCrop();});canvas.addEventListener('pointerdown',e=>{if(!photoDraft.image||photoDraft.busy)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);photoDraft.drag={pointer:e.pointerId,x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointermove',e=>{const d=photoDraft.drag;if(!d||d.pointer!==e.pointerId)return;const scale=canvas.width/canvas.getBoundingClientRect().width;photoDraft.x+=(e.clientX-d.x)*scale;photoDraft.y+=(e.clientY-d.y)*scale;d.x=e.clientX;d.y=e.clientY;paintAvatarCrop();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>photoDraft.drag=null);
  document.addEventListener('error',e=>{const parent=e.target?.tagName==='IMG'?e.target.closest('.avatar-photo'):null;if(parent){parent.classList.remove('avatar-photo');parent.classList.add('avatar-orb');parent.innerHTML='<i></i>';}},true);
}
addTranslations([['照片頭像預覽','Photo avatar preview'],['請先登入，才能設定玩家資料。','Sign in before editing your profile.'],['請選擇有效的國籍。','Choose a valid nationality.'],['請先同意公開使用這張頭像。','Agree to show this avatar publicly first.'],['請使用有效的照片頭像。','Choose a valid photo avatar.'],['照片格式無效。','Invalid photo format.'],['照片頭像太大，請重新裁切。','The avatar is too large. Crop it again.'],['請先將照片裁切成頭像。','Crop the photo before uploading.'],['只能修改玩家暱稱、頭像或國籍。','Only nickname, avatar or nationality can be changed.'],['請一次修改一項玩家資料。','Change one profile field at a time.'],['玩家資料過長。','Profile data is too large.']]);
