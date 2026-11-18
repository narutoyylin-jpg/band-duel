// Original synthesized music and effects use separate gain controls.
const duelSound={enabled:true,homeVolume:30,duelVolume:35,effectsVolume:80,context:null,effectsGain:null,voices:new Set(),charge:null,lastMove:0,played:{},music:null,previewScene:null,previewTrack:null,previewTimer:null};
try{const saved=JSON.parse(localStorage.getItem('band-duel-audio-v2')||'null');if(saved){duelSound.enabled=saved.enabled!==false;for(const field of ['homeVolume','duelVolume','effectsVolume'])if(Number.isFinite(saved[field]))duelSound[field]=Math.max(0,Math.min(100,saved[field]));}else duelSound.enabled=localStorage.getItem('band-duel-sound')!=='off';}catch{}
function unlockSound(){
  if(!duelSound.enabled)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;if(!duelSound.context){duelSound.context=new Audio();duelSound.effectsGain=duelSound.context.createGain();duelSound.effectsGain.connect(duelSound.context.destination);applyAudioGains();}if(duelSound.context.state==='suspended')duelSound.context.resume().then(syncMusic).catch(()=>{});else syncMusic();}catch{}
}
function soundNote(frequency,duration=.09,delay=0,volume=.035,type='sine',endFrequency=null){
  const c=duelSound.context;if(!duelSound.enabled||!duelSound.effectsVolume||!c||c.state!=='running')return;
  const o=c.createOscillator(),g=c.createGain(),start=c.currentTime+delay;
  o.type=type;o.frequency.setValueAtTime(frequency,start);if(endFrequency)o.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
  g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(volume,start+.008);g.gain.exponentialRampToValueAtTime(.0001,start+duration);
  o.connect(g);g.connect(duelSound.effectsGain);duelSound.voices.add(o);o.onended=()=>{duelSound.voices.delete(o);o.disconnect();g.disconnect();};o.start(start);o.stop(start+duration+.025);return o;
}
function soundEffect(name){
  if(!duelSound.enabled||duelSound.context?.state!=='running')return;
  duelSound.played[name]=(duelSound.played[name]||0)+1;
  if(name==='tap'){soundNote(680,.065,0,.019,'sine',440);}
  else if(name==='role'){soundNote(440,.16,0,.035);soundNote(660,.22,.065,.025);}
  else if(name==='coin'){
    for(let i=0;i<12;i++){const delay=i*.065+i*i*.003;soundNote(1450+(i%3)*240,.045,delay,.019*(1-i/17),'triangle',1000);}
    soundNote(720,.23,1.24,.033,'triangle');
  }else if(name==='move'){soundNote(210,.24,0,.013,'sine',420);soundNote(630,.18,.08,.009,'sine');}
  else if(name==='lock'){soundNote(170,.12,0,.042,'triangle',75);soundNote(980,.055,.07,.024,'triangle');soundNote(540,.09,.13,.018);}
  else if(name==='reveal'){soundNote(380,.15,0,.022);soundNote(570,.22,.08,.02);}
  else if(name==='win'){[523,659,784,1047].forEach((n,i)=>soundNote(n,.48,i*.12,.036,'triangle'));}
  else if(name==='loss'){[440,349,262].forEach((n,i)=>soundNote(n,.36,i*.16,.026,'triangle'));}
  else if(name==='draw'){[440,554,660].forEach(n=>soundNote(n,.5,0,.023));}
  else if(name==='countdown'){soundNote(880,.11,0,.04,'sine',740);}
  else if(name==='countdown-final'){soundNote(1175,.16,0,.05,'triangle');soundNote(1175,.11,.19,.035,'sine');}
}
function movementSound(){if(performance.now()-duelSound.lastMove<160)return;duelSound.lastMove=performance.now();soundEffect('move');}
function startChargeSound(){stopChargeSound();duelSound.charge=soundNote(150,.68,0,.019,'sine',620);}
function stopChargeSound(){if(duelSound.charge){try{duelSound.charge.stop();}catch{}duelSound.charge=null;}}
function quietSound(){stopChargeSound();for(const v of duelSound.voices)try{v.stop();}catch{}duelSound.voices.clear();}
function renderSound(){
  const b=$('soundToggle');b.removeAttribute('aria-pressed');b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-label',tx('音樂與音效設定','Music and sound settings'));b.title=tx('音樂與音效設定','Music and sound settings');b.classList.toggle('muted',!duelSound.enabled);if($('audioSettings').open)renderAudioSettings();syncMusic();
}
function saveAudioSettings(){try{localStorage.setItem('band-duel-audio-v2',JSON.stringify({enabled:duelSound.enabled,homeVolume:duelSound.homeVolume,duelVolume:duelSound.duelVolume,effectsVolume:duelSound.effectsVolume}));}catch{}}
function applyAudioGains(){const c=duelSound.context;if(!c)return;duelSound.effectsGain?.gain.setTargetAtTime(duelSound.enabled?duelSound.effectsVolume/100:0,c.currentTime,.03);const m=duelSound.music;if(m)m.bus.gain.setTargetAtTime(duelSound.enabled?duelSound[m.scene+'Volume']/100:0,c.currentTime,.15);}
function toggleSound(){duelSound.enabled=!duelSound.enabled;saveAudioSettings();if(duelSound.enabled)unlockSound();else{quietSound();pauseMusic();}applyAudioGains();renderSound();}
function desiredMusicScene(){return duelSound.previewScene||(ui.data&&!['lobby','party','queue','closed'].includes(ui.data.stage)?'duel':'home');}
function desiredMusicTrack(scene){const id=duelSound.previewTrack||(typeof shopState!=='undefined'?shopState.data?.wallet?.[scene+'Music']:null)||DEFAULT_MUSIC[scene];return musicById(id)||musicById(DEFAULT_MUSIC[scene]);}
function musicTone(track,midi,time,duration,volume,type='sine',cutoff=2000){
  const c=duelSound.context,o=c.createOscillator(),g=c.createGain(),filter=c.createBiquadFilter();o.type=type==='piano'?'triangle':type;o.frequency.value=440*2**((midi-69)/12);filter.type='lowpass';filter.frequency.value=cutoff;
  g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(volume,time+(type==='piano'?.005:Math.min(.09,duration*.15)));g.gain.exponentialRampToValueAtTime(.0001,time+duration);
  o.connect(filter);filter.connect(g);g.connect(track.bus);g.connect(track.delay);track.voices.add(o);o.onended=()=>{track.voices.delete(o);o.disconnect();g.disconnect();filter.disconnect();};o.start(time);o.stop(time+duration+.03);
}
function musicDrum(track,time,kind){
  const c=duelSound.context;if(kind==='kick'){const o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(105,time);o.frequency.exponentialRampToValueAtTime(42,time+.14);g.gain.setValueAtTime(.10,time);g.gain.exponentialRampToValueAtTime(.0001,time+.22);o.connect(g);g.connect(track.bus);track.voices.add(o);o.onended=()=>{track.voices.delete(o);o.disconnect();g.disconnect();};o.start(time);o.stop(time+.24);return;}
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();source.buffer=track.noise;filter.type=kind==='hat'?'highpass':'bandpass';filter.frequency.value=kind==='hat'?6500:1800;filter.Q.value=.7;const duration=kind==='hat'?.07:.15;
  g.gain.setValueAtTime(kind==='hat'?.018:.037,time);g.gain.exponentialRampToValueAtTime(.0001,time+duration);source.connect(filter);filter.connect(g);g.connect(track.bus);track.voices.add(source);source.onended=()=>{track.voices.delete(source);source.disconnect();filter.disconnect();g.disconnect();};source.start(time);source.stop(time+duration+.02);
}
function scheduleMusicStep(track,step,time){
  if(scheduleScoreStep(track,step,time))return;
  const duel=track.id==='band-clash',root=(duel?[38,41,34,36]:[50,46,53,48])[Math.floor(step/16)%4],beat=60/(duel?108:78),eighth=beat/2;
  if(step%8===0){const chord=duel?[12,15,19]:[0,7,10,15];for(const note of chord)musicTone(track,root+note,time,beat*4.6,duel?.017:.023,'triangle',duel?1200:850);}
  if(duel){
    if(step%2===0)musicTone(track,root+(step%8===6?7:0),time,eighth*1.55,.057,'triangle',500);
    if(step%8===0||step%8===4)musicDrum(track,time,'kick');if(step%8===2||step%8===6)musicDrum(track,time,'snare');musicDrum(track,time,'hat');
    if(step%2===1){const melody=[24,27,31,29,24,22,27,31][Math.floor(step/2)%8];musicTone(track,root+melody,time,beat*.82,.019,'sine',2300);}
  }else{
    const melody=[12,19,22,15,19,24,22,19][step%8];musicTone(track,root+melody,time,beat*1.8,.027,'sine',2400);
    if(step%8===0)musicTone(track,root-12,time,beat*3.9,.037,'sine',400);
  }
}
function stopMusicTrack(track,fade=true){
  if(!track)return;clearInterval(track.timer);const c=duelSound.context;
  if(fade&&c){track.bus.gain.cancelScheduledValues(c.currentTime);track.bus.gain.setTargetAtTime(0,c.currentTime,.12);}
  const clean=()=>{for(const voice of track.voices)try{voice.stop();}catch{}track.voices.clear();for(const node of [track.bus,track.delay,track.feedback])try{node.disconnect();}catch{}};
  if(fade)setTimeout(clean,700);else clean();
}
function pauseMusic(){stopMusicTrack(duelSound.music,false);duelSound.music=null;}
function syncMusic(){
  const c=duelSound.context,scene=desiredMusicScene(),item=desiredMusicTrack(scene);
  if(!duelSound.enabled||!c||c.state!=='running'||document.hidden||duelSound[scene+'Volume']===0){pauseMusic();return;}
  if(duelSound.music?.scene===scene&&duelSound.music?.id===item.id)return;
  stopMusicTrack(duelSound.music);const bus=c.createGain(),delay=c.createDelay(1),feedback=c.createGain();bus.gain.setValueAtTime(0,c.currentTime);bus.gain.setTargetAtTime(duelSound[scene+'Volume']/100,c.currentTime,.3);bus.connect(c.destination);delay.delayTime.value=scene==='home'?.38:.28;feedback.gain.value=.19;delay.connect(feedback);feedback.connect(delay);feedback.connect(bus);
  const noise=c.createBuffer(1,Math.floor(c.sampleRate*.2),c.sampleRate),samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  const track={scene,id:item.id,bpm:item.bpm,bus,delay,feedback,noise,voices:new Set(),step:0,next:c.currentTime+.06,timer:null};duelSound.music=track;
  const schedule=()=>{if(duelSound.music!==track)return;while(track.next<c.currentTime+.35){scheduleMusicStep(track,track.step++,track.next);track.next+=60/track.bpm/2;}};
  schedule();track.timer=setInterval(schedule,100);if($('audioSettings').open)renderAudioSettings();
}
function renderAudioSettings(){
  $('audioTitle').textContent=tx('音樂與音效','MUSIC & SOUND');$('audioClose').textContent=tx('關閉','Close');$('audioIntro').textContent=tx('主頁與決鬥使用不同的音樂，各自調整音量。','The home screen and duels have different music. Adjust each volume independently.');$('audioMuteLabel').textContent=tx('全部靜音','Mute all');$('audioMute').checked=!duelSound.enabled;
  for(const [field,label,cn,en] of [['home','homeVolumeLabel','主頁音樂','Home music'],['duel','duelVolumeLabel','決鬥音樂','Duel music'],['effects','effectsVolumeLabel','按鍵與遊戲音效','Buttons & game effects']]){$(label).textContent=tx(cn,en);$(field+'Volume').value=duelSound[field+'Volume'];$(field+'VolumeValue').textContent=duelSound[field+'Volume']+'%';}
  const track=musicById(duelSound.music?.id);$('audioTrack').textContent=tx('目前音樂：','Now playing: ')+(track?tx(track.cn,track.en)+' · '+(duelSound.music.scene==='home'?tx('主頁','Home'):tx('決鬥','Duel')):tx('已暫停','Paused'));
  $('previewHome').textContent=tx('試聽主頁','Preview home');$('previewDuel').textContent=tx('試聽決鬥','Preview duel');$('previewEffects').textContent=tx('試聽音效','Preview effects');$('audioStatus').textContent=tx('原創電子配樂。首次點擊後開始播放，設定會保存在這個裝置。','Original electronic music starts after your first interaction. Settings are saved on this device.');
}
function openAudioSettings(){unlockSound();renderAudioSettings();$('audioSettings').showModal();}
function stopMusicPreview(){clearTimeout(duelSound.previewTimer);duelSound.previewTimer=null;duelSound.previewScene=null;duelSound.previewTrack=null;syncMusic();}
function previewMusic(scene){stopMusicPreview();duelSound.previewScene=scene;unlockSound();syncMusic();renderAudioSettings();duelSound.previewTimer=setTimeout(()=>{stopMusicPreview();renderAudioSettings();},8000);}
function initAudioSettings(){
  $('audioClose').addEventListener('click',()=>closeAnimatedDialog($('audioSettings')));$('audioMute').addEventListener('change',toggleSound);
  for(const field of ['home','duel','effects'])$(field+'Volume').addEventListener('input',e=>{duelSound[field+'Volume']=Number(e.target.value);saveAudioSettings();applyAudioGains();unlockSound();syncMusic();renderAudioSettings();});
  $('previewHome').addEventListener('click',()=>previewMusic('home'));$('previewDuel').addEventListener('click',()=>previewMusic('duel'));$('previewEffects').addEventListener('click',()=>{unlockSound();soundEffect('coin');});
  $('audioSettings').addEventListener('close',()=>{if(typeof musicShopState!=='undefined'&&musicShopState.preview){stopShopMusicPreview();if($('shop').open&&shopState.section==='music')renderMusicShop();}else stopMusicPreview();});
}
