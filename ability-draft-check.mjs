import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {DUEL_CHARACTERS,draftDuelSkills,selectDuelSkill,makeTerminalDuel,terminalGoalsForMode,duelActions,duelActionInfo,resolveTerminalDuel} from './duel-core.mjs';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1TeamStore,handleTeamRequest,teamView} from './team-service.mjs';
import {TEAM_SLOTS,teamSkillActions,resolveTeamRound} from './team-core.mjs';
import {teamMvp} from './team-mvp.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let values=[];return {bind(...v){values=v;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const rooms=new D1RoomStore(db),teams=new D1TeamStore(db),now=Date.now();let serial=0;
const op=extra=>({requestId:'ability-test-'+(++serial),...extra});
async function req(team,path='',body,token,id){const response=await (team?handleTeamRequest:handleRoomRequest)(new Request('https://game.test/api/'+(team?'team-rooms':'rooms')+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(id?{'oai-authenticated-user-id':id}:{})},body:body===undefined?undefined:JSON.stringify(body)}),team?teams:rooms,now);return {status:response.status,data:await response.json()};}
const combinations=new Set();let seed=91;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<200;i++){const g=draftDuelSkills({},['player','cpu'],'skills',random);for(const offered of Object.values(g.skillOffers)){assert.equal(new Set(offered).size,3);assert(offered.every(id=>DUEL_CHARACTERS.some(s=>s.id===id)));combinations.add([...offered].sort().join(','));}}
assert.equal(combinations.size,4,'four skills give four distinct three-skill draws');
for(const controlled of ['ec','ev'])for(const rounds of [5,12])for(const skill of DUEL_CHARACTERS){
 const g={...makeTerminalDuel(controlled,terminalGoalsForMode('types')),round:2,roundLimit:rounds,started:true,active:true,stage:'plan',playerBudget:9};draftDuelSkills(g,['player','cpu'],'skills',()=>.5);g.skillOffers.player=[skill.id];selectDuelSkill(g,'player',skill.id);
 const action=duelActions(g,'player').find(a=>a.skill===skill.id);assert(action,skill.id+' has a legal move');const info=duelActionInfo(g,'player',action),resolved=resolveTerminalDuel(g,action,{kind:'hold',direction:1,amount:0});assert.equal(info.cost,skill.id==='split'?3:skill.id==='charge'?0:1);assert.equal(resolved.skillUsed.player,true);assert.throws(()=>duelActionInfo(resolved,'player',action));assert.throws(()=>duelActionInfo({...g,abilityMode:'classic'},'player',action));assert.throws(()=>duelActionInfo({...g,round:1},'player',action));
}
// Classic and skill casual queues must not consume one another's waiting entry.
const classic=(await req(false,'/match',{abilityMode:'classic'})).data,skills=(await req(false,'/match',{abilityMode:'skills'})).data;assert.notEqual(classic.view.code,skills.view.code);assert.equal(skills.view.stage,'lobby');
const peer=(await req(false,'/match',{abilityMode:'skills'})).data;assert.equal(peer.view.code,skills.view.code);assert.equal(peer.view.skills.offers.length,3);assert.equal(peer.view.skills.enabled,true);assert(!JSON.stringify(peer.view).includes('skillOffers'));
const offered=skills.view.skills.offers,missing=DUEL_CHARACTERS.find(s=>!offered.includes(s.id)).id;assert.equal((await req(false,'/'+skills.view.code+'/role',op({round:1,controlled:'ec',character:missing}),skills.token)).status,400);
assert.equal((await req(false,'/'+skills.view.code+'/role',op({round:1,controlled:'ec',character:offered[0]}),skills.token)).status,200);const second=await req(false,'/'+peer.view.code+'/role',op({round:1,controlled:'ev',character:peer.view.skills.offers[0]}),peer.token);assert.equal(second.data.skills.opponent,offered[0]);
const classicPeer=(await req(false,'/match',{abilityMode:'classic'})).data;assert.equal(classicPeer.view.code,classic.view.code);assert.equal(classicPeer.view.skills.enabled,false);assert.deepEqual(classicPeer.view.skills.offers,[]);
assert.equal((await req(false,'/ranked',{abilityMode:'skills'},null,'rank-one')).status,400);assert.equal((await req(true,'',{queue:'ranked',abilityMode:'skills'},null,'rank-team')).status,400);
// Four independent offers, legal use, sealed usage state and public selected abilities.
const created=(await req(true,'',{abilityMode:'skills',rounds:5})).data,code=created.view.code,tokens={ae:created.token};for(const slot of ['av','be','bv'])tokens[slot]=(await req(true,'/'+code+'/join',{})).data.token;
for(const slot of TEAM_SLOTS){let v=(await req(true,'/'+code,undefined,tokens[slot.id])).data;assert.equal(v.skills.offers.length,3);assert.equal((await req(true,'/'+code+'/ready',op({round:1,ready:true}),tokens[slot.id])).status,409);assert.equal((await req(true,'/'+code+'/skill',op({skill:v.skills.offers[0]}),tokens[slot.id])).status,200);}
for(const slot of TEAM_SLOTS)await req(true,'/'+code+'/ready',op({round:1,ready:true}),tokens[slot.id]);assert.equal((await req(true,'/'+code+'/start',op(),tokens.ae)).status,200);
for(const slot of TEAM_SLOTS)assert.equal((await req(true,'/'+code+'/lock',op({round:1,sequence:1,action:{ec:0,ev:0,[slot.field]:1}}),tokens[slot.id])).status,200);
for(const slot of TEAM_SLOTS)await req(true,'/'+code+'/next',op({round:1}),tokens[slot.id]);let record=await teams.get(code);
for(const slot of TEAM_SLOTS){const action=teamSkillActions(record.game,slot.id)[0];assert(action);assert.equal((await req(true,'/'+code+'/lock',op({round:2,sequence:1,action}),tokens[slot.id])).status,200);if(slot.id!=='bv')assert.equal((await req(true,'/'+code,undefined,tokens[slot.id])).data.skills.yourUsed,false,'ability consumption remains sealed until reveal');}
record=await teams.get(code);for(const slot of TEAM_SLOTS)assert.equal(record.game.skillUsed[slot.id],true);assert.equal(record.game.history.length,2);const visible=teamView(record,'ae');assert.equal(visible.mvp,null);assert.equal(visible.players.filter(p=>p.skill).length,4);assert(!('skillOffers' in visible));
// Ranked/classic core rejects skill actions even if a client forges a known skill.
const rank=(await req(true,'',{queue:'ranked'},null,'ranked-a')).data;assert.equal(rank.view.skills.enabled,false);assert.equal((await req(true,'/'+rank.view.code+'/skill',op({skill:'split'}),rank.token)).status,409);
// Skill and classic four-player queues remain separate until each has four players.
const queued={classic:[],skills:[]};for(const mode of ['classic','skills'])for(let i=0;i<3;i++){const x=await req(true,'',{queue:'random',abilityMode:mode},null,'isolation-'+mode+'-'+i);assert.equal(x.status,201);assert.equal(x.data.view.stage,'queue');queued[mode].push(x.data);}
const skillFourth=await req(true,'',{queue:'random',abilityMode:'skills'},null,'isolation-skills-3');assert.equal(skillFourth.data.view.stage,'lobby');for(const c of queued.classic)assert.equal((await req(true,'/'+c.view.code,undefined,c.token)).data.stage,'queue');for(const c of queued.skills){const v=(await req(true,'/'+c.view.code,undefined,c.token)).data;assert.equal(v.stage,'lobby');assert.equal(v.skills.enabled,true);}
const classicFourth=await req(true,'',{queue:'random',abilityMode:'classic'},null,'isolation-classic-3');assert.equal(classicFourth.data.view.stage,'lobby');assert.equal(classicFourth.data.view.skills.enabled,false);
// MVP belongs to the winning team and is stable across reconstruction and draws.
const r={code:'MVP222',matchId:'mvp-fixture',stage:'plan',goals:{a:'Type I',b:'Type II'},game:{rulesVersion:3,round:5,roundLimit:5,board:{aEc:0,aEv:0,bEc:0,bEv:0},budgets:{ae:12,av:12,be:12,bv:12},history:[]},drafts:{ae:{ec:-2,ev:0},av:{ec:0,ev:2},be:{ec:0,ev:0},bv:{ec:0,ev:0}},autoLocks:[]};resolveTeamRound(r);assert.equal(r.game.history.at(-1).decision.winner,'a');const mvp=teamMvp(r);assert(mvp&&['ae','av'].includes(mvp.slot));assert.equal(mvp.decisive,true);assert.deepEqual(teamMvp(structuredClone(r)),mvp);r.game.history.at(-1).decision.winner='draw';assert.equal(teamMvp(r),null);
console.log('Passed: random three-of-four offers, private offers/public choices, both bands and lengths, skill costs and once-only use, rank/classic guards, separate casual queues, 2v2 drafting and sealed usage, deterministic winning-team MVP and no draw MVP.');sqlite.close();
