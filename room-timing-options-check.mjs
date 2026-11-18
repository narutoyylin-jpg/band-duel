import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const rooms=new D1RoomStore(db),teams=new D1TeamStore(db),now=Date.now();let serial=0;
async function req(team,path,body,id='timer-host',token=null,at=now){
 const response=await (team?handleTeamRequest:handleRoomRequest)(new Request('https://game.test/api/'+(team?'team-rooms':'rooms')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':id,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),team?teams:rooms,at);
 return {status:response.status,data:await response.json()};
}
const action=extra=>({round:1,requestId:'timing-options-'+(++serial),...extra});
const teamAction=extra=>({requestId:'timing-team-'+(++serial),...extra});
for(const timed of [false,true]){
 const a=await req(false,'',{timed}),code=a.data.view.code,b=await req(false,'/'+code+'/join',{},'timer-peer');assert.equal(a.status,201);assert.equal(a.data.view.timed,timed);
 for(const [id,token,controlled] of [['timer-host',a.data.token,'ec'],['timer-peer',b.data.token,'ev']])assert.equal((await req(false,'/'+code+'/role',action({controlled}),id,token)).status,200);
 let v=await req(false,'/'+code+'/mode',action({mode:'shuffle'}),'timer-host',a.data.token);assert.equal(v.status,200);
 if(timed){assert.equal(v.data.clock.duration,30000);continue;}
 assert.equal(v.data.clock,null);
 const first=v.data.firstStarter==='you'?{id:'timer-host',token:a.data.token}:{id:'timer-peer',token:b.data.token},second=first.token===a.data.token?{id:'timer-peer',token:b.data.token}:{id:'timer-host',token:a.data.token};
 v=await req(false,'/'+code,undefined,first.id,first.token,now+60000);assert.equal(v.data.stage,'plan');assert.equal(v.data.yourLocked,false);assert.equal(v.data.clock,null);
 assert.equal((await req(false,'/'+code+'/draft',{round:1,sequence:1,action:{kind:'own',direction:1,amount:1}},first.id,first.token,now+60000)).status,200);
 v=await req(false,'/'+code+'/lock',action({action:{kind:'own',direction:1,amount:1}}),first.id,first.token,now+60000);assert.equal(v.status,200);
 v=await req(false,'/'+code,undefined,second.id,second.token,now+120000);assert.equal(v.data.stage,'plan');assert.equal(v.data.yourLocked,false);assert.equal(v.data.clock,null);
 v=await req(false,'/'+code+'/lock',action({action:{kind:'own',direction:1,amount:1}}),second.id,second.token,now+120000);assert.equal(v.data.stage,'revealed');assert.equal(v.data.history.length,1);
 for(const p of [first,second])v=await req(false,'/'+code+'/ready',action(),p.id,p.token,now+120000);
 assert.equal(v.data.round,2);assert.equal(v.data.clock,null);
}
assert.equal((await req(false,'',{timed:'off'})).status,400);
assert.equal((await req(false,'/match',{timed:false})).status,400);
assert.equal((await req(false,'/ranked',{timed:false})).status,400);
assert.equal((await req(true,'',{timed:'off'})).status,400);
assert.equal((await req(true,'',{queue:'random',timed:false})).status,400);
assert.equal((await req(true,'',{queue:'ranked',timed:false})).status,400);
const c=await req(true,'',{code:'TIMERS',timed:false}),path='/'+c.data.view.code,host=c.data.token;
assert.equal(c.status,201);assert.equal(c.data.view.timed,false);
let changed=await req(true,path+'/settings',teamAction({timed:true}),'timer-host',host);assert.equal(changed.data.timed,true);
changed=await req(true,path+'/settings',teamAction({timed:false}),'timer-host',host);assert.equal(changed.data.timed,false);
const j=await req(true,path+'/join',{},'team-timer-peer');assert.equal(j.status,201);
assert.equal((await req(true,path+'/settings',teamAction({timed:true}),'team-timer-peer',j.data.token)).status,403);
await req(true,path+'/ready',action({ready:true}),'timer-host',host);await req(true,path+'/ready',action({ready:true}),'team-timer-peer',j.data.token);
let started=await req(true,path+'/start',teamAction(),'timer-host',host);assert.equal(started.status,200);assert.equal(started.data.clock,null);assert.equal(started.data.hasComputers,true);
let later=await req(true,path,undefined,'timer-host',host,now+120000);assert.equal(later.status,200);assert.equal(later.data.stage,'plan');assert.equal(later.data.yourLocked,false);assert.equal(later.data.clock,null);
for(const [id,token] of [['timer-host',host],['team-timer-peer',j.data.token]])assert.equal((await req(true,path+'/lock',action({sequence:1,action:{ec:0,ev:0}}),id,token,now+120000)).status,200);
later=await req(true,path,undefined,'timer-host',host,now+122000);assert.equal(later.data.stage,'revealed');assert.equal(later.data.history.length,1);assert.deepEqual(later.data.history[0].autoLocked,[]);
sqlite.close();console.log('Passed: custom 1v1/2v2 timer on/off, no human auto-lock while disabled, mixed CPU completion, manual next round, host-only settings, and mandatory clocks in random/ranked queues.');
