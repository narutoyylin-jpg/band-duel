import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function fixture(){
 const nodes=new Map(),calls={cleared:0};let language='cn';
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,open:false,textContent:'',innerHTML:'',attributes:{},dataset:{},close(){this.open=false;},setAttribute(key,value){this.attributes[key]=value;},classList:{add(){},remove(){}},style:{setProperty(){}}});return nodes.get(id);};
 const context=vm.createContext({crypto,structuredClone,URLSearchParams,document:{getElementById:node,querySelectorAll:()=>[],hidden:false},tx:(cn,en)=>language==='cn'?cn:en,siteLanguage:'cn',setTimeout:()=>1,clearTimeout(){},sessionStorage:{setItem(){},removeItem(){}},motion:{verdictAcknowledged:true},duelSound:{enabled:true,played:{}},leaderboardState:{data:{viewer:{profile:{}}}},render(){},renderTeam(){},refreshQueue(){},loadProfileCard(){},resetDraftSync(){},resetMotion(){},stopReplay(){},stopTutorialDemo(){},stopWaitingAnimation(){},syncCoinReward(){},soundEffect(){},avatarMarkup:()=>'',htmlText:x=>String(x),bandLabel:x=>x,DUEL_LENGTHS:{5:12,12:30},teamSlot:slot=>({id:slot,field:slot.endsWith('e')?'ec':'ev'}),characterName:x=>x});
 vm.runInContext(['phone.js','phone-team.js','phone-room-create.js','phone-team-matchmaking.js'].map(file=>fs.readFileSync(file,'utf8')).join('\n'),context);
 const run=code=>vm.runInContext(code,context);context.readPhone=()=>({});context.clearSession=()=>{calls.cleared++;run('ui.data=null;ui.credentials=null;');};return {context,node,calls,run,english:()=>language='en'};
}
const markup=fs.readFileSync('phone-layout.html','utf8');for(const id of ['roomClose','roomCloseResult','teamClose','roomDepartureNotice','teamDepartureNotice'])assert.equal(markup.split('id="'+id+'"').length-1,1);
{
 const {context,run,calls}=fixture();let rendered=0,operation;
 context.api=async(path,body)=>{operation={path,body};return {left:true,code:'ABC123',stage:'left'};};context.receive=()=>rendered++;
 run("ui.kind='online';ui.credentials={code:'ABC123',token:'test'};ui.data={code:'ABC123',stage:'plan',matchId:'current',round:2};");
 const ack=await run("command('leave')");assert.equal(ack.left,true);assert.equal(rendered,0,'leave acknowledgments are not game views');assert.equal(operation.body.matchId,'current');
 await run('leave()');assert.equal(calls.cleared,1,'leave ack clears local session without requiring the whole room to close');assert.equal(run('ui.credentials'),null);
}
{
 const {context,run,calls}=fixture();let rendered=0;context.teamApi=async()=>({left:true,stage:'left',code:'ABC123'});context.receiveTeam=()=>rendered++;
 run("ui.kind='team';ui.credentials={code:'ABC123',token:'test'};ui.data={code:'ABC123',stage:'finished',matchId:'current',round:5};");
 const ack=await run("teamCommand('leave')");assert.equal(ack.left,true);assert.equal(rendered,0);await run('leave()');assert.equal(calls.cleared,1);
}
{
 const {context,run,calls}=fixture();context.command=async()=>({});run("ui.kind='online';ui.credentials={code:'ABC123'};ui.data={stage:'plan'};");await run('leave()');assert.equal(calls.cleared,0,'failed departure keeps the active room session');
}
{
 const {context,node,run,english}=fixture();context.view={stage:'lobby',host:true,matchmaking:false,computer:false,code:'ABC123',yourProfile:{},lastDeparture:{name:'Alice',slot:'ae',hostTransferred:true,hostName:'Bob'}};
 run("ui.kind='online';ui.credentials={code:'ABC123'};renderRoomLifecycle(view);renderRoomWaiting(view);");assert.equal(node('roomClose').hidden,false);assert.equal(node('roomWaitingInvite').hidden,false,'new host can invite into the surviving room');assert.match(node('roomDepartureNotice').textContent,/Alice.*房間仍保留.*Bob 接任房主/);assert.equal(node('cancelWait').textContent,'離開房間');
 context.view.host=false;run('renderRoomLifecycle(view);renderRoomWaiting(view);');assert.equal(node('roomClose').hidden,true);assert.equal(node('roomWaitingInvite').hidden,true,'non-host cannot issue host invitations');
 context.view.host=true;context.view.stage='plan';context.view.hasComputers=true;run('renderRoomLifecycle(view,true)');assert.equal(node('teamClose').hidden,false);assert.match(node('teamDepartureNotice').textContent,/電腦接手/);
 context.view.stage='party';context.view.hasComputers=false;run('renderRoomLifecycle(view,true)');assert.doesNotMatch(node('teamDepartureNotice').textContent,/電腦/);assert.match(node('teamDepartureNotice').textContent,/可邀請其他朋友/);
 context.view.matchmaking=true;run('renderRoomLifecycle(view,true)');assert.equal(node('teamClose').hidden,true,'matchmaking has no private host-close control');
 english();context.view.matchmaking=false;context.view.stage='plan';context.view.hasComputers=true;run('renderRoomLifecycle(view,true)');assert.doesNotMatch(node('teamDepartureNotice').textContent,/[\u4e00-\u9fff]/);assert.match(node('teamDepartureNotice').textContent,/CPU.*Bob is now the host/);
}
{
 const {context,run,calls}=fixture();let closed=0;context.command=async operation=>{assert.equal(operation,'close');closed++;run("ui.data.stage='closed';");};
 run("ui.kind='online';ui.credentials={code:'ABC123'};ui.data={stage:'lobby',host:false,matchmaking:false};");await run('requestRoomClose()');assert.equal(closed,0);
 run('ui.data.host=true;ui.data.matchmaking=true;');await run('requestRoomClose()');assert.equal(closed,0);
 run('ui.data.matchmaking=false;');await run('requestRoomClose()');assert.equal(closed,1);assert.equal(calls.cleared,1,'explicit host close returns home after server closure');
}
{
 const {context,node,run}=fixture();context.view={stage:'lobby',host:true,matchmaking:false,computer:false,minimumHumans:1,skills:{enabled:false},yourSlot:'ae',yourTeam:'a',yourReady:true,roundLimit:5,timed:true,players:['ae','av','be','bv'].map((slot,i)=>({slot,team:slot[0],field:slot.endsWith('e')?'ec':'ev',joined:true,computer:i>0,ready:true,profile:{}}))};
 run('renderTeamLobby(view)');assert.equal(node('teamStart').disabled,false);assert.match(node('teamLobbyHint').textContent,/仍可與電腦繼續/);
 context.view.minimumHumans=2;run('renderTeamLobby(view)');assert.equal(node('teamStart').disabled,true,'initial one-human custom room still needs another real player');
}
console.log('Passed: individual leave acknowledgments, no rendering of departed seats, retained session on failure, separate host-only room closure, host-transfer invitations, CPU takeover/party notices, bilingual departure text, and solo continuation readiness.');
