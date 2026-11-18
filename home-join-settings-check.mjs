import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('phone-layout.html','utf8');
const lobby=html.slice(html.indexOf('<section id="lobby"'),html.indexOf('<section id="waiting"'));
assert(lobby.includes('id="homeJoinOpen"'),'join room remains a homepage action');
assert(!/<details\b[\s\S]*?id="homeJoinOpen"/.test(lobby),'join room must not be hidden in More');
assert(!html.includes('id="teamOpen"'),'remove redundant 2v2 Rooms entry');
for(const id of ['homeJoinSubmit','roomSetupTimer','teamTimedSwitch'])assert(html.includes('id="'+id+'"'));
for(const file of ['phone-battle-view.js','phone-team.js','phone-team-matchmaking.js','phone-room-create.js','phone-events.js'])new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});

const nodes=new Map(),calls=[],ui={busy:false,data:null,credentials:null,queue:null,error:''};
const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,open:false,textContent:'',innerHTML:'',value:'',dataset:{},attributes:{},events:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.events[k]=fn;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
const context=vm.createContext({
  console,Date,URLSearchParams,ui,$:node,tx:(zh,en)=>zh,translated:s=>s,DUEL_LENGTHS:{5:12,12:26},
  leaderboardState:{data:null},teamMatchUi:{format:'1v1'},abilityUi:{mode:'classic'},shopState:{offline:true},
  htmlText:s=>String(s??''),avatarMarkup:()=>'<span class="avatar-shell"></span>',bandLabel:f=>f==='ec'?'導帶':'價帶',
  characterName:id=>id||'未選擇',teamPlayerName:p=>p.computer?'CPU':p.profile?.displayName||'玩家',teamName:t=>'隊伍 '+t,
  document:{querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem(){return null;}},
  renderAbilityRules(){},renderQueueExtras(){},syncWaitingAnimation(){},stopCoverMotion(){},updateCoverMotion(){},
  showAchievementNotice(){},soundEffect(){},loadProfileCard:async()=>{},closeAnimatedDialog:el=>el.close(),
  ROOM_CODE_PATTERN:/^[A-Z0-9]{6}$/,normalizeRoomCode:s=>String(s||'').trim().toUpperCase(),randomRoomCode:()=>'ABC123',
  connect:async(kind,code,options)=>{calls.push({format:'1v1',kind,code,options});ui.credentials={code};},
  connectTeam:async(kind,code,options)=>{calls.push({format:'2v2',kind,code,options});ui.credentials={code};},
});
vm.runInContext(fs.readFileSync('phone-room-create.js','utf8'),context);
vm.runInContext(fs.readFileSync('phone-team-matchmaking.js','utf8'),context);
vm.runInContext('initRoomCreate();renderRoomCreate();',context);
assert.equal(node('roomSetupTimer').attributes['aria-checked'],'true');
node('roomSetupTimer').events.click();assert.equal(node('roomSetupTimer').attributes['aria-checked'],'false');
node('roomCreateInput').value='ABC123';await vm.runInContext('submitRoomCreate()',context);
assert.equal(calls[0].format,'1v1');assert.equal(calls[0].options.timed,false);
ui.credentials=null;vm.runInContext("roomCreateState.format='2v2';roomCreateState.timed=true;",context);
await vm.runInContext('submitRoomCreate()',context);assert.equal(calls[1].format,'2v2');assert.equal(calls[1].options.timed,true);

const slots=[['ae','a','ec'],['av','a','ev'],['be','b','ec'],['bv','b','ev']];
const room=(humans=2)=>({host:true,stage:'lobby',roundLimit:5,yourSlot:'ae',yourTeam:'a',yourReady:true,timed:true,minimumHumans:2,skills:{enabled:false},players:slots.map(([slot,team,field],i)=>({slot,team,field,joined:i<humans,ready:i<humans,computer:false,profile:null}))});
context.current=room(1);vm.runInContext('renderTeamLobby(current)',context);assert.equal(node('teamStart').disabled,true,'one-human friend room waits');
context.current=room(2);vm.runInContext('renderTeamLobby(current)',context);assert.equal(node('teamStart').disabled,false,'two ready humans can start with empty seats');
context.current.players[1].ready=false;vm.runInContext('renderTeamLobby(current)',context);assert.equal(node('teamStart').disabled,true,'every human must ready up');
context.current=room(2);context.current.timed=false;vm.runInContext('renderTeamLobby(current)',context);assert.equal(node('teamTimedSwitch').attributes['aria-checked'],'false');assert.equal(node('teamTimingControl').hidden,false);
context.current.host=false;vm.runInContext('renderTeamLobby(current)',context);assert.equal(node('teamTimedSwitch').disabled,true,'only the host changes timer');
context.current=room(1);context.current.computer=true;context.current.players.forEach((p,i)=>{p.joined=true;p.ready=true;p.computer=i>0;});vm.runInContext('renderTeamLobby(current)',context);assert.equal(node('teamStart').disabled,false,'solo CPU practice is retained');
context.current=room(2);context.current.matchmaking=true;context.current.hasComputers=true;context.current.players.forEach((p,i)=>{p.joined=true;p.ready=true;p.computer=i>1;});vm.runInContext('renderTeamLobby(current)',context);assert.equal(node('teamTimingControl').hidden,true,'official matching keeps its timer');
assert.match(node('teamLobbyHint').textContent,/真人全部準備/);
context.current.yourReady=false;context.current.players[1].computer=true;assert.equal(vm.runInContext('teamSeatDisabled(current,current.players[1])',context),false,'an unready human can switch with a ready CPU teammate');
context.current={...room(2),stage:'queue',queueKind:'ranked',partySize:1,waitingPlayers:2,cpuFillAt:Date.now()+12000};vm.runInContext('renderTeamQueue(current)',context);assert.match(node('waitingStatus').textContent,/再等 1[12] 秒/);
console.log('Passed: visible homepage joining, removed 2v2 Rooms entry, room timer payloads, host timer permissions, two-human room readiness, solo practice, CPU role swapping, and matchmaking fill countdown.');
