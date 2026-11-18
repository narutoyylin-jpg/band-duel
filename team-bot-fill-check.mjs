import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import {D1SocialStore} from './social.mjs';
import {D1SeasonStore} from './seasons.mjs';
import {arrangePartialTeams,TEAM_CPU_FILL_WAIT_MS} from './team-matchmaking.mjs';

function harness(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
 const db={prepare(sql){let values=[];return {bind(...args){values=args;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 const store=new D1TeamStore(db),social=new D1SocialStore(db);let now=Date.now(),serial=0;
 const h={sqlite,db,store,social,get now(){return now;},set now(value){now=value;},advance(ms){now+=ms;},close(){sqlite.close();}};
 h.request=async(path='',data,id=null,token=null)=>{
  const response=await handleTeamRequest(new Request('https://game.test/api/team-rooms'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(id?{'oai-authenticated-user-id':id}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)}),store,now);
  return {status:response.status,data:await response.json()};
 };
 h.create=async(id,options={})=>{const result=await h.request('',options,id);assert.equal(result.status,201,JSON.stringify(result.data));return {id,code:result.data.view.code,token:result.data.token,view:result.data.view};};
 h.join=async(host,id)=>{const result=await h.request('/'+host.code+'/join',{},id);assert.equal(result.status,201,JSON.stringify(result.data));return {id,code:result.data.view.code,token:result.data.token,view:result.data.view};};
 h.view=async player=>{const result=await h.request('/'+player.code,undefined,player.id,player.token);assert.equal(result.status,200,JSON.stringify(result.data));player.code=result.data.code;player.view=result.data;return result.data;};
 h.command=async(player,op,extra={})=>h.request('/'+player.code+'/'+op,{requestId:'bot-fill-command-'+(++serial),...(['ready','lock','next','draft'].includes(op)?{round:player.view.round}:{}),...extra},player.id,player.token);
 h.ok=async(player,op,extra={})=>{const result=await h.command(player,op,extra);assert.equal(result.status,200,JSON.stringify(result.data));player.code=result.data.code;player.view=result.data;return result.data;};
 h.friends=async(a,b)=>{await social.ensure(a,now);await social.ensure(b,now);await social.request(a,b,now);await social.change(b,a,'accept',now);};
 h.party=async(a,b,queue='random')=>{await h.friends(a,b);const leader=await h.create(a,{queue,party:true}),peer=await h.join(leader,b);await h.view(leader);await h.ok(leader,'ready',{ready:true});await h.ok(peer,'ready',{ready:true});await h.ok(leader,'search');await h.view(peer);return [leader,peer];};
 return h;
}
const bots=view=>view.players.filter(p=>p.computer),humans=view=>view.players.filter(p=>p.joined&&!p.computer);
const checks=[];

// Custom rooms remain editable with fewer than four people. Starting requires
// at least two ready humans; only then are all unoccupied seats filled by CPUs.
for(const count of [2,3]){
 const h=harness();try{
  const host=await h.create('custom-host',{code:'CUSTOM',timed:false});
  await h.ok(host,'ready',{ready:true});assert.equal((await h.command(host,'start')).status,409,'one human cannot start a shared room');
  const players=[host];for(let i=1;i<count;i++)players.push(await h.join(host,'custom-'+i));
  for(const player of players){await h.view(player);await h.ok(player,'ready',{ready:true});}
  const started=await h.ok(host,'start');assert.equal(started.stage,'plan');assert.equal(started.humanCount,count);assert.equal(bots(started).length,4-count);assert.equal(started.clock,null);assert.equal(started.ranked,false);assert.equal(started.computer,false);
  for(const player of players){const view=await h.view(player);assert.equal(view.humanCount,count);assert.equal(view.hasComputers,true);assert.equal(view.startingPoints,12);}
  // Even an hour later, untimed human plans remain open; CPUs finish their own
  // plans without advancing the humans or the round.
  h.advance(3600000);let view=await h.view(host);assert.equal(view.stage,'plan');assert.equal(view.yourLocked,false);assert.equal(view.autoLocked,false);assert(bots(view).every(p=>p.locked));assert(humans(view).every(p=>!p.locked));assert.equal(view.history.length,0);
  for(const player of players){await h.view(player);await h.ok(player,'lock',{sequence:1,action:{ec:0,ev:0}});}
  view=await h.view(host);assert.equal(view.stage,'revealed');assert.equal(view.history.length,1);assert.deepEqual(view.history[0].autoLocked,[]);
  for(const player of players){await h.view(player);await h.ok(player,'next');}
  view=await h.view(host);assert.equal(view.stage,'plan');assert.equal(view.round,2);assert.equal(view.clock,null);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM duel_rating_events').get().n,0);
  checks.push('custom '+count+' humans, CPU fill and untimed round');
 }finally{h.close();}
}

// A lone person never starts a normal queue against three CPUs.
{
 const h=harness();try{const player=await h.create('alone',{queue:'random'});h.advance(600000);const view=await h.view(player);assert.equal(view.stage,'queue');assert.equal(view.cpuFillAt,null);assert.equal(view.humanCount,1);checks.push('single-human queue keeps waiting');}finally{h.close();}
}

for(const queue of ['random','ranked']){
 const h=harness();try{
  const a=await h.create(queue+'-a',{queue}),startedAt=h.now;h.advance(2000);const b=await h.create(queue+'-b',{queue});
  const readyAt=h.now;let av=await h.view(a),bv=await h.view(b);assert.equal(av.stage,'queue');assert.equal(av.cpuFillAt,readyAt+TEAM_CPU_FILL_WAIT_MS);assert.equal(bv.cpuFillAt,av.cpuFillAt);assert.equal(av.waitingPlayers,2);
  h.now=readyAt+TEAM_CPU_FILL_WAIT_MS-1;assert.equal((await h.view(a)).stage,'queue','15-second grace period is not shortened');
  h.now=readyAt+TEAM_CPU_FILL_WAIT_MS;const views=await Promise.all([h.view(a),h.view(b)]);assert(views.every(v=>v.stage==='lobby'));assert.equal(a.code,b.code);assert.equal(views[0].humanCount,2);assert.equal(bots(views[0]).length,2);assert.notEqual(views[0].yourTeam,views[1].yourTeam,'solo humans face each other');assert.equal(views[0].ranked,queue==='ranked');assert.equal(views[0].cpuFillAt,null);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM duel_team_queue_members').get().n,0);
  assert(h.now>startedAt+15000);checks.push(queue+' 15-second CPU fill with two opposing humans');
 }finally{h.close();}
}

// The third arrival uses the already running grace period. The final human
// takes precedence over CPU filling if present before that period expires.
for(const total of [3,4]){
 const h=harness();try{
  const players=[await h.create('arrival-a',{queue:'random'}),await h.create('arrival-b',{queue:'random'})];const deadline=(await h.view(players[0])).cpuFillAt;
  h.advance(5000);players.push(await h.create('arrival-c',{queue:'random'}));assert.equal((await h.view(players[2])).cpuFillAt,deadline);
  if(total===4){h.advance(5000);players.push(await h.create('arrival-d',{queue:'random'}));}
  else h.now=deadline;
  const views=await Promise.all(players.map(h.view));assert(views.every(v=>v.stage==='lobby'));assert.equal(new Set(players.map(p=>p.code)).size,1);assert.equal(bots(views[0]).length,4-total);assert.equal(humans(views[0]).length,total);
  const humanTeams=humans(views[0]).map(p=>p.team);assert.equal(Math.min(humanTeams.filter(t=>t==='a').length,humanTeams.filter(t=>t==='b').length),total===3?1:2);
  checks.push(total===4?'four real players preempt CPU timer':'three solo humans keep original timer and balanced sides');
 }finally{h.close();}
}

// A friend party remains together, whether it gets an all-CPU opponent team or
// one real opponent plus a CPU. No friend is moved across teams by balancing.
for(const third of [false,true]){
 const h=harness();try{
  const [leader,peer]=await h.party('party-a','party-b','ranked'),players=[leader,peer],deadline=(await h.view(leader)).cpuFillAt;assert.equal(typeof deadline,'number');
  if(third){h.advance(4000);players.push(await h.create('party-opponent',{queue:'ranked'}));assert.equal((await h.view(players[2])).cpuFillAt,deadline);}
  h.now=deadline;await Promise.all(players.map(h.view));assert.equal(leader.view.yourTeam,peer.view.yourTeam);assert.equal(bots(leader.view).length,third?1:2);assert.equal(leader.view.ranked,true);
  if(third)assert.notEqual(leader.view.yourTeam,players[2].view.yourTeam);
  checks.push(third?'friend party plus one opponent and CPU':'friend party against two CPUs');
 }finally{h.close();}
}

// Different queue rules cannot establish a shared two-human fill timer.
{
 const h=harness();try{
  const players=[await h.create('isolate-random',{queue:'random'}),await h.create('isolate-ranked',{queue:'ranked'}),await h.create('isolate-rounds',{queue:'random',rounds:12}),await h.create('isolate-skills',{queue:'random',abilityMode:'skills'})];h.advance(60000);
  for(const player of players){const view=await h.view(player);assert.equal(view.stage,'queue');assert.equal(view.cpuFillAt,null);}
  checks.push('queue, round-count and skill-rule isolation');
 }finally{h.close();}
}

// Leaving removes the old compatible pair: a new person gets a complete grace
// period, rather than inheriting an almost-expired timer from a departed peer.
{
 const h=harness();try{
  const a=await h.create('reset-a',{queue:'random'}),b=await h.create('reset-b',{queue:'random'}),oldDeadline=(await h.view(a)).cpuFillAt;
  h.advance(14000);await h.ok(b,'leave');await h.view(a);assert.equal(a.view.cpuFillAt,null);
  const c=await h.create('reset-c',{queue:'random'}),newDeadline=(await h.view(a)).cpuFillAt;assert.equal(newDeadline,h.now+15000);assert(newDeadline>oldDeadline);
  h.now=oldDeadline;assert.equal((await h.view(a)).stage,'queue');h.now=newDeadline;await Promise.all([h.view(a),h.view(c)]);assert.equal(a.code,c.code);assert.equal(a.view.stage,'lobby');checks.push('departed peer resets CPU grace period for new pair');
 }finally{h.close();}
}

// Duplicate queue entries and concurrent matchmakers cannot assign a person
// twice, make two live matches, or revive a stale queue snapshot.
{
 const h=harness();try{
  const duplicate=await Promise.all([h.request('',{queue:'random'},'dupe'),h.request('',{queue:'random'},'dupe')]);assert.equal(duplicate.filter(r=>r.status===201).length,1);assert(duplicate.some(r=>[400,409].includes(r.status)));
  const p=duplicate.find(r=>r.status===201).data;await h.ok({id:'dupe',code:p.view.code,view:p.view,token:p.token},'leave');
  const a=await h.create('claim-a',{queue:'ranked'}),b=await h.create('claim-b',{queue:'ranked'});await h.view(a);await h.view(b);const snapshots=await Promise.all([h.store.get(a.code),h.store.get(b.code)]);h.advance(15000);
  const claims=await Promise.all([h.store.matchmaker.claim(structuredClone(snapshots),arrangePartialTeams(snapshots),h.now),h.store.matchmaker.claim(structuredClone(snapshots),arrangePartialTeams(snapshots),h.now)]);assert.equal(claims.filter(Boolean).length,1);
  await Promise.all([h.view(a),h.view(b)]);assert.equal(a.code,b.code);assert.equal(a.view.humanCount,2);assert.equal(bots(a.view).length,2);assert.equal(await h.store.matchmaker.claim(structuredClone(snapshots),arrangePartialTeams(snapshots),h.now),false);
  const live=h.sqlite.prepare("SELECT COUNT(*) n FROM duel_rooms WHERE json_extract(state,'$.stage')='lobby'").get().n;assert.equal(live,1);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM duel_team_queue_members').get().n,0);
  checks.push('duplicate-account race, concurrent fill and stale-claim rejection');
 }finally{h.close();}
}

// A completed mixed ranked game updates real accounts and rewards exactly once;
// CPU rating snapshots contribute to expectation but never become accounts.
for(const total of [2,3]){
 const h=harness();try{
  const players=[];for(let i=0;i<total;i++)players.push(await h.create('rank-'+i,{queue:'ranked'}));h.advance(15000);await Promise.all(players.map(h.view));
  for(const player of players)await h.ok(player,'ready',{ready:true});for(const player of players){const view=await h.view(player);assert.equal(view.stage,'plan');assert.equal(view.ranked,true);assert.equal(bots(view).length,4-total);}
  for(let round=1;round<=5;round++){
   const room=await h.store.get(players[0].code);h.now=room.deadline+1;await Promise.all(players.map(h.view));assert(players.every(p=>p.view.stage===(round===5?'finished':'revealed')));
   if(round<5){for(const player of players)await h.ok(player,'next');for(const player of players)await h.view(player);}
  }
  const room=await h.store.get(players[0].code),events=h.sqlite.prepare("SELECT * FROM duel_rating_events WHERE format='2v2' AND settled=1").all();assert.equal(events.length,1);const participants=JSON.parse(events[0].participants);assert.equal(participants.length,total);assert(participants.every(p=>players.some(x=>x.id===p.accountId)));
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM duel_players').get().n,total);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,total);assert.equal(room.game.history.length,5);
  for(const player of players){const profile=await h.store.ranking.profile(player.id);assert.equal(profile.games,1);assert.equal(profile.rating,player.view.ratingResult.after);assert.equal((await new D1SeasonStore(h.db).view(player.id,h.now)).games,1);assert(player.view.coinReward.amount>0);}
  await Promise.all(players.map(h.view));for(const player of players)assert.equal((await h.store.ranking.profile(player.id)).games,1);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,total);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) n FROM duel_players WHERE account_id LIKE 'computer:%'").get().n,0);checks.push('complete '+total+'-human ranked match, human-only scores/monthly games/rewards and idempotence');
 }finally{h.close();}
}
console.log('Passed: '+checks.join('; ')+'.');
