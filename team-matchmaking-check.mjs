import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import {D1SocialStore} from './social.mjs';
import {D1SeasonStore} from './seasons.mjs';
import {TEAM_SLOTS} from './team-core.mjs';
import {arrangeTeams} from './team-matchmaking.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...args){values=args;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const store=new D1TeamStore(db),social=new D1SocialStore(db),sessions=new Map();let now=Date.now(),serial=0;
const body=extra=>({requestId:'match-check-'+(++serial),...extra});
async function req(path='',data,id=null,token=null,at=now){const response=await handleTeamRequest(new Request('https://game.test/api/team-rooms'+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(id?{'oai-authenticated-user-id':id}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)}),store,at),result={status:response.status,data:await response.json()};if(result.data.token&&result.data.view){const raw=result.data.token,hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),n=>n.toString(16).padStart(2,'0')).join('');sessions.set(raw,{id,token:raw,hash});}return result;}
async function make(id,queue='random',party=false,rounds=5){const r=await req('',{queue,party,rounds},id);assert.equal(r.status,201,JSON.stringify(r.data));return {id,token:r.data.token,code:r.data.view.code,view:r.data.view};}
async function view(p){const r=await req('/'+p.code,undefined,p.id,p.token);assert.equal(r.status,200,JSON.stringify(r.data));p.view=r.data;p.code=r.data.code;return r.data;}
const cmd=(p,op,extra={})=>req('/'+p.code+'/'+op,body({...(['ready','next','lock'].includes(op)?{round:p.view.round}:{}),...extra}),p.id,p.token);
// Fixture teardown leaves every issued human session. One departure now keeps
// the match/party alive, and ranked rooms must never use the custom /close API.
async function close(p){let room=await store.get(p.code);while(room?.stage==='redirect')room=await store.get(room.redirectCode);if(!room||room.stage==='closed')return;for(const session of sessions.values()){const current=await store.get(room.code);if(current.stage==='closed')break;if(!Object.values(current.seats).includes(session.hash))continue;const result=await req('/'+current.code+'/leave',body({matchId:current.matchId}),session.id,session.token);assert.equal(result.status,200);assert.equal(result.data.left,true);}assert.equal((await store.get(room.code)).stage,'closed','all fixture humans left the room');}
async function friends(a,b){await social.ensure(a,now);await social.ensure(b,now);await social.request(a,b,now);await social.change(b,a,'accept',now);}
assert.equal((await req('',{queue:'ranked'})).status,401);
assert.equal((await req('',{queue:'random',party:true})).status,401);
{
 const a=await make('dedupe');assert([400,409].includes((await req('',{queue:'ranked'},'dedupe')).status));await close(a);
 const requests=await Promise.all([req('',{queue:'random'},'raced-dupe'),req('',{queue:'random'},'raced-dupe')]);assert.equal(requests.filter(r=>r.status===201).length,1,'one queue per account even during concurrent creation');const joined=requests.find(r=>r.status===201).data;await close({id:'raced-dupe',token:joined.token,code:joined.view.code,view:joined.view});
}
{
 const a=await make('isolation-random','random'),b=await make('isolation-ranked','ranked'),c=await make('isolation-rounds','random',false,12);for(const p of [a,b,c]){assert.equal((await view(p)).stage,'queue');await close(p);}
}
// Four independent signed-in players share the global ladder, each receiving one game.
const players=[];for(let i=0;i<4;i++)players.push(await make('ranked-'+i,'ranked'));
for(const p of players){const v=await view(p);assert.equal(v.stage,'lobby');assert.equal(v.ranked,true);assert.equal(v.players.length,4);assert.equal((await req('/'+p.code+'/join',{},'stranger')).status,409);}
assert.equal(new Set(players.map(p=>p.code)).size,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_team_queue_members').get().n,0);
for(const p of players){const r=await cmd(p,'ready',{ready:true});assert.equal(r.status,200);}
for(const p of players)assert.equal((await view(p)).stage,'plan');
let room=await store.get(players[0].code);room.goals={a:'邊界排列',b:'Type I'};const expected=room.version;room.version++;assert(await store.save(room,expected));
for(let round=1;round<=5;round++){
 now=(await store.get(players[0].code)).deadline+1;
 for(const p of players){const v=await view(p);assert.equal(v.stage,round===5?'finished':'revealed');assert.equal(v.history.length,round);if(round<5)p.view=v;}
 if(round<5){for(const p of players)assert.equal((await cmd(p,'next')).status,200);for(const p of players)await view(p);}
}
const finished=await store.get(players[0].code);for(const p of players){const v=await view(p),profile=await store.ranking.profile(p.id),winner=v.yourTeam==='a';assert.equal(profile.games,1);assert.equal(profile.rating,winner?1016:984);assert.equal(profile.wins,winner?1:0);assert.equal(v.ratingResult.change,winner?16:-16);assert.equal((await store.economy.row('account:'+p.id)).coins,winner?30:10);const season=await new D1SeasonStore(db).view(p.id,now);assert.equal(season.games,1);}
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rating_events WHERE settled=1').get().n,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rated_matches').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,4);
// Resync cannot duplicate shared Elo, coins, achievements or monthly eligibility.
for(const p of players)await view(p);assert.equal((await store.ranking.profile(players[0].id)).games,1);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,4);
// Two accepted friends stay together against two solo players.
await friends('party-a','party-b');const party=await make('party-a','random',true);assert.equal(party.view.stage,'party');assert.equal((await req('/'+party.code+'/join',{},'uninvited')).status,403);
const join=await req('/'+party.code+'/join',{},'party-b');assert.equal(join.status,201);const mate={id:'party-b',code:party.code,token:join.data.token,view:join.data.view};await view(party);
assert.equal((await cmd(party,'search')).status,409);await cmd(party,'ready',{ready:true});await cmd(mate,'ready',{ready:true});assert.equal((await cmd(party,'search')).status,200);
const soloA=await make('party-opponent-a'),soloB=await make('party-opponent-b');for(const p of [party,mate,soloA,soloB])await view(party===p?party:p);assert.equal(party.view.yourTeam,mate.view.yourTeam);assert.notEqual(party.view.yourTeam,soloA.view.yourTeam);assert.equal(soloA.view.yourTeam,soloB.view.yourTeam);assert.equal(party.view.ranked,false);await close(party);
// Concurrent matchmakers cannot redirect unrelated players into an already claimed room.
const batch=await Promise.all(Array.from({length:8},(_,i)=>make('concurrent-'+i)));
for(const p of batch)await view(p);assert(batch.every(p=>p.view.stage==='lobby'));assert.equal(new Set(batch.map(p=>p.code)).size,2);for(const code of new Set(batch.map(p=>p.code))){const group=batch.filter(p=>p.code===code);assert.equal(group.length,4);assert.equal(new Set(group.map(p=>p.view.yourSlot)).size,4);await close(group[0]);}
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_team_queue_members').get().n,0);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_coin_receipts').get().n,4,'unplayed casual matches create no rewards');
async function readyParty(a,b,ratings){
 await friends(a,b);for(const [i,id] of [a,b].entries())sqlite.prepare('UPDATE duel_players SET rating=? WHERE account_id=?').run(ratings[i],id);
 const leader=await make(a,'ranked',true),j=await req('/'+leader.code+'/join',{},b);assert.equal(j.status,201);const peer={id:b,code:leader.code,token:j.data.token,view:j.data.view};await view(leader);await cmd(leader,'ready',{ready:true});await cmd(peer,'ready',{ready:true});assert.equal((await cmd(leader,'search')).status,200);return [leader,peer];
}
// Team averages, not the difference between friends, determine eligibility.
const avgA=await readyParty('avg-high','avg-low',[2000,0]),avgB=await readyParty('avg-mid-a','avg-mid-b',[1000,1000]);for(const p of [...avgA,...avgB])await view(p);assert.equal(avgA[0].view.stage,'lobby');assert.equal(avgA[0].view.yourTeam,avgA[1].view.yourTeam);assert.notEqual(avgA[0].view.yourTeam,avgB[0].view.yourTeam);await close(avgA[0]);
const wideA=await readyParty('wide-a','wide-b',[1000,1000]),wideB=await readyParty('wide-c','wide-d',[1500,1500]);assert.equal((await view(wideA[0])).stage,'queue');assert.equal((await view(wideB[0])).stage,'queue');now+=105001;assert.equal((await view(wideA[0])).stage,'lobby','rating search widens after waiting');await close(wideA[0]);
const revoked=await readyParty('revoked-a','revoked-b',[1000,1000]);await social.change('revoked-a','revoked-b','remove',now);assert.equal((await view(revoked[0])).stage,'closed');assert.equal((await view(revoked[1])).stage,'closed');
const raceA=await readyParty('relation-race-a','relation-race-b',[1000,1000]),raceB=await readyParty('relation-race-c','relation-race-d',[1000,1000]);const snapshots=await Promise.all([store.get(raceA[0].code),store.get(raceB[0].code)]),arrangement=arrangeTeams(snapshots);await social.change('relation-race-a','relation-race-b','remove',now);assert.equal(await store.matchmaker.claim(snapshots,arrangement,now),false,'friend consent is checked in the atomic claim too');assert.equal((await view(raceA[0])).stage,'closed');await close(raceB[0]);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_team_queue_members').get().n,0);
// Standalone upgrade is additive, repeatable, and never counts invalid old self-play.
const legacy=new DatabaseSync(':memory:');legacy.exec(fs.readFileSync('standalone/schema.sql','utf8').split('CREATE TABLE `duel_rating_events`')[0]);
const insert=legacy.prepare('INSERT INTO duel_rated_matches (id,player_id,opponent_id,winner,player_before,opponent_before,player_after,opponent_after,created_at,settled) VALUES (?,?,?,?,?,?,?,?,?,1)');insert.run('old-valid','old-a','old-b','player',1000,1000,1016,984,1);insert.run('old-invalid','same','same','draw',1000,1000,1000,1000,2);
for(let i=0;i<2;i++)legacy.exec(fs.readFileSync('standalone/upgrade-team-matchmaking.sql','utf8'));assert.equal(legacy.prepare('SELECT COUNT(*) n FROM duel_rating_events').get().n,1);legacy.close();
sqlite.close();console.log('Passed: solo/party 2v2 queues, shared Elo for all four players, one monthly game per match, idempotent rewards, queue/round isolation, friend consent, fixed teammates, duplicate-account races and eight-player concurrent matching.');
