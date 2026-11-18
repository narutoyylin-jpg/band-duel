import {D1TeamStore,handleTeamRequest} from './team-service.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {D1SocialStore,handleSocialRequest} from './social.mjs';
import {D1RoomStore,handleRoomRequest} from './rooms-service.mjs';
import {D1EconomyStore,handleShopRequest} from './economy.mjs';
import {D1RankingStore,handleRankingRequest} from './ranking.mjs';
import {loadPlaywright} from './scripts/optional-tools.mjs';
const {chromium}=await loadPlaywright();
const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('standalone/schema.sql','utf8'));
const db={prepare(sql){let v=[];return {bind(...values){v=values;return this;},first(){return sqlite.prepare(sql).get(...v)||null;},all(){return {results:sqlite.prepare(sql).all(...v)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...v).changes)}};}};},batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
let testClockOffset=0;const teams=new D1TeamStore(db);const social=new D1SocialStore(db),rooms=new D1RoomStore(db),economy=new D1EconomyStore(db),ranking=new D1RankingStore(db),errors=[];
for(const [id,name] of [['qa-alice','Alice'],['qa-bob','Bob'],['qa-cara','Cara'],['qa-dan','Dan']])await ranking.rename(id,name,Date.now());
const server=http.createServer(async(req,res)=>{
 try{
  const base='http://127.0.0.1:'+server.address().port,url=new URL(req.url,base),headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  headers.delete('oai-authenticated-user-id');if(req.headers['x-test-player'])headers.set('oai-authenticated-user-id',String(req.headers['x-test-player']));
  const body=[];for await(const chunk of req)body.push(chunk);const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(body)}:{})});let response;
  if(url.pathname.startsWith('/api/team-rooms'))response=await handleTeamRequest(request,teams,Date.now()+testClockOffset);
  else if(url.pathname.startsWith('/api/friends'))response=await handleSocialRequest(request,social);
  else if(url.pathname.startsWith('/api/rooms'))response=await handleRoomRequest(request,rooms,Date.now()+testClockOffset);
  else if(url.pathname.startsWith('/api/shop'))response=await handleShopRequest(request,economy);
  else if(url.pathname==='/api/leaderboard')response=await handleRankingRequest(request,ranking);
  else if(url.pathname==='/api/auth/config')response=Response.json({provider:'google',configured:true,signedIn:true});
  else if(url.pathname==='/play'||url.pathname==='/')response=new Response(fs.readFileSync('phone.html'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
  else{
   const root=path.resolve('public'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
   if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){const mime={'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.js':'text/javascript','.webmanifest':'application/manifest+json','.html':'text/html; charset=utf-8'}[path.extname(file)]||'application/octet-stream';response=new Response(fs.readFileSync(file),{headers:{'Content-Type':mime}});}else response=new Response('Not found',{status:404});
  }
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){errors.push(String(e.stack||e));res.writeHead(500);res.end('Test server error');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{

 const pages=[];for(const id of ['qa-alice','qa-bob','qa-cara','qa-dan']){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',extraHTTPHeaders:{'x-test-player':id}});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const p=await context.newPage();p.setDefaultTimeout(18000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/play');await p.locator('[data-match-format="2v2"]').click();pages.push(p);
 }
 const [alice,bob,cara,dan]=pages;
 async function startSolo(p){await p.locator('#match').click();await p.locator('#teamMatchSolo').click();}
 async function playMatch(){
  await Promise.all(pages.map(p=>p.locator('#teamReady').click()));await Promise.all(pages.map(p=>p.locator('#teamLock:enabled').waitFor()));
  for(let round=1;round<=5;round++){await Promise.all(pages.map(p=>p.locator('#teamLock').click()));if(round===5){await Promise.all(pages.map(p=>p.locator('#teamFinal').waitFor({state:'visible'})));break;}await Promise.all(pages.map(p=>p.locator('#teamNext:enabled').waitFor()));await Promise.all(pages.map(p=>p.locator('#teamNext').click()));await Promise.all(pages.map(p=>p.locator('#teamLock:enabled').waitFor()));}
 }
 await startSolo(alice);await alice.locator('#waitingLesson').waitFor({state:'visible'});await alice.locator('#waitingLessonCaption').filter({hasText:/./}).waitFor();await alice.screenshot({path:'output/band-duel-team-queue-mobile.png',fullPage:true});
 await alice.locator('#waitingPractice').click();await alice.locator('#teamRoster .avatar-robot').first().waitFor();assert.equal(await alice.locator('#teamRoster .avatar-robot').count(),3);assert.equal(await alice.locator('#queuePracticeBanner').isVisible(),true);
 for(const p of [bob,cara,dan])await startSolo(p);await Promise.all(pages.map(p=>p.locator('#teamRoster').waitFor({state:'visible'})));assert.equal(await alice.locator('#queuePracticeBanner').isVisible(),false,'matched players leave CPU practice automatically');
 assert.equal(new Set(await Promise.all(pages.map(p=>p.locator('#teamCode').innerText()))).size,1);await alice.screenshot({path:'output/band-duel-team-random-lobby.png',fullPage:true});await playMatch();await Promise.all(pages.map(async p=>{await p.locator('#verdict[open]').waitFor();await p.locator('#verdictConfirm:enabled').click();await p.locator('#verdict').waitFor({state:'hidden'});}));
 for(const id of ['qa-alice','qa-bob','qa-cara','qa-dan'])assert.equal((await ranking.profile(id)).games,0,'casual team games do not change ranked stats');assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM duel_rating_events').get().n,0);await Promise.all(pages.map(p=>p.locator('#teamBack').click()));
 // Friend invites are local synthetic test players, never real accounts.
 for(const [a,b] of [['qa-alice','qa-bob'],['qa-cara','qa-dan']]){await social.ensure(a,Date.now());await social.ensure(b,Date.now());await social.request(a,b,Date.now());await social.change(b,a,'accept',Date.now());}
 async function party(leader,mate,mateName){
  await leader.locator('#rankedMatch').click();await leader.locator('#teamMatchParty').click();await leader.locator('#friends').waitFor({state:'visible'});await leader.locator('.friend-row').filter({hasText:mateName}).locator('[data-social-op="invite"]').click();await leader.locator('#friendsClose').click();
  await mate.locator('#friendsOpen').click();await mate.locator('[data-join-invite]').first().click();await mate.locator('#teamRoster').waitFor({state:'visible'});await leader.locator('.team-seat').filter({hasText:mateName}).waitFor();
  await Promise.all([leader,mate].map(p=>p.locator('#teamReady').click()));await leader.locator('#teamStart:enabled').click();
 }
 await party(alice,bob,'Bob');await alice.locator('#waiting').waitFor({state:'visible'});await party(cara,dan,'Dan');await Promise.all(pages.map(p=>p.locator('#teamRoster').waitFor({state:'visible'})));
 const views=await Promise.all(pages.map(p=>p.evaluate(()=>ui.data)));assert.equal(views[0].yourTeam,views[1].yourTeam);assert.equal(views[2].yourTeam,views[3].yourTeam);assert.notEqual(views[0].yourTeam,views[2].yourTeam);assert(views.every(v=>v.ranked));await alice.screenshot({path:'output/band-duel-team-ranked-lobby.png',fullPage:true});
 await playMatch();await Promise.all(pages.map(async p=>{await p.locator('#verdict[open]').waitFor();await p.locator('#verdictConfirm:enabled').click();await p.locator('#verdict').waitFor({state:'hidden'});}));await alice.screenshot({path:'output/band-duel-team-ranked-result.png',fullPage:true});
 for(const [i,id] of ['qa-alice','qa-bob','qa-cara','qa-dan'].entries()){const profile=await ranking.profile(id);assert.equal(profile.games,1);const v=await pages[i].evaluate(()=>ui.data);assert.equal(profile.rating,v.ratingResult.after);assert((await pages[i].locator('#teamFinal').innerText()).includes('積分'));}
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM duel_rating_events WHERE format='2v2' AND settled=1").get().n,1);await Promise.all(pages.map(p=>p.locator('#teamBack').click()));await alice.locator('#leaderboardOpen').click();await alice.locator('#leaderboardBody tr').first().waitFor();assert.equal(await alice.locator('#leaderboardBody tr').count(),4);assert.deepEqual(errors,[]);
 console.log('Passed: four mobile solo queues, inline animated waiting tips, CPU practice handoff, complete casual game, two accepted friend parties, fixed teammates, ranked auto-start, full rated game, shared leaderboard and per-player rating results.');
}finally{await browser.close();await new Promise(r=>server.close(r));sqlite.close();}
