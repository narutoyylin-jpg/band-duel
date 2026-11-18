import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function fixture(){
 const nodes=new Map(),calls={timers:0,resets:0,render:0};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,open:false,textContent:'',close(){this.open=false;},classList:{add(){},remove(){}},style:{setProperty(){}}});return nodes.get(id);};
 const context=vm.createContext({console,crypto,structuredClone,URLSearchParams,setTimeout:()=>{calls.timers++;return calls.timers;},clearTimeout(){},sessionStorage:{setItem(){},removeItem(){}},document:{getElementById:node,hidden:false,querySelectorAll:()=>[]},siteLanguage:'cn',tx:(cn,en)=>context.siteLanguage==='cn'?cn:en,motion:{verdictAcknowledged:false},duelSound:{enabled:true,played:{}},resetDraftSync(){calls.resets++;},resetMotion(){context.motion.verdictAcknowledged=false;node('verdict').close();},stopReplay(){},stopTutorialDemo(){},stopWaitingAnimation(){},syncCoinReward(){},render(){calls.render++;},renderTeam(){calls.render++;},soundEffect(){},goalDirection:()=>1,otherBand:f=>f==='ec'?'ev':'ec',teamSlot:slot=>({id:slot,field:slot.endsWith('e')?'ec':'ev'}),normalizeDuelAction:a=>a,duelActionInfo:()=>({}),duelActions:()=>[],refreshQueue(){},loadProfileCard(){},playReplay(){},saveSession(){},readPhone(){return {};}});
 vm.runInContext(fs.readFileSync('phone.js','utf8')+'\n'+fs.readFileSync('phone-team.js','utf8')+'\n'+fs.readFileSync('phone-clock.js','utf8'),context);
 context.resetTeamUi=()=>{calls.resets++;vm.runInContext("teamUi.key=null;teamUi.lastSent=null;teamUi.sequence=0;teamUi.replaying=false;",context);};
 context.resetDraftSync=()=>{calls.resets++;vm.runInContext("draftSync.key=null;draftSync.last=null;draftSync.sequence=0;",context);};
 context.stopReplay=()=>vm.runInContext('ui.replayPlaying=false;',context);
 context.readPhone=()=>({});return {context,node,calls,run:code=>vm.runInContext(code,context)};
}
const markup=fs.readFileSync('phone-layout.html','utf8');for(const id of ['roomRematch','roomRematchStatus','teamRematch','teamRematchStatus'])assert.equal(markup.split('id="'+id+'"').length-1,1);
assert(fs.readFileSync('phone-events.js','utf8').includes("['roomRematch','teamRematch']"));
{
 const {context,node,run}=fixture();context.view={stage:'finished',code:'ABC123',canRematch:true,rematchReady:false,rematchReadyCount:0,rematchHumanCount:2};
 run('renderRematchControls(view)');assert.equal(node('roomRematch').hidden,true,'result must be acknowledged before rematch');
 context.motion.verdictAcknowledged=true;run('renderRematchControls(view)');assert.equal(node('roomRematch').hidden,false);assert.equal(node('roomRematch').disabled,false);assert.match(node('roomRematch').textContent,/原房再戰/);
 context.view.rematchReady=true;context.view.rematchReadyCount=1;run('renderRematchControls(view)');assert.equal(node('roomRematch').disabled,true);assert.match(node('roomRematch').textContent,/1 \/ 2/);assert.match(node('roomRematchStatus').textContent,/ABC123/);
 context.view.rematchHumanCount=1;run('renderRematchControls(view,true)');assert.match(node('teamRematch').textContent,/1 \/ 1/,'solo CPU practice counts one human');
 context.view.canRematch=false;run('renderRematchControls(view)');assert.equal(node('roomRematch').hidden,true,'matchmaking cannot rematch');
 context.view.canRematch=true;context.view.rematchReady=false;context.siteLanguage='en';run('renderRematchControls(view)');assert.match(node('roomRematch').textContent,/Rematch/);assert.doesNotMatch(node('roomRematchStatus').textContent,/[\u4e00-\u9fff]/);
}
{
 const {calls,run}=fixture();run("ui.kind='online';ui.credentials={code:'ABC123',token:'old'};ui.data={stage:'finished',canRematch:true};schedulePoll();");assert.equal(calls.timers,1,'finished custom rooms keep polling');
 run('ui.data.canRematch=false;schedulePoll();');assert.equal(calls.timers,1,'finished matching stops polling');
 assert.notEqual(run("phoneMatchKey({code:'ABC123',matchId:'old'})"),run("phoneMatchKey({code:'ABC123',matchId:'new'})"));
 run("ui.kind='cpu'");assert.equal(run("phoneMatchKey({code:'CPU',matchId:'server-id'})"),'CPU','CPU coin state remains compatible');
}
{
 const {context,run,calls,node}=fixture();run("ui.kind='online';ui.credentials={code:'ABC123',token:'token'};ui.data={code:'ABC123',matchId:'old',version:10,stage:'finished',round:5};ui.replayKey='old:5';ui.autoReplayKey='old:5';ui.coinAnimation='old';ui.roleChoicePending='ec';");context.motion.verdictAcknowledged=true;node('verdict').open=true;node('resultInfo').open=true;
 context.view={code:'ABC123',matchId:'new',version:12,stage:'role',round:1,roundLimit:12,joined:true};run('receive(view)');assert.equal(run('ui.data.matchId'),'new');assert.equal(context.motion.verdictAcknowledged,false);assert.equal(node('verdict').open,false);assert.equal(node('resultInfo').open,false);assert.equal(run('ui.coinAnimation'),null);assert.equal(run('ui.roleChoicePending'),null);assert.equal(run('ui.selectedRounds'),12);assert(calls.resets>=2);
 context.view={code:'ABC123',matchId:'old',version:11,stage:'finished',round:5};run('receive(view)');assert.equal(run('ui.data.matchId'),'new','late response cannot restore previous match');
}
{
 const {context,run}=fixture();let sent;context.api=async(path,body,credentials)=>{sent={path,body,credentials};return {stage:'finished'};};context.receive=()=>{};
 run("ui.kind='online';ui.credentials={code:'ABC123',token:'token'};ui.data={code:'ABC123',matchId:'current',round:5,stage:'finished',canRematch:true};");await run("command('rematch')");assert.equal(sent.path,'/ABC123/rematch');assert.equal(sent.body.matchId,'current');assert.equal(sent.body.round,5);assert(sent.body.requestId);
 context.teamApi=async(path,body)=>{sent={path,body};return {};};context.receiveTeam=()=>{};run("ui.kind='team';ui.busy=false;");await run("teamCommand('rematch')");assert.equal(sent.body.matchId,'current');assert.equal('round' in sent.body,false);
}
{
 const {context,run}=fixture();let sent;context.api=async(path,body)=>{sent={path,body};return {};};context.receive=()=>{};
 run("ui.kind='online';ui.credentials={code:'ABC123',token:'token'};ui.data={matchId:'current',stage:'plan',round:2,yourTurn:true,yourLocked:false,controlled:'ec',board:{ec:0,ev:0},yourBudget:12,opponentBudget:12};draftSync.key='current:2';");await run("sendPlanDraft('current:2')");assert.equal(sent.body.matchId,'current');
 context.teamApi=async(path,body)=>{sent={path,body};return {};};context.receiveTeam=()=>{};run("ui.kind='team';teamUi.key='current:2:ae';teamUi.lastSent=null;teamUi.inflight=false;");await run('sendTeamDraft()');assert.equal(sent.body.matchId,'current');
}
{
 const {context,run}=fixture();let closed=0,cleared=0;context.command=async op=>{assert.equal(op,'leave');closed++;run("ui.data.stage='closed';");};context.clearSession=()=>{cleared++;run('ui.data=null;ui.credentials=null;');};
 run("ui.kind='online';ui.credentials={code:'ABC123'};ui.data={stage:'finished'};");await run('leave()');assert.equal(closed,1,'finished online room must close server-side');assert.equal(cleared,1);
 run("ui.kind='cpu';ui.data={stage:'finished'};");await run('leave()');assert.equal(closed,1,'local CPU does not send room closure');
}
{
 const {context,run}=fixture();let release,received=0;context.api=()=>new Promise(resolve=>release=resolve);context.receive=()=>received++;
 run("ui.kind='online';ui.credentials={code:'ABC123',token:'old'};ui.data={stage:'lobby'};");const pending=run('refresh()');run("ui.credentials={code:'ABC123',token:'new'};");release({code:'ABC123',version:99,matchId:'old'});await pending;assert.equal(received,0,'old poll cannot replace a new session reusing the same room code');
}
console.log('Passed: explicit rematch consent/counts, result acknowledgment, finished-room polling, per-match coin/replay reset, stale-response fencing, matchId command/draft payloads, and finished-room closure.');
