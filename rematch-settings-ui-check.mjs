import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const markup=fs.readFileSync('phone-layout.html','utf8');
const nodes=new Map(),requests=[],groups=new Map();let language='cn';
const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',attributes:{},setAttribute(key,value){this.attributes[key]=value;}});return nodes.get(id);};
for(const prefix of ['room','team']){
 for(const suffix of ['RematchSettings','RematchSettingsTitle','RematchSettingsOwner','RematchSettingsSummary','RematchRoundsLabel','RematchAbilityLabel','RematchTimerLabel','RematchTimedSwitch','RematchSettingsHint'])assert.equal(markup.split('id="'+prefix+suffix+'"').length-1,1);
 groups.set(prefix,[['rounds','5'],['rounds','12'],['abilityMode','classic'],['abilityMode','skills'],['timed','false']].map(([field,value])=>({dataset:{rematchSetting:field,rematchValue:value},disabled:false,textContent:'',attributes:{},setAttribute(key,value){this.attributes[key]=value;}})));
}
const context=vm.createContext({document:{getElementById:node,querySelectorAll:selector=>groups.get(selector.startsWith('#team')?'team':'room')},tx:(cn,en)=>language==='cn'?cn:en,motion:{verdictAcknowledged:true},teamUi:{replaying:false},crypto,structuredClone});
vm.runInContext(fs.readFileSync('phone.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
context.command=(op,body)=>requests.push({op,body:structuredClone(body)});
function view(extra={}){context.current={code:'ABC123',stage:'finished',matchId:'old-match',round:5,roundLimit:5,timed:true,skills:{enabled:false},canRematch:true,canEditRematchSettings:true,rematchReady:false,rematchReadyCount:0,rematchHumanCount:2,rematchSettings:{rounds:12,abilityMode:'skills',timed:false,version:7},...extra};run('ui.data=current;ui.busy=false;');}
function render(team=false){run('renderRematchControls(current,'+team+')');}
const button=(prefix,field,value)=>groups.get(prefix).find(button=>button.dataset.rematchSetting===field&&(value===undefined||button.dataset.rematchValue===value));
for(const team of [false,true]){
 const prefix=team?'team':'room';view();render(team);
 assert.equal(node(prefix+'RematchSettings').hidden,false);assert.match(node(prefix+'RematchSettingsSummary').textContent,/12 回合 · 30 點／人.*技能模式.*無倒數/,'next settings come from the pending snapshot, not the old match');
 assert.equal(button(prefix,'rounds','12').attributes['aria-pressed'],'true');assert.equal(button(prefix,'abilityMode','skills').attributes['aria-pressed'],'true');assert.equal(button(prefix,'timed').attributes['aria-checked'],'false');
 assert(groups.get(prefix).every(button=>!button.disabled));assert.match(node(prefix+'RematchSettingsHint').textContent,/所有人都需重新同意/);
 const oldSettings=structuredClone(context.current.rematchSettings);run("changeRematchSetting('rounds','5')");assert.deepEqual(requests.at(-1),{op:'rematch-settings',body:{settingsVersion:7,rounds:5}});assert.deepEqual(context.current.rematchSettings,oldSettings,'wait for server confirmation rather than changing the snapshot optimistically');
 run("changeRematchSetting('abilityMode','classic')");assert.deepEqual(requests.at(-1),{op:'rematch-settings',body:{settingsVersion:7,abilityMode:'classic'}});
 run("changeRematchSetting('timed','true')");assert.deepEqual(requests.at(-1),{op:'rematch-settings',body:{settingsVersion:7,timed:true}});
 const count=requests.length;run("changeRematchSetting('rounds','12');changeRematchSetting('rounds','13');changeRematchSetting('abilityMode','invalid');changeRematchSetting('timed','invalid');");assert.equal(requests.length,count,'unchanged and invalid options do not send commands');
 run('requestRoomRematch()');assert.deepEqual(requests.at(-1),{op:'rematch',body:{settingsVersion:7}},'agreement carries the exact settings version');
 view({rematchReady:true,rematchReadyCount:1});render(team);assert.equal(node(prefix+'Rematch').disabled,true);assert(groups.get(prefix).every(button=>!button.disabled),'host can revise settings even after agreeing');
 view({rematchSettings:{rounds:5,abilityMode:'classic',timed:true,version:8},rematchReady:false,rematchReadyCount:0});render(team);assert.equal(node(prefix+'Rematch').disabled,false);assert.match(node(prefix+'RematchSettingsSummary').textContent,/5 回合 · 12 點／人.*經典模式.*30 秒/);run('requestRoomRematch()');assert.equal(requests.at(-1).body.settingsVersion,8);
 view({canEditRematchSettings:false});render(team);assert(groups.get(prefix).every(button=>button.disabled),'peers can inspect but cannot edit');assert.match(node(prefix+'RematchSettingsOwner').textContent,/由房主/);
 const peerCount=requests.length;run("changeRematchSetting('rounds','5')");assert.equal(requests.length,peerCount);
 view({stage:'plan'});render(team);assert.equal(node(prefix+'RematchSettings').hidden,true);run("changeRematchSetting('rounds','5')");assert.equal(requests.length,peerCount);
 view({canRematch:false});render(team);assert.equal(node(prefix+'RematchSettings').hidden,true);
 view();language='en';render(team);for(const suffix of ['RematchSettingsTitle','RematchSettingsOwner','RematchSettingsSummary','RematchSettingsHint'])assert.doesNotMatch(node(prefix+suffix).textContent,/[\u4e00-\u9fff]/);for(const b of groups.get(prefix))assert.doesNotMatch(b.textContent,/[\u4e00-\u9fff]/);language='cn';
}
assert(fs.readFileSync('phone-events.js','utf8').includes("['roomRematchSettings','teamRematchSettings']"));
console.log('Passed: host/peer next-match settings for 1v1/2v2, exact pending rounds/points/rules/timer snapshots, host revision after consent, reset consent display, settings-version agreement, no optimistic mutation, hidden in-play/matchmaking controls and complete bilingual labels.');
